import re
import httpx
from typing import Dict, Any, Optional, List
from app.core.config import settings
from app.core.logger import app_logger

META_GRAPH_API_VERSION = "v21.0"
MSG91_WHATSAPP_BULK_URL = "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/"


def normalize_phone_number(phone: str) -> str:
    """
    Normalizes a phone number to WhatsApp international format (digits only, no +).
    Defaults 10-digit Indian numbers with '91'.
    """
    clean = re.sub(r"[^\d]", "", str(phone or "").strip())
    
    # If 10 digits (typical Indian mobile), prepend 91
    if len(clean) == 10:
        clean = f"91{clean}"
    
    return clean


def send_msg91_whatsapp_otp(phone: str, otp: str) -> Dict[str, Any]:
    """
    Dispatches an OTP verification message via MSG91 WhatsApp Business API v5.
    Uses pre-approved template (default 'auth') with automatic button/body fallback.
    """
    recipient = normalize_phone_number(phone)
    auth_key = (settings.MSG91_AUTH_KEY or "").strip()
    integrated_number = (settings.MSG91_INTEGRATED_NUMBER or "17115086207").strip().replace("+", "")
    template_name = (settings.MSG91_WHATSAPP_TEMPLATE_NAME or settings.WHATSAPP_TEMPLATE_NAME or "auth").strip()

    if not auth_key:
        return {"success": False, "error": "MSG91_AUTH_KEY is not configured on the server."}

    headers = {
        "authkey": auth_key,
        "Content-Type": "application/json",
        "accept": "application/json",
    }

    # Format 1: Authentication template with Copy Code / URL button
    payload_with_button = {
        "integrated_number": integrated_number,
        "content_type": "template",
        "payload": {
            "messaging_product": "whatsapp",
            "type": "template",
            "template": {
                "name": template_name,
                "language": {
                    "code": "en",
                    "policy": "deterministic",
                },
                "to_and_components": [
                    {
                        "to": [recipient],
                        "components": {
                            "body_1": {
                                "type": "text",
                                "value": str(otp),
                            },
                            "button_1": {
                                "subtype": "url",
                                "type": "text",
                                "value": str(otp),
                            },
                        },
                    }
                ],
            },
        },
    }

    # Format 2: Body text parameter only (if template doesn't declare interactive button)
    payload_body_only = {
        "integrated_number": integrated_number,
        "content_type": "template",
        "payload": {
            "messaging_product": "whatsapp",
            "type": "template",
            "template": {
                "name": template_name,
                "language": {
                    "code": "en",
                    "policy": "deterministic",
                },
                "to_and_components": [
                    {
                        "to": [recipient],
                        "components": {
                            "body_1": {
                                "type": "text",
                                "value": str(otp),
                            },
                        },
                    }
                ],
            },
        },
    }

    try:
        with httpx.Client(timeout=12.0) as client:
            resp = client.post(MSG91_WHATSAPP_BULK_URL, headers=headers, json=payload_with_button)

            # Check if button component mismatch caused an issue, and fallback
            retry_needed = False
            if resp.status_code == 400 and "button" in resp.text.lower():
                retry_needed = True
            elif resp.is_success:
                try:
                    res_json = resp.json()
                    if isinstance(res_json, dict) and res_json.get("status") == "error" and "button" in str(res_json).lower():
                        retry_needed = True
                except Exception:
                    pass

            if retry_needed:
                app_logger.info("Retrying MSG91 WhatsApp template without button parameter...")
                resp = client.post(MSG91_WHATSAPP_BULK_URL, headers=headers, json=payload_body_only)

            if resp.is_success:
                try:
                    data = resp.json()
                except Exception:
                    data = {"raw": resp.text}

                if isinstance(data, dict) and data.get("status") == "error":
                    err_msg = data.get("message") or "MSG91 WhatsApp API returned error"
                    app_logger.error(f"MSG91 WhatsApp error: {data}")
                    return {"success": False, "error": err_msg, "details": data}

                app_logger.info(f"MSG91 WhatsApp OTP dispatched to {recipient}. Result: {data}")
                return {"success": True, "data": data, "provider": "msg91"}
            else:
                error_body = resp.text
                app_logger.error(f"MSG91 WhatsApp API error ({resp.status_code}): {error_body}")
                return {
                    "success": False,
                    "error": f"MSG91 API error ({resp.status_code})",
                    "details": error_body,
                }
    except Exception as exc:
        app_logger.error(f"Failed to communicate with MSG91 WhatsApp API: {exc}")
        return {"success": False, "error": str(exc)}


