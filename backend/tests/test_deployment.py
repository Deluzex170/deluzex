"""Deployment smoke checks without external database or provider access."""
import asyncio
from datetime import datetime
import importlib.util
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import MagicMock, patch

import httpx

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
with patch.dict(os.environ, {"MONGODB_URI": "mongodb://127.0.0.1:27017"}):
    import main
from app.api.endpoints import auth, cart


class DeploymentTests(unittest.TestCase):
    def request(self, method, path, **kwargs):
        async def send():
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=main.app), base_url="http://test"
            ) as client:
                return await client.request(method, path, **kwargs)
        return asyncio.run(send())

    def test_real_app_health_and_openapi(self):
        response = self.request("GET", "/api/v1/health-check")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        paths = self.request("GET", "/api/v1/openapi.json").json()["paths"]
        for path in ("/api/v1/analytics/visit", "/api/v1/cart/{identifier}",
                     "/api/v1/auth/login"):
            self.assertIn(path, paths)

    def test_guest_cart_route_reaches_backend(self):
        database = MagicMock()
        database.cart_items.find.return_value = []
        with patch.object(cart, "db", database):
            response = self.request("GET", "/api/v1/cart/guest_deployment_test")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])
        database.cart_items.find.assert_called_once()

    def test_api_post_routes_validate_requests_instead_of_404(self):
        for path in ("/api/v1/analytics/visit", "/api/v1/auth/login"):
            with self.subTest(path=path):
                response = self.request("POST", path, json={})
                self.assertEqual(response.status_code, 422)

    def test_legacy_entrypoint_does_not_hide_import_failures(self):
        spec = importlib.util.spec_from_file_location("legacy_entry", ROOT / "api/index.py")
        module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {"main": None}):
            with self.assertRaises(ModuleNotFoundError):
                spec.loader.exec_module(module)

    def test_unverified_login_explains_403_without_issuing_token(self):
        database = MagicMock()
        database.users.find_one.return_value = {
            "email": "test@example.com", "hashed_password": "test-hash",
            "is_active": True, "is_verified": False, "is_admin": False,
        }
        database.email_otps.find_one.return_value = {"created_at": datetime.utcnow(), "sent_at": datetime.utcnow()}
        with patch.object(auth, "db", database), \
             patch.object(auth, "verify_password", return_value=True), \
             patch.object(auth, "_issue_and_send_email_otp") as send_otp:
            response = self.request("POST", "/api/v1/auth/login", json={
                "email": "test@example.com", "password": "test-password",
            })
        self.assertEqual(response.status_code, 403)
        self.assertIn("EMAIL_NOT_VERIFIED", response.json()["detail"])
        self.assertNotIn("access_token", response.json())
        send_otp.assert_not_called()

    def test_login_reports_email_delivery_failure(self):
        database = MagicMock()
        database.users.find_one.return_value = {
            "email": "test@example.com", "hashed_password": "test-hash",
            "is_active": True, "is_verified": False, "is_admin": False,
        }
        database.email_otps.find_one.return_value = None
        with patch.object(auth, "db", database), \
             patch.object(auth, "verify_password", return_value=True), \
             patch.object(auth, "_issue_and_send_email_otp", return_value={
                 "send_res": {"success": False, "error": "SMTP connection closed during authentication."}
             }):
            response = self.request("POST", "/api/v1/auth/login", json={
                "email": "test@example.com", "password": "test-password",
            })
        self.assertEqual(response.status_code, 503)
        self.assertIn("SMTP connection closed during authentication", response.json()["detail"])
        self.assertNotIn("access_token", response.json())

if __name__ == "__main__":
    unittest.main()
