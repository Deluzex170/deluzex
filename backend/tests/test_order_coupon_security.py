import pytest
from fastapi.testclient import TestClient
from main import app
from app.core.database import db

client = TestClient(app)

def test_tampered_discount_rejected():
    # Setup test coupon
    db.coupons.delete_many({"code": "TAMPER10"})
    db.coupons.insert_one({
        "code": "TAMPER10",
        "title": "Tamper Test",
        "discount_type": "percentage",
        "discount_value": 10.0,
        "min_order_value": 1000.0,
        "is_active": True,
        "times_used": 0,
        "max_uses_per_user": 5
    })

    # Subtotal is 2000, 10% discount is 200, net taxable is 1800. GST is 324, Grand Total is 2124.
    # Client sends fake total 500 (tampering)
    payload = {
        "email": "hacker@test.com",
        "phone": "9876543210",
        "shipping_address": {
            "first_name": "Test",
            "last_name": "User",
            "street": "123 Street",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pin_code": "400001"
        },
        "items": [{
            "product_id": "test_prod_1",
            "title": "Test Lamp",
            "price": 2000.0,
            "quantity": 1
        }],
        "subtotal": 2000.0,
        "gst": 324.0,
        "delivery": 0.0,
        "total": 500.0,  # FAKE / TAMPERED
        "coupon_code": "TAMPER10"
    }
    res = client.post("/api/v1/payments/cod", json=payload)
    # Must reject with 400 Bad Request due to calculation mismatch
    assert res.status_code == 400
    assert "mismatch" in res.json()["detail"].lower()

    # Valid total should succeed
    payload["total"] = 2124.0
    payload["discount"] = 200.0
    res_valid = client.post("/api/v1/payments/cod", json=payload)
    assert res_valid.status_code == 200
    order_id = res_valid.json()["order_id"]
    order_doc = db.orders.find_one({"_id": db.orders.find_one({"email": "hacker@test.com"})["_id"]})
    assert order_doc["coupon_code"] == "TAMPER10"
    assert order_doc["discount"] == 200.0

    # Coupon times_used must be atomically incremented
    coupon_doc = db.coupons.find_one({"code": "TAMPER10"})
    assert coupon_doc["times_used"] == 1

    # Cleanup
    db.coupons.delete_many({"code": "TAMPER10"})
    db.orders.delete_many({"email": "hacker@test.com"})
