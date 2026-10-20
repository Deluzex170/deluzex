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
def review_setup():
    # Insert a dummy product
    prod_res = db.products.insert_one({
        "product_name": "Test Luxury Chandelier",
        "price": 45000,
        "product_rating": 0.0,
        "review_count": 0,
        "stock": 10
    })
    prod_id = str(prod_res.inserted_id)

    created_review_ids = []

    yield prod_id, created_review_ids

    # Cleanup
    db.products.delete_one({"_id": ObjectId(prod_id)})
    for rid in created_review_ids:
        try:
            db.reviews.delete_one({"_id": ObjectId(rid)})
        except Exception:
            pass

def test_review_lifecycle_and_moderation(review_setup):
    prod_id, created_review_ids = review_setup

    # 1. Submit review
    post_res = client.post("/api/v1/reviews", json={
        "product_id": prod_id,
        "author_name": "Alexander Sterling",
        "author_email": "alexander@deluzex.test",
        "rating": 5,
        "title": "Exquisite Quality",
        "text": "The brass finish and crystal clarity exceed expectations."
    })
    assert post_res.status_code == 201
    rev_data = post_res.json()["review"]
    rev_id = rev_data["id"]
    created_review_ids.append(rev_id)

    # Verify storefront shows it
    storefront_res = client.get(f"/api/v1/reviews?product_id={prod_id}")
    assert storefront_res.status_code == 200
    assert storefront_res.json()["total_reviews"] == 1
    assert storefront_res.json()["average_rating"] == 5.0

    # 2. Check stats endpoint
    stats_res = client.get("/api/v1/reviews/stats")
    assert stats_res.status_code == 200
    assert "approved" in stats_res.json()
    assert "pending" in stats_res.json()

    # 3. Check admin listing
    all_res = client.get(f"/api/v1/reviews/all?product_id={prod_id}")
    assert all_res.status_code == 200
    items = all_res.json()
    assert any(r["id"] == rev_id for r in items)
    matched = next(r for r in items if r["id"] == rev_id)
    assert matched["product"]["name"] == "Test Luxury Chandelier"

    # 4. Moderate review - unapprove
    patch_res = client.patch(f"/api/v1/reviews/{rev_id}/approval", json={"is_approved": False})
    assert patch_res.status_code == 200
    assert patch_res.json()["review"]["is_approved"] is False

    # Storefront should now show 0 approved reviews
    storefront_after = client.get(f"/api/v1/reviews?product_id={prod_id}")
    assert storefront_after.json()["total_reviews"] == 0
    assert storefront_after.json()["average_rating"] == 0.0

    # 5. Moderate review - re-approve
    patch_res2 = client.patch(f"/api/v1/reviews/{rev_id}/approval", json={"is_approved": True})
    assert patch_res2.status_code == 200
    assert patch_res2.json()["review"]["is_approved"] is True

    storefront_reapproved = client.get(f"/api/v1/reviews?product_id={prod_id}")
    assert storefront_reapproved.json()["total_reviews"] == 1

    # 6. Delete review
    del_res = client.delete(f"/api/v1/reviews/{rev_id}")
    assert del_res.status_code == 200

    # Storefront after deletion
    storefront_deleted = client.get(f"/api/v1/reviews?product_id={prod_id}")
    assert storefront_deleted.json()["total_reviews"] == 0
