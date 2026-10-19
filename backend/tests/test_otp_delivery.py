from datetime import datetime
from unittest import TestCase
from unittest.mock import MagicMock, patch
from bson import ObjectId
import test_deployment as deployment
from app.api.endpoints import auth


class FirstOtpTests(TestCase):
    request = deployment.DeploymentTests.request

    def setUp(self):
        self.database = MagicMock()
        self.database.users.find_one.return_value = None
        self.database.users.insert_one.return_value.inserted_id = ObjectId()
        self.patchers = [patch.object(auth, "db", self.database),
                         patch.object(auth, "record_audit_event"),
                         patch.object(auth, "get_password_hash", return_value="test-hash")]
        for patcher in self.patchers:
            patcher.start(); self.addCleanup(patcher.stop)

    def test_signup_sends_first_code_and_starts_cooldown_after_acceptance(self):
        with patch.object(auth, "send_verification_email", return_value={"success": True}) as send:
            response = self.request("POST", "/api/v1/auth/register", json={"email": "test@example.com", "password": "test-password"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()["otp_sent"])
        self.assertEqual(response.json()["retry_after"], 45)
        send.assert_called_once()
        self.assertEqual(len(send.call_args.kwargs["otp"]), 6)
        self.assertIn("sent_at", self.database.email_otps.update_one.call_args.args[1]["$set"])

    def test_failed_first_send_does_not_claim_success_or_force_cooldown(self):
        with patch.object(auth, "send_verification_email", return_value={"success": False, "error": "SMTP offline"}):
            response = self.request("POST", "/api/v1/auth/register", json={"email": "test@example.com", "password": "test-password"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["requires_verification"])
        self.assertFalse(response.json()["otp_sent"])
        self.assertEqual(response.json()["retry_after"], 0)
        self.assertIn("could not be sent", response.json()["message"])
        self.database.email_otps.delete_one.assert_called_once()

    def test_first_signup_code_can_verify_without_resend(self):
        with patch.object(auth, "send_verification_email", return_value={"success": True}) as send:
            registered = self.request("POST", "/api/v1/auth/register", json={"email": "test@example.com", "password": "test-password"})
        self.assertTrue(registered.json()["otp_sent"])
        stored_code = self.database.email_otps.update_one.call_args_list[0].args[1]["$set"]
        self.database.email_otps.find_one.return_value = stored_code
        self.database.users.find_one.return_value = {
            "_id": self.database.users.insert_one.return_value.inserted_id,
            "email": "test@example.com", "hashed_password": "test-hash",
        }
        verified = self.request("POST", "/api/v1/auth/verify-email-otp", json={
            "email": "test@example.com", "otp": send.call_args.kwargs["otp"],
        })
        self.assertEqual(verified.status_code, 200, verified.text)
        self.assertTrue(verified.json()["data"]["is_verified"])
        self.assertTrue(verified.json()["access_token"])
        send.assert_called_once()

    def test_resend_is_limited_only_after_a_successful_send(self):
        self.database.users.find_one.return_value = {"email": "test@example.com"}
        for record, expected in [({"created_at": datetime.utcnow()}, 200),
                                 ({"sent_at": datetime.utcnow()}, 429)]:
            self.database.email_otps.find_one.return_value = record
            with patch.object(auth, "send_verification_email", return_value={"success": True}) as send:
                response = self.request("POST", "/api/v1/auth/resend-email-otp", json={"email": "test@example.com"})
            self.assertEqual(response.status_code, expected, response.text)
            self.assertEqual(send.call_count, 1 if expected == 200 else 0)

    def test_login_resends_legacy_unsent_record_without_manual_resend(self):
        self.database.users.find_one.return_value = {"email": "test@example.com", "hashed_password": "test-hash"}
        self.database.email_otps.find_one.return_value = {"created_at": datetime.utcnow()}
        with patch.object(auth, "verify_password", return_value=True), \
             patch.object(auth, "send_verification_email", return_value={"success": True}) as send:
            response = self.request("POST", "/api/v1/auth/login", json={"email": "test@example.com", "password": "test-password"})
        self.assertEqual(response.status_code, 403)
        self.assertTrue(response.json()["otp_sent"])
        send.assert_called_once()
