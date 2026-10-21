import pytest
from datetime import datetime, timedelta
from app.models.coupon import Coupon
from app.schemas.coupon import CouponCreateRequest, CouponValidateResponse

def test_coupon_model_defaults_and_validation():
    coupon_data = {
        "code": "DELUZEXVIP",
        "title": "VIP Launch Special",
        "description": "10% off launch discount",
        "discount_type": "percentage",
        "discount_value": 10.0,
        "max_discount_cap": 2000.0,
        "min_order_value": 1999.0,
        "is_active": True,
        "is_public": True,
        "is_first_order_only": True,
    }
    coupon = Coupon(**coupon_data)
    assert coupon.code == "DELUZEXVIP"
    assert coupon.discount_type == "percentage"
    assert coupon.times_used == 0
    assert coupon.max_uses_per_user == 1

def test_coupon_create_request_code_normalization():
    req = CouponCreateRequest(
        code="  deluzexvip  ",
        title="Test",
        discount_type="percentage",
        discount_value=15.0,
    )
    assert req.code == "DELUZEXVIP"
