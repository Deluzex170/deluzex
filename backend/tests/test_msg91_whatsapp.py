import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch, MagicMock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.services import whatsapp
from app.core.config import settings


class TestMsg91WhatsApp(unittest.TestCase):
    def test_phone_normalization(self):
        self.assertEqual(whatsapp.normalize_phone_number("9876543210"), "919876543210")
        self.assertEqual(whatsapp.normalize_phone_number("+91 98765-43210"), "919876543210")
        self.assertEqual(whatsapp.normalize_phone_number("+1 (711) 508-6207"), "17115086207")

    def test_unconfigured_whatsapp_returns_clean_error(self):
        with patch.multiple(settings, MSG91_AUTH_KEY="", WHATSAPP_ACCESS_TOKEN="", WHATSAPP_PHONE_NUMBER_ID=""):
            result = whatsapp.send_whatsapp_otp("9876543210", "123456")
            self.assertFalse(result["success"])
            self.assertIn("not configured", result["error"])

    @patch("httpx.Client.post")
    def test_msg91_otp_dispatch_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.is_success = True
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "success",
            "message": "Campaign submitted successfully",
            "request_id": "req_123456",
        }
        mock_post.return_value = mock_response

        with patch.multiple(
            settings,
            MSG91_AUTH_KEY="test_authkey_91",
            MSG91_INTEGRATED_NUMBER="17115086207",
            MSG91_WHATSAPP_TEMPLATE_NAME="auth",
        ):
            res = whatsapp.send_whatsapp_otp("9876543210", "654321")

            self.assertTrue(res["success"])
            self.assertEqual(res["provider"], "msg91")
            mock_post.assert_called_once()
            call_kwargs = mock_post.call_args.kwargs
            self.assertEqual(call_kwargs["headers"]["authkey"], "test_authkey_91")
            payload = call_kwargs["json"]
            self.assertEqual(payload["integrated_number"], "17115086207")
            template = payload["payload"]["template"]
            self.assertEqual(template["name"], "auth")
            to_and_components = template["to_and_components"][0]
            self.assertEqual(to_and_components["to"], ["919876543210"])
            self.assertEqual(to_and_components["components"]["body_1"]["value"], "654321")

    @patch("httpx.Client.post")
    def test_msg91_otp_button_fallback_retry(self, mock_post):
        # 1st call fails due to template having no button parameter
        mock_fail_resp = MagicMock()
        mock_fail_resp.is_success = False
        mock_fail_resp.status_code = 400
        mock_fail_resp.text = "Template does not contain button parameter"

        # 2nd call succeeds with body only
        mock_succ_resp = MagicMock()
        mock_succ_resp.is_success = True
        mock_succ_resp.status_code = 200
        mock_succ_resp.json.return_value = {"status": "success", "request_id": "req_789"}

        mock_post.side_effect = [mock_fail_resp, mock_succ_resp]

        with patch.multiple(
            settings,
            MSG91_AUTH_KEY="test_authkey_91",
            MSG91_INTEGRATED_NUMBER="17115086207",
            MSG91_WHATSAPP_TEMPLATE_NAME="auth",
        ):
            res = whatsapp.send_whatsapp_otp("9876543210", "112233")
            self.assertTrue(res["success"])
            self.assertEqual(mock_post.call_count, 2)
            # Second call should not have button_1
            second_payload = mock_post.call_args_list[1].kwargs["json"]
            components = second_payload["payload"]["template"]["to_and_components"][0]["components"]
            self.assertIn("body_1", components)
            self.assertNotIn("button_1", components)


if __name__ == "__main__":
    unittest.main()
