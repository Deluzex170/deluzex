import pytest
from datetime import datetime, timedelta
from app.services.coupon_service import calculate_discount, validate_coupon_dict

def test_calculate_discount_percentage_no_cap():
    coupon = {"discount_type": "percentage", "discount_value": 10.0, "max_discount_cap": None}
    disc, tax_sub, gst, deliv, grand = calculate_discount(coupon, 5000.0)
    assert disc == 500.0
    assert tax_sub == 4500.0
    assert gst == 810.0
    assert deliv == 0.0  # subtotal >= 1999 -> free delivery
    assert grand == 5310.0

def test_calculate_discount_percentage_with_cap():
    coupon = {"discount_type": "percentage", "discount_value": 20.0, "max_discount_cap": 1500.0}
    # 20% of 20000 is 4000, capped at 1500
    disc, tax_sub, gst, deliv, grand = calculate_discount(coupon, 20000.0)
    assert disc == 1500.0
    assert tax_sub == 18500.0
    assert gst == 3330.0
    assert deliv == 0.0
    assert grand == 21830.0

def test_calculate_discount_flat():
    coupon = {"discount_type": "flat", "discount_value": 500.0}
    disc, tax_sub, gst, deliv, grand = calculate_discount(coupon, 3000.0)
    assert disc == 500.0
    assert tax_sub == 2500.0
    assert gst == 450.0
    assert deliv == 0.0
    assert grand == 2950.0

def test_calculate_discount_free_shipping():
    coupon = {"discount_type": "free_shipping", "discount_value": 0.0}
    disc, tax_sub, gst, deliv, grand = calculate_discount(coupon, 1000.0)
    # subtotal < 1999 normally charges 99 delivery, but coupon makes it 0
    assert deliv == 0.0
    assert disc == 0.0
    assert tax_sub == 1000.0
    assert gst == 180.0
    assert grand == 1180.0

def test_calculate_discount_exceeding_subtotal():
    coupon = {"discount_type": "flat", "discount_value": 1500.0}
    disc, tax_sub, gst, deliv, grand = calculate_discount(coupon, 800.0)
    assert disc == 800.0
    assert tax_sub == 0.0
    assert gst == 0.0

def test_validation_inactive_coupon():
    coupon = {"code": "OFF50", "is_active": False, "min_order_value": 0}
    res = validate_coupon_dict(coupon, 2000.0, None, completed_orders_count=0, user_usage_count=0)
    assert not res.valid
    assert res.reason == "INACTIVE"

def test_validation_expired_coupon():
    coupon = {
        "code": "OLD",
        "is_active": True,
        "expiry_date": datetime.utcnow() - timedelta(days=1),
        "min_order_value": 0
    }
    res = validate_coupon_dict(coupon, 2000.0, None, completed_orders_count=0, user_usage_count=0)
    assert not res.valid
    assert res.reason == "EXPIRED"

def test_validation_min_order_value_not_met():
    coupon = {"code": "BIG", "is_active": True, "min_order_value": 3000.0}
    res = validate_coupon_dict(coupon, 2500.0, None, completed_orders_count=0, user_usage_count=0)
    assert not res.valid
    assert res.reason == "MIN_ORDER_NOT_MET"
    assert res.required_more == 500.0

def test_validation_first_order_only_rejected_for_existing_user():
    coupon = {"code": "FIRST", "is_active": True, "is_first_order_only": True, "min_order_value": 0}
    res = validate_coupon_dict(coupon, 2000.0, "user@test.com", completed_orders_count=2, user_usage_count=0)
    assert not res.valid
    assert res.reason == "FIRST_ORDER_ONLY"

def test_validation_max_uses_per_user_exhausted():
    coupon = {"code": "ONEUSE", "is_active": True, "max_uses_per_user": 1, "min_order_value": 0}
    res = validate_coupon_dict(coupon, 2000.0, "user@test.com", completed_orders_count=1, user_usage_count=1)
    assert not res.valid
    assert res.reason == "USER_LIMIT_REACHED"
