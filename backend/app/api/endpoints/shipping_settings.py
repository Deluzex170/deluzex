import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app import models
from app.api import deps
from app.core.database import db
from app.core.audit import record_audit_event

logger = logging.getLogger("uvicorn.error")

router = APIRouter()

DEFAULT_SHIPPING_SETTINGS = {
    "type": "shipping_delivery",
    "standard_delivery_fee": 99.0,
    "free_shipping_enabled": True,
    "free_shipping_threshold": 1999.0,
    "min_order_value_enabled": True,
    "min_order_value": 499.0,
    "min_order_message": "Minimum order value of ₹{amount} is required to place an order.",
    "cod_enabled": True,
    "cod_extra_fee": 0.0,
    "cod_max_order_value": 25000.0,
    "estimated_delivery_days": "3-5 business days",
    "white_glove_note": "Complimentary white-glove packaging on all luminaire orders.",
    "updated_at": datetime.now(timezone.utc).replace(tzinfo=None),
    "updated_by": "system",
}


class ShippingSettingsPayload(BaseModel):
    standard_delivery_fee: float = Field(ge=0, default=99.0, description="Standard delivery fee in INR")
    free_shipping_enabled: bool = Field(default=True, description="Enable free shipping above threshold")
    free_shipping_threshold: float = Field(ge=0, default=1999.0, description="Cart amount qualifying for free shipping")
    min_order_value_enabled: bool = Field(default=True, description="Enforce minimum order value to checkout")
    min_order_value: float = Field(ge=0, default=499.0, description="Minimum order value in INR")
    min_order_message: Optional[str] = Field(
        default="Minimum order value of ₹{amount} is required to place an order.",
        description="Friendly message shown to customer when cart is below minimum",
    )
    cod_enabled: bool = Field(default=True, description="Enable Cash on Delivery option")
    cod_extra_fee: float = Field(ge=0, default=0.0, description="Extra fee for COD orders")
    cod_max_order_value: float = Field(ge=0, default=25000.0, description="Maximum cart amount allowed for COD")
    estimated_delivery_days: Optional[str] = Field(default="3-5 business days")
    white_glove_note: Optional[str] = Field(default="Complimentary white-glove packaging on all orders.")


def get_shipping_rules() -> dict:
    """
    Returns active shipping settings from DB, falling back to defaults.
    Cached/quick lookup for cart, checkout, coupon service, and payments.
    """
    try:
        doc = db.system_settings.find_one({"type": "shipping_delivery"})
        if doc:
            return doc
    except Exception as exc:
        logger.warning(f"[ShippingSettings] Error fetching settings: {exc}")
    return DEFAULT_SHIPPING_SETTINGS.copy()


@router.get("/public")
def get_public_shipping_settings():
    """
    Public endpoint for Cart, Checkout, and Product Pages to get active delivery fees and thresholds.
    """
    rules = get_shipping_rules()
    return {
        "success": True,
        "standard_delivery_fee": float(rules.get("standard_delivery_fee", 99.0)),
        "free_shipping_enabled": bool(rules.get("free_shipping_enabled", True)),
        "free_shipping_threshold": float(rules.get("free_shipping_threshold", 1999.0)),
        "min_order_value_enabled": bool(rules.get("min_order_value_enabled", True)),
        "min_order_value": float(rules.get("min_order_value", 499.0)),
        "min_order_message": rules.get("min_order_message") or "Minimum order value of ₹{amount} is required to place an order.",
        "cod_enabled": bool(rules.get("cod_enabled", True)),
        "cod_extra_fee": float(rules.get("cod_extra_fee", 0.0)),
        "cod_max_order_value": float(rules.get("cod_max_order_value", 25000.0)),
        "estimated_delivery_days": rules.get("estimated_delivery_days", "3-5 business days"),
        "white_glove_note": rules.get("white_glove_note", "Complimentary white-glove packaging on all orders."),
    }


@router.get("/admin")
def get_admin_shipping_settings(
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Admin-only endpoint to get all shipping and delivery rule parameters.
    """
    rules = get_shipping_rules()
    if "_id" in rules:
        rules["_id"] = str(rules["_id"])
    return {
        "success": True,
        "settings": rules,
    }


@router.put("/admin")
def update_admin_shipping_settings(
    payload: ShippingSettingsPayload,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Admin-only endpoint to update shipping and delivery rules.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    update_data = payload.model_dump()
    update_data["type"] = "shipping_delivery"
    update_data["updated_at"] = now
    update_data["updated_by"] = admin.email

    try:
        db.system_settings.update_one(
            {"type": "shipping_delivery"},
            {"$set": update_data},
            upsert=True,
        )

        record_audit_event(
            action="SHIPPING_SETTINGS_UPDATED",
            action_category="settings",
            actor_email=admin.email,
            target_id="shipping_delivery",
            details={
                "standard_delivery_fee": payload.standard_delivery_fee,
                "free_shipping_threshold": payload.free_shipping_threshold,
                "min_order_value": payload.min_order_value,
                "cod_enabled": payload.cod_enabled,
            },
        )

        logger.info(f"[ShippingSettings] Updated by {admin.email}: fee={payload.standard_delivery_fee}, free_threshold={payload.free_shipping_threshold}")
        return {
            "success": True,
            "message": "Shipping and delivery settings updated successfully.",
            "settings": update_data,
        }
    except Exception as exc:
        logger.error(f"[ShippingSettings] Update failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update shipping settings: {str(exc)}",
        )
