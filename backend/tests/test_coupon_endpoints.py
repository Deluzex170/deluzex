from fastapi.testclient import TestClient
from main import app
from app.core.database import db
from datetime import datetime, timezone

client = TestClient(app)

def test_available_coupons_and_validation():
    # Setup test coupon in db
    db.coupons.delete_many({"code": "TESTVIP"})
    db.coupons.insert_one({
        "code": "TESTVIP",
        "title": "Test VIP",
        "description": "10% off",
        "discount_type": "percentage",
        "discount_value": 10.0,
        "min_order_value": 1000.0,
        "is_active": True,
        "is_public": True,
        "is_first_order_only": False,
        "times_used": 0,
        "max_uses_per_user": 1,
        "created_at": datetime.now(timezone.utc)
    })

    # Test GET available
    res = client.get("/api/v1/coupons/available")
    assert res.status_code == 200
    codes = [c["code"] for c in res.json()]
    assert "TESTVIP" in codes

    # Test POST validate - valid
    res_val = client.post("/api/v1/coupons/validate", json={
        "code": "TESTVIP",
        "subtotal": 2000.0,
        "email": "test@deluzex.com"
    })
    assert res_val.status_code == 200
    data = res_val.json()
    assert data["valid"] is True
    assert data["discount_amount"] == 200.0
    # subtotal 2000 - 200 = 1800. GST (18%) = 324. Delivery = 0 (subtotal >= 1999). Grand total = 2124.
    assert data["grand_total"] == 2124.0

    # Test POST validate - non-existent code
    res_bad = client.post("/api/v1/coupons/validate", json={
        "code": "NOTREAL",
        "subtotal": 2000.0
    })
    assert res_bad.status_code == 200
    assert res_bad.json()["valid"] is False
    assert res_bad.json()["reason"] == "NOT_FOUND"

    # Cleanup
    db.coupons.delete_many({"code": "TESTVIP"})
