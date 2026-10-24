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
# ADMIN ENDPOINTS (Require active admin authentication)
# ---------------------------------------------------------------------------

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
    except Exception as exc:
        logger.error(f"[Shiprocket] Error checking couriers: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


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
    except Exception as exc:
        logger.error(f"[Shiprocket] Create shipment error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


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

    try:
        awb_res = sr_service.generate_awb(
            shipment_id=payload.shipment_id,
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
    except Exception as exc:
        logger.error(f"[Shiprocket] AWB assignment error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


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
    except Exception as exc:
        logger.error(f"[Shiprocket] Pickup scheduling error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


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
    except Exception as exc:
        logger.error(f"[Shiprocket] Label generation error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


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
    except Exception as exc:
        logger.error(f"[Shiprocket] Invoice generation error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


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
# REVERSE LOGISTICS / RETURN ORDER MANAGEMENT
# ---------------------------------------------------------------------------

@router.post("/returns/create")
def initiate_return_order(
    payload: ReturnOrderPayload,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Initiate a return order / reverse pickup from customer's address back to 'work' warehouse.
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

        # Attempt to auto-generate reverse AWB
        return_awb_code = None
        courier_name = None
        try:
            awb_ret = sr_service.generate_return_awb(return_shipment_id)
            return_awb_code = awb_ret.get("return_awb_code")
            courier_name = awb_ret.get("courier_name")
        except Exception as awb_err:
            logger.warning(f"[Shiprocket] Reverse AWB auto-assignment pending: {awb_err}")

        return_data = {
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
                    "status": "return_requested",
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
    except Exception as exc:
        logger.error(f"[Shiprocket] Return creation error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


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
