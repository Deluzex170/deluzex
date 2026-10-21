import logging
from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app import models
from app.api import deps
from app.core.database import db
from app.core.audit import record_audit_event
from app.schemas.coupon import (
    AvailableCouponResponse,
    CouponCreateRequest,
    CouponResponse,
    CouponUpdateRequest,
    CouponValidateRequest,
    CouponValidateResponse,
)
from app.services.coupon_service import validate_coupon_code

logger = logging.getLogger("uvicorn.error")

router = APIRouter()
admin_router = APIRouter()


def _format_coupon(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc


# ==========================================
# PUBLIC STOREFRONT ENDPOINTS
# ==========================================

@router.get("/available", response_model=List[AvailableCouponResponse])
def get_available_coupons():
    """
    Returns active, public coupons that customers can discover and apply in 1 click.
    Excludes private/secret codes and expired/exhausted promotions.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    query = {
        "is_active": True,
        "is_public": True,
        "$or": [
            {"expiry_date": None},
            {"expiry_date": {"$gt": now}}
        ]
    }
    docs = list(db.coupons.find(query).sort("min_order_value", 1))
    results = []
    for doc in docs:
        max_uses = doc.get("max_uses")
        times_used = doc.get("times_used", 0)
        if max_uses is not None and times_used >= max_uses:
            continue
        results.append(
            AvailableCouponResponse(
                code=doc["code"],
                title=doc.get("title", doc["code"]),
                description=doc.get("description", ""),
                discount_type=doc.get("discount_type", "percentage"),
                discount_value=doc.get("discount_value", 0.0),
                max_discount_cap=doc.get("max_discount_cap"),
                min_order_value=doc.get("min_order_value", 0.0),
                is_first_order_only=doc.get("is_first_order_only", False),
                expiry_date=doc.get("expiry_date"),
            )
        )
    return results


@router.post("/validate", response_model=CouponValidateResponse)
def validate_coupon(payload: CouponValidateRequest):
    """
    Validates a coupon code against the cart subtotal and user context.
    Returns complete breakdown (discount, gst, delivery, grand_total).
    """
    if not payload.code or not payload.code.strip():
        return CouponValidateResponse(
            valid=False,
            code="",
            reason="EMPTY_CODE",
            message="Please enter a valid promo code.",
        )

    res = validate_coupon_code(payload.code, payload.subtotal, payload.email)
    return res


# ==========================================
# ADMIN MANAGEMENT ENDPOINTS
# ==========================================

@admin_router.get("", response_model=List[CouponResponse])
def list_admin_coupons(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """List all coupons in the system with usage metrics (Admin only)."""
    docs = list(db.coupons.find().sort("created_at", -1).skip(skip).limit(limit))
    return [CouponResponse(**_format_coupon(d)) for d in docs]


@admin_router.post("", response_model=CouponResponse, status_code=status.HTTP_201_CREATED)
def create_admin_coupon(
    payload: CouponCreateRequest,
    request: Request,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """Create a new promotional coupon (Admin only)."""
    clean_code = payload.code.strip().upper()
    existing = db.coupons.find_one({"code": clean_code})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Coupon code '{clean_code}' already exists.",
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    data = payload.dict()
    data["code"] = clean_code
    data["times_used"] = 0
    data["created_at"] = now
    data["updated_at"] = now

    result = db.coupons.insert_one(data)
    data["_id"] = str(result.inserted_id)

    record_audit_event(
        action="coupon.created",
        performed_by=admin.email,
        details={"code": clean_code, "type": payload.discount_type, "value": payload.discount_value},
        request=request,
    )

    return CouponResponse(**data)


@admin_router.get("/{coupon_id}", response_model=CouponResponse)
def get_admin_coupon(
    coupon_id: str,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """Retrieve coupon details by ID (Admin only)."""
    if not ObjectId.is_valid(coupon_id):
        raise HTTPException(status_code=400, detail="Invalid coupon ID")

    doc = db.coupons.find_one({"_id": ObjectId(coupon_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Coupon not found")

    return CouponResponse(**_format_coupon(doc))


@admin_router.put("/{coupon_id}", response_model=CouponResponse)
def update_admin_coupon(
    coupon_id: str,
    payload: CouponUpdateRequest,
    request: Request,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """Update coupon configuration (Admin only)."""
    if not ObjectId.is_valid(coupon_id):
        raise HTTPException(status_code=400, detail="Invalid coupon ID")

    existing = db.coupons.find_one({"_id": ObjectId(coupon_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Coupon not found")

    updates = {k: v for k, v in payload.dict(exclude_unset=True).items()}
    updates["updated_at"] = datetime.now(timezone.utc).replace(tzinfo=None)

    db.coupons.update_one({"_id": ObjectId(coupon_id)}, {"$set": updates})
    updated = db.coupons.find_one({"_id": ObjectId(coupon_id)})

    record_audit_event(
        action="coupon.updated",
        performed_by=admin.email,
        details={"code": existing.get("code"), "updated_fields": list(updates.keys())},
        request=request,
    )

    return CouponResponse(**_format_coupon(updated))


@admin_router.patch("/{coupon_id}/toggle", response_model=CouponResponse)
def toggle_admin_coupon(
    coupon_id: str,
    request: Request,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """1-Click enable/disable toggle for a coupon (Admin only)."""
    if not ObjectId.is_valid(coupon_id):
        raise HTTPException(status_code=400, detail="Invalid coupon ID")

    existing = db.coupons.find_one({"_id": ObjectId(coupon_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Coupon not found")

    new_state = not existing.get("is_active", True)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    db.coupons.update_one(
        {"_id": ObjectId(coupon_id)},
        {"$set": {"is_active": new_state, "updated_at": now}}
    )
    updated = db.coupons.find_one({"_id": ObjectId(coupon_id)})

    record_audit_event(
        action="coupon.toggled",
        performed_by=admin.email,
        details={"code": existing.get("code"), "new_active_state": new_state},
        request=request,
    )

    return CouponResponse(**_format_coupon(updated))


@admin_router.delete("/{coupon_id}")
def delete_admin_coupon(
    coupon_id: str,
    request: Request,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """Delete a coupon (Admin only)."""
    if not ObjectId.is_valid(coupon_id):
        raise HTTPException(status_code=400, detail="Invalid coupon ID")

    existing = db.coupons.find_one({"_id": ObjectId(coupon_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Coupon not found")

    db.coupons.delete_one({"_id": ObjectId(coupon_id)})

    record_audit_event(
        action="coupon.deleted",
        performed_by=admin.email,
        details={"code": existing.get("code")},
        request=request,
    )

    return {"success": True, "message": f"Coupon {existing.get('code')} deleted successfully."}
