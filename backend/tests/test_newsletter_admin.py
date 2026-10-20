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
def subscriber_setup():
    test_email = "test.luxury.subscriber@deluzex.com"
    db.newsletter_subscribers.delete_many({"email": test_email})

    yield test_email

    db.newsletter_subscribers.delete_many({"email": test_email})

def test_newsletter_admin_lifecycle(subscriber_setup):
    test_email = subscriber_setup

    # 1. Subscribe
    sub_res = client.post("/api/v1/newsletter/subscribe", json={
        "email": test_email,
        "source": "admin_test_suite"
    })
    assert sub_res.status_code == 200
    data = sub_res.json()
    assert data["status"] in ["success", "already_subscribed"]

    # 2. List subscribers with search
    list_res = client.get(f"/api/v1/newsletter/subscribers?search={test_email}")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] >= 1
    assert any(s["email"] == test_email for s in list_data["subscribers"])

    sub_item = next(s for s in list_data["subscribers"] if s["email"] == test_email)
    sub_id = sub_item["id"]

    # 3. Toggle notification status
    patch_res = client.patch(f"/api/v1/newsletter/subscribers/{sub_id}/notified", json={
        "is_notified": True
    })
    assert patch_res.status_code == 200
    assert patch_res.json()["subscriber"]["is_notified"] is True

    # 4. Check CSV export
    csv_res = client.get("/api/v1/newsletter/export-csv")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers.get("content-type", "")
    assert test_email in csv_res.text

    # 5. Delete subscriber
    del_res = client.delete(f"/api/v1/newsletter/subscribers/{sub_id}")
    assert del_res.status_code == 200

    # Verify deleted
    verify_res = client.get(f"/api/v1/newsletter/subscribers?search={test_email}")
    assert not any(s["email"] == test_email for s in verify_res.json()["subscribers"])
