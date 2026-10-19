import re
import httpx
from typing import Dict, Any, Optional
from app.core.config import settings
from app.core.logger import app_logger

META_GRAPH_API_VERSION = "v21.0"

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

def send_whatsapp_otp(phone: str, otp: str) -> Dict[str, Any]:
    """
    Dispatches an OTP verification message via Meta WhatsApp Cloud API using
    the pre-approved Authentication template (e.g. 'auth').
    
    Missing credentials produce a delivery error.
    """
    recipient = normalize_phone_number(phone)
    if not recipient or len(recipient) < 10:
        raise ValueError(f"Invalid recipient phone number format: '{phone}'")

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
                app_logger.info(f"WhatsApp OTP dispatched to {recipient}. Msg ID: {data.get('messages', [{}])[0].get('id')}")
                return {"success": True, "data": data}
            else:
                error_body = resp.text
                app_logger.error(f"WhatsApp Cloud API error ({resp.status_code}): {error_body}")
                return {
                    "success": False,
                        "error": f"Meta API error ({resp.status_code})",
                    "details": error_body
                }
    except Exception as exc:
        app_logger.error(f"Failed to communicate with WhatsApp Cloud API: {exc}")
        return {"success": False, "error": str(exc)}
