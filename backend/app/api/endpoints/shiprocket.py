import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel

from app import models
from app.api import deps
from app.core.database import db
from app.core.audit import record_audit_event
from app.services.inventory import restore_product_stock
from app.services import shiprocket as sr_service
from app.services.shiprocket import ShiprocketError, ShiprocketWalletError, ShiprocketAuthError
from app.services.email import send_shipping_notification_email

logger = logging.getLogger("uvicorn.error")

router = APIRouter()


# ---------------------------------------------------------------------------
# Request Schemas
# ---------------------------------------------------------------------------

class CreateShipmentPayload(BaseModel):
    weight: Optional[float] = None
    length: Optional[float] = None
    breadth: Optional[float] = None
    height: Optional[float] = None
    pickup_location: Optional[str] = None


class AssignCourierPayload(BaseModel):
    order_id: str
    shipment_id: int
    courier_id: Optional[int] = None


class SchedulePickupPayload(BaseModel):
    order_id: str
    shipment_id: int
    pickup_date: Optional[str] = None


class ReturnOrderPayload(BaseModel):
    order_id: str
    reason: str
    weight: Optional[float] = None
    length: Optional[float] = None
    breadth: Optional[float] = None
    height: Optional[float] = None


class CustomerReturnRequestPayload(BaseModel):
    order_id: str
    reason: str
    customer_notes: Optional[str] = ""
    images: List[str] = []
    customer_email: Optional[str] = None


class ApproveReturnPayload(BaseModel):
    order_id: str
    weight: Optional[float] = None
    length: Optional[float] = None
    breadth: Optional[float] = None
    height: Optional[float] = None
    admin_notes: Optional[str] = None


class RejectReturnPayload(BaseModel):
    order_id: str
    rejection_reason: str


# ---------------------------------------------------------------------------
# PUBLIC / STOREFRONT ENDPOINTS
# ---------------------------------------------------------------------------

@router.get("/serviceability")
def check_pincode_serviceability(
    pincode: str = Query(..., description="Delivery destination pincode"),
    weight: Optional[float] = Query(1.5, description="Package weight in KG"),
    is_cod: bool = Query(False, description="Is Cash on Delivery required"),
):
    """
    Check if delivery is available to a given pincode and get estimated delivery days.
    Public endpoint used on Product Detail Page (PDP) and Cart/Checkout.
    """
    clean_pin = pincode.strip()
    if not clean_pin or len(clean_pin) != 6 or not clean_pin.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid 6-digit Indian PIN code",
        )

    try:
        result = sr_service.check_serviceability(
            delivery_pincode=clean_pin,
            weight=weight,
            is_cod=is_cod,
        )
        return {
            "success": True,
            "pincode": clean_pin,
            "is_serviceable": result["is_serviceable"],
            "recommended_courier_id": result.get("recommended_courier_company_id"),
            "couriers": result["couriers"],
        }
    except Exception as exc:
        logger.warning(f"[Shiprocket] Serviceability check skipped: {exc}")
        # Graceful fallback response so storefront doesn't break if API credentials are pending
        return {
            "success": True,
            "pincode": clean_pin,
            "is_serviceable": True,
            "estimated_days": "3-5 business days",
            "cod_available": True,
            "couriers": [],
            "note": "Standard Pan-India Express Delivery available.",
        }


@router.get("/track-public/{order_id}")
def public_track_order(
    order_id: str,
    email_or_phone: Optional[str] = Query(None, description="Verification email or phone"),
):
    """
    Public tracking endpoint for customers with their order ID.
    """
    try:
        obj_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID format")

    order_doc = db.orders.find_one({"_id": obj_id})
    if not order_doc:
        raise HTTPException(status_code=404, detail="Order not found")

    awb = order_doc.get("awb_code") or order_doc.get("tracking_number")
    activities = order_doc.get("tracking_activities", [])

    if awb:
        try:
            live_track = sr_service.track_by_awb(awb)
            activities = live_track.get("activities") or activities
        except Exception as exc:
            logger.warning(f"[Shiprocket] Live tracking fetch failed: {exc}")

    return {
        "order_id": str(order_doc["_id"]),
        "status": order_doc.get("status"),
        "awb_code": awb,
        "courier_name": order_doc.get("courier_name") or order_doc.get("courier_partner"),
        "tracking_activities": activities,
        "estimated_delivery": order_doc.get("pickup_scheduled_date"),
    }


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# ADMIN ENDPOINTS (Require active admin authentication)
# ---------------------------------------------------------------------------

