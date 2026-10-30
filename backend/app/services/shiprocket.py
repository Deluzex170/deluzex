"""
Shiprocket Logistics Service Module
Provides complete end-to-end integration with Shiprocket API v2:
- Token management with automatic caching & re-authentication
- Forward Logistics: Serviceability check, Create Order/Shipment, Assign AWB, Schedule Pickup, Labels & Invoices, Live Tracking
- Reverse Logistics (Returns): Create Return Order, Generate Return AWB, Track Return Shipment
- Account Management: Wallet balance verification & Pickup location discovery
"""

import logging
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger("uvicorn.error")

SHIPROCKET_API_BASE = getattr(settings, "SHIPROCKET_API_BASE", "https://apiv2.shiprocket.in/v1/external")

# In-memory token cache
_cached_token: Optional[str] = None
_token_expires_at: Optional[datetime] = None


class ShiprocketError(Exception):
    """Base exception for Shiprocket integration errors."""
    pass


class ShiprocketWalletError(ShiprocketError):
    """Raised when Shiprocket prepaid wallet has insufficient balance (< Rs 100)."""
    pass


class ShiprocketAuthError(ShiprocketError):
    """Raised when authentication credentials fail."""
    pass


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
        raise ShiprocketAuthError(
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
                    raise ShiprocketAuthError(f"No token in Shiprocket login response: {data}")
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
                raise ShiprocketAuthError(
                    f"Shiprocket authentication failed ({resp.status_code}): {err_body}"
                )
        except httpx.RequestError as exc:
            logger.error(f"[Shiprocket] Network error during auth: {exc}")
            raise ShiprocketAuthError(f"Unable to reach Shiprocket API: {exc}")


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
            raise ShiprocketError(f"Shiprocket API request error: {exc}")


# ---------------------------------------------------------------------------
# ACCOUNT & WALLET MANAGEMENT
# ---------------------------------------------------------------------------

def get_wallet_balance() -> Dict[str, Any]:
    """
    Fetch current Shiprocket prepaid wallet balance.
    """
    res = _request("GET", "/account/details/wallet-balance")
    data_dict = res.get("data") if isinstance(res.get("data"), dict) else {}
    raw_bal = data_dict.get("balance_amount", "0")
    try:
        balance = float(raw_bal)
    except (ValueError, TypeError):
        balance = 0.0

    return {
        "balance": balance,
        "is_low": balance < 100.0,
        "minimum_required": 100.0,
        "currency": "INR",
        "recharge_url": "https://app.shiprocket.in/billing/recharge",
    }


def get_pickup_locations() -> List[Dict[str, Any]]:
    """
    Fetch verified pickup locations from Shiprocket company settings.
    """
    res = _request("GET", "/settings/company/pickup")
    data_dict = res.get("data") if isinstance(res.get("data"), dict) else {}
    shipping_addresses = data_dict.get("shipping_address", []) if isinstance(data_dict.get("shipping_address"), list) else []

    locations = []
    for addr in shipping_addresses:
        if isinstance(addr, dict):
            locations.append({
                "id": addr.get("id"),
                "pickup_location": addr.get("pickup_location") or "work",
                "city": addr.get("city") or "Banaskantha",
                "state": addr.get("state") or "Gujarat",
                "pin_code": addr.get("pin_code") or "385210",
                "phone": addr.get("phone") or "",
                "name": addr.get("name") or "",
                "is_primary": bool(addr.get("is_primary_location")),
            })

    if not locations:
        locations.append({
            "pickup_location": "work",
            "city": "Banaskantha",
            "state": "Gujarat",
            "pin_code": "385210",
            "is_primary": True,
        })

    return locations


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

    data = res.get("data") if isinstance(res.get("data"), dict) else {}
    available_couriers = []
    recommended_courier_id = data.get("recommended_courier_company_id")

    courier_companies = data.get("available_courier_companies")
    if isinstance(courier_companies, list):
        for courier in courier_companies:
            if isinstance(courier, dict):
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
    order_id = str(order.get("order_number") or order.get("_id") or order.get("id"))
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
            "name": item.get("title") or item.get("name") or "Luxury Lighting Fixture",
            "sku": str(item.get("product_id") or "DELUZEX-SKU")[:50],
            "units": int(item.get("quantity", 1)),
            "selling_price": float(item.get("price", 0)),
            "discount": 0,
            "tax": 0,
        })

    if not items_payload:
        items_payload.append({
            "name": "Luxury Luminaire Fixture",
            "sku": "DELUZEX-DEFAULT",
            "units": 1,
            "selling_price": float(order.get("total", 1000)),
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

    # Use exact pickup location string from parameters, env, or default
    loc = (pickup_location or settings.SHIPROCKET_PICKUP_LOCATION or "work").strip()

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
        "billing_pincode": str(shipping_addr.get("pin_code", "380001")).strip(),
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

    logger.info(f"[Shiprocket] Creating adhoc order for Deluzex Order #{order_id} (pickup_location={loc})")
    res = _request("POST", "/orders/create/adhoc", json=payload)

    shiprocket_order_id = res.get("order_id")
    shiprocket_shipment_id = res.get("shipment_id")

    if not shiprocket_order_id or not shiprocket_shipment_id:
        err_details = []
        if isinstance(res.get("errors"), dict):
            for field, msgs in res["errors"].items():
                if isinstance(msgs, list):
                    err_details.append(f"{field}: {', '.join(str(m) for m in msgs)}")
                else:
                    err_details.append(f"{field}: {msgs}")

        main_msg = res.get("message") or "Order creation failed"
        if err_details:
            error_msg = f"{main_msg} ({'; '.join(err_details)})"
        else:
            error_msg = str(main_msg)

        logger.error(f"[Shiprocket] Failed to create order: {error_msg}")
        raise ShiprocketError(error_msg)

    return {
        "shiprocket_order_id": shiprocket_order_id,
        "shiprocket_shipment_id": shiprocket_shipment_id,
        "status": res.get("status"),
        "status_code": res.get("status_code"),
        "raw_response": res,
    }



def sync_order_to_shiprocket(order_data: Any) -> Optional[Dict[str, Any]]:
    """
    Automatically pushes a new Deluzex order (COD or Prepaid Paid) to Shiprocket.
    Creates the order in Shiprocket so customer name, shipping address, products,
    and payment info appear in the Shiprocket dashboard under 'Orders -> New'.
    
    Zero balance is needed for this step (costs Rs 0.00).
    AWB assignment and courier booking can be done later by admin once wallet is recharged.
    """
    from app.core.database import db
    from bson import ObjectId

    try:
        if hasattr(order_data, "model_dump"):
            order_dict = order_data.model_dump(by_alias=True)
        elif isinstance(order_data, dict):
            order_dict = dict(order_data)
        else:
            return None

        # Check if already synced
        if order_dict.get("shiprocket_order_id"):
            logger.info(f"[Shiprocket Auto-Sync] Order #{order_dict.get('_id')} already synced to Shiprocket.")
            return None

        # Only sync active valid orders (skip cancelled / failed)
        status = str(order_dict.get("status") or "").lower()
        if status in ("cancelled", "failed"):
            return None

        res = create_order(order_dict)
        sr_order_id = res.get("shiprocket_order_id")
        sr_shipment_id = res.get("shiprocket_shipment_id")

        if sr_order_id and sr_shipment_id:
            oid_val = order_dict.get("_id") or order_dict.get("id")
            try:
                obj_id = ObjectId(str(oid_val))
            except Exception:
                obj_id = oid_val

            db.orders.update_one(
                {"_id": obj_id},
                {
                    "$set": {
                        "shiprocket_order_id": sr_order_id,
                        "shiprocket_shipment_id": sr_shipment_id,
                        "shiprocket_status": "NEW",
                        "updated_at": datetime.utcnow(),
                    }
                },
            )
            logger.info(
                f"[Shiprocket Auto-Sync] Successfully pushed Order #{oid_val} to Shiprocket! "
                f"SR Order ID: {sr_order_id}, Shipment ID: {sr_shipment_id}"
            )
            return res
        return None
    except Exception as exc:
        logger.warning(f"[Shiprocket Auto-Sync] Automatic push skipped for order: {exc}")
        return None


def generate_awb(
    shipment_id: int,
    courier_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Assign courier partner and generate Air Waybill (AWB) number.
    Gracefully handles and parses responses without crashing on unexpected formats.
    """
    payload: Dict[str, Any] = {"shipment_id": shipment_id}
    if courier_id:
        payload["courier_id"] = courier_id

    logger.info(
        f"[Shiprocket] Assigning AWB for shipment_id={shipment_id} (courier_id={courier_id})"
    )
    res = _request("POST", "/courier/assign/awb", json=payload)

    # Safe nested dictionary parsing
    response_obj = res.get("response") if isinstance(res.get("response"), dict) else {}
    data_obj = response_obj.get("data") if isinstance(response_obj.get("data"), dict) else {}

    awb_code = None
    courier_name = None
    courier_company_id = None

    if isinstance(data_obj, dict):
        awb_code = data_obj.get("awb_code")
        courier_name = data_obj.get("courier_name")
        courier_company_id = data_obj.get("courier_company_id")

    if not awb_code and isinstance(res.get("data"), dict):
        awb_code = res["data"].get("awb_code")
        courier_name = res["data"].get("courier_name") or courier_name
        courier_company_id = res["data"].get("courier_company_id") or courier_company_id

    if not awb_code:
        awb_code = res.get("awb_code")

    awb_status = res.get("awb_assign_status")

    if not awb_code or awb_status == 0:
        err_msg = ""
        if isinstance(data_obj, dict) and data_obj.get("awb_assign_error"):
            err_msg = str(data_obj.get("awb_assign_error"))
        elif isinstance(response_obj.get("data"), str) and response_obj.get("data").strip():
            err_msg = response_obj.get("data").strip()
        elif res.get("message"):
            err_msg = str(res.get("message"))
        elif res.get("errors"):
            err_msg = str(res.get("errors"))
        else:
            err_msg = "AWB could not be generated by courier partner"

        logger.error(f"[Shiprocket] AWB assignment failed: {err_msg}")
        if (
            "recharge" in err_msg.lower()
            or "wallet" in err_msg.lower()
            or res.get("status_code") == 350
        ):
            raise ShiprocketWalletError(
                f"Shiprocket Wallet Recharge Required: {err_msg} (Minimum ₹100 required in Shiprocket wallet to assign couriers)."
            )
        raise ShiprocketError(f"AWB generation failed: {err_msg}")

    return {
        "awb_code": str(awb_code),
        "courier_name": str(courier_name or "Express Logistics"),
        "courier_company_id": courier_company_id or courier_id,
        "shipment_id": shipment_id,
        "raw_response": res,
    }


def schedule_pickup(
    shipment_id: int,
    pickup_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Schedule courier pickup for a shipment.
    pickup_date format: 'YYYY-MM-DD'.
    """
    date_str = pickup_date or datetime.utcnow().strftime("%Y-%m-%d")

    payload = {
        "shipment_id": [shipment_id],
        "pickup_date": [date_str],
    }

    logger.info(f"[Shiprocket] Requesting pickup for shipment_id={shipment_id} on {date_str}")
    res = _request("POST", "/courier/generate/pickup", json=payload)

    response_obj = res.get("response") if isinstance(res.get("response"), dict) else {}
    pickup_status = res.get("pickup_status") or res.get("status")
    pickup_token = response_obj.get("pickup_token_number") or res.get("pickup_token_number")

    if pickup_status == 0 or (res.get("status_code") and res.get("status_code") not in (200, 201)):
        err_msg = (
            response_obj.get("error")
            or (response_obj.get("data") if isinstance(response_obj.get("data"), str) else None)
            or res.get("message")
            or "Failed to schedule pickup"
        )
        raise ShiprocketError(f"Pickup scheduling failed: {err_msg}")

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

    raw_label_url = res.get("label_url")
    if not isinstance(raw_label_url, str) or not raw_label_url.startswith("http"):
        pdf_url = res.get("pdf_url")
        if isinstance(pdf_url, str) and pdf_url.startswith("http"):
            raw_label_url = pdf_url
        else:
            raw_label_url = None

    if not raw_label_url:
        err_msg = res.get("message") or "Label URL not yet ready. Ensure AWB is assigned first."
        raise ShiprocketError(err_msg)

    return {
        "label_url": raw_label_url,
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

    raw_invoice_url = res.get("invoice_url")
    if not isinstance(raw_invoice_url, str) or not raw_invoice_url.startswith("http"):
        raw_invoice_url = None

    if not raw_invoice_url:
        err_msg = res.get("message") or "Invoice PDF is still generating or not available."
        raise ShiprocketError(err_msg)

    return {
        "invoice_url": raw_invoice_url,
        "raw_response": res,
    }


def track_by_awb(awb_code: str) -> Dict[str, Any]:
    """
    Get live, real-time tracking history, scans, current location and ETA.
    """
    logger.info(f"[Shiprocket] Tracking AWB: {awb_code}")
    res = _request("GET", f"/courier/track/awb/{awb_code}")

    tracking_data = res.get("tracking_data") if isinstance(res.get("tracking_data"), dict) else {}
    track_status = tracking_data.get("track_status")
    current_status = tracking_data.get("current_status")
    activities = tracking_data.get("shipment_track_activities") or []
    etd = tracking_data.get("etd")

    # If current_status or etd is empty, inspect shipment_track array
    shipment_tracks = tracking_data.get("shipment_track")
    if isinstance(shipment_tracks, list) and len(shipment_tracks) > 0 and isinstance(shipment_tracks[0], dict):
        first_track = shipment_tracks[0]
        if not current_status:
            current_status = first_track.get("current_status")
        if not etd:
            etd = first_track.get("edd")

    return {
        "awb_code": awb_code,
        "track_status": track_status,
        "current_status": current_status or "In Process",
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
    phone = _clean_phone(order.get("phone") or order.get("user_phone") or (shipping_addr.get("phone") if isinstance(shipping_addr, dict) else "") or "9909382031")
    email = order.get("email") or order.get("user_email") or "support@deluzexlighting.com"

    warehouse_loc = (pickup_location or settings.SHIPROCKET_PICKUP_LOCATION or "work").strip()

    items_payload = []
    for item in (order.get("items") or []):
        items_payload.append({
            "name": item.get("title") or item.get("name") or "Luxury Lighting Fixture",
            "sku": str(item.get("product_id") or "DELUZEX-RETURN-SKU")[:50],
            "units": int(item.get("quantity", 1)),
            "selling_price": float(item.get("price", 0)),
            "discount": 0,
            "qc_enable": False,
        })

    if not items_payload:
        items_payload.append({
            "name": "Luxury Luminaire Return Item",
            "sku": "DELUZEX-RETURN-DEFAULT",
            "units": 1,
            "selling_price": float(order.get("total", 1000)),
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
        "pickup_pincode": str(shipping_addr.get("pin_code", "380001")).strip(),
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
        raise ShiprocketError(f"Return order creation failed: {err}")

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

    response_obj = res.get("response") if isinstance(res.get("response"), dict) else {}
    data_obj = response_obj.get("data") if isinstance(response_obj.get("data"), dict) else {}

    awb_code = None
    courier_name = None

    if isinstance(data_obj, dict):
        awb_code = data_obj.get("awb_code")
        courier_name = data_obj.get("courier_name")

    if not awb_code and isinstance(res.get("data"), dict):
        awb_code = res["data"].get("awb_code")
        courier_name = res["data"].get("courier_name") or courier_name

    if not awb_code:
        awb_code = res.get("awb_code")

    awb_status = res.get("awb_assign_status")

    if not awb_code or awb_status == 0:
        err_msg = ""
        if isinstance(data_obj, dict) and data_obj.get("awb_assign_error"):
            err_msg = str(data_obj.get("awb_assign_error"))
        elif isinstance(response_obj.get("data"), str) and response_obj.get("data").strip():
            err_msg = response_obj.get("data").strip()
        elif res.get("message"):
            err_msg = str(res.get("message"))
        else:
            err_msg = "Reverse AWB assignment pending courier availability"

        logger.warning(f"[Shiprocket] Reverse AWB auto-assignment: {err_msg}")
        if "recharge" in err_msg.lower() or "wallet" in err_msg.lower() or res.get("status_code") == 350:
            raise ShiprocketWalletError(
                f"Shiprocket Wallet Recharge Required: {err_msg} (Minimum ₹100 required in Shiprocket wallet to assign couriers)."
            )
        raise ShiprocketError(err_msg)

    return {
        "return_awb_code": str(awb_code),
        "courier_name": str(courier_name or "Reverse Courier Partner"),
        "shipment_id": return_shipment_id,
        "raw_response": res,
    }
