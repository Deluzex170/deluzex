import sys
import os
from types import SimpleNamespace
from bson import ObjectId
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from starlette.testclient import TestClient
from main import app
from app.api import deps

client = TestClient(app)

def test_dashboard_summary_unauthorized():
    app.dependency_overrides.clear()
    res = client.get("/api/v1/analytics/dashboard-summary")
    assert res.status_code == 401

def test_dashboard_summary_endpoint():
    admin_user = SimpleNamespace(
        id=str(ObjectId()),
        email="admin@deluzex.com",
        first_name="Admin",
        last_name="Tester",
        is_admin=True,
        is_active=True,
        is_verified=True,
    )
    app.dependency_overrides[deps.get_current_active_admin] = lambda: admin_user

    try:
        res = client.get("/api/v1/analytics/dashboard-summary")
        assert res.status_code == 200
        data = res.json()

        # Check top-level keys
        assert "revenue" in data
        assert "inventory" in data
        assert "operations" in data

        # Check revenue metrics
        rev = data["revenue"]
        assert "total" in rev
        assert "orders_count" in rev
        assert "pending_orders" in rev
        assert "recent_orders" in rev
        assert isinstance(rev["recent_orders"], list)

        # Check inventory metrics
        inv = data["inventory"]
        assert "total_products" in inv
        assert "low_stock_count" in inv
        assert "out_of_stock_count" in inv
        assert "low_stock_items" in inv

        # Check operations metrics
        ops = data["operations"]
        assert "pending_inquiries" in ops
        assert "pending_reviews" in ops
        assert "total_customers" in ops
        assert "newsletter_subscribers" in ops
    finally:
        app.dependency_overrides.clear()
