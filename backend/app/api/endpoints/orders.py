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
from app.services.email import send_order_confirmation_email
from app.schemas.order import (
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
    return [models.Order(**doc) for doc in docs]


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
                {"tracking_number": {"$regex": re.escape(search_clean), "$options": "i"}},
            ]
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
        query["status"] = {"$regex": f"^{re.escape(order_status.strip())}$", "$options": "i"}

    docs = list(
        db.orders.find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    logger.info(f"[GET /orders] Query: {query} -> Found {len(docs)} orders")
    return [models.Order(**doc) for doc in docs]


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
    return models.Order(**doc)


@router.post("", response_model=models.Order, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreateRequest):
    """
    Create a new order directly in the database.
    """
    initial_status = "cod" if payload.payment_method == "cod" else "pending"
    logger.info(f"[POST /orders] Creating order for email={payload.email}, total={payload.total}, payment_method={payload.payment_method}")

    db_order = models.Order(
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

    result = db.orders.insert_one(
        db_order.model_dump(by_alias=True, exclude_none=True)
    )
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
    logger.info(f"[PATCH /orders/{order_id}/status] Updating status to '{payload.status}' by {admin.email}")
    try:
        obj_id = ObjectId(order_id)
    except Exception:
        logger.warning(f"[PATCH /orders/{order_id}/status] Invalid ObjectId format")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid order ID format",
        )

    prev_doc = db.orders.find_one({"_id": obj_id})
    old_status = prev_doc.get("status") if prev_doc else None

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

    doc = db.orders.find_one({"_id": obj_id})
    logger.info(f"[PATCH /orders/{order_id}/status] Status updated successfully")

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

    return models.Order(**doc)


@router.delete("/{order_id}")
def delete_order(
    order_id: str,
    request: Request = None,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Delete an order (Admin only).
    """
    try:
        obj_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid order ID format",
        )

    doc = db.orders.find_one({"_id": obj_id})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

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
    current_user: models.User = Depends(deps.get_current_active_user),
):
    """
    Cancel an order if it is in a cancellable state (pending, paid, cod, processing).
    Enforces authorization: Only the customer who owns the order or an Admin can cancel it.
    """
    clean_id = order_id.replace("#", "").strip()
    logger.info(f"[POST /orders/{order_id}/cancel] Attempting to cancel order by {current_user.email}")
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
    user_email = (current_user.email or "").strip().lower()
    order_uid = str(doc.get("user_id") or "")
    user_id_str = str(current_user.id) if current_user.id else None
    is_owner = (order_email and order_email == user_email) or (user_id_str and order_uid == user_id_str)

    if not is_owner and not getattr(current_user, "is_admin", False):
        logger.warning(f"[POST /orders/{order_id}/cancel] User {current_user.email} unauthorized to cancel order #{order_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this order",
        )

    current_status = doc.get("status")
    non_cancellable = ["shipped", "out_for_delivery", "delivered", "cancelled"]
    if current_status in non_cancellable:
        logger.warning(f"[POST /orders/{order_id}/cancel] Cannot cancel order with status '{current_status}'")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order cannot be cancelled as it is already '{current_status}'",
        )

    db.orders.update_one(
        {"_id": obj_id},
        {
            "$set": {
                "status": "cancelled",
                "updated_at": datetime.utcnow(),
            }
        },
    )
    logger.info(f"[POST /orders/{order_id}/cancel] Order cancelled successfully")

    # Restore inventory stock back to products
    restore_product_stock(doc.get("items", []))

    return OrderCancelResponse(
        success=True,
        order_id=order_id,
        message="Order cancelled successfully",
        status="cancelled",
    )
