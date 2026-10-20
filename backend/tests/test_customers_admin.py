import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from bson import ObjectId
from starlette.testclient import TestClient

from main import app
from app.core.database import db

client = TestClient(app)

@pytest.fixture
def customer_setup():
    test_email = "lord.sterling.test@deluzex.com"
    db.users.delete_many({"email": test_email})
    db.orders.delete_many({"customer.email": test_email})

    # Insert test user
    u_res = db.users.insert_one({
        "first_name": "Lord",
        "last_name": "Sterling",
        "email": test_email,
        "phone": "+91 98765 43210",
        "is_admin": False,
        "is_active": True,
        "is_verified": True
    })
    user_id = str(u_res.inserted_id)

    # Insert a test order for this user
    db.orders.insert_one({
        "order_number": "ORD-TEST-CUST-01",
        "user_id": user_id,
        "customer": {
            "name": "Lord Sterling",
            "email": test_email,
            "phone": "+91 98765 43210"
        },
        "total_amount": 125000.0,
        "status": "delivered"
    })

    yield user_id, test_email

    # Cleanup
    db.users.delete_many({"email": test_email})
    db.orders.delete_many({"customer.email": test_email})

def test_customers_admin_endpoints(customer_setup):
    user_id, test_email = customer_setup

    # 1. Stats endpoint
    stats_res = client.get("/api/v1/auth/users/stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert "total_users" in stats
    assert "total_customers" in stats
    assert stats["total_customers"] >= 1

    # 2. Users list with search and metrics
    list_res = client.get(f"/api/v1/auth/users?search={test_email}")
    assert list_res.status_code == 200
    users = list_res.json()
    assert len(users) >= 1
    found = next(u for u in users if u["email"] == test_email)
    assert found["name"] == "Lord Sterling"
    assert found["orders_count"] >= 1
    assert found["total_spent"] >= 125000.0

    # 3. Customer order history drawer
    orders_res = client.get(f"/api/v1/auth/users/{user_id}/orders")
    assert orders_res.status_code == 200
    orders = orders_res.json()
    assert len(orders) >= 1
    assert orders[0]["order_number"] == "ORD-TEST-CUST-01"

    # 4. Status toggle
    deactivate_res = client.patch(f"/api/v1/auth/users/{user_id}/status", json={"is_active": False})
    assert deactivate_res.status_code == 200
    assert deactivate_res.json()["is_active"] is False

    reactivate_res = client.patch(f"/api/v1/auth/users/{user_id}/status", json={"is_active": True})
    assert reactivate_res.status_code == 200
    assert reactivate_res.json()["is_active"] is True

    # 5. Role toggle
    role_res = client.patch(f"/api/v1/auth/users/{user_id}/role", json={"is_admin": True})
    assert role_res.status_code == 200
    assert role_res.json()["is_admin"] is True
