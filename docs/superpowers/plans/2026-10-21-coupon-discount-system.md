# Dynamic Coupon & Discount System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify an enterprise-grade, luxury-tailored dynamic coupon and discount engine for De Luzex across MongoDB, FastAPI backend, Next.js storefront checkout, and Admin management dashboard with full positive, negative, and edge case coverage.

**Architecture:** A centralized server-side coupon validation service in FastAPI that calculates discounts (percentage with max cap, flat amount, and free shipping) and net taxable amounts. MongoDB stores coupons with granular constraints (MOV, total uses, per-user uses, date ranges, first-order restrictions). Checkout and cart seamlessly validate and auto-apply offers with celebratory UI, while payment and order endpoints enforce server-side recalculation to prevent price tampering.

**Tech Stack:** FastAPI, Pydantic V2, MongoDB (Motor/PyMongo), Pytest, Next.js 14 App Router, TypeScript, Vanilla CSS Modules.

**Spec:** [docs/superpowers/specs/2026-10-21-coupon-discount-system-design.md](file:///c:/Kamal%20Learning/Delu-Website/deluzex/docs/superpowers/specs/2026-10-21-coupon-discount-system-design.md)

## Global Constraints

- Never perform price calculations solely on the client; the backend must re-verify the coupon code and recalculate totals before creating orders or Razorpay payments.
- Indian GST rule: GST (18%) is applied on the discounted taxable amount (`max(0.0, subtotal - discount) * 0.18`), and standard delivery (₹99) applies unless subtotal >= ₹1,999 or a free shipping coupon is applied.
- All coupon codes must be trimmed and converted to uppercase for case-insensitive matching.
- Concurrency control: store-wide coupon usage increments must use atomic database operations (`$inc`) with bounds checking (`times_used < max_uses`).
- All code must adhere to existing repository conventions and maintain lint/type integrity.

---

### Task 1: Coupon Data Model & Schemas

**Files:**
- Create: `backend/app/models/coupon.py`
- Create: `backend/app/schemas/coupon.py`
- Modify: `backend/app/models/__init__.py:1-35`
- Test: `backend/tests/test_coupon_models.py`

**Interfaces:**
- Produces: `Coupon` model, `CouponCreateRequest`, `CouponUpdateRequest`, `CouponResponse`, `CouponValidateRequest`, `CouponValidateResponse`, `AvailableCouponResponse`.

- [ ] **Step 1: Write failing test for Coupon model & schemas**

Create `backend/tests/test_coupon_models.py`:
```python
import pytest
from datetime import datetime, timedelta
from app.models.coupon import Coupon
from app.schemas.coupon import CouponCreateRequest, CouponValidateResponse

def test_coupon_model_defaults_and_validation():
    coupon_data = {
        "code": "DELUZEXVIP",
        "title": "VIP Launch Special",
        "description": "10% off launch discount",
        "discount_type": "percentage",
        "discount_value": 10.0,
        "max_discount_cap": 2000.0,
        "min_order_value": 1999.0,
        "is_active": True,
        "is_public": True,
        "is_first_order_only": True,
    }
    coupon = Coupon(**coupon_data)
    assert coupon.code == "DELUZEXVIP"
    assert coupon.discount_type == "percentage"
    assert coupon.times_used == 0
    assert coupon.max_uses_per_user == 1

def test_coupon_create_request_code_normalization():
    req = CouponCreateRequest(
        code="  deluzexvip  ",
        title="Test",
        discount_type="percentage",
        discount_value=15.0,
    )
    assert req.code == "DELUZEXVIP"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_coupon_models.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.models.coupon'`

- [ ] **Step 3: Implement `backend/app/models/coupon.py` and `backend/app/schemas/coupon.py`**

Create `backend/app/models/coupon.py`:
```python
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator
from app.models.common import PyObjectId

DiscountType = Literal["percentage", "flat", "free_shipping"]

class Coupon(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    code: str
    title: str
    description: Optional[str] = ""
    discount_type: DiscountType = "percentage"
    discount_value: float = 0.0
    max_discount_cap: Optional[float] = None
    min_order_value: float = 0.0
    is_active: bool = True
    is_public: bool = True
    is_first_order_only: bool = False
    start_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    max_uses: Optional[int] = None
    times_used: int = 0
    max_uses_per_user: int = 1
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return v.strip().upper()
```

Create `backend/app/schemas/coupon.py`:
```python
from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator
from app.models.coupon import DiscountType

class CouponCreateRequest(BaseModel):
    code: str
    title: str
    description: Optional[str] = ""
    discount_type: DiscountType = "percentage"
    discount_value: float = 0.0
    max_discount_cap: Optional[float] = None
    min_order_value: float = 0.0
    is_active: bool = True
    is_public: bool = True
    is_first_order_only: bool = False
    start_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    max_uses: Optional[int] = None
    max_uses_per_user: int = 1

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return v.strip().upper()

class CouponUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    discount_type: Optional[DiscountType] = None
    discount_value: Optional[float] = None
    max_discount_cap: Optional[float] = None
    min_order_value: Optional[float] = None
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None
    is_first_order_only: Optional[bool] = None
    start_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    max_uses: Optional[int] = None
    max_uses_per_user: Optional[int] = None

class CouponResponse(BaseModel):
    id: str = Field(alias="_id")
    code: str
    title: str
    description: Optional[str] = ""
    discount_type: DiscountType
    discount_value: float
    max_discount_cap: Optional[float] = None
    min_order_value: float
    is_active: bool
    is_public: bool
    is_first_order_only: bool
    start_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    max_uses: Optional[int] = None
    times_used: int
    max_uses_per_user: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True

class AvailableCouponResponse(BaseModel):
    code: str
    title: str
    description: Optional[str] = ""
    discount_type: DiscountType
    discount_value: float
    max_discount_cap: Optional[float] = None
    min_order_value: float
    is_first_order_only: bool
    expiry_date: Optional[datetime] = None

class CouponValidateRequest(BaseModel):
    code: str
    subtotal: float
    email: Optional[str] = None

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return v.strip().upper()

class CouponValidateResponse(BaseModel):
    valid: bool
    code: str
    reason: Optional[str] = None
    message: str
    discount_type: Optional[DiscountType] = None
    discount_value: Optional[float] = None
    discount_amount: float = 0.0
    discount_breakdown: Optional[dict] = None
    new_subtotal: float = 0.0
    gst: float = 0.0
    delivery: float = 0.0
    grand_total: float = 0.0
    required_more: Optional[float] = None
```

Export in `backend/app/models/__init__.py`:
Add `from app.models.coupon import Coupon`

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_coupon_models.py -v`
Expected: PASS

- [ ] **Step 5: Commit changes**

Run:
```bash
git add backend/app/models/coupon.py backend/app/schemas/coupon.py backend/app/models/__init__.py backend/tests/test_coupon_models.py
git commit -m "feat: add Coupon data model and Pydantic schemas"
```

---

### Task 2: Central Coupon Calculation & Validation Service (TDD)

**Files:**
- Create: `backend/app/services/coupon_service.py`
- Test: `backend/tests/test_coupon_service.py`

**Interfaces:**
- Consumes: `Coupon` model, MongoDB `db.orders`, `db.coupons`
- Produces:
  - `calculate_discount(coupon: dict, subtotal: float) -> tuple[float, float, float, float]`
  - `validate_coupon(code: str, subtotal: float, email: Optional[str] = None) -> CouponValidateResponse`

- [ ] **Step 1: Write failing test suite covering all positive, negative, and edge calculations**

Create `backend/tests/test_coupon_service.py`:
```python
import pytest
from datetime import datetime, timedelta
from app.services.coupon_service import calculate_discount, validate_coupon_dict

def test_calculate_discount_percentage_no_cap():
    coupon = {"discount_type": "percentage", "discount_value": 10.0, "max_discount_cap": None}
    disc, tax_sub, gst, deliv, grand = calculate_discount(coupon, 5000.0)
    assert disc == 500.0
    assert tax_sub == 4500.0
    assert gst == 810.0
    assert deliv == 0.0  # subtotal >= 1999 -> free delivery
    assert grand == 5310.0

def test_calculate_discount_percentage_with_cap():
    coupon = {"discount_type": "percentage", "discount_value": 20.0, "max_discount_cap": 1500.0}
    # 20% of 20000 is 4000, capped at 1500
    disc, tax_sub, gst, deliv, grand = calculate_discount(coupon, 20000.0)
    assert disc == 1500.0
    assert tax_sub == 18500.0
    assert gst == 3330.0
    assert deliv == 0.0
    assert grand == 21830.0

def test_calculate_discount_flat():
    coupon = {"discount_type": "flat", "discount_value": 500.0}
    disc, tax_sub, gst, deliv, grand = calculate_discount(coupon, 3000.0)
    assert disc == 500.0
    assert tax_sub == 2500.0
    assert gst == 450.0
    assert deliv == 0.0
    assert grand == 2950.0

def test_calculate_discount_free_shipping():
    coupon = {"discount_type": "free_shipping", "discount_value": 0.0}
    disc, tax_sub, gst, deliv, grand = calculate_discount(coupon, 1000.0)
    # subtotal < 1999 normally charges 99 delivery, but coupon makes it 0
    assert deliv == 0.0
    assert disc == 0.0
    assert tax_sub == 1000.0
    assert gst == 180.0
    assert grand == 1180.0

def test_calculate_discount_exceeding_subtotal():
    coupon = {"discount_type": "flat", "discount_value": 1500.0}
    disc, tax_sub, gst, deliv, grand = calculate_discount(coupon, 800.0)
    assert disc == 800.0
    assert tax_sub == 0.0
    assert gst == 0.0

def test_validation_inactive_coupon():
    coupon = {"code": "OFF50", "is_active": False, "min_order_value": 0}
    res = validate_coupon_dict(coupon, 2000.0, None, completed_orders_count=0, user_usage_count=0)
    assert not res.valid
    assert res.reason == "INACTIVE"

def test_validation_expired_coupon():
    coupon = {
        "code": "OLD",
        "is_active": True,
        "expiry_date": datetime.utcnow() - timedelta(days=1),
        "min_order_value": 0
    }
    res = validate_coupon_dict(coupon, 2000.0, None, completed_orders_count=0, user_usage_count=0)
    assert not res.valid
    assert res.reason == "EXPIRED"

def test_validation_min_order_value_not_met():
    coupon = {"code": "BIG", "is_active": True, "min_order_value": 3000.0}
    res = validate_coupon_dict(coupon, 2500.0, None, completed_orders_count=0, user_usage_count=0)
    assert not res.valid
    assert res.reason == "MIN_ORDER_NOT_MET"
    assert res.required_more == 500.0

def test_validation_first_order_only_rejected_for_existing_user():
    coupon = {"code": "FIRST", "is_active": True, "is_first_order_only": True, "min_order_value": 0}
    res = validate_coupon_dict(coupon, 2000.0, "user@test.com", completed_orders_count=2, user_usage_count=0)
    assert not res.valid
    assert res.reason == "FIRST_ORDER_ONLY"

def test_validation_max_uses_per_user_exhausted():
    coupon = {"code": "ONEUSE", "is_active": True, "max_uses_per_user": 1, "min_order_value": 0}
    res = validate_coupon_dict(coupon, 2000.0, "user@test.com", completed_orders_count=1, user_usage_count=1)
    assert not res.valid
    assert res.reason == "USER_LIMIT_REACHED"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_coupon_service.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.coupon_service'`

- [ ] **Step 3: Implement `backend/app/services/coupon_service.py`**

Create `backend/app/services/coupon_service.py`:
```python
import logging
from datetime import datetime
from typing import Optional, Tuple
from app.core.database import db
from app.schemas.coupon import CouponValidateResponse

logger = logging.getLogger("uvicorn.error")

def calculate_discount(coupon: dict, subtotal: float) -> Tuple[float, float, float, float, float]:
    """
    Computes (discount_amount, taxable_subtotal, gst, delivery, grand_total)
    GST is 18% on net taxable subtotal.
    Standard delivery is ₹99 if subtotal < 1999, else ₹0.
    """
    discount_type = coupon.get("discount_type", "percentage")
    discount_val = float(coupon.get("discount_value", 0.0))
    max_cap = coupon.get("max_discount_cap")

    if discount_type == "percentage":
        discount = (subtotal * discount_val) / 100.0
        if max_cap is not None and max_cap > 0:
            discount = min(discount, float(max_cap))
    elif discount_type == "flat":
        discount = discount_val
    elif discount_type == "free_shipping":
        discount = 0.0
    else:
        discount = 0.0

    discount = min(discount, subtotal)
    discount = round(discount, 2)

    taxable_subtotal = max(0.0, subtotal - discount)
    gst = round(taxable_subtotal * 0.18, 2)

    if discount_type == "free_shipping" or subtotal >= 1999.0 or subtotal == 0:
        delivery = 0.0
    else:
        delivery = 99.0

    grand_total = round(taxable_subtotal + gst + delivery, 2)
    return discount, taxable_subtotal, gst, delivery, grand_total


def validate_coupon_dict(
    coupon: dict,
    subtotal: float,
    email: Optional[str] = None,
    completed_orders_count: int = 0,
    user_usage_count: int = 0,
) -> CouponValidateResponse:
    code = coupon.get("code", "")

    if not coupon.get("is_active", True):
        return CouponValidateResponse(
            valid=False,
            code=code,
            reason="INACTIVE",
            message=f"Coupon {code} is currently inactive.",
        )

    now = datetime.utcnow()
    if coupon.get("start_date") and now < coupon["start_date"]:
        return CouponValidateResponse(
            valid=False,
            code=code,
            reason="NOT_STARTED",
            message=f"Coupon {code} has not started yet.",
        )

    if coupon.get("expiry_date") and now > coupon["expiry_date"]:
        return CouponValidateResponse(
            valid=False,
            code=code,
            reason="EXPIRED",
            message=f"Coupon {code} has expired.",
        )

    min_mov = float(coupon.get("min_order_value", 0.0))
    if subtotal < min_mov:
        diff = round(min_mov - subtotal, 2)
        return CouponValidateResponse(
            valid=False,
            code=code,
            reason="MIN_ORDER_NOT_MET",
            required_more=diff,
            message=f"Add ₹{diff:,.0f} more to apply coupon {code}.",
        )

    max_uses = coupon.get("max_uses")
    times_used = coupon.get("times_used", 0)
    if max_uses is not None and times_used >= max_uses:
        return CouponValidateResponse(
            valid=False,
            code=code,
            reason="MAX_USES_REACHED",
            message=f"Coupon {code} has reached its maximum redemption limit.",
        )

    if coupon.get("is_first_order_only") and completed_orders_count > 0:
        return CouponValidateResponse(
            valid=False,
            code=code,
            reason="FIRST_ORDER_ONLY",
            message=f"Coupon {code} is only valid for your first order.",
        )

    max_user_uses = coupon.get("max_uses_per_user", 1)
    if user_usage_count >= max_user_uses:
        return CouponValidateResponse(
            valid=False,
            code=code,
            reason="USER_LIMIT_REACHED",
            message=f"You have already redeemed coupon {code} the maximum allowed times.",
        )

    discount, tax_sub, gst, delivery, grand_total = calculate_discount(coupon, subtotal)

    msg = f"Coupon {code} applied successfully! You saved ₹{discount:,.2f}"
    if coupon.get("discount_type") == "free_shipping":
        msg = f"Coupon {code} applied! Free delivery unlocked."

    return CouponValidateResponse(
        valid=True,
        code=code,
        message=msg,
        discount_type=coupon.get("discount_type", "percentage"),
        discount_value=coupon.get("discount_value", 0.0),
        discount_amount=discount,
        new_subtotal=tax_sub,
        gst=gst,
        delivery=delivery,
        grand_total=grand_total,
    )


def validate_coupon_code(code: str, subtotal: float, email: Optional[str] = None) -> CouponValidateResponse:
    clean_code = code.strip().upper()
    coupon = db.coupons.find_one({"code": clean_code})
    if not coupon:
        return CouponValidateResponse(
            valid=False,
            code=clean_code,
            reason="NOT_FOUND",
            message=f"Coupon code '{clean_code}' is invalid.",
        )

    completed_orders = 0
    user_usage = 0
    if email:
        clean_email = email.strip().lower()
        completed_orders = db.orders.count_documents({
            "email": {"$regex": f"^{clean_email}$", "$options": "i"},
            "status": {"$in": ["paid", "delivered", "processing", "shipped", "cod"]}
        })
        user_usage = db.orders.count_documents({
            "email": {"$regex": f"^{clean_email}$", "$options": "i"},
            "coupon_code": clean_code,
            "status": {"$in": ["paid", "delivered", "processing", "shipped", "cod"]}
        })

    return validate_coupon_dict(coupon, subtotal, email, completed_orders, user_usage)
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `python -m pytest backend/tests/test_coupon_service.py -v`
Expected: PASS (All 10 test cases pass)

- [ ] **Step 5: Commit changes**

Run:
```bash
git add backend/app/services/coupon_service.py backend/tests/test_coupon_service.py
git commit -m "feat: implement centralized coupon calculation and validation service with full test coverage"
```

---

### Task 3: Backend FastAPI Endpoints for Coupons (Public & Admin)

**Files:**
- Create: `backend/app/api/endpoints/coupons.py`
- Modify: `backend/app/api/__init__.py:1-40`
- Test: `backend/tests/test_coupon_endpoints.py`

**Interfaces:**
- Produces:
  - `GET /api/coupons/available`
  - `POST /api/coupons/validate`
  - `POST /api/admin/coupons`
  - `GET /api/admin/coupons`
  - `GET /api/admin/coupons/{coupon_id}`
  - `PUT /api/admin/coupons/{coupon_id}`
  - `PATCH /api/admin/coupons/{coupon_id}/toggle`
  - `DELETE /api/admin/coupons/{coupon_id}`

- [ ] **Step 1: Write integration test for coupon endpoints**

Create `backend/tests/test_coupon_endpoints.py`:
```python
from fastapi.testclient import TestClient
from main import app
from app.core.database import db
from datetime import datetime, timedelta

client = TestClient(app)

def test_available_coupons_and_validation():
    # Setup coupon in db
    db.coupons.delete_many({"code": "TESTVIP"})
    db.coupons.insert_one({
        "code": "TESTVIP",
        "title": "Test VIP",
        "description": "10% off",
        "discount_type": "percentage",
        "discount_value": 10.0,
        "min_order_value": 1000.0,
        "is_active": True,
        "is_public": True,
        "is_first_order_only": False,
        "times_used": 0,
        "max_uses_per_user": 1,
        "created_at": datetime.utcnow()
    })

    # Test GET available
    res = client.get("/api/coupons/available")
    assert res.status_code == 200
    codes = [c["code"] for c in res.json()]
    assert "TESTVIP" in codes

    # Test POST validate - valid
    res_val = client.post("/api/coupons/validate", json={
        "code": "TESTVIP",
        "subtotal": 2000.0,
        "email": "test@deluzex.com"
    })
    assert res_val.status_code == 200
    data = res_val.json()
    assert data["valid"] is True
    assert data["discount_amount"] == 200.0
    assert data["grand_total"] == 2124.0

    # Cleanup
    db.coupons.delete_many({"code": "TESTVIP"})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_coupon_endpoints.py -v`
Expected: FAIL (404 on `/api/coupons/available`)

- [ ] **Step 3: Implement `backend/app/api/endpoints/coupons.py` and register router**

Create `backend/app/api/endpoints/coupons.py`:
Full CRUD for Admin with Audit logging, plus public endpoints for `/available` and `/validate`.
Update `backend/app/api/__init__.py` to include `api_router.include_router(coupons.router, prefix="/coupons", tags=["coupons"])` and `api_router.include_router(coupons.admin_router, prefix="/admin/coupons", tags=["admin-coupons"])`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_coupon_endpoints.py -v`
Expected: PASS

- [ ] **Step 5: Commit changes**

Run:
```bash
git add backend/app/api/endpoints/coupons.py backend/app/api/__init__.py backend/tests/test_coupon_endpoints.py
git commit -m "feat: add public and admin coupon endpoints with validation and CRUD"
```

---

### Task 4: Server-Side Order & Payment Security Guardrails

**Files:**
- Modify: `backend/app/models/order.py:40-60`
- Modify: `backend/app/schemas/order.py:8-25`
- Modify: `backend/app/schemas/payment.py:16-35`
- Modify: `backend/app/api/endpoints/payments.py:95-150`
- Modify: `backend/app/api/endpoints/orders.py:130-180`
- Test: `backend/tests/test_order_coupon_security.py`

**Interfaces:**
- Consumes: `Coupon` model, `calculate_discount`, `validate_coupon_code`
- Produces: Atomic coupon usage recording, tamper-proof payment creation, and order persistence with coupon fields.

- [ ] **Step 1: Write test for price tampering rejection & atomic increment**

Create `backend/tests/test_order_coupon_security.py`:
```python
import pytest
from fastapi.testclient import TestClient
from main import app
from app.core.database import db

client = TestClient(app)

def test_tampered_discount_rejected():
    # Setup test coupon
    db.coupons.delete_many({"code": "TAMPER10"})
    db.coupons.insert_one({
        "code": "TAMPER10",
        "title": "Tamper Test",
        "discount_type": "percentage",
        "discount_value": 10.0,
        "min_order_value": 1000.0,
        "is_active": True,
        "times_used": 0,
        "max_uses_per_user": 5
    })

    # Subtotal is 2000, 10% discount is 200, GST is 324, Grand Total is 2324.
    # Client sends fake total 500 (tampering)
    payload = {
        "email": "hacker@test.com",
        "phone": "9876543210",
        "shipping_address": {
            "first_name": "Test",
            "last_name": "User",
            "street": "123 Street",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pin_code": "400001"
        },
        "items": [{
            "product_id": "test_prod_1",
            "title": "Test Lamp",
            "price": 2000.0,
            "quantity": 1
        }],
        "subtotal": 2000.0,
        "gst": 324.0,
        "delivery": 0.0,
        "total": 500.0,  # FAKE / TAMPERED
        "payment_method": "upi",
        "razorpay_method": "upi",
        "coupon_code": "TAMPER10"
    }
    res = client.post("/api/payments/create-order", json=payload)
    # Must reject with 400 Bad Request due to calculation mismatch
    assert res.status_code == 400
    assert "mismatch" in res.json()["detail"].lower()

    # Cleanup
    db.coupons.delete_many({"code": "TAMPER10"})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_order_coupon_security.py -v`
Expected: FAIL (either status is not 400 or payload schema doesn't have coupon_code)

- [ ] **Step 3: Update Order schemas, models, and endpoints**

Add `coupon_code: Optional[str] = None` and `discount: float = 0.0` to:
- `Order` model in `backend/app/models/order.py`
- `OrderCreateRequest` in `backend/app/schemas/order.py`
- `CreateOrderRequest` and `CodOrderRequest` in `backend/app/schemas/payment.py`
In `backend/app/api/endpoints/payments.py` (`create_order` and `create_cod_order`):
- Re-validate coupon code if provided using `validate_coupon_code`.
- Re-calculate expected `discount`, `gst`, `delivery`, and `total`.
- Verify client `payload.total` matches computed total within ±₹0.50 (rounding tolerance).
- Persist `coupon_code` and `discount` on the created `Order` document.
- Upon successful payment verification or COD order placement, atomically increment `times_used`:
  `db.coupons.update_one({"code": clean_code}, {"$inc": {"times_used": 1}})`

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_order_coupon_security.py -v`
Expected: PASS

- [ ] **Step 5: Commit changes**

Run:
```bash
git add backend/app/models/order.py backend/app/schemas/order.py backend/app/schemas/payment.py backend/app/api/endpoints/payments.py backend/app/api/endpoints/orders.py backend/tests/test_order_coupon_security.py
git commit -m "feat: enforce server-side price validation and atomic coupon usage accounting"
```

---

### Task 5: Frontend API Client & Types

**Files:**
- Modify: `app/services/api.ts:1-200`
- Test: Verify build / type check with `npm run build` or `npx tsc --noEmit`

**Interfaces:**
- Produces:
  - `fetchAvailableCoupons(): Promise<AvailableCoupon[]>`
  - `validateCoupon(code: string, subtotal: number, email?: string): Promise<CouponValidateResponse>`
  - `fetchAdminCoupons(): Promise<Coupon[]>`
  - `createAdminCoupon(data: CouponCreateInput): Promise<Coupon>`
  - `updateAdminCoupon(id: string, data: Partial<CouponCreateInput>): Promise<Coupon>`
  - `toggleAdminCoupon(id: string): Promise<{ success: boolean; is_active: boolean }>`
  - `deleteAdminCoupon(id: string): Promise<{ success: boolean }>`

- [ ] **Step 1: Add Coupon interfaces and API helper functions**

In `app/services/api.ts`:
Define types: `AvailableCoupon`, `CouponValidateResponse`, `AdminCoupon`, `CouponCreateInput`.
Add export functions calling `/api/coupons/...` and `/api/admin/coupons/...`.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit changes**

Run:
```bash
git add app/services/api.ts
git commit -m "feat: add frontend TypeScript interfaces and API methods for coupons"
```

---

### Task 6: Storefront Cart & Checkout UX Integration

**Files:**
- Modify: `app/checkout/page.tsx:90-150, 400-550`
- Modify: `app/checkout/checkout.module.css:300-450`
- Modify: `app/components/CartDrawer.tsx` (or `app/cart/page.tsx` if applicable)

**Interfaces:**
- Consumes: `fetchAvailableCoupons`, `validateCoupon`
- Produces:
  - Interactive Promo Code Input with uppercase transformation.
  - "Available Offers" Drawer/Section with 1-click "APPLY".
  - Golden celebratory applied state with "Remove" badge.
  - Transparent bill breakdown showing Coupon Discount in gold/green.
  - Auto-revalidation when cart items/quantity change.

- [ ] **Step 1: Implement Coupon UI in `app/checkout/page.tsx`**

Integrate state:
- `appliedCoupon: CouponValidateResponse | null`
- `couponInput: string`
- `couponLoading: boolean`
- `couponError: string | null`
- `availableOffers: AvailableCoupon[]`
Add `useEffect` to fetch available coupons on mount.
Add `handleApplyCoupon(codeToApply?: string)`.
Update calculations:
```typescript
const discount = appliedCoupon?.discount_amount || 0;
const taxableSubtotal = Math.max(0, subtotal - discount);
const gst = taxableSubtotal * 0.18;
const delivery = (appliedCoupon?.discount_type === "free_shipping" || subtotal >= 1999) ? 0 : (subtotal > 0 ? 99 : 0);
const grandTotal = taxableSubtotal + gst + delivery;
```
Pass `coupon_code: appliedCoupon?.code` in `createPaymentOrder` and `createCodOrder`.

- [ ] **Step 2: Style coupon components in `app/checkout/checkout.module.css`**

Add luxury styling matching De Luzex aesthetic:
- Clean minimal border input with gold focus ring.
- Available offers card with dashed gold border and badge.
- Celebratory discount tag with smooth fade-in animation.
- Helpful error / prompt state.

- [ ] **Step 3: Test Cart Modification Edge Case**

Add `useEffect` listening to `subtotal`: if `appliedCoupon` is active and `subtotal < appliedCoupon.min_order_value`, automatically revalidate or alert user and adjust discount.

- [ ] **Step 4: Run typecheck and frontend build validation**

Run: `npm run build`
Expected: PASS (Compiled successfully)

- [ ] **Step 5: Commit changes**

Run:
```bash
git add app/checkout/page.tsx app/checkout/checkout.module.css
git commit -m "feat: integrate dynamic coupon input and available offers card into checkout"
```

---

### Task 7: Admin Panel Coupon Management (`/admin/coupons`)

**Files:**
- Create: `app/admin/coupons/page.tsx`
- Create: `app/admin/coupons/coupons.module.css`
- Modify: `app/admin/layout.tsx:50-100` (Add "Coupons & Offers" to Admin Sidebar)

**Interfaces:**
- Consumes: Admin coupon endpoints
- Produces: Complete CRUD, 1-Click active/inactive switch, template presets, and usage analytics.

- [ ] **Step 1: Create Admin Coupons Page**

Create `app/admin/coupons/page.tsx`:
- Overview Stats: Active Coupons count, Total Times Redeemed, Quick Add button.
- Coupons Table: Code, Type, Value, Min Order, Uses / Limit, Expiry, Status Switch (Toggle), Actions (Delete).
- Create / Edit Modal: Form with presets ("VIP Launch 10%", "Festive Flat ₹500", "Free Shipping"), custom code input, date picker, and validation constraints.
- Seed default `DELUZEXVIP` coupon if database has 0 coupons.

- [ ] **Step 2: Add sidebar navigation item**

In `app/admin/layout.tsx`:
Add "Coupons & Offers" link with `Tag` or `Ticket` icon pointing to `/admin/coupons`.

- [ ] **Step 3: Run build check**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit changes**

Run:
```bash
git add app/admin/coupons/page.tsx app/admin/coupons/coupons.module.css app/admin/layout.tsx
git commit -m "feat: add comprehensive admin coupon management interface and navigation"
```

---

### Task 8: End-to-End Verification (Positive, Negative, and Edge Cases)

**Files:**
- Create: `backend/tests/test_coupon_e2e_scenarios.py`
- Browser verification script or browser subagent inspection

- [ ] **Step 1: Run complete backend pytest suite**

Run: `python -m pytest backend/tests/test_coupon*.py -v`
Expected: All tests PASS with 100% green status across all positive, negative, and edge scenarios.

- [ ] **Step 2: Browser Verification on Storefront and Admin**

Verify:
- Admin panel `/admin/coupons` loads, lists `DELUZEXVIP`, allows creating a new coupon `TEST20`, and allows toggling status.
- Checkout page displays "Available Offers" with `DELUZEXVIP`.
- Clicking "APPLY" validates code, deducts 10%, updates GST and Grand Total cleanly.
- Entering invalid code shows friendly error message.
- Removing coupon cleanly resets totals.

- [ ] **Step 3: Final commit and summary**

Run:
```bash
git add .
git commit -m "test: verify complete coupon subsystem end-to-end"
```
