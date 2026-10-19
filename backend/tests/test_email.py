import smtplib
import unittest
from email.mime.multipart import MIMEMultipart
from unittest.mock import MagicMock, patch

from test_deployment import main  # Set up the isolated backend import path.
from app.services import email


class SmtpTests(unittest.TestCase):
    def setUp(self):
        self.config = patch.multiple(email.settings, SMTP_HOST="smtp.example.com",
                                     SMTP_PORT=465, SMTP_USER="test@example.com",
                                     SMTP_PASSWORD="test-password")
        self.config.start()
        self.addCleanup(self.config.stop)

    def test_closed_connection_reports_stage(self):
        with patch.object(email.smtplib, "SMTP_SSL", side_effect=smtplib.SMTPServerDisconnected()):
            result = email._send_smtp_message(MIMEMultipart(), "test@example.com")
        self.assertFalse(result["success"])
        self.assertIn("during connection", result["error"])

    def test_disconnect_after_acceptance_is_success(self):
        server = MagicMock()
        server.sendmail.return_value = {}
        server.quit.side_effect = smtplib.SMTPServerDisconnected()
        with patch.object(email.smtplib, "SMTP_SSL", return_value=server):
            result = email._send_smtp_message(MIMEMultipart(), "test@example.com")
        self.assertTrue(result["success"])
        server.close.assert_called_once()

    def test_starttls_before_authentication(self):
        server = MagicMock()
        server.sendmail.return_value = {}
        with patch.object(email.settings, "SMTP_PORT", 587), \
             patch.object(email.smtplib, "SMTP", return_value=server):
            result = email._send_smtp_message(MIMEMultipart(), "test@example.com")
        self.assertTrue(result["success"])
        self.assertEqual([call[0] for call in server.method_calls],
                         ["ehlo", "starttls", "ehlo", "login", "sendmail", "quit"])

    def test_missing_credentials_do_not_connect(self):
        with patch.object(email.settings, "SMTP_PASSWORD", ""), \
             patch.object(email.smtplib, "SMTP_SSL") as connect:
            result = email._send_smtp_message(MIMEMultipart(), "test@example.com")
        self.assertFalse(result["success"])
        connect.assert_not_called()
