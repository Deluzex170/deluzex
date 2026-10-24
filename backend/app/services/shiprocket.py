"""
Shiprocket Logistics Service Module
Provides complete end-to-end integration with Shiprocket API v2:
- Token management with automatic caching & re-authentication
- Forward Logistics: Serviceability check, Create Order/Shipment, Assign AWB, Schedule Pickup, Labels & Invoices, Live Tracking
- Reverse Logistics (Returns): Create Return Order, Generate Return AWB, Track Return Shipment
"""

import logging
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger("uvicorn.error")

SHIPROCKET_API_BASE = "https://apiv2.shiprocket.in/v1/external"

# In-memory token cache
_cached_token: Optional[str] = None
_token_expires_at: Optional[datetime] = None


def _clean_phone(phone: str) -> str:
    """Normalize phone numbers to standard 10-digit format for Shiprocket."""
    digits = re.sub(r"\D", "", str(phone or ""))
    if len(digits) >= 10:
        return digits[-10:]
    return digits or "9999999999"


def get_auth_token(force_refresh: bool = False) -> str:
    """
    Retrieve Shiprocket JWT Bearer token.
    Uses in-memory caching to avoid repeated login requests.
    Tokens are valid for 10 days; we refresh safely before expiry.
    """
    global _cached_token, _token_expires_at

    now = datetime.utcnow()
    if (
        not force_refresh
        and _cached_token
        and _token_expires_at
        and now < _token_expires_at
    ):
        return _cached_token

    if not settings.SHIPROCKET_EMAIL or not settings.SHIPROCKET_PASSWORD:
        logger.warning(
            "[Shiprocket] SHIPROCKET_EMAIL or SHIPROCKET_PASSWORD not configured in environment."
        )
        raise ValueError(
            "Shiprocket credentials not configured. Please set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in .env."
        )

    logger.info(f"[Shiprocket] Authenticating with email: {settings.SHIPROCKET_EMAIL}")
    login_url = f"{SHIPROCKET_API_BASE}/auth/login"
    payload = {
        "email": settings.SHIPROCKET_EMAIL.strip(),
        "password": settings.SHIPROCKET_PASSWORD.strip(),
    }

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "DeluzexECommerce/1.0",
    }

    with httpx.Client(timeout=15.0) as client:
        try:
            resp = client.post(login_url, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                token = data.get("token")
                if not token:
                    raise ValueError(f"No token in Shiprocket login response: {data}")
                _cached_token = token
                # Cache token for 9 days (Shiprocket tokens expire in 10 days)
                _token_expires_at = now + timedelta(days=9)
                logger.info("[Shiprocket] Successfully authenticated & cached JWT token.")
                return _cached_token
            else:
                err_body = resp.text
                logger.error(
                    f"[Shiprocket] Auth failed [{resp.status_code}]: {err_body}"
                )
                raise ValueError(
                    f"Shiprocket authentication failed ({resp.status_code}): {err_body}"
                )
        except httpx.RequestError as exc:
            logger.error(f"[Shiprocket] Network error during auth: {exc}")
            raise ValueError(f"Unable to reach Shiprocket API: {exc}")


def _request(
    method: str,
    path: str,
    json: Optional[Dict[str, Any]] = None,
    params: Optional[Dict[str, Any]] = None,
    retry_on_401: bool = True,
) -> Dict[str, Any]:
    """
    Authenticated HTTP request wrapper with automatic 401 token refresh.
    """
    token = get_auth_token()
    url = f"{SHIPROCKET_API_BASE}{path}"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "DeluzexECommerce/1.0",
    }

    with httpx.Client(timeout=30.0) as client:
        try:
            resp = client.request(method, url, json=json, params=params, headers=headers)
            if resp.status_code == 401 and retry_on_401:
                logger.warning("[Shiprocket] Token expired (401). Refreshing token and retrying...")
                token = get_auth_token(force_refresh=True)
                headers["Authorization"] = f"Bearer {token}"
                resp = client.request(method, url, json=json, params=params, headers=headers)

            try:
                data = resp.json()
            except Exception:
                data = {"raw_text": resp.text, "status_code": resp.status_code}

            if resp.status_code not in (200, 201):
                logger.warning(
                    f"[Shiprocket] {method} {path} returned status {resp.status_code}: {data}"
                )

            return data
        except httpx.RequestError as exc:
            logger.error(f"[Shiprocket] Request error on {method} {path}: {exc}")
            raise ValueError(f"Shiprocket API request error: {exc}")


# ---------------------------------------------------------------------------
# FORWARD LOGISTICS
# ---------------------------------------------------------------------------

