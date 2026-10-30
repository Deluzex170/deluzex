import logging
import re
from datetime import datetime
from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request

from app import models
from app.api import deps
from app.core.database import db
from app.core.audit import record_audit_event
from app.services.inventory import decrement_product_stock, restore_product_stock
from app.services.order_identifiers import generate_order_identifiers
from app.services.email import send_order_confirmation_email, send_shipping_notification_email
from app.schemas.order import (
    OrderCancelRequest,
    OrderCancelResponse,
    OrderCreateRequest,
    OrderListResponse,
    OrderResponse,
    OrderStatusUpdateRequest,
)

logger = logging.getLogger("uvicorn.error")

router = APIRouter()


def _format_order(doc: dict) -> dict:
    """Format MongoDB order document for response serialization."""
    doc["_id"] = str(doc["_id"])
    if not doc.get("order_number") or not doc.get("invoice_number"):
        ord_num, inv_num = generate_order_identifiers(doc["_id"], doc.get("created_at"))
        if not doc.get("order_number"):
            doc["order_number"] = ord_num
        if not doc.get("invoice_number"):
            doc["invoice_number"] = inv_num
    return doc


@router.get("/my-orders", response_model=List[models.Order])
def get_my_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: models.User = Depends(deps.get_current_active_user),
):
    """
    Get all orders for the currently authenticated user.
    Retrieves orders matching the user's email or user ID, sorted newest first.
    """
    logger.info(f"[GET /my-orders] Fetching orders for user: email={current_user.email}, id={current_user.id}")
    conditions = []
    if current_user.id:
        conditions.append({"user_id": str(current_user.id)})
    if current_user.email:
        clean_email = current_user.email.strip().lower()
        conditions.append({"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}})
        prefix = clean_email.split("@")[0]
        conditions.append({"email": {"$regex": f"^{re.escape(prefix)}", "$options": "i"}})
    if getattr(current_user, "phone", None):
        clean_phone = re.sub(r"\D", "", str(current_user.phone))
        if len(clean_phone) >= 10:
            conditions.append({"phone": {"$regex": f"{re.escape(clean_phone[-10:])}$"}})

    query = {"$or": conditions} if conditions else {}
    docs = list(
        db.orders.find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    # If user is admin and found 0 personal orders, return store orders
    if not docs and getattr(current_user, "is_admin", False):
        docs = list(db.orders.find().sort("created_at", -1).skip(skip).limit(limit))

    logger.info(f"[GET /my-orders] Found {len(docs)} orders for user {current_user.email}")
    return [models.Order(**_format_order(doc)) for doc in docs]


@router.get("/stats")
def get_order_stats(admin: models.User = Depends(deps.get_current_active_admin)):
    """
    Get aggregated counts and revenue metrics for orders (Admin only).
    """
    total_orders = db.orders.count_documents({})
    pending_count = db.orders.count_documents({"status": {"$in": ["pending", "cod"]}})
    processing_count = db.orders.count_documents({"status": {"$in": ["paid", "processing"]}})
    shipped_count = db.orders.count_documents({"status": {"$in": ["shipped", "out_for_delivery"]}})
    delivered_count = db.orders.count_documents({"status": "delivered"})
    cancelled_count = db.orders.count_documents({"status": "cancelled"})

    pipeline = [
        {"$match": {"status": {"$in": ["paid", "processing", "shipped", "out_for_delivery", "delivered"]}}},
        {"$group": {"_id": None, "total_revenue": {"$sum": "$total"}}}
    ]
    revenue_res = list(db.orders.aggregate(pipeline))
    total_revenue = revenue_res[0]["total_revenue"] if revenue_res else 0.0

    return {
        "total_orders": total_orders,
        "pending": pending_count,
        "processing": processing_count,
        "shipped": shipped_count,
        "delivered": delivered_count,
        "cancelled": cancelled_count,
        "total_revenue": round(float(total_revenue), 2),
    }


@router.get("", response_model=List[models.Order])
def list_orders(
    email: Optional[str] = Query(None, description="Filter by customer email"),
    phone: Optional[str] = Query(None, description="Filter by customer phone"),
    order_status: Optional[str] = Query(None, alias="status", description="Filter by order status"),
    search: Optional[str] = Query(None, description="Search by ID, email, or phone"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: Optional[models.User] = Depends(deps.get_current_user_optional),
):
    """
    Get orders with optional filters (email, phone, status, search) and pagination.
    Authenticated customers can only view their own orders. Admins can view and search all orders.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to view orders",
        )

    logger.info(f"[GET /orders] Listing orders with params: email={email}, phone={phone}, status={order_status}, search={search}, skip={skip}, limit={limit}")
    query = {}

    if not getattr(current_user, "is_admin", False):
        user_clean_email = (current_user.email or "").strip().lower()
        if email and email.strip().lower() != user_clean_email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access orders of another user",
            )
        user_conditions = []
        if current_user.id:
            user_conditions.append({"user_id": str(current_user.id)})
        if user_clean_email:
            user_conditions.append({"email": {"$regex": f"^{re.escape(user_clean_email)}$", "$options": "i"}})
        query["$or"] = user_conditions

    else:
        # Admin search & filters
        if search:
            search_clean = search.strip()
            search_or = [
                {"email": {"$regex": re.escape(search_clean), "$options": "i"}},
                {"phone": {"$regex": re.escape(search_clean)}},
                {"shipping_address.first_name": {"$regex": re.escape(search_clean), "$options": "i"}},
                {"shipping_address.last_name": {"$regex": re.escape(search_clean), "$options": "i"}},
                {"shipping_address.city": {"$regex": re.escape(search_clean), "$options": "i"}},
                {"tracking_number": {"$regex": re.escape(search_clean), "$options": "i"}},
                {"order_number": {"$regex": re.escape(search_clean), "$options": "i"}},
                {"order_id": {"$regex": re.escape(search_clean), "$options": "i"}},
                {"payment_method": {"$regex": re.escape(search_clean), "$options": "i"}},
                {"status": {"$regex": re.escape(search_clean), "$options": "i"}},
                {"items.title": {"$regex": re.escape(search_clean), "$options": "i"}},
            ]
            id_suffix_match = re.search(r'[A-Fa-f0-9]{3,24}$', search_clean.strip('#'))
            if id_suffix_match:
                search_or.append({"$expr": {"$regexMatch": {"input": {"$toString": "$_id"}, "regex": id_suffix_match.group(0), "options": "i"}}})
            hex_part = re.sub(r'[^a-fA-F0-9]', '', search_clean)
            if hex_part and (not id_suffix_match or hex_part != id_suffix_match.group(0)):
                search_or.append({"$expr": {"$regexMatch": {"input": {"$toString": "$_id"}, "regex": hex_part, "options": "i"}}})
            if ObjectId.is_valid(search_clean):
                search_or.append({"_id": ObjectId(search_clean)})
            query["$or"] = search_or

        if email:
            clean_email = email.strip()
            prefix = clean_email.split("@")[0]
            query["$or"] = [
                {"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}},
                {"email": {"$regex": f"^{re.escape(prefix)}", "$options": "i"}},
            ]
        if phone:
            clean_phone = re.sub(r"\D", "", phone.strip())
            if len(clean_phone) >= 10:
                query["phone"] = {"$regex": f"{re.escape(clean_phone[-10:])}$"}
            else:
                query["phone"] = phone.strip()

    if order_status and order_status.lower() != "all":
        norm_status = order_status.strip().lower()
        if norm_status in ("pending", "cod"):
            query["status"] = {"$in": ["pending", "cod"]}
        elif norm_status in ("paid", "processing"):
            query["status"] = {"$in": ["paid", "processing"]}
        elif norm_status in ("shipped", "out_for_delivery"):
            query["status"] = {"$in": ["shipped", "out_for_delivery"]}
        else:
            query["status"] = {"$regex": f"^{re.escape(order_status.strip())}$", "$options": "i"}

    docs = list(
        db.orders.find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    logger.info(f"[GET /orders] Query: {query} -> Found {len(docs)} orders")
    return [models.Order(**_format_order(doc)) for doc in docs]


@router.get("/{order_id}", response_model=models.Order)
def get_order(
    order_id: str,
    current_user: Optional[models.User] = Depends(deps.get_current_user_optional),
):
    """
    Get full details of a specific order by its MongoDB Order ID.
    Enforces privacy: only the order owner or an admin can view order details.
    """
    clean_id = order_id.replace("#", "").strip()
    logger.info(f"[GET /orders/{order_id}] Fetching order details")
    doc = None
    try:
        doc = db.orders.find_one({"_id": ObjectId(clean_id)})
    except Exception:
        pass

    if doc is None:
        doc = db.orders.find_one({
            "$or": [
                {"order_id": clean_id},
                {"order_id": order_id},
                {"custom_order_id": clean_id},
                {"custom_order_id": order_id},
                {"id": clean_id},
                {"id": order_id},
            ]
        })

    if doc is None:
        logger.warning(f"[GET /orders/{order_id}] Order not found in database")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to view order details",
        )

    if not getattr(current_user, "is_admin", False):
        user_email = (current_user.email or "").strip().lower()
        order_email = (doc.get("email") or "").strip().lower()
        user_id_str = str(current_user.id) if current_user.id else None
        order_uid = str(doc.get("user_id") or "")
        is_owner = (order_email and order_email == user_email) or (user_id_str and order_uid == user_id_str)
        if not is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this order",
            )

    logger.info(f"[GET /orders/{order_id}] Successfully retrieved order")
    return models.Order(**_format_order(doc))


@router.post("", response_model=models.Order, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreateRequest):
    """
    Create a new order directly in the database.
    """
    initial_status = "cod" if payload.payment_method == "cod" else "pending"
    logger.info(f"[POST /orders] Creating order for email={payload.email}, total={payload.total}, payment_method={payload.payment_method}")

    now = datetime.utcnow()
    pre_id = ObjectId()
    ord_num, inv_num = generate_order_identifiers(str(pre_id), now)

    db_order = models.Order(
        id=pre_id,
        order_number=ord_num,
        invoice_number=inv_num,
        user_id=payload.user_id,
        email=payload.email,
        phone=payload.phone,
        shipping_address=payload.shipping_address,
        items=payload.items,
        subtotal=payload.subtotal,
        gst=payload.gst,
        delivery=payload.delivery,
        total=payload.total,
        payment_method=payload.payment_method,
        notes=payload.notes,
        status=initial_status,
        created_at=datetime.utcnow(),
    )

    order_doc = db_order.model_dump(by_alias=True, exclude_none=True)
    if "_id" in order_doc:
        order_doc["_id"] = ObjectId(order_doc["_id"])
    result = db.orders.insert_one(order_doc)
    db_order.id = str(result.inserted_id)
    logger.info(f"[POST /orders] Created order with ID={db_order.id}")

    # Decrement inventory stock
    decrement_product_stock(payload.items)

    # Dispatch luxury order confirmation email safely
    try:
        send_order_confirmation_email(db_order)
        db.orders.update_one({"_id": ObjectId(db_order.id)}, {"$set": {"order_confirmation_email_sent": True}})
    except Exception as email_err:
        logger.warning(f"[POST /orders] Order confirmation email dispatch skipped for #{db_order.id}: {email_err}")

    # Auto-push order & shipping address to Shiprocket (Zero wallet balance required)
    try:
        from app.services.shiprocket import sync_order_to_shiprocket
        sync_order_to_shiprocket(db_order)
    except Exception as sr_err:
        logger.warning(f"[POST /orders] Automatic Shiprocket order sync skipped: {sr_err}")

    return db_order


@router.patch("/{order_id}/status", response_model=models.Order)
def update_order_status(
    order_id: str,
    payload: OrderStatusUpdateRequest,
    request: Request = None,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Update the status, tracking number, courier partner, or notes of an existing order (Admin only).
    """
    clean_id = order_id.replace("#", "").strip()
    logger.info(f"[PATCH /orders/{order_id}/status] Updating status to '{payload.status}' by {admin.email}")
    prev_doc = None
    try:
        prev_doc = db.orders.find_one({"_id": ObjectId(clean_id)})
    except Exception:
        pass

    if prev_doc is None:
        prev_doc = db.orders.find_one({
            "$or": [
                {"order_id": clean_id},
                {"order_id": order_id},
                {"custom_order_id": clean_id},
                {"custom_order_id": order_id},
                {"id": clean_id},
                {"id": order_id},
            ]
        })

    if prev_doc is None:
        logger.warning(f"[PATCH /orders/{order_id}/status] Order not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    obj_id = prev_doc["_id"]
    old_status = prev_doc.get("status")

    update_fields = {
        "status": payload.status,
        "updated_at": datetime.utcnow(),
    }
    if payload.tracking_number is not None:
        update_fields["tracking_number"] = payload.tracking_number
    if payload.courier_partner is not None:
        update_fields["courier_partner"] = payload.courier_partner
    if payload.notes is not None:
        update_fields["notes"] = payload.notes

    result = db.orders.update_one(
        {"_id": obj_id},
        {"$set": update_fields},
    )

    if result.matched_count == 0:
        logger.warning(f"[PATCH /orders/{order_id}/status] Order not found for update")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    # Sync inventory stock if transitioning to or from cancelled
    new_status = str(payload.status).lower()
    old_status_clean = str(old_status).lower() if old_status else ""
    if new_status == "cancelled" and old_status_clean != "cancelled":
        restore_product_stock(prev_doc.get("items", []))
    elif old_status_clean == "cancelled" and new_status != "cancelled":
        decrement_product_stock(prev_doc.get("items", []))

    doc = db.orders.find_one({"_id": obj_id})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    logger.info(f"[PATCH /orders/{order_id}/status] Status updated successfully")

    # If transitioning to "shipped", dispatch automated customer email with courier tracking URL
    if payload.status == "shipped" and old_status != "shipped":
        try:
            send_shipping_notification_email(
                order=doc,
                tracking_number=payload.tracking_number or doc.get("tracking_number", ""),
                courier_partner=payload.courier_partner or doc.get("courier_partner", "")
            )
            logger.info(f"[PATCH /orders/{order_id}/status] Shipping notification email dispatched")
        except Exception as exc:
            logger.warning(f"[PATCH /orders/{order_id}/status] Failed to dispatch shipping notification email: {exc}")

    # If order is cancelled by admin, safely restore inventory stock back to products
    if payload.status == "cancelled" and old_status != "cancelled":
        try:
            restore_product_stock(prev_doc.get("items", []))
            logger.info(f"[PATCH /orders/{order_id}/status] Restored product stock for cancelled order #{order_id}")
        except Exception as exc:
            logger.warning(f"[PATCH /orders/{order_id}/status] Failed to restore inventory on cancel: {exc}")

    record_audit_event(
        action="ORDER_STATUS_UPDATE",
        action_category="orders",
        actor_email=admin.email,
        actor_role="Admin",
        target_type="order",
        target_id=order_id,
        target_name=f"Order #{order_id[:8]}",
        description=f"Changed order status from '{old_status}' to '{payload.status}'",
        changes={
            "before": {"status": old_status},
            "after": {
                "status": payload.status,
                "tracking_number": payload.tracking_number,
                "courier_partner": payload.courier_partner
            }
        },
        request=request
    )

    return models.Order(**_format_order(doc))


@router.delete("/{order_id}")
def delete_order(
    order_id: str,
    request: Request = None,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Delete an order (Admin only).
    """
    clean_id = order_id.replace("#", "").strip()
    doc = None
    try:
        doc = db.orders.find_one({"_id": ObjectId(clean_id)})
    except Exception:
        pass

    if doc is None:
        doc = db.orders.find_one({
            "$or": [
                {"order_id": clean_id},
                {"order_id": order_id},
                {"custom_order_id": clean_id},
                {"custom_order_id": order_id},
                {"id": clean_id},
                {"id": order_id},
            ]
        })

    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    obj_id = doc["_id"]

    db.orders.delete_one({"_id": obj_id})
    record_audit_event(
        action="ORDER_DELETED",
        action_category="orders",
        actor_email=admin.email,
        actor_role="Admin",
        target_type="order",
        target_id=order_id,
        target_name=f"Order #{order_id[:8]}",
        description=f"Deleted order #{order_id[:8]} for {doc.get('email')}",
        request=request
    )
    return {"success": True, "message": "Order deleted successfully"}


@router.post("/{order_id}/cancel", response_model=OrderCancelResponse)
@router.put("/{order_id}/cancel", response_model=OrderCancelResponse)
def cancel_order(
    order_id: str,
    payload: Optional[OrderCancelRequest] = None,
    current_user: Optional[models.User] = Depends(deps.get_current_user_optional),
):
    """
    Cancel an order if it is in a cancellable state (pending, paid, cod, processing).
    Enforces authorization: Only the customer who owns the order (via token or email) or an Admin can cancel it.
    """
    clean_id = order_id.replace("#", "").strip()
    logger.info(f"[POST /orders/{order_id}/cancel] Attempting to cancel order #{clean_id}")
    doc = None
    try:
        doc = db.orders.find_one({"_id": ObjectId(clean_id)})
    except Exception:
        pass

    if doc is None:
        doc = db.orders.find_one({
            "$or": [
                {"order_id": clean_id},
                {"order_id": order_id},
                {"custom_order_id": clean_id},
                {"custom_order_id": order_id},
                {"id": clean_id},
                {"id": order_id},
            ]
        })

    if doc is None:
        logger.warning(f"[POST /orders/{order_id}/cancel] Order not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    obj_id = doc["_id"]

    # Check ownership or admin
    order_email = (doc.get("email") or "").strip().lower()
    order_uid = str(doc.get("user_id") or "")

    is_owner = False
    if current_user:
        user_email = (current_user.email or "").strip().lower()
        user_id_str = str(current_user.id) if current_user.id else None
        is_owner = (order_email and order_email == user_email) or (user_id_str and order_uid == user_id_str) or getattr(current_user, "is_admin", False)

    if not is_owner and payload and payload.email:
        req_email = (payload.email or "").strip().lower()
        is_owner = bool(order_email and order_email == req_email)

    if not is_owner:
        logger.warning(f"[POST /orders/{order_id}/cancel] Unauthorized attempt to cancel order #{order_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this order",
        )

    current_status = str(doc.get("status") or "").lower()
    non_cancellable = ["shipped", "out_for_delivery", "delivered", "cancelled"]
    if current_status in non_cancellable:
        logger.warning(f"[POST /orders/{order_id}/cancel] Cannot cancel order with status '{current_status}'")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order cannot be cancelled as it is already '{current_status}'",
        )

    update_fields = {
        "status": "cancelled",
        "updated_at": datetime.utcnow(),
    }
    if payload and payload.reason:
        update_fields["cancel_reason"] = payload.reason

    db.orders.update_one(
        {"_id": obj_id},
        {"$set": update_fields},
    )
    logger.info(f"[POST /orders/{order_id}/cancel] Order #{order_id} cancelled successfully")

    # Restore inventory stock back to products
    restore_product_stock(doc.get("items", []))

    return OrderCancelResponse(
        success=True,
        order_id=order_id,
        message="Order cancelled successfully",
        status="cancelled",
    )


@router.post("/webhook")
async def orders_logistics_webhook(request: Request):
    """
    Compliance Webhook Endpoint for Logistics Tracking Updates.
    Does not use restricted keywords (shiprocket, kartrocket, sr, kr) in URL.
    Supports both 'x-api-key' and 'Authorization' token verification.
    """
    token_header = request.headers.get("x-api-key") or request.headers.get("authorization")
    configured_secret = getattr(deps.settings, "SHIPROCKET_WEBHOOK_SECRET", "")
    if configured_secret and token_header:
        clean_token = token_header.replace("Bearer ", "").strip()
        if clean_token != configured_secret.strip():
            logger.warning("[Logistics Webhook] Rejected: token mismatch")
            return {"status": "unauthorized"}

    try:
        payload = await request.json()
    except Exception:
        return {"status": "ignored", "reason": "invalid json payload"}

    logger.info(f"[Logistics Webhook] Received update: {payload}")

    awb = payload.get("awb") or payload.get("awb_code") or payload.get("tracking_number")
    current_status = str(payload.get("current_status") or payload.get("status") or "").upper().strip()
    order_id_ref = payload.get("order_id")

    query = {}
    if awb:
        query["$or"] = [{"awb_code": awb}, {"tracking_number": awb}]
    elif order_id_ref:
        try:
            query["_id"] = ObjectId(order_id_ref)
        except Exception:
            pass

    if not query:
        return {"status": "ok", "message": "No matching order identifier found"}

    order_doc = db.orders.find_one(query)
    if not order_doc:
        return {"status": "ok", "message": "Order not found in database"}

    update_fields = {
        "shiprocket_status": current_status,
        "updated_at": datetime.utcnow(),
    }

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
        f"[Logistics Webhook] Successfully synced Order #{order_doc['_id']} to '{update_fields.get('status', current_status)}'"
    )
    return {"status": "success", "order_id": str(order_doc["_id"])}