def send_meta_whatsapp_otp(phone: str, otp: str) -> Dict[str, Any]:
    """
    Dispatches an OTP verification message via Meta WhatsApp Cloud API directly.
    """
    recipient = normalize_phone_number(phone)
    access_token = (settings.WHATSAPP_ACCESS_TOKEN or "").strip()
    phone_number_id = (settings.WHATSAPP_PHONE_NUMBER_ID or "").strip()
    template_name = (settings.WHATSAPP_TEMPLATE_NAME or "auth").strip()

    if not access_token or not phone_number_id:
        return {"success": False, "error": "WhatsApp messaging is not configured on the server."}

    url = f"https://graph.facebook.com/{META_GRAPH_API_VERSION}/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    # Meta Authentication Template with Copy Code button component
    payload_with_button = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": "en"},
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": str(otp)}]
                },
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": "0",
                    "parameters": [{"type": "text", "text": str(otp)}]
                }
            ]
        }
    }

    # Fallback payload (body parameter only) in case template does not have URL button
    payload_body_only = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": "en"},
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": str(otp)}]
                }
            ]
        }
    }

    try:
        with httpx.Client(timeout=12.0) as client:
            resp = client.post(url, headers=headers, json=payload_with_button)
            
            # If button parameter caused an error, fallback to body-only template format
            if resp.status_code == 400 and "button" in resp.text.lower():
                app_logger.info("Retrying WhatsApp template without button parameter...")
                resp = client.post(url, headers=headers, json=payload_body_only)

            if resp.is_success:
                data = resp.json()
                app_logger.info(f"Meta WhatsApp OTP dispatched to {recipient}. Msg ID: {data.get('messages', [{}])[0].get('id')}")
                return {"success": True, "data": data, "provider": "meta"}
            else:
                error_body = resp.text
                app_logger.error(f"Meta WhatsApp Cloud API error ({resp.status_code}): {error_body}")
                return {
                    "success": False,
                    "error": f"Meta API error ({resp.status_code})",
                    "details": error_body
                }
    except Exception as exc:
        app_logger.error(f"Failed to communicate with Meta WhatsApp Cloud API: {exc}")
        return {"success": False, "error": str(exc)}


def send_whatsapp_otp(phone: str, otp: str) -> Dict[str, Any]:
    """
    Dispatches an OTP verification message via WhatsApp.
    Automatically prioritizes MSG91 WhatsApp API if MSG91_AUTH_KEY is configured.
    Falls back to direct Meta WhatsApp Cloud API if WHATSAPP_ACCESS_TOKEN is configured.
    """
    recipient = normalize_phone_number(phone)
    if not recipient or len(recipient) < 10:
        raise ValueError(f"Invalid recipient phone number format: '{phone}'")

    # 1. Prefer MSG91 WhatsApp API if configured
    if (settings.MSG91_AUTH_KEY or "").strip():
        return send_msg91_whatsapp_otp(recipient, otp)

    # 2. Fall back to direct Meta Cloud API if configured
    if (settings.WHATSAPP_ACCESS_TOKEN or "").strip() and (settings.WHATSAPP_PHONE_NUMBER_ID or "").strip():
        return send_meta_whatsapp_otp(recipient, otp)

    return {"success": False, "error": "WhatsApp messaging is not configured on the server."}


def send_whatsapp_notification(
    phone: str,
    template_name: str,
    body_values: List[str],
    language_code: str = "en",
) -> Dict[str, Any]:
    """
    General helper to send pre-approved transactional WhatsApp template notifications
    (e.g., Order Confirmation, Shipment Out for Delivery, Return Approved).
    """
    recipient = normalize_phone_number(phone)
    if not recipient or len(recipient) < 10:
        return {"success": False, "error": f"Invalid phone format: {phone}"}

    auth_key = (settings.MSG91_AUTH_KEY or "").strip()
    if not auth_key:
        return {"success": False, "error": "MSG91_AUTH_KEY is not configured for WhatsApp notifications."}

    integrated_number = (settings.MSG91_INTEGRATED_NUMBER or "17115086207").strip().replace("+", "")

    components: Dict[str, Any] = {}
    for idx, val in enumerate(body_values, start=1):
        components[f"body_{idx}"] = {"type": "text", "value": str(val)}

    payload = {
        "integrated_number": integrated_number,
        "content_type": "template",
        "payload": {
            "messaging_product": "whatsapp",
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code, "policy": "deterministic"},
                "to_and_components": [
                    {
                        "to": [recipient],
                        "components": components,
                    }
                ],
            },
        },
    }

    headers = {
        "authkey": auth_key,
        "Content-Type": "application/json",
        "accept": "application/json",
    }

    try:
        with httpx.Client(timeout=12.0) as client:
            resp = client.post(MSG91_WHATSAPP_BULK_URL, headers=headers, json=payload)
            if resp.is_success:
                try:
                    data = resp.json()
                except Exception:
                    data = {"raw": resp.text}
                app_logger.info(f"WhatsApp notification ({template_name}) dispatched to {recipient}.")
                return {"success": True, "data": data}
            return {"success": False, "error": f"MSG91 error ({resp.status_code}): {resp.text}"}
    except Exception as exc:
        app_logger.error(f"WhatsApp notification exception: {exc}")
        return {"success": False, "error": str(exc)}

