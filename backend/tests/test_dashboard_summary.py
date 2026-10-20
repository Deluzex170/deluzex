import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from starlette.testclient import TestClient
from main import app

client = TestClient(app)

def test_dashboard_summary_endpoint():
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
