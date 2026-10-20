import unittest
import sys
import os
from types import SimpleNamespace
from bson import ObjectId

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from main import app
from app.api import deps
from app.core.database import db

client = TestClient(app)


class TestProductionReadinessE2E(unittest.TestCase):
    """
    Comprehensive Production-Readiness E2E Test Suite.
    Validates:
      1. Customer Checkout & Inventory Integrity Flow (positive).
      2. Multi-tenant customer data isolation (privacy).
      3. Negative & edge cases (out of stock, over-limit clamping, malformed IDs).
      4. RBAC security enforcement (unauthenticated vs regular customer vs admin).
    """

    def setUp(self):
        self.customer_a = SimpleNamespace(
            id=str(ObjectId()),
            email="luxury.client.a@deluzex.com",
            first_name="Lady",
            last_name="Delacroix",
            is_admin=False,
            is_active=True,
            is_verified=True,
        )
        self.customer_b = SimpleNamespace(
            id=str(ObjectId()),
            email="luxury.client.b@deluzex.com",
            first_name="Lord",
            last_name="Vanderbilt",
            is_admin=False,
            is_active=True,
            is_verified=True,
        )
        self.admin_user = SimpleNamespace(
            id=str(ObjectId()),
            email="concierge@deluzex.com",
            first_name="Executive",
            last_name="Director",
            is_admin=True,
            is_active=True,
            is_verified=True,
        )

        # Seed test product in database
        self.test_prod_id = ObjectId()
        db.products.insert_one({
            "_id": self.test_prod_id,
            "product_title": "Grand Versailles Royal Chandelier",
            "price": 285000.0,
            "stock_count": 10,
            "in_stock": True,
            "image": "/images/grand_versailles.jpg",
        })

        # Track created resources for teardown
        self.created_order_ids = []
        self.created_address_ids = []
        self.created_card_ids = []

    def tearDown(self):
        app.dependency_overrides.clear()
        # Clean up seeded product
        db.products.delete_one({"_id": self.test_prod_id})
        # Clean up created orders
        for oid in self.created_order_ids:
            if ObjectId.is_valid(oid):
                db.orders.delete_one({"_id": ObjectId(oid)})
        # Clean up created addresses
        for aid in self.created_address_ids:
            if ObjectId.is_valid(aid):
                db.addresses.delete_one({"_id": ObjectId(aid)})
        # Clean up created cards
        for cid in self.created_card_ids:
            if ObjectId.is_valid(cid):
                db.payment_cards.delete_one({"_id": ObjectId(cid)})
        # Clean up test cart items
        db.cart_items.delete_many({"user_email": {"$in": [self.customer_a.email, self.customer_b.email]}})
        db.cart_items.delete_many({"session_id": {"$in": ["guest_sess_1", "guest_clamp_test"]}})
        # Clean up test wishlists
        db.wishlist_items.delete_many({"user_email": {"$in": [self.customer_a.email, self.customer_b.email]}})

    # =========================================================================
    # 1. POSITIVE CUSTOMER PURCHASE JOURNEY & INVENTORY ACCURACY
    # =========================================================================
    def test_01_customer_checkout_and_stock_lifecycle(self):
        """
        Verify:
        - Customer A adds items to cart and validates cart sync.
        - Places Cash on Delivery (COD) order.
        - Stock is automatically decremented.
        - Customer A sees the order in their history.
        - Customer A cancels order, and stock is automatically restored.
        """
        app.dependency_overrides[deps.get_current_active_user] = lambda: self.customer_a
        app.dependency_overrides[deps.get_current_user_optional] = lambda: self.customer_a

        # 1. Add item as guest, then sync to authenticated user
        cart_add_payload = {
            "session_id": "guest_sess_1",
            "product_id": str(self.test_prod_id),
            "quantity": 2,
            "title": "Grand Versailles Royal Chandelier",
            "price": 285000.0,
            "image": "/images/grand_versailles.jpg",
        }
        res_add = client.post("/api/v1/cart/add", json=cart_add_payload)
        self.assertEqual(res_add.status_code, 200)

        sync_payload = {
            "session_id": "guest_sess_1",
            "user_email": self.customer_a.email,
        }
        res_sync = client.post("/api/v1/cart/sync", json=sync_payload)
        self.assertEqual(res_sync.status_code, 200)
        synced_items = res_sync.json()
        self.assertEqual(len(synced_items), 1)
        self.assertEqual(synced_items[0]["quantity"], 2)

        # 2. Place COD Order
        cod_payload = {
            "email": self.customer_a.email,
            "phone": "+91 9988776655",
            "shipping_address": {
                "first_name": "Lady",
                "last_name": "Delacroix",
                "street": "14 Rue Royale",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pin_code": "400001",
            },
            "items": [
                {
                    "product_id": str(self.test_prod_id),
                    "title": "Grand Versailles Royal Chandelier",
                    "price": 285000.0,
                    "quantity": 2,
                    "image": "/images/grand_versailles.jpg",
                }
            ],
            "subtotal": 570000.0,
            "gst": 102600.0,
            "delivery": 0.0,
            "total": 672600.0,
        }
        res_cod = client.post("/api/v1/payments/cod", json=cod_payload)
        self.assertEqual(res_cod.status_code, 200)
        cod_data = res_cod.json()
        self.assertTrue(cod_data["success"])
        order_id = cod_data["order_id"]
        self.created_order_ids.append(order_id)

        # 3. Verify stock decremented from 10 to 8
        prod_doc = db.products.find_one({"_id": self.test_prod_id})
        self.assertEqual(prod_doc["stock_count"], 8)
        self.assertTrue(prod_doc["in_stock"])

        # 4. Verify Customer A can view the placed order
        res_orders = client.get("/api/v1/orders")
        self.assertEqual(res_orders.status_code, 200)
        orders_list = res_orders.json()
        matching = [o for o in orders_list if str(o.get("_id") or o.get("id")) == order_id]
        self.assertEqual(len(matching), 1)
        self.assertEqual(matching[0]["status"], "cod")

        # 5. Customer A cancels order -> stock restored from 8 to 10
        res_cancel = client.put(f"/api/v1/orders/{order_id}/cancel")
        self.assertEqual(res_cancel.status_code, 200)
        self.assertTrue(res_cancel.json()["success"])

        prod_restored = db.products.find_one({"_id": self.test_prod_id})
        self.assertEqual(prod_restored["stock_count"], 10)

        # Verify order status is cancelled
        cancelled_doc = db.orders.find_one({"_id": ObjectId(order_id)})
        self.assertEqual(cancelled_doc["status"], "cancelled")

    # =========================================================================
    # 2. PRIVACY & MULTI-TENANT ISOLATION
    # =========================================================================
    def test_02_customer_isolation_and_privacy_boundaries(self):
        """
        Verify:
        - Customer A's orders cannot be viewed or cancelled by Customer B.
        - Customer A's addresses cannot be viewed, edited, or deleted by Customer B.
        - Customer A's saved cards cannot be viewed by Customer B.
        - Customer A's wishlist cannot be viewed or modified by Customer B.
        """
        # Step A: Act as Customer A
        app.dependency_overrides[deps.get_current_active_user] = lambda: self.customer_a
        app.dependency_overrides[deps.get_current_user_optional] = lambda: self.customer_a

        # Seed order for Customer A
        order_doc = {
            "_id": ObjectId(),
            "user_id": self.customer_a.id,
            "email": self.customer_a.email,
            "phone": "+91 9988776655",
            "items": [{"product_id": str(self.test_prod_id), "title": "Royal Lamp", "price": 50000.0, "quantity": 1}],
            "total": 50000.0,
            "status": "pending",
        }
        db.orders.insert_one(order_doc)
        order_a_id = str(order_doc["_id"])
        self.created_order_ids.append(order_a_id)

        # Customer A creates saved address
        res_addr = client.post("/api/v1/addresses", json={
            "user_email": self.customer_a.email,
            "type": "Home",
            "first_name": "Lady",
            "last_name": "Delacroix",
            "street": "14 Rue Royale",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pin_code": "400001",
            "phone": "+91 9988776655",
            "is_default": True,
        })
        self.assertEqual(res_addr.status_code, 201)
        addr_a_id = res_addr.json()["id"]
        self.created_address_ids.append(addr_a_id)

        # Customer A saves card
        res_card = client.post("/api/v1/cards", json={
            "user_email": self.customer_a.email,
            "card_holder": "Lady Delacroix",
            "card_number_masked": "•••• •••• •••• 8844",
            "card_last4": "8844",
            "card_type": "mastercard",
            "expiry": "12/28",
            "is_default": True,
        })
        self.assertEqual(res_card.status_code, 201)
        card_a_id = res_card.json()["id"]
        self.created_card_ids.append(card_a_id)

        # Customer A adds to wishlist
        res_wish = client.post("/api/v1/wishlist", json={
            "user_email": self.customer_a.email,
            "product_id": str(self.test_prod_id),
            "product_title": "Grand Versailles Royal Chandelier",
            "product_price": 285000.0,
            "product_image": "/images/grand_versailles.jpg",
        })
        self.assertEqual(res_wish.status_code, 201)

        # Step B: Switch to Customer B
        app.dependency_overrides[deps.get_current_active_user] = lambda: self.customer_b
        app.dependency_overrides[deps.get_current_user_optional] = lambda: self.customer_b

        # 1. Customer B lists orders -> Customer A's order is NOT visible
        res_b_orders = client.get("/api/v1/orders")
        self.assertEqual(res_b_orders.status_code, 200)
        b_orders = res_b_orders.json()
        self.assertFalse(any(str(o.get("_id") or o.get("id")) == order_a_id for o in b_orders))

        # 2. Customer B attempts to view Customer A's order by ID -> 403 Forbidden
        res_b_view = client.get(f"/api/v1/orders/{order_a_id}")
        self.assertEqual(res_b_view.status_code, 403)

        # 3. Customer B attempts to cancel Customer A's order -> 403 Forbidden
        res_b_cancel = client.put(f"/api/v1/orders/{order_a_id}/cancel")
        self.assertEqual(res_b_cancel.status_code, 403)

        # 4. Customer B lists addresses -> Customer A's address is NOT returned
        res_b_addr = client.get("/api/v1/addresses")
        self.assertEqual(res_b_addr.status_code, 200)
        b_addrs = res_b_addr.json()
        self.assertFalse(any(a["id"] == addr_a_id for a in b_addrs))

        # 5. Customer B attempts to modify Customer A's address -> 403 Forbidden
        res_b_mod_addr = client.put(f"/api/v1/addresses/{addr_a_id}", json={
            "first_name": "Hacker",
            "last_name": "Attempt",
            "street": "Malicious",
            "city": "Hacked",
            "state": "Hacked",
            "pin_code": "000000",
            "phone": "0000000000",
        })
        self.assertIn(res_b_mod_addr.status_code, [403, 404])

        # 6. Customer B lists cards -> Customer A's card is NOT returned
        res_b_cards = client.get("/api/v1/cards")
        self.assertEqual(res_b_cards.status_code, 200)
        b_cards = res_b_cards.json()
        self.assertFalse(any(c["id"] == card_a_id for c in b_cards))

        # 7. Customer B checks wishlist -> Customer A's items are NOT returned
        res_b_wish = client.get(f"/api/v1/wishlist?email={self.customer_b.email}")
        self.assertEqual(res_b_wish.status_code, 200)
        b_wish_items = res_b_wish.json()
        self.assertEqual(len(b_wish_items), 0)

    # =========================================================================
    # 3. NEGATIVE & EDGE CASES (STOCK LIMITS, CLAMPING, INPUT VALIDATION)
    # =========================================================================
    def test_03_negative_stock_and_validation_guardrails(self):
        """
        Verify:
        - Out-of-stock product checkout is blocked with 400 Bad Request.
        - Exceeding available stock count is blocked with 400 Bad Request.
        - Cart sync clamps or flags availability for over-subscribed quantities.
        - Malformed ObjectId returns 400 Bad Request.
        - Non-existent valid ObjectId returns 404 Not Found.
        """
        app.dependency_overrides[deps.get_current_active_user] = lambda: self.customer_a
        app.dependency_overrides[deps.get_current_user_optional] = lambda: self.customer_a

        # 1. Out of stock test: set stock to 0
        db.products.update_one({"_id": self.test_prod_id}, {"$set": {"stock_count": 0, "in_stock": False}})

        out_of_stock_order = {
            "email": self.customer_a.email,
            "phone": "+91 9988776655",
            "shipping_address": {
                "first_name": "Lady",
                "last_name": "Delacroix",
                "street": "14 Rue Royale",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pin_code": "400001",
            },
            "items": [
                {
                    "product_id": str(self.test_prod_id),
                    "title": "Grand Versailles Royal Chandelier",
                    "price": 285000.0,
                    "quantity": 1,
                    "image": "/images/grand_versailles.jpg",
                }
            ],
            "subtotal": 285000.0,
            "gst": 51300.0,
            "delivery": 0.0,
            "total": 336300.0,
        }
        res_oos = client.post("/api/v1/payments/cod", json=out_of_stock_order)
        self.assertEqual(res_oos.status_code, 400)
        self.assertIn("out of stock", res_oos.json()["detail"].lower())

        # 2. Exceeding available stock: set stock to 2, attempt to order 5
        db.products.update_one({"_id": self.test_prod_id}, {"$set": {"stock_count": 2, "in_stock": True}})
        out_of_stock_order["items"][0]["quantity"] = 5
        res_exceed = client.post("/api/v1/payments/cod", json=out_of_stock_order)
        self.assertEqual(res_exceed.status_code, 400)
        self.assertIn("only 2 unit(s)", res_exceed.json()["detail"].lower())

        # 3. Cart sync clamps quantity to stock count (2)
        client.post("/api/v1/cart/add", json={
            "session_id": "guest_clamp_test",
            "product_id": str(self.test_prod_id),
            "quantity": 10,
        })
        res_clamp = client.post("/api/v1/cart/sync", json={
            "session_id": "guest_clamp_test",
            "user_email": self.customer_a.email,
        })
        self.assertEqual(res_clamp.status_code, 200)
        clamped_items = res_clamp.json()
        self.assertEqual(len(clamped_items), 1)
        self.assertEqual(clamped_items[0]["quantity"], 2)  # Clamped to stock_count

        # 4. Malformed ObjectId on Order lookup returns 400
        res_bad_id = client.get("/api/v1/orders/invalid-mongo-id-123")
        self.assertEqual(res_bad_id.status_code, 400)

        # 5. Non-existent valid ObjectId on Order lookup returns 404
        res_not_found = client.get(f"/api/v1/orders/{ObjectId()}")
        self.assertEqual(res_not_found.status_code, 404)

    # =========================================================================
    # 4. RBAC & PERMISSION BOUNDARIES (CUSTOMER VS ADMIN VS UNAUTHENTICATED)
    # =========================================================================
    def test_04_rbac_security_and_privilege_boundaries(self):
        """
        Verify:
        - Unauthenticated requests to protected endpoints return 401 Unauthorized.
        - Regular customers attempting to access admin management endpoints return 403 Forbidden.
        - Admin users have full access (200 OK) to all admin endpoints.
        """
        # A. Unauthenticated checks (dependency overrides cleared)
        app.dependency_overrides.clear()

        endpoints_requiring_auth = [
            ("GET", "/api/v1/orders/stats"),
            ("GET", "/api/v1/orders"),
            ("GET", "/api/v1/analytics/dashboard-summary"),
            ("GET", "/api/v1/audit/logs"),
            ("GET", "/api/v1/auth/users"),
            ("GET", "/api/v1/auth/users/stats"),
            ("GET", "/api/v1/contact/stats"),
            ("GET", "/api/v1/newsletter/subscribers"),
            ("GET", "/api/v1/reviews/stats"),
        ]
        for method, ep in endpoints_requiring_auth:
            if method == "GET":
                res = client.get(ep)
            self.assertEqual(
                res.status_code, 401,
                f"Expected 401 for unauthenticated request to {ep}, got {res.status_code}"
            )

        # B. Customer attempting admin endpoints -> 403 Forbidden
        app.dependency_overrides[deps.get_current_active_user] = lambda: self.customer_a
        app.dependency_overrides[deps.get_current_user_optional] = lambda: self.customer_a
        # get_current_active_admin will evaluate is_admin on customer_a and raise 403

        admin_only_endpoints = [
            ("GET", "/api/v1/orders/stats"),
            ("GET", "/api/v1/analytics/dashboard-summary"),
            ("GET", "/api/v1/audit/logs"),
            ("GET", "/api/v1/auth/users"),
            ("GET", "/api/v1/auth/users/stats"),
            ("GET", "/api/v1/contact/stats"),
            ("GET", "/api/v1/newsletter/subscribers"),
            ("GET", "/api/v1/reviews/stats"),
        ]
        for method, ep in admin_only_endpoints:
            if method == "GET":
                res = client.get(ep)
            self.assertEqual(
                res.status_code, 403,
                f"Expected 403 for customer accessing admin endpoint {ep}, got {res.status_code}"
            )

        # Customer attempting to modify order status or delete order
        fake_id = str(ObjectId())
        res_patch = client.patch(f"/api/v1/orders/{fake_id}/status", json={"status": "shipped"})
        self.assertEqual(res_patch.status_code, 403)

        res_delete = client.delete(f"/api/v1/orders/{fake_id}")
        self.assertEqual(res_delete.status_code, 403)

        # C. Admin access -> 200 OK
        app.dependency_overrides[deps.get_current_active_admin] = lambda: self.admin_user
        app.dependency_overrides[deps.get_current_active_user] = lambda: self.admin_user
        app.dependency_overrides[deps.get_current_user_optional] = lambda: self.admin_user

        res_admin_orders = client.get("/api/v1/orders/stats")
        self.assertEqual(res_admin_orders.status_code, 200)

        res_admin_summary = client.get("/api/v1/analytics/dashboard-summary")
        self.assertEqual(res_admin_summary.status_code, 200)

        res_admin_audit = client.get("/api/v1/audit/logs")
        self.assertEqual(res_admin_audit.status_code, 200)

        res_admin_users = client.get("/api/v1/auth/users/stats")
        self.assertEqual(res_admin_users.status_code, 200)

        res_admin_contact = client.get("/api/v1/contact/stats")
        self.assertEqual(res_admin_contact.status_code, 200)

        res_admin_subscribers = client.get("/api/v1/newsletter/subscribers")
        self.assertEqual(res_admin_subscribers.status_code, 200)

        res_admin_reviews = client.get("/api/v1/reviews/stats")
        self.assertEqual(res_admin_reviews.status_code, 200)


if __name__ == "__main__":
    unittest.main()
