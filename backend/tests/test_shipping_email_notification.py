import unittest
from unittest.mock import patch
import os
import sys
from bson import ObjectId

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.email import (
    get_courier_tracking_url,
    build_shipping_notification_email_html,
    send_shipping_notification_email
)
from app.api import deps
from app.core.database import db
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

class TestShippingEmailNotification(unittest.TestCase):
    def setUp(self):
        self.sample_order = {
            "email": "patron@deluzex.com",
            "phone": "+91 9876543210",
            "shipping_address": {
                "first_name": "Julian",
                "last_name": "Vance",
                "street": "12 Kensington Park",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pin_code": "400050"
            },
            "items": [
                {
                    "product_id": "test_chandelier_1",
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
            "payment_method": "online",
            "status": "processing"
        }

    def test_01_courier_tracking_urls(self):
        """Test URL generator for various Indian and global luxury couriers."""
        self.assertIn("bluedart.com", get_courier_tracking_url("BlueDart Express", "BD123456789"))
        self.assertIn("delhivery.com", get_courier_tracking_url("Delhivery Surface", "DEL987654321"))
        self.assertIn("shiprocket.co", get_courier_tracking_url("Shiprocket Prime", "SR55443322"))
        self.assertIn("dtdc.in", get_courier_tracking_url("DTDC Air", "D11223344"))
        self.assertIn("fedex.com", get_courier_tracking_url("FedEx Priority", "FX99887766"))
        self.assertIn("google.com", get_courier_tracking_url("Custom Courier", "CUST12345"))
        self.assertEqual("", get_courier_tracking_url("BlueDart", ""))

    def test_02_html_template_renders_tracking_data(self):
        """Test that generated shipping notification HTML contains essential luxury elements."""
        html = build_shipping_notification_email_html(
            self.sample_order,
            tracking_number="BD123456789",
            courier_partner="BlueDart Express"
        )
        self.assertIn("DELUZEX", html)
        self.assertIn("Shipped", html)
        self.assertIn("BD123456789", html)
        self.assertIn("BlueDart Express", html)
        self.assertIn("bluedart.com", html)
        self.assertIn("Aura Radiant Chandelier", html)
        self.assertIn("Julian Vance", html)

    def test_03_send_shipping_notification_email_dispatches(self):
        """Test that send_shipping_notification_email dispatches via SMTP without error."""
        with patch("app.services.email._send_smtp_message", return_value={"success": True}) as mock_smtp:
            res = send_shipping_notification_email(
                self.sample_order,
                tracking_number="BD123456789",
                courier_partner="BlueDart Express"
            )
            self.assertTrue(res.get("success"))
            self.assertTrue(mock_smtp.called)

    def test_04_status_update_to_shipped_triggers_email(self):
        """Integration test: PATCH /orders/{id}/status to 'shipped' sends notification."""
        order_doc = self.sample_order.copy()
        ins = db.orders.insert_one(order_doc)
        oid = str(ins.inserted_id)

        from types import SimpleNamespace
        admin_mock = SimpleNamespace(
            id=str(ObjectId()),
            email="admin@deluzex.com",
            first_name="Admin",
            last_name="Tester",
            is_admin=True,
            is_active=True,
            is_verified=True,
        )
        app.dependency_overrides[deps.get_current_active_admin] = lambda: admin_mock

        try:
            with patch("app.api.endpoints.orders.send_shipping_notification_email", return_value={"success": True}) as mock_notify:
                res = client.patch(
                    f"/api/v1/orders/{oid}/status",
                    json={
                        "status": "shipped",
                        "tracking_number": "BD998877",
                        "courier_partner": "BlueDart"
                    }
                )
                self.assertEqual(res.status_code, 200)
                self.assertTrue(mock_notify.called)
        finally:
            app.dependency_overrides.clear()
            db.orders.delete_one({"_id": ObjectId(oid)})

    def test_05_status_update_to_non_shipped_does_not_trigger_email(self):
        """Integration test: PATCH to 'delivered' does not trigger shipping notification email."""
        order_doc = self.sample_order.copy()
        order_doc["status"] = "shipped"
        ins = db.orders.insert_one(order_doc)
        oid = str(ins.inserted_id)

        from types import SimpleNamespace
        admin_mock = SimpleNamespace(
            id=str(ObjectId()),
            email="admin@deluzex.com",
            first_name="Admin",
            last_name="Tester",
            is_admin=True,
            is_active=True,
            is_verified=True,
        )
        app.dependency_overrides[deps.get_current_active_admin] = lambda: admin_mock

        try:
            with patch("app.api.endpoints.orders.send_shipping_notification_email", return_value={"success": True}) as mock_notify:
                res = client.patch(
                    f"/api/v1/orders/{oid}/status",
                    json={
                        "status": "delivered"
                    }
                )
                self.assertEqual(res.status_code, 200)
                self.assertFalse(mock_notify.called)
        finally:
            app.dependency_overrides.clear()
            db.orders.delete_one({"_id": ObjectId(oid)})

if __name__ == "__main__":
    unittest.main()
