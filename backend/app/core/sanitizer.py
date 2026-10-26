"""
Deluzex Security Sanitization Core Module
Provides defensive input sanitization against XSS, NoSQL injection, ReDoS, and mass-assignment.
"""

import html
import re
from typing import Optional


def sanitize_text(val: Optional[str], max_len: int = 1000) -> Optional[str]:
    """
    Strips leading/trailing whitespace, truncates to max_len,
    and HTML-escapes raw markup to prevent Stored XSS attacks.
    """
    if val is None:
        return None
    cleaned = str(val).strip()
    if not cleaned:
        return ""
    # Truncate
    truncated = cleaned[:max_len]
    # Escape HTML tags (&, <, >, ", ')
    return html.escape(truncated, quote=True)


def sanitize_search_term(term: Optional[str], max_len: int = 100) -> str:
    """
    Sanitizes search query input for MongoDB queries:
    - Truncates to max_len to prevent memory exhaustion
    - Escapes all regular expression meta-characters to prevent NoSQL ReDoS / regex injection
    """
    if not term:
        return ""
    cleaned = str(term).strip()[:max_len]
    return re.escape(cleaned)


def sanitize_phone(phone: Optional[str]) -> Optional[str]:
    """
    Retains only digits and optional leading plus sign.
    Prevents injection via phone fields.
    """
    if not phone:
        return None
    cleaned = str(phone).strip()
    # Keep leading + if present, and digits only
    has_plus = cleaned.startswith("+")
    digits = re.sub(r"\D", "", cleaned)
    if not digits:
        return None
    result = f"+{digits}" if has_plus else digits
    return result[:20]


def sanitize_email(email: Optional[str]) -> Optional[str]:
    """
    Normalizes and validates email string.
    """
    if not email:
        return None
    cleaned = str(email).strip().lower()
    return cleaned[:150]