def check_serviceability(
    delivery_pincode: str,
    weight: float = None,
    is_cod: bool = False,
    pickup_pincode: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Check courier serviceability and shipping rates for a destination pincode.
    """
    pickup = pickup_pincode or settings.SHIPROCKET_PICKUP_PINCODE
    wt = weight or settings.SHIPROCKET_DEFAULT_WEIGHT

    params = {
        "pickup_postcode": pickup,
        "delivery_postcode": delivery_pincode.strip(),
        "weight": str(wt),
        "cod": 1 if is_cod else 0,
    }

    logger.info(
        f"[Shiprocket] Checking serviceability from {pickup} to {delivery_pincode} (weight={wt}kg, cod={is_cod})"
    )
    res = _request("GET", "/courier/serviceability/", params=params)

    data = res.get("data", {})
    available_couriers = []
    recommended_courier_id = data.get("recommended_courier_company_id")

    for courier in data.get("available_courier_companies", []):
        available_couriers.append({
            "courier_company_id": courier.get("courier_company_id"),
            "courier_name": courier.get("courier_name"),
            "rate": courier.get("rate"),
            "estimated_delivery_days": courier.get("estimated_delivery_days"),
            "etd": courier.get("etd"),
            "call_before_delivery": courier.get("call_before_delivery"),
            "cod": courier.get("cod") == 1,
            "rating": courier.get("rating"),
            "is_recommended": courier.get("courier_company_id") == recommended_courier_id,
        })

    available_couriers.sort(
        key=lambda c: (0 if c["is_recommended"] else 1, c["rate"] or 999999)
    )

    return {
        "is_serviceable": len(available_couriers) > 0,
        "recommended_courier_company_id": recommended_courier_id,
        "couriers": available_couriers,
        "raw_response": res,
    }


def create_order(
    order: Dict[str, Any],
    dimensions: Optional[Dict[str, float]] = None,
    pickup_location: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a custom adhoc order in Shiprocket.
    Prepares billing, shipping, order items, and dimensions.
    Returns shiprocket_order_id and shiprocket_shipment_id.
    """
    order_id = str(order.get("_id") or order.get("id"))
    shipping_addr = order.get("shipping_address") or {}

    first_name = shipping_addr.get("first_name", "Valued")
    last_name = shipping_addr.get("last_name", "Customer")
    phone = _clean_phone(order.get("phone", ""))
    email = order.get("email", "support@deluzexlighting.com")

    created_at = order.get("created_at")
    if isinstance(created_at, datetime):
        order_date_str = created_at.strftime("%Y-%m-%d %H:%M")
    elif isinstance(created_at, str):
        try:
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            order_date_str = dt.strftime("%Y-%m-%d %H:%M")
        except Exception:
            order_date_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
    else:
        order_date_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M")

    items_payload = []
    for item in order.get("items", []):
        items_payload.append({
            "name": item.get("title", "Luxury Lighting Fixture"),
            "sku": item.get("product_id", "DELUZEX-SKU")[:50],
            "units": int(item.get("quantity", 1)),
            "selling_price": float(item.get("price", 0)),
            "discount": 0,
            "tax": 0,
        })

    is_cod = order.get("payment_method", "").lower() == "cod"
    total_amount = float(order.get("total", 0))

    dims = dimensions or {}
    length = float(dims.get("length") or settings.SHIPROCKET_DEFAULT_LENGTH)
    breadth = float(dims.get("breadth") or settings.SHIPROCKET_DEFAULT_BREADTH)
    height = float(dims.get("height") or settings.SHIPROCKET_DEFAULT_HEIGHT)
    weight = float(dims.get("weight") or settings.SHIPROCKET_DEFAULT_WEIGHT)

    loc = pickup_location or settings.SHIPROCKET_PICKUP_LOCATION

    payload = {
        "order_id": order_id,
        "order_date": order_date_str,
        "pickup_location": loc,
        "comment": order.get("notes") or "Deluzex Luxury Order",
        "billing_customer_name": first_name,
        "billing_last_name": last_name,
        "billing_address": shipping_addr.get("street", "N/A"),
        "billing_address_2": "",
        "billing_city": shipping_addr.get("city", "N/A"),
        "billing_pincode": shipping_addr.get("pin_code", "380001"),
        "billing_state": shipping_addr.get("state", "Gujarat"),
        "billing_country": "India",
        "billing_email": email,
        "billing_phone": phone,
        "shipping_is_billing": True,
        "order_items": items_payload,
        "payment_method": "COD" if is_cod else "Prepaid",
        "shipping_charges": float(order.get("delivery", 0)),
        "giftwrap_charges": 0,
        "transaction_charges": 0,
        "total_discount": float(order.get("discount", 0)),
        "sub_total": total_amount,
        "length": length,
        "breadth": breadth,
        "height": height,
        "weight": weight,
    }

    logger.info(f"[Shiprocket] Creating adhoc order for Deluzex Order #{order_id}")
    res = _request("POST", "/orders/create/adhoc", json=payload)

    shiprocket_order_id = res.get("order_id")
    shiprocket_shipment_id = res.get("shipment_id")

    if not shiprocket_order_id or not shiprocket_shipment_id:
        error_msg = res.get("message") or res.get("errors") or str(res)
        logger.error(f"[Shiprocket] Failed to create order: {error_msg}")
        raise ValueError(f"Shiprocket order creation failed: {error_msg}")

    return {
        "shiprocket_order_id": shiprocket_order_id,
        "shiprocket_shipment_id": shiprocket_shipment_id,
        "status": res.get("status"),
        "status_code": res.get("status_code"),
        "raw_response": res,
    }


def generate_awb(
    shipment_id: int,
    courier_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Assign courier partner and generate Air Waybill (AWB) number.
    """
    payload = {"shipment_id": shipment_id}
    if courier_id:
        payload["courier_id"] = courier_id

    logger.info(
        f"[Shiprocket] Assigning AWB for shipment_id={shipment_id} (courier_id={courier_id})"
    )
    res = _request("POST", "/courier/assign/awb", json=payload)

    response_data = res.get("response", {}).get("data", {})
    awb_code = response_data.get("awb_code") or res.get("awb_code")
    courier_name = response_data.get("courier_name") or res.get("courier_name")
    courier_company_id = response_data.get("courier_company_id") or courier_id

    if not awb_code:
        err_msg = (
            res.get("message")
            or response_data.get("error")
            or res.get("errors")
            or str(res)
        )
        logger.error(f"[Shiprocket] AWB assignment failed: {err_msg}")
        raise ValueError(f"AWB generation failed: {err_msg}")

    return {
        "awb_code": awb_code,
        "courier_name": courier_name,
        "courier_company_id": courier_company_id,
        "shipment_id": shipment_id,
        "raw_response": res,
    }


def schedule_pickup(
    shipment_id: int,
    pickup_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Schedule courier pickup for a shipment.
    pickup_date format: 'YYYY-MM-DD' (defaults to today or tomorrow if after cut-off).
    """
    date_str = pickup_date or datetime.utcnow().strftime("%Y-%m-%d")

    payload = {
        "shipment_id": [shipment_id],
        "pickup_date": [date_str],
    }

    logger.info(f"[Shiprocket] Requesting pickup for shipment_id={shipment_id} on {date_str}")
    res = _request("POST", "/courier/generate/pickup", json=payload)

    pickup_status = res.get("pickup_status") or res.get("status")
    pickup_token = res.get("response", {}).get("pickup_token_number") or res.get("pickup_token_number")

    return {
        "pickup_status": pickup_status,
        "pickup_token_number": pickup_token,
        "pickup_scheduled_date": date_str,
        "raw_response": res,
    }


def generate_label(shipment_id: int) -> Dict[str, Any]:
    """
    Generate thermal/PDF shipping label URL with barcodes.
    """
    payload = {"shipment_id": [shipment_id]}
    logger.info(f"[Shiprocket] Generating shipping label for shipment_id={shipment_id}")
    res = _request("POST", "/courier/generate/label", json=payload)

    label_url = res.get("label_url") or res.get("label_created")
    return {
        "label_url": label_url,
        "label_created": res.get("label_created"),
        "raw_response": res,
    }


def generate_invoice(order_id: int) -> Dict[str, Any]:
    """
    Generate printable GST invoice PDF for an order.
    """
    payload = {"ids": [order_id]}
    logger.info(f"[Shiprocket] Generating invoice for shiprocket_order_id={order_id}")
    res = _request("POST", "/orders/print/invoice", json=payload)

    invoice_url = res.get("invoice_url") or res.get("is_invoice_created")
    return {
        "invoice_url": invoice_url,
        "raw_response": res,
    }


def track_by_awb(awb_code: str) -> Dict[str, Any]:
    """
    Get live, real-time tracking history, scans, current location and ETA.
    """
    logger.info(f"[Shiprocket] Tracking AWB: {awb_code}")
    res = _request("GET", f"/courier/track/awb/{awb_code}")

    tracking_data = res.get("tracking_data", {})
    track_status = tracking_data.get("track_status")
    current_status = tracking_data.get("current_status")
    activities = tracking_data.get("shipment_track_activities", [])
    etd = tracking_data.get("etd")

    return {
        "awb_code": awb_code,
        "track_status": track_status,
        "current_status": current_status,
        "etd": etd,
        "activities": activities,
        "raw_response": res,
    }


def cancel_shipment(awb_code: str) -> Dict[str, Any]:
    """
    Cancel an active courier shipment/AWB.
    """
    payload = {"awbs": [awb_code]}
    logger.info(f"[Shiprocket] Cancelling AWB: {awb_code}")
    res = _request("POST", "/orders/cancel/shipment/awbs", json=payload)
    return res


# ---------------------------------------------------------------------------
# REVERSE LOGISTICS (RETURNS)
# ---------------------------------------------------------------------------

def create_return_order(
    order: Dict[str, Any],
    reason: str,
    pickup_location: Optional[str] = None,
    dimensions: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Initiate a reverse pickup / return order directly from the customer's address
    back to the Deluzex primary warehouse ("work").
    """
    order_id = str(order.get("_id") or order.get("id"))
    shipping_addr = order.get("shipping_address") or {}

    first_name = shipping_addr.get("first_name", "Valued")
    last_name = shipping_addr.get("last_name", "Customer")
    phone = _clean_phone(order.get("phone", ""))
    email = order.get("email", "support@deluzexlighting.com")

    warehouse_loc = pickup_location or settings.SHIPROCKET_PICKUP_LOCATION

    items_payload = []
    for item in order.get("items", []):
        items_payload.append({
            "name": item.get("title", "Luxury Lighting Fixture"),
            "sku": item.get("product_id", "DELUZEX-RETURN-SKU")[:50],
            "units": int(item.get("quantity", 1)),
            "selling_price": float(item.get("price", 0)),
            "discount": 0,
            "qc_enable": False,
        })

    dims = dimensions or {}
    length = float(dims.get("length") or settings.SHIPROCKET_DEFAULT_LENGTH)
    breadth = float(dims.get("breadth") or settings.SHIPROCKET_DEFAULT_BREADTH)
    height = float(dims.get("height") or settings.SHIPROCKET_DEFAULT_HEIGHT)
    weight = float(dims.get("weight") or settings.SHIPROCKET_DEFAULT_WEIGHT)

    payload = {
        "order_id": f"RET-{order_id}",
        "order_date": datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
        "channel_id": "",
        "pickup_customer_name": f"{first_name} {last_name}".strip(),
        "pickup_last_name": last_name,
        "pickup_address": shipping_addr.get("street", "N/A"),
        "pickup_address_2": "",
        "pickup_city": shipping_addr.get("city", "N/A"),
        "pickup_state": shipping_addr.get("state", "Gujarat"),
        "pickup_country": "India",
        "pickup_pincode": shipping_addr.get("pin_code", "380001"),
        "pickup_email": email,
        "pickup_phone": phone,
        "pickup_isd_code": "91",
        "shipping_customer_name": "Deluzex Lighting Warehouse",
        "shipping_address": "Block no 19, Galaxy complex, Ahmedabad - Palanpur Hwy, opposite ekta hotel",
        "shipping_city": "Banaskantha",
        "shipping_country": "India",
        "shipping_pincode": settings.SHIPROCKET_PICKUP_PINCODE,
        "shipping_state": "Gujarat",
        "shipping_email": "support@deluzexlighting.com",
        "shipping_phone": "9909382031",
        "shipping_isd_code": "91",
        "order_items": items_payload,
        "payment_method": "PREPAID",
        "total_discount": 0,
        "sub_total": float(order.get("total", 0)),
        "length": length,
        "breadth": breadth,
        "height": height,
        "weight": weight,
        "reason": reason,
    }

    logger.info(f"[Shiprocket] Creating Return Order for Order #{order_id} (Reason: {reason})")
    res = _request("POST", "/orders/create/return", json=payload)

    return_order_id = res.get("order_id")
    return_shipment_id = res.get("shipment_id")

    if not return_order_id or not return_shipment_id:
        err = res.get("message") or res.get("errors") or str(res)
        logger.error(f"[Shiprocket] Return order creation failed: {err}")
        raise ValueError(f"Return order creation failed: {err}")

    return {
        "return_order_id": return_order_id,
        "return_shipment_id": return_shipment_id,
        "status": res.get("status"),
        "raw_response": res,
    }


def generate_return_awb(return_shipment_id: int) -> Dict[str, Any]:
    """
    Generate reverse AWB code for a return shipment.
    """
    payload = {"shipment_id": return_shipment_id, "is_return": 1}
    logger.info(f"[Shiprocket] Assigning Reverse AWB for shipment_id={return_shipment_id}")
    res = _request("POST", "/courier/assign/awb", json=payload)

    response_data = res.get("response", {}).get("data", {})
    awb_code = response_data.get("awb_code") or res.get("awb_code")
    courier_name = response_data.get("courier_name") or res.get("courier_name")

    return {
        "return_awb_code": awb_code,
        "courier_name": courier_name,
        "shipment_id": return_shipment_id,
        "raw_response": res,
    }
