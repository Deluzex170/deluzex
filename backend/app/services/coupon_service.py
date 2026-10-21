import logging
from datetime import datetime, timezone
from typing import Optional, Tuple
from app.core.database import db
from app.schemas.coupon import CouponValidateResponse

logger = logging.getLogger("uvicorn.error")

def calculate_discount(coupon: dict, subtotal: float) -> Tuple[float, float, float, float, float]:
    """
    Computes (discount_amount, taxable_subtotal, gst, delivery, grand_total)
    GST is 18% on net taxable subtotal.
    Standard delivery is ₹99 if subtotal < 1999, else ₹0.
    """
    discount_type = coupon.get("discount_type", "percentage")
    discount_val = float(coupon.get("discount_value", 0.0))
    max_cap = coupon.get("max_discount_cap")

    if discount_type == "percentage":
        discount = (subtotal * discount_val) / 100.0
        if max_cap is not None and max_cap > 0:
            discount = min(discount, float(max_cap))
    elif discount_type == "flat":
        discount = discount_val
    elif discount_type == "free_shipping":
        discount = 0.0
    else:
        discount = 0.0

    discount = min(discount, subtotal)
    discount = round(discount, 2)

    taxable_subtotal = max(0.0, subtotal - discount)
    gst = round(taxable_subtotal * 0.18, 2)

    if discount_type == "free_shipping" or subtotal >= 1999.0 or subtotal == 0:
        delivery = 0.0
    else:
        delivery = 99.0

    grand_total = round(taxable_subtotal + gst + delivery, 2)
    return discount, taxable_subtotal, gst, delivery, grand_total


def validate_coupon_dict(
    coupon: dict,
    subtotal: float,
    email: Optional[str] = None,
    completed_orders_count: int = 0,
    user_usage_count: int = 0,
) -> CouponValidateResponse:
    code = coupon.get("code", "")

    if not coupon.get("is_active", True):
        return CouponValidateResponse(
            valid=False,
            code=code,
            reason="INACTIVE",
            message=f"Coupon {code} is currently inactive.",
        )

    # Use naive UTC datetime to compare cleanly with MongoDB UTC timestamps
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    start_date = coupon.get("start_date")
    if start_date:
        if getattr(start_date, "tzinfo", None) is not None:
            start_date = start_date.astimezone(timezone.utc).replace(tzinfo=None)
        if now < start_date:
            return CouponValidateResponse(
                valid=False,
                code=code,
                reason="NOT_STARTED",
                message=f"Coupon {code} has not started yet.",
            )

    expiry_date = coupon.get("expiry_date")
    if expiry_date:
        if getattr(expiry_date, "tzinfo", None) is not None:
            expiry_date = expiry_date.astimezone(timezone.utc).replace(tzinfo=None)
        if now > expiry_date:
            return CouponValidateResponse(
                valid=False,
                code=code,
                reason="EXPIRED",
                message=f"Coupon {code} has expired.",
            )

    min_mov = float(coupon.get("min_order_value", 0.0))
    if subtotal < min_mov:
        diff = round(min_mov - subtotal, 2)
        return CouponValidateResponse(
            valid=False,
            code=code,
            reason="MIN_ORDER_NOT_MET",
            required_more=diff,
            message=f"Add ₹{diff:,.0f} more to apply coupon {code}.",
        )

    max_uses = coupon.get("max_uses")
    times_used = coupon.get("times_used", 0)
    if max_uses is not None and times_used >= max_uses:
        return CouponValidateResponse(
            valid=False,
            code=code,
            reason="MAX_USES_REACHED",
            message=f"Coupon {code} has reached its maximum redemption limit.",
        )

    if coupon.get("is_first_order_only") and completed_orders_count > 0:
        return CouponValidateResponse(
            valid=False,
            code=code,
            reason="FIRST_ORDER_ONLY",
            message=f"Coupon {code} is only valid for your first order.",
        )

    max_user_uses = coupon.get("max_uses_per_user", 1)
    if user_usage_count >= max_user_uses:
        return CouponValidateResponse(
            valid=False,
            code=code,
            reason="USER_LIMIT_REACHED",
            message=f"You have already redeemed coupon {code} the maximum allowed times.",
        )

    discount, tax_sub, gst, delivery, grand_total = calculate_discount(coupon, subtotal)

    msg = f"Coupon {code} applied successfully! You saved ₹{discount:,.2f}"
    if coupon.get("discount_type") == "free_shipping":
        msg = f"Coupon {code} applied! Free delivery unlocked."

    return CouponValidateResponse(
        valid=True,
        code=code,
        message=msg,
        discount_type=coupon.get("discount_type", "percentage"),
        discount_value=coupon.get("discount_value", 0.0),
        discount_amount=discount,
        new_subtotal=tax_sub,
        gst=gst,
        delivery=delivery,
        grand_total=grand_total,
    )


def validate_coupon_code(code: str, subtotal: float, email: Optional[str] = None) -> CouponValidateResponse:
    clean_code = code.strip().upper()
    coupon = db.coupons.find_one({"code": clean_code})
    if not coupon:
        return CouponValidateResponse(
            valid=False,
            code=clean_code,
            reason="NOT_FOUND",
            message=f"Coupon code '{clean_code}' is invalid.",
        )

    completed_orders = 0
    user_usage = 0
    if email:
        clean_email = email.strip().lower()
        completed_orders = db.orders.count_documents({
            "email": {"$regex": f"^{clean_email}$", "$options": "i"},
            "status": {"$in": ["paid", "delivered", "processing", "shipped", "cod"]}
        })
        user_usage = db.orders.count_documents({
            "email": {"$regex": f"^{clean_email}$", "$options": "i"},
            "coupon_code": clean_code,
            "status": {"$in": ["paid", "delivered", "processing", "shipped", "cod"]}
        })

    return validate_coupon_dict(coupon, subtotal, email, completed_orders, user_usage)
