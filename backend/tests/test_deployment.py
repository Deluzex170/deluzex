"""Deployment smoke checks without external database or provider access."""
import asyncio
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
from app.api.endpoints import cart


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

if __name__ == "__main__":
    unittest.main()
