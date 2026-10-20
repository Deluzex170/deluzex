import unittest
import sys
import os
from types import SimpleNamespace

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from bson import ObjectId
from fastapi.testclient import TestClient
from main import app
from app.api import deps
from app.core.database import db

client = TestClient(app)

class TestAdminOrders(unittest.TestCase):
    def setUp(self):
        self.admin_user = SimpleNamespace(
            id=str(ObjectId()),
            email="admin@deluzex.com",
            first_name="Admin",
            last_name="Tester",
            is_admin=True,
            is_active=True,
            is_verified=True,
        )
        app.dependency_overrides[deps.get_current_active_admin] = lambda: self.admin_user
        app.dependency_overrides[deps.get_current_active_user] = lambda: self.admin_user
        app.dependency_overrides[deps.get_current_user_optional] = lambda: self.admin_user

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_01_order_stats_endpoint(self):
        """Positive test: GET /api/v1/orders/stats returns status dictionary"""
        response = client.get("/api/v1/orders/stats")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("total_orders", data)
        self.assertIn("pending", data)
        self.assertIn("processing", data)
        self.assertIn("shipped", data)
        self.assertIn("delivered", data)
        self.assertIn("cancelled", data)
        self.assertIn("total_revenue", data)
        self.assertIsInstance(data["total_orders"], int)
        self.assertIsInstance(data["total_revenue"], (int, float))

    def test_02_admin_order_crud_flow(self):
        """Positive test: Create, List, Filter, Status Update with Tracking, and Delete order"""
        test_order_payload = {
            "email": "test_client_delux@example.com",
            "phone": "+91 9876543210",
            "shipping_address": {
                "first_name": "Antigravity",
                "last_name": "Tester",
                "street": "100 Gold Boulevard",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pin_code": "400001"
            },
            "items": [
                {
                    "product_id": "test_prod_1",
                    "title": "Aura Radiant Chandelier",
                    "price": 125000.0,
                    "quantity": 1,
                    "image": "/images/card1.jpg"
                }
            ],
            "subtotal": 105932.2,
            "gst": 19067.8,
            "delivery": 0.0,
            "total": 125000.0,
            "payment_method": "cod",
            "notes": "Fragile white-glove packaging requested"
        }

        # 1. Create order
        create_res = client.post("/api/v1/orders", json=test_order_payload)
        self.assertEqual(create_res.status_code, 201)
        created_order = create_res.json()
        order_id = created_order.get("id") or created_order.get("_id")
        self.assertIsNotNone(order_id)
        self.assertEqual(created_order["status"], "cod")

        try:
            # 2. List orders and search by ID
            list_res = client.get(f"/api/v1/orders?search={order_id}")
            self.assertEqual(list_res.status_code, 200)
            found_orders = list_res.json()
            self.assertGreaterEqual(len(found_orders), 1)
            self.assertTrue(any((o.get("id") == order_id or o.get("_id") == order_id) for o in found_orders))

            # 3. Update status to 'shipped' with courier partner and tracking
            patch_res = client.patch(
                f"/api/v1/orders/{order_id}/status",
                json={
                    "status": "shipped",
                    "tracking_number": "BLUEDART-8829104",
                    "courier_partner": "BlueDart Express",
                    "notes": "Dispatched via express air delivery"
                }
            )
            self.assertEqual(patch_res.status_code, 200)
            updated_data = patch_res.json()
            self.assertEqual(updated_data["status"], "shipped")
            self.assertEqual(updated_data["tracking_number"], "BLUEDART-8829104")
            self.assertEqual(updated_data["courier_partner"], "BlueDart Express")

            # 4. Update status to 'delivered'
            delivered_res = client.patch(
                f"/api/v1/orders/{order_id}/status",
                json={
                    "status": "delivered",
                    "notes": "Delivered and signed by client"
                }
            )
            self.assertEqual(delivered_res.status_code, 200)
            self.assertEqual(delivered_res.json()["status"], "delivered")

        finally:
            # 5. Clean up - delete order
            del_res = client.delete(f"/api/v1/orders/{order_id}")
            self.assertEqual(del_res.status_code, 200)
            self.assertTrue(del_res.json().get("success"))

    def test_03_negative_invalid_order_id(self):
        """Negative test: Invalid order ID formats should return 400 Bad Request"""
        res1 = client.get("/api/v1/orders/invalid-mongo-id-123")
        self.assertEqual(res1.status_code, 400)

        res2 = client.patch("/api/v1/orders/invalid-mongo-id-123/status", json={"status": "shipped"})
        self.assertEqual(res2.status_code, 400)

        res3 = client.delete("/api/v1/orders/invalid-mongo-id-123")
        self.assertEqual(res3.status_code, 400)

    def test_04_negative_non_existent_order(self):
        """Negative test: Non-existent valid ObjectId should return 404 Not Found"""
        fake_id = str(ObjectId())
        res1 = client.get(f"/api/v1/orders/{fake_id}")
        self.assertEqual(res1.status_code, 404)

        res2 = client.patch(f"/api/v1/orders/{fake_id}/status", json={"status": "shipped"})
        self.assertEqual(res2.status_code, 404)

        res3 = client.delete(f"/api/v1/orders/{fake_id}")
        self.assertEqual(res3.status_code, 404)

    def test_05_unauthorized_order_endpoints(self):
        """Negative test: Unauthenticated requests to admin stats and orders return 401 Unauthorized"""
        app.dependency_overrides.clear()
        res1 = client.get("/api/v1/orders/stats")
        self.assertEqual(res1.status_code, 401)

        res2 = client.get("/api/v1/orders")
        self.assertEqual(res2.status_code, 401)

        fake_id = str(ObjectId())
        res3 = client.patch(f"/api/v1/orders/{fake_id}/status", json={"status": "shipped"})
        self.assertEqual(res3.status_code, 401)

        res4 = client.delete(f"/api/v1/orders/{fake_id}")
        self.assertEqual(res4.status_code, 401)

if __name__ == "__main__":
    unittest.main()