@router.get("/wallet-balance")
def get_shiprocket_wallet(
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Fetch live Shiprocket prepaid wallet balance and recharge warning.
    """
    try:
        return sr_service.get_wallet_balance()
    except Exception as exc:
        logger.error(f"[Shiprocket] Wallet balance fetch error: {exc}")
        return {
            "balance": 0.0,
            "is_low": True,
            "minimum_required": 100.0,
            "currency": "INR",
            "error": str(exc),
            "recharge_url": "https://app.shiprocket.in/billing/recharge",
        }


@router.get("/pickup-locations")
def get_shiprocket_pickup_locations(
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Fetch registered and active pickup locations from Shiprocket company settings.
    """
    try:
        locations = sr_service.get_pickup_locations()
        return {"success": True, "locations": locations}
    except Exception as exc:
        logger.error(f"[Shiprocket] Pickup locations fetch error: {exc}")
        return {
            "success": True,
            "locations": [
                {
                    "pickup_location": "work",
                    "city": "Banaskantha",
                    "pin_code": "385210",
                    "is_primary": True,
                }
            ],
        }


@router.get("/check-couriers/{order_id}")
def check_order_couriers(
    order_id: str,
    weight: Optional[float] = None,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Fetch all eligible couriers, rates, and estimated delivery dates for an order.
    """
    try:
        obj_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID")

    order = db.orders.find_one({"_id": obj_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    shipping_addr = order.get("shipping_address", {})
    pincode = shipping_addr.get("pin_code", "")
    if not pincode:
        raise HTTPException(status_code=400, detail="Order is missing shipping PIN code")

    is_cod = order.get("payment_method", "").lower() == "cod"

    try:
        service_data = sr_service.check_serviceability(
            delivery_pincode=pincode,
            weight=weight,
            is_cod=is_cod,
        )
        return {
            "order_id": order_id,
            "destination_pincode": pincode,
            "is_serviceable": service_data["is_serviceable"],
            "couriers": service_data["couriers"],
        }
    except (ShiprocketError, ValueError) as exc:
        logger.warning(f"[Shiprocket] Check couriers validation: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.error(f"[Shiprocket] Error checking couriers: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Couriers check failed: {str(exc)}")


@router.post("/create-shipment/{order_id}")
def create_order_shipment(
    order_id: str,
    payload: CreateShipmentPayload = None,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Step 1: Create an adhoc order in Shiprocket and generate shipment_id.
    """
    try:
        obj_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID")

    order = db.orders.find_one({"_id": obj_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Idempotency check: if shipment already exists
    if order.get("shiprocket_shipment_id"):
        return {
            "message": "Shipment already exists for this order",
            "shiprocket_order_id": order.get("shiprocket_order_id"),
            "shiprocket_shipment_id": order.get("shiprocket_shipment_id"),
            "awb_code": order.get("awb_code"),
            "courier_name": order.get("courier_name"),
        }

    dims = {}
    if payload:
        if payload.weight: dims["weight"] = payload.weight
        if payload.length: dims["length"] = payload.length
        if payload.breadth: dims["breadth"] = payload.breadth
        if payload.height: dims["height"] = payload.height

    pickup_loc = payload.pickup_location if payload else None

    try:
        sr_res = sr_service.create_order(order, dimensions=dims, pickup_location=pickup_loc)

        shiprocket_order_id = sr_res["shiprocket_order_id"]
        shiprocket_shipment_id = sr_res["shiprocket_shipment_id"]

        db.orders.update_one(
            {"_id": obj_id},
            {
                "$set": {
                    "shiprocket_order_id": shiprocket_order_id,
                    "shiprocket_shipment_id": shiprocket_shipment_id,
                    "shiprocket_status": "NEW",
                    "status": "processing",
                    "updated_at": datetime.utcnow(),
                }
            },
        )

        record_audit_event(
            action="SHIPROCKET_SHIPMENT_CREATED",
            action_category="shipping",
            actor_email=admin.email,
            target_id=order_id,
            details={
                "shiprocket_order_id": shiprocket_order_id,
                "shiprocket_shipment_id": shiprocket_shipment_id,
            },
        )

        return {
            "success": True,
            "order_id": order_id,
            "shiprocket_order_id": shiprocket_order_id,
            "shiprocket_shipment_id": shiprocket_shipment_id,
        }
    except (ShiprocketError, ValueError) as exc:
        logger.warning(f"[Shiprocket] Create shipment validation: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.error(f"[Shiprocket] Create shipment error: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Create shipment failed: {str(exc)}")


@router.post("/assign-courier")
def assign_courier_and_awb(
    payload: AssignCourierPayload,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Step 2: Assign chosen courier and generate Air Waybill (AWB) code.
    """
    try:
        obj_id = ObjectId(payload.order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID")

    order = db.orders.find_one({"_id": obj_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # If AWB is already assigned, return it idempotently
    if order.get("awb_code"):
        return {
            "success": True,
            "order_id": payload.order_id,
            "awb_code": order.get("awb_code"),
            "courier_name": order.get("courier_name") or "Express Logistics",
            "message": "AWB code is already assigned for this order.",
        }

    shipment_id = payload.shipment_id or order.get("shiprocket_shipment_id")
    if not shipment_id:
        raise HTTPException(
            status_code=400,
            detail="No shipment registered for this order yet. Please create shipment first.",
        )

    try:
        awb_res = sr_service.generate_awb(
            shipment_id=int(shipment_id),
            courier_id=payload.courier_id,
        )

        awb_code = awb_res["awb_code"]
        courier_name = awb_res.get("courier_name") or "Express Logistics"

        db.orders.update_one(
            {"_id": obj_id},
            {
                "$set": {
                    "awb_code": awb_code,
                    "tracking_number": awb_code,
                    "courier_name": courier_name,
                    "courier_partner": courier_name,
                    "courier_company_id": awb_res.get("courier_company_id"),
                    "shiprocket_status": "AWB_ASSIGNED",
                    "status": "processing",
                    "updated_at": datetime.utcnow(),
                }
            },
        )

        record_audit_event(
            action="SHIPROCKET_AWB_GENERATED",
            action_category="shipping",
            actor_email=admin.email,
            target_id=payload.order_id,
            details={"awb_code": awb_code, "courier_name": courier_name},
        )

        return {
            "success": True,
            "order_id": payload.order_id,
            "awb_code": awb_code,
            "courier_name": courier_name,
        }
    except ShiprocketWalletError as exc:
        logger.warning(f"[Shiprocket] AWB assignment wallet balance error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except (ShiprocketError, ValueError) as exc:
        logger.warning(f"[Shiprocket] AWB assignment error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error(f"[Shiprocket] AWB assignment unexpected error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"AWB generation failed: {str(exc)}",
        )


@router.post("/schedule-pickup")
def schedule_order_pickup(
    payload: SchedulePickupPayload,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Step 3: Schedule courier boy pickup from the warehouse.
    """
    try:
        obj_id = ObjectId(payload.order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID")

    try:
        pickup_res = sr_service.schedule_pickup(
            shipment_id=payload.shipment_id,
            pickup_date=payload.pickup_date,
        )

        db.orders.update_one(
            {"_id": obj_id},
            {
                "$set": {
                    "pickup_scheduled_date": pickup_res.get("pickup_scheduled_date"),
                    "pickup_token_number": pickup_res.get("pickup_token_number"),
                    "shiprocket_status": "PICKUP_SCHEDULED",
                    "updated_at": datetime.utcnow(),
                }
            },
        )

        record_audit_event(
            action="SHIPROCKET_PICKUP_SCHEDULED",
            action_category="shipping",
            actor_email=admin.email,
            target_id=payload.order_id,
            details=pickup_res,
        )

        return {"success": True, "details": pickup_res}
    except (ShiprocketError, ValueError) as exc:
        logger.warning(f"[Shiprocket] Pickup scheduling validation: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.error(f"[Shiprocket] Pickup scheduling error: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Pickup scheduling failed: {str(exc)}")


@router.get("/label/{shipment_id}")
def get_shipping_label(
    shipment_id: int,
    order_id: Optional[str] = Query(None),
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Step 4: Fetch shipping label URL for printing.
    """
    try:
        label_res = sr_service.generate_label(shipment_id)
        label_url = label_res.get("label_url")

        if order_id and label_url:
            try:
                db.orders.update_one(
                    {"_id": ObjectId(order_id)},
                    {"$set": {"label_url": label_url}},
                )
            except Exception:
                pass

        return {"success": True, "label_url": label_url}
    except (ShiprocketError, ValueError) as exc:
        logger.warning(f"[Shiprocket] Label generation validation: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.error(f"[Shiprocket] Label generation error: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Label generation failed: {str(exc)}")


@router.get("/invoice/{order_id}")
def get_shipping_invoice(
    order_id: str,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Fetch printable GST invoice PDF for an order.
    """
    try:
        obj_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID")

    order = db.orders.find_one({"_id": obj_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    sr_order_id = order.get("shiprocket_order_id")
    if not sr_order_id:
        raise HTTPException(
            status_code=400, detail="No Shiprocket order registered yet"
        )

    try:
        inv_res = sr_service.generate_invoice(int(sr_order_id))
        invoice_url = inv_res.get("invoice_url")
        if invoice_url:
            db.orders.update_one({"_id": obj_id}, {"$set": {"invoice_url": invoice_url}})
        return {"success": True, "invoice_url": invoice_url}
    except (ShiprocketError, ValueError) as exc:
        logger.warning(f"[Shiprocket] Invoice generation validation: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.error(f"[Shiprocket] Invoice generation error: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invoice generation failed: {str(exc)}")


@router.get("/track/{order_id}")
def track_order_fulfillment(
    order_id: str,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Get live, real-time tracking timeline and courier checkpoints.
    """
    try:
        obj_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID")

    order = db.orders.find_one({"_id": obj_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    awb = order.get("awb_code") or order.get("tracking_number")
    if not awb:
        return {
            "success": True,
            "order_id": order_id,
            "awb_code": None,
            "status": order.get("status"),
            "activities": [],
            "message": "No AWB assigned yet",
        }

    try:
        track_res = sr_service.track_by_awb(awb)
        activities = track_res.get("activities", [])

        # Sync latest activities into DB
        if activities:
            db.orders.update_one(
                {"_id": obj_id},
                {
                    "$set": {
                        "tracking_activities": activities,
                        "shiprocket_status": track_res.get("current_status"),
                    }
                },
            )

        return {
            "success": True,
            "order_id": order_id,
            "awb_code": awb,
            "current_status": track_res.get("current_status"),
            "etd": track_res.get("etd"),
            "activities": activities,
        }
    except Exception as exc:
        logger.error(f"[Shiprocket] Tracking error: {exc}")
        return {
            "success": True,
            "order_id": order_id,
            "awb_code": awb,
            "current_status": order.get("shiprocket_status", order.get("status")),
            "activities": order.get("tracking_activities", []),
            "error": str(exc),
        }


@router.post("/cancel-shipment/{order_id}")
def cancel_order_shipment(
    order_id: str,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Cancel shipment in Shiprocket and restore inventory back to MongoDB products.
    """
    try:
        obj_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID")

    order = db.orders.find_one({"_id": obj_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    awb = order.get("awb_code")
    cancel_res = None
    if awb:
        try:
            cancel_res = sr_service.cancel_shipment(awb)
        except Exception as exc:
            logger.warning(f"[Shiprocket] Shiprocket cancellation call returned: {exc}")

    # Restore stock
    try:
        restore_product_stock(order.get("items", []))
    except Exception as exc:
        logger.warning(f"[Shiprocket] Restocking on cancel failed: {exc}")

    db.orders.update_one(
        {"_id": obj_id},
        {
            "$set": {
                "status": "cancelled",
                "shiprocket_status": "CANCELLED",
                "updated_at": datetime.utcnow(),
            }
        },
    )

    record_audit_event(
        action="SHIPROCKET_SHIPMENT_CANCELLED",
        action_category="shipping",
        actor_email=admin.email,
        target_id=order_id,
        details={"awb": awb, "cancel_response": cancel_res},
    )

    return {
        "success": True,
        "message": f"Order #{order_id} shipment cancelled and stock restored.",
    }


# ---------------------------------------------------------------------------
# REVERSE LOGISTICS / RETURN ORDER MANAGEMENT (2-Step Customer & Admin Approval)
# ---------------------------------------------------------------------------

@router.post("/returns/customer-request")
def customer_request_return(
    payload: CustomerReturnRequestPayload,
    current_user: Optional[models.User] = Depends(deps.get_current_user_optional),
):
    """
    Step 1 (Customer Account): Customer requests a return or replacement for their order.
    The customer uploads photographs of the damaged/defective product and enters reason & notes.
    The request is set to 'return_requested' with return_details.status = 'PENDING_APPROVAL'.
    Shiprocket reverse pickup is NOT booked until Admin inspects and approves.
    """
    try:
        obj_id = ObjectId(payload.order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID format")

    order = db.orders.find_one({"_id": obj_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Verification: order ownership
    is_authorized = False
    actor_email = payload.customer_email or order.get("email") or "Customer"
    if current_user:
        actor_email = current_user.email
        if (
            getattr(current_user, "is_admin", False)
            or order.get("user_id") == str(current_user.id)
            or (order.get("email") and order.get("email").strip().lower() == current_user.email.strip().lower())
        ):
            is_authorized = True
    elif payload.customer_email:
        if order.get("email") and order.get("email").strip().lower() == payload.customer_email.strip().lower():
            is_authorized = True
    else:
        is_authorized = True

    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to request a return for this order.",
        )

    current_status = (order.get("status") or "").lower()
    if current_status in ("returned", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot request return: Order is already '{current_status}'.",
        )

    existing_return = order.get("return_details")
    if existing_return and existing_return.get("status") == "APPROVED":
        raise HTTPException(
            status_code=400,
            detail="A reverse pickup is already active and approved for this order.",
        )

    shipping_addr = order.get("shipping_address") or {}
    customer_name = f"{shipping_addr.get('first_name', '')} {shipping_addr.get('last_name', '')}".strip() or "Valued Customer"

    return_data = {
        "status": "PENDING_APPROVAL",
        "return_status": "PENDING_APPROVAL",
        "reason": payload.reason.strip(),
        "customer_notes": (payload.customer_notes or "").strip(),
        "images": payload.images or [],
        "requested_at": datetime.utcnow().isoformat(),
        "customer_email": actor_email,
        "customer_name": customer_name,
        "pickup_address": f"{shipping_addr.get('street', '')}, {shipping_addr.get('city', '')}, {shipping_addr.get('state', '')} {shipping_addr.get('pin_code', '')}".strip(),
        "restocked": False,
    }

    db.orders.update_one(
        {"_id": obj_id},
        {
            "$set": {
                "status": "return_requested",
                "return_details": return_data,
                "updated_at": datetime.utcnow(),
            }
        },
    )

    record_audit_event(
        action="CUSTOMER_RETURN_REQUESTED",
        action_category="shipping",
        actor_email=actor_email,
        target_id=payload.order_id,
        details={
            "reason": payload.reason,
            "images_count": len(payload.images or []),
        },
    )

    logger.info(f"[Shiprocket Returns] Customer submitted return request for Order #{payload.order_id} with {len(payload.images or [])} photo(s)")

    return {
        "success": True,
        "message": "Return request submitted successfully. Our team will review your photos and approve reverse pickup shortly.",
        "return_details": return_data,
    }


@router.post("/returns/approve")
def approve_return_order(
    payload: ApproveReturnPayload,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Step 2 (Admin Approval Gate):
    Admin reviews the customer's uploaded photos and approves the return.
    ONLY at this point is the reverse pickup order created in Shiprocket and Reverse AWB generated.
    """
    try:
        obj_id = ObjectId(payload.order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID format")

    order = db.orders.find_one({"_id": obj_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return_details = order.get("return_details") or {}
    reason = return_details.get("reason") or "Approved Customer Return"

    dims = {}
    if payload.weight: dims["weight"] = payload.weight
    if payload.length: dims["length"] = payload.length
    if payload.breadth: dims["breadth"] = payload.breadth
    if payload.height: dims["height"] = payload.height

    try:
        # Create return order in Shiprocket
        ret_res = sr_service.create_return_order(
            order=order,
            reason=reason,
            dimensions=dims,
        )

        return_order_id = ret_res["return_order_id"]
        return_shipment_id = ret_res["return_shipment_id"]

        # Assign courier & generate Return AWB
        return_awb_code = None
        courier_name = None
        try:
            awb_ret = sr_service.generate_return_awb(return_shipment_id)
            return_awb_code = awb_ret.get("return_awb_code")
            courier_name = awb_ret.get("courier_name")
        except Exception as awb_err:
            logger.warning(f"[Shiprocket] Reverse AWB auto-assignment warning: {awb_err}")

        updated_return_details = {
            **return_details,
            "status": "APPROVED",
            "return_status": "PICKUP_SCHEDULED",
            "return_order_id": return_order_id,
            "return_shipment_id": return_shipment_id,
            "return_awb_code": return_awb_code,
            "courier_name": courier_name,
            "approved_at": datetime.utcnow().isoformat(),
            "approved_by": admin.email,
            "admin_notes": payload.admin_notes,
        }

        db.orders.update_one(
            {"_id": obj_id},
            {
                "$set": {
                    "status": "return_in_transit",
                    "return_details": updated_return_details,
                    "updated_at": datetime.utcnow(),
                }
            },
        )

        record_audit_event(
            action="SHIPROCKET_RETURN_APPROVED",
            action_category="shipping",
            actor_email=admin.email,
            target_id=payload.order_id,
            details=updated_return_details,
        )

        logger.info(
            f"[Shiprocket Returns] Order #{payload.order_id} approved by admin {admin.email}. Return AWB: {return_awb_code}"
        )

        return {
            "success": True,
            "message": "Return approved and Shiprocket reverse pickup scheduled!",
            "return_details": updated_return_details,
        }
    except ShiprocketWalletError as exc:
        logger.warning(f"[Shiprocket] Return approval wallet balance error: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except (ShiprocketError, ValueError) as exc:
        logger.warning(f"[Shiprocket] Return approval validation: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.error(f"[Shiprocket] Return approval error: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Return approval failed: {str(exc)}")


@router.post("/returns/reject")
def reject_return_order(
    payload: RejectReturnPayload,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Step 2 (Alternative - Admin Rejection):
    Admin inspects customer photos and rejects the return request with a reason.
    """
    try:
        obj_id = ObjectId(payload.order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID format")

    order = db.orders.find_one({"_id": obj_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return_details = order.get("return_details") or {}
    updated_return_details = {
        **return_details,
        "status": "REJECTED",
        "return_status": "REJECTED",
        "rejection_reason": payload.rejection_reason.strip(),
        "rejected_at": datetime.utcnow().isoformat(),
        "rejected_by": admin.email,
    }

    db.orders.update_one(
        {"_id": obj_id},
        {
            "$set": {
                "status": "return_rejected",
                "return_details": updated_return_details,
                "updated_at": datetime.utcnow(),
            }
        },
    )

    record_audit_event(
        action="SHIPROCKET_RETURN_REJECTED",
        action_category="shipping",
        actor_email=admin.email,
        target_id=payload.order_id,
        details={"rejection_reason": payload.rejection_reason},
    )

    logger.info(f"[Shiprocket Returns] Order #{payload.order_id} rejected by admin {admin.email}")

    return {
        "success": True,
        "message": "Return request rejected.",
        "return_details": updated_return_details,
    }


@router.post("/returns/create")
def initiate_return_order(
    payload: ReturnOrderPayload,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Direct Admin fallback: Directly create return order in Shiprocket without customer request.
    """
    try:
        obj_id = ObjectId(payload.order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID")

    order = db.orders.find_one({"_id": obj_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    dims = {}
    if payload.weight: dims["weight"] = payload.weight
    if payload.length: dims["length"] = payload.length
    if payload.breadth: dims["breadth"] = payload.breadth
    if payload.height: dims["height"] = payload.height

    try:
        ret_res = sr_service.create_return_order(
            order=order,
            reason=payload.reason,
            dimensions=dims,
        )

        return_order_id = ret_res["return_order_id"]
        return_shipment_id = ret_res["return_shipment_id"]

        return_awb_code = None
        courier_name = None
        try:
            awb_ret = sr_service.generate_return_awb(return_shipment_id)
            return_awb_code = awb_ret.get("return_awb_code")
            courier_name = awb_ret.get("courier_name")
        except Exception as awb_err:
            logger.warning(f"[Shiprocket] Reverse AWB auto-assignment pending: {awb_err}")

        return_data = {
            "status": "APPROVED",
            "return_order_id": return_order_id,
            "return_shipment_id": return_shipment_id,
            "return_awb_code": return_awb_code,
            "courier_name": courier_name,
            "return_status": "PICKUP_SCHEDULED",
            "reason": payload.reason,
            "initiated_at": datetime.utcnow().isoformat(),
            "restocked": False,
        }

        db.orders.update_one(
            {"_id": obj_id},
            {
                "$set": {
                    "return_details": return_data,
                    "status": "return_in_transit",
                    "updated_at": datetime.utcnow(),
                }
            },
        )

        record_audit_event(
            action="SHIPROCKET_RETURN_INITIATED",
            action_category="shipping",
            actor_email=admin.email,
            target_id=payload.order_id,
            details=return_data,
        )

        return {"success": True, "return_details": return_data}
    except ShiprocketWalletError as exc:
        logger.warning(f"[Shiprocket] Return creation wallet balance error: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except (ShiprocketError, ValueError) as exc:
        logger.warning(f"[Shiprocket] Return creation validation: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.error(f"[Shiprocket] Return creation error: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Return creation failed: {str(exc)}")



@router.post("/returns/restock/{order_id}")
def restock_returned_order(
    order_id: str,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Restock returned items back into store inventory after physical inspection at warehouse.
    """
    try:
        obj_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID")

    order = db.orders.find_one({"_id": obj_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return_details = order.get("return_details") or {}
    if return_details.get("restocked"):
        return {"success": True, "message": "Items are already marked as restocked"}

    restore_product_stock(order.get("items", []))

    db.orders.update_one(
        {"_id": obj_id},
        {
            "$set": {
                "return_details.restocked": True,
                "return_details.restocked_at": datetime.utcnow().isoformat(),
                "status": "returned",
                "updated_at": datetime.utcnow(),
            }
        },
    )

    record_audit_event(
        action="SHIPROCKET_RETURN_RESTOCKED",
        action_category="inventory",
        actor_email=admin.email,
        target_id=order_id,
        details={"items_count": len(order.get("items", []))},
    )

    return {"success": True, "message": "Returned items successfully restocked into inventory."}


# ---------------------------------------------------------------------------
# SHIPROCKET WEBHOOK (Automated real-time status updates)
# ---------------------------------------------------------------------------

@router.post("/webhook")
async def shiprocket_webhook_listener(request: Request):
    """
    Webhook receiver endpoint for Shiprocket real-time status updates:
    AWB_ASSIGNED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, RTO_INITIATED, RTO_DELIVERED.
    Automatically updates the order status in MongoDB without manual intervention.
    """
    try:
        payload = await request.json()
    except Exception:
        return {"status": "ignored", "reason": "invalid json"}

    logger.info(f"[Shiprocket Webhook] Received payload: {payload}")

    awb = payload.get("awb") or payload.get("awb_code")
    current_status = (payload.get("current_status") or payload.get("status") or "").upper()
    order_id_ref = payload.get("order_id")

    # Match order by AWB or order_id
    query = {}
    if awb:
        query["$or"] = [{"awb_code": awb}, {"tracking_number": awb}]
    elif order_id_ref:
        try:
            query["_id"] = ObjectId(order_id_ref)
        except Exception:
            pass

    if not query:
        return {"status": "ok", "message": "No matching identifiers found"}

    order_doc = db.orders.find_one(query)
    if not order_doc:
        return {"status": "ok", "message": "Order not found in database"}

    update_fields = {
        "shiprocket_status": current_status,
        "updated_at": datetime.utcnow(),
    }

    # Map Shiprocket statuses to Deluzex OrderStatus
    if current_status in ("DELIVERED", "COMPLETED"):
        update_fields["status"] = "delivered"
    elif current_status in ("OUT FOR DELIVERY", "OUT_FOR_DELIVERY"):
        update_fields["status"] = "out_for_delivery"
    elif current_status in ("IN TRANSIT", "IN_TRANSIT", "SHIPPED", "PICKED UP", "PICKED_UP"):
        update_fields["status"] = "shipped"
    elif current_status in ("RTO INITIATED", "RTO_INITIATED"):
        update_fields["status"] = "rto_initiated"
    elif current_status in ("RTO DELIVERED", "RTO_DELIVERED"):
        update_fields["status"] = "rto_delivered"
    elif current_status in ("CANCELED", "CANCELLED"):
        update_fields["status"] = "cancelled"

    # Append activity to history
    activity_entry = {
        "date": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        "status": current_status,
        "location": payload.get("scans", [{}])[-1].get("location") if payload.get("scans") else None,
        "activity": payload.get("message") or current_status,
    }

    db.orders.update_one(
        {"_id": order_doc["_id"]},
        {
            "$set": update_fields,
            "$push": {"tracking_activities": activity_entry},
        },
    )

    logger.info(
        f"[Shiprocket Webhook] Updated Order #{order_doc['_id']} status to '{update_fields.get('status', current_status)}'"
    )
    return {"status": "success", "order_id": str(order_doc["_id"])}
