import unittest
import os
import sys

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from jose import jwt, JWTError
from app.core.config import settings
from app.core import security

class TestJWTSecurityConfig(unittest.TestCase):
    def test_settings_has_secret_key(self):
        """Settings must expose SECRET_KEY and ALGORITHM attributes."""
        self.assertTrue(hasattr(settings, "SECRET_KEY"))
        self.assertTrue(len(settings.SECRET_KEY) >= 16)
        self.assertTrue(hasattr(settings, "ALGORITHM"))
        self.assertEqual(settings.ALGORITHM, "HS256")

    def test_token_creation_and_verification(self):
        """Token created with security helper must decode successfully using settings.SECRET_KEY."""
        token = security.create_access_token(subject="user@example.com", is_admin=True)
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        self.assertEqual(payload.get("sub"), "user@example.com")
        self.assertTrue(payload.get("is_admin"))

    def test_token_rejects_tampered_secret(self):
        """Decoding with invalid secret must raise JWTError."""
        token = security.create_access_token(subject="user@example.com", is_admin=True)
        with self.assertRaises(JWTError):
            jwt.decode(token, "tampered_fake_secret_key_9999999999", algorithms=[settings.ALGORITHM])
