import unittest
import sys
import os
from unittest.mock import MagicMock, patch
from bson import ObjectId

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.email import (
    build_order_confirmation_email_html,
    build_order_confirmation_email_text,
    send_order_confirmation_email,
)

class TestOrderConfirmationEmail(unittest.TestCase):
    def setUp(self):
        self.sample_order = {
            "_id": ObjectId("665432101234567890abcdef"),
            "email": "luxurypatron@deluzex.com",
            "phone": "+91 9876543210",
            "shipping_address": {
                "first_name": "Eleanor",
                "last_name": "Vance",
                "street": "12 Kensington Palace Gardens",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pin_code": "400001",
            },
            "items": [
                {
                    "product_id": "prod_1",
                    "title": "Aura Radiant Chandelier",
                    "price": 125000.0,
                    "quantity": 1,
                    "image": "https://deluzex.com/images/chandelier.jpg",
                },
                {
                    "product_id": "prod_2",
                    "title": "Celeste Velvet Wall Sconce",
                    "price": 32000.0,
                    "quantity": 2,
                    "image": "https://deluzex.com/images/sconce.jpg",
                },
            ],
            "subtotal": 189000.0,
            "gst": 34020.0,
            "delivery": 0.0,
            "total": 223020.0,
            "payment_method": "upi",
            "status": "paid",
        }

    def test_01_build_html_template_renders_all_fields(self):
        """Positive test: HTML template renders customer, order ID, line items and totals"""
        html = build_order_confirmation_email_html(self.sample_order)
        self.assertIn("Eleanor Vance", html)
        self.assertIn("Aura Radiant Chandelier", html)
        self.assertIn("Celeste Velvet Wall Sconce", html)
        self.assertIn("66543210", html)
        self.assertIn("223,020", html)
        self.assertIn("12 Kensington Palace Gardens", html)
        self.assertIn("DELUZEX", html)

    def test_02_build_text_template_renders_properly(self):
        """Positive test: Plain text email fallback contains essential order metadata"""
        text = build_order_confirmation_email_text(self.sample_order)
        self.assertIn("Eleanor", text)
        self.assertIn("66543210", text)
        self.assertIn("Aura Radiant Chandelier", text)
        self.assertIn("223,020", text)

    def test_03_send_order_confirmation_email_success(self):
        """Positive test: Sending order confirmation returns success when SMTP succeeds"""
        with patch("app.services.email._send_smtp_message", return_value={"success": True}) as mock_send:
            result = send_order_confirmation_email(self.sample_order)
            self.assertTrue(result["success"])
            mock_send.assert_called_once()
            args, _ = mock_send.call_args
            msg, to_email = args
            self.assertEqual(to_email, "luxurypatron@deluzex.com")
            self.assertIn("Order Confirmation #66543210", msg["Subject"])

    def test_04_send_order_confirmation_missing_email_fails_gracefully(self):
        """Negative test: Missing email in order does not raise, returns failure dict"""
        invalid_order = self.sample_order.copy()
        invalid_order["email"] = ""
        result = send_order_confirmation_email(invalid_order)
        self.assertFalse(result["success"])
        self.assertIn("error", result)

    def test_05_smtp_exception_does_not_raise(self):
        """Edge case: Unexpected exception in sending returns safe error dictionary"""
        with patch("app.services.email._send_smtp_message", side_effect=Exception("Connection drop")):
            result = send_order_confirmation_email(self.sample_order)
            self.assertFalse(result["success"])
            self.assertIn("Connection drop", result.get("error", ""))

    def test_06_verify_payment_triggers_confirmation_email(self):
        """Integration test: verify_payment dispatches order confirmation email"""
        from fastapi.testclient import TestClient
        from main import app
        from app.core.database import db

        client = TestClient(app)
        test_oid = db.orders.insert_one(self.sample_order.copy()).inserted_id
        db.orders.update_one({"_id": test_oid}, {"$set": {"status": "pending"}})

        try:
            with patch("app.services.razorpay.verify_payment_signature", return_value=True), \
                 patch("app.api.endpoints.payments.send_order_confirmation_email", return_value={"success": True}) as mock_email:
                res = client.post("/api/v1/payments/verify", json={
                    "order_id": str(test_oid),
                    "razorpay_order_id": "order_test_123",
                    "razorpay_payment_id": "pay_test_456",
                    "razorpay_signature": "sig_valid_test",
                })
                self.assertEqual(res.status_code, 200)
                mock_email.assert_called_once()
        finally:
            db.orders.delete_one({"_id": test_oid})

    def test_07_cod_order_triggers_confirmation_email(self):
        """Integration test: create_cod_order dispatches order confirmation email"""
        from fastapi.testclient import TestClient
        from main import app
        from app.core.database import db

        client = TestClient(app)
        cod_payload = {
            "email": "codpatron@deluzex.com",
            "phone": "+91 9999988888",
            "shipping_address": {
                "first_name": "Alexander",
                "last_name": "Pierce",
                "street": "44 Mayfair Crescent",
                "city": "Bengaluru",
                "state": "Karnataka",
                "pin_code": "560001",
            },
            "items": [
                {
                    "product_id": "prod_cod_1",
                    "title": "Bespoke Luminaire",
                    "price": 85000.0,
                    "quantity": 1,
                    "image": "/images/card1.jpg",
                }
            ],
            "subtotal": 85000.0,
            "gst": 15300.0,
            "delivery": 0.0,
            "total": 100300.0,
        }

        with patch("app.api.endpoints.payments.send_order_confirmation_email", return_value={"success": True}) as mock_email:
            res = client.post("/api/v1/payments/cod", json=cod_payload)
            self.assertEqual(res.status_code, 200)
            mock_email.assert_called_once()
            created_id = res.json().get("order_id")
            if created_id and ObjectId.is_valid(created_id):
                db.orders.delete_one({"_id": ObjectId(created_id)})

if __name__ == "__main__":
    unittest.main()

