# Design Specification: Dynamic Coupon & Promotions Subsystem for De Luzex

- **Date:** 2026-10-21
- **Status:** Proposed (Under Review)
- **Author:** Antigravity & Kamal
- **Scope:** Full-stack (MongoDB Database, FastAPI Backend Engine, Admin Management Dashboard, Next.js Frontend Cart & Checkout UX)

---

## 1. Executive Summary & Business Goals

De Luzex currently lacks a dynamic coupon, promo code, and discount engine. While email campaigns (such as `backend/send_launch_emails.py`) mention launch promo code `DELUZEXVIP` for 10% off, neither the backend nor the checkout frontend currently supports entering, validating, or computing discounts.

This specification outlines an enterprise-grade, luxury-tailored **Dynamic Coupon & Promotions Engine** that provides:
1. **Delightful Customer UX:** 1-Click apply from an "Available Offers" drawer, real-time discount celebration, clear tax & savings breakdown, and actionable guidance (e.g. "Add ₹400 more to unlock this code").
2. **Zero-Friction Admin Management:** A dedicated `/admin/coupons` control panel to create, edit, toggle, and analyze coupons with pre-built templates, maximum discount caps (financial risk protection), and customer limits.
3. **Rock-Solid Security & Integrity:** Server-side price recalculation, tamper resistance, atomic usage counting, and resilience against race conditions.

---

## 2. Architecture & Data Flow

```
[Customer Cart / Checkout]
       │
       ├── (1) GET /api/coupons/available ──────────► [Coupons Service]
       │       (Returns active public coupons)               │
       │                                                     ▼
       ├── (2) POST /api/coupons/validate ──────────► [Validation Engine]
       │       (Checks code, min_order, user limits,          │
       │        expiry, calculates discount & new totals)    ▼
       │                                               [MongoDB]
       └── (3) POST /api/payments/create-order ──────► (Recalculates coupon
               (Includes coupon_code & verification)    server-side to prevent
                                                        client-side tampering)
```

---

## 3. Database Schema (MongoDB `coupons` collection)

### Collection: `coupons`
```json
{
  "_id": "ObjectId(...)",
  "code": "DELUZEXVIP",
  "title": "VIP Launch Special",
  "description": "Get 10% off on your first luxury home decor order",
  "discount_type": "percentage", // "percentage" | "flat" | "free_shipping"
  "discount_value": 10.0,        // 10% or ₹500 flat
  "max_discount_cap": 2000.0,    // Cap for percentage discounts (null if uncapped)
  "min_order_value": 1999.0,     // Minimum cart subtotal required
  "is_active": true,
  "is_public": true,             // If true, listed in Available Offers; if false, secret VIP code
  "is_first_order_only": true,   // Restricted to customers with 0 completed orders
  "start_date": "2026-10-01T00:00:00Z",
  "expiry_date": "2026-12-31T23:59:59Z", // Optional / null for perpetual
  "max_uses": 500,               // Store-wide total redemption limit (null for unlimited)
  "times_used": 14,              // Number of successful redemptions
  "max_uses_per_user": 1,        // Max redemptions per email / user_id
  "created_at": "2026-10-21T12:00:00Z",
  "updated_at": "2026-10-21T12:00:00Z"
}
```

### Updates to `orders` Model & Collection
Add the following fields to `app/models/order.py`:
- `coupon_code`: `Optional[str] = None`
- `discount`: `float = 0.0`
- `discount_breakdown`: `Optional[dict] = None` (e.g., `{"type": "percentage", "rate": 10, "cap_applied": false}`)

---

## 4. Backend Validation Engine & Endpoints

### 4.1 Endpoints
1. `GET /api/coupons/available` (Public)
   - Returns all active, public coupons whose start_date <= now <= expiry_date and times_used < max_uses.
   - Allows users to see and 1-click apply discounts.
2. `POST /api/coupons/validate` (Public / Authenticated)
   - Request Body: `{ "code": "DELUZEXVIP", "subtotal": 5000.0, "email": "customer@example.com" }`
   - Returns:
     ```json
     {
       "valid": true,
       "code": "DELUZEXVIP",
       "discount_type": "percentage",
       "discount_amount": 500.0,
       "new_subtotal": 4500.0,
       "gst": 810.0,
       "delivery": 0.0,
       "grand_total": 5310.0,
       "message": "DELUZEXVIP applied! You saved ₹500"
     }
     ```
   - If invalid, returns `valid: false` with specific reason and helpful prompt (e.g. `{"valid": false, "reason": "MIN_ORDER_NOT_MET", "required_more": 450.0, "message": "Add ₹450 more to apply this coupon"}`).
3. `POST /api/admin/coupons` (Admin Only) - Create coupon
4. `GET /api/admin/coupons` (Admin Only) - List coupons with pagination and search
5. `GET /api/admin/coupons/{id}` (Admin Only) - View single coupon details + usage history
6. `PUT /api/admin/coupons/{id}` (Admin Only) - Update coupon details
7. `PATCH /api/admin/coupons/{id}/toggle` (Admin Only) - Quick 1-click enable/disable
8. `DELETE /api/admin/coupons/{id}` (Admin Only) - Delete coupon (or soft-delete if already used in orders)

### 4.2 Calculation & Tax Logic (Financial Integrity)
- **Standard Tax Order**:
  1. `subtotal` = Sum of all items (`item.price * item.quantity`).
  2. `discount` = Calculated based on coupon rules:
     - `percentage`: `min(subtotal * (discount_value / 100), max_discount_cap or inf)`
     - `flat`: `min(discount_value, subtotal)`
     - `free_shipping`: `delivery = 0.0`
  3. `taxable_subtotal` = `max(0.0, subtotal - discount)`
  4. `gst` = `taxable_subtotal * 0.18` (18% GST as per Indian law on net taxable supply)
  5. `delivery` = `0.0` if `free_shipping` or `subtotal >= 1999` else standard ₹99
  6. `grand_total` = `taxable_subtotal + gst + delivery`
- **Security Check on `/api/payments/create-order` and `/api/orders/cod`**:
  - The client submits `coupon_code`. The backend re-fetches the coupon from the database, runs the exact calculation server-side, and validates that client `total` matches the computed `total`. Any client manipulation throws `HTTP 400: Discount mismatch`.

---

## 5. Frontend UI/UX Design

### 5.1 Cart & Checkout UX
1. **Promo Code Input Box:** Clean, luxury aesthetic input with uppercase auto-formatting, "Apply" button, and loading spinner.
2. **Available Offers Card / Drawer:**
   - Displays clickable tags for active public promotions (e.g. `DELUZEXVIP` - 10% off on your first order).
   - "Apply" button triggers instant validation.
3. **Celebration & Applied State:**
   - Visual chip/tag: `🏷️ DELUZEXVIP (-₹500) [Remove]`
   - Subtle gold celebration highlight.
4. **Summary Breakdown:**
   - Subtotal: ₹5,000
   - Coupon Discount (DELUZEXVIP): **-₹500** (highlighted in luxury gold/green)
   - Estimated GST (18%): ₹810
   - Shipping: FREE
   - **Total Payable: ₹5,310**

### 5.2 Admin Management UX (`/admin/coupons`)
1. **Overview Metrics:** Total active coupons, total discount given to date, total orders generated via coupons.
2. **Coupons Table:**
   - Columns: Code, Type/Value, Min Order, Uses / Limit, Validity, Status (Toggle Switch), Actions (Edit / Delete).
3. **Create / Edit Modal / Form:**
   - Code generator button (e.g. `GENERATE CODE`).
   - Radio buttons for Discount Type (`Percentage %`, `Flat ₹`, `Free Shipping`).
   - Quick presets: "Launch Offer", "Festive Sale", "Clearance Flat Off".
   - Clean date pickers for start & end date.
   - Toggles for "Public Offer" and "First-Time Buyer Only".

---

## 6. Comprehensive Test Matrix & Edge Cases

The following test scenarios must be implemented in automated unit, integration, and UI tests:

### A. Positive Test Cases
1. **Percentage Discount without Cap:** 10% on ₹2,000 -> ₹200 discount.
2. **Percentage Discount with Cap:** 20% on ₹15,000 with ₹1,500 cap -> exactly ₹1,500 discount (not ₹3,000).
3. **Flat Discount:** ₹500 off on ₹3,000 -> ₹500 discount, new subtotal ₹2,500.
4. **Free Shipping Coupon:** Delivery fee becomes ₹0 regardless of standard delivery fee.
5. **Exact Minimum Cart Value:** Min cart ₹1,999 on cart of ₹1,999.00 -> passes validation.
6. **Case-Insensitive & Whitespace Normalization:** `deluzexvip`, ` DELUZEXVIP `, `DeLuZeXvIp` all resolve properly to `DELUZEXVIP`.
7. **Switching Coupons:** Applying `COUPON_B` cleanly replaces previously applied `COUPON_A`.
8. **Removing Coupon:** Clicking "Remove" resets discount to ₹0, recalculates GST and Delivery properly.
9. **Order Completion Recording:** When payment succeeds or COD is placed, `times_used` is incremented and order document stores coupon metadata.

### B. Negative Test Cases
1. **Invalid Code:** Non-existent code returns friendly `Coupon code does not exist`.
2. **Inactive Code:** Admin toggled `is_active: false` -> returns `This coupon is currently inactive`.
3. **Expired Code:** Current timestamp > `expiry_date` -> returns `This coupon has expired`.
4. **Upcoming Code:** Current timestamp < `start_date` -> returns `This coupon is not yet active`.
5. **Minimum Order Value Not Met:** Cart subtotal < `min_order_value` -> returns `Minimum cart value of ₹X required. Add ₹Y more to apply`.
6. **Store-wide Usage Limit Exhausted:** `times_used >= max_uses` -> returns `This offer has reached its maximum redemptions`.
7. **Per-User Usage Limit Exhausted:** User email already completed `max_uses_per_user` orders with this code -> returns `You have already used this coupon the maximum allowed times`.
8. **First-Time Buyer Restriction:** Customer has >= 1 completed order and attempts to use a first-order-only coupon -> returns `This offer is exclusive to first-time customers`.

### C. Critical Edge & Security Cases
1. **Price Tampering Prevention:** Client manually alters request body to set discount to ₹10,000. Backend recalculates and rejects order with HTTP 400.
2. **Cart Modification After Applying Coupon:** User adds items to reach ₹2,000, applies coupon, then deletes an item in cart bringing total to ₹1,200. System re-validates on cart update and checkout submission, automatically revoking the coupon.
3. **Zero / Negative Total Safeguard:** Discount value cannot exceed cart subtotal (e.g. ₹1,000 flat discount on ₹800 cart -> discount capped at ₹800, subtotal never goes below ₹0).
4. **Concurrency / Flash Sale Race Condition:** 100 users try to claim a 10-limit coupon simultaneously. Backend uses atomic MongoDB conditional updates (`find_one_and_update({"code": code, "times_used": {"$lt": max_uses}}, {"$inc": {"times_used": 1}})`) to prevent over-allocation.
5. **Unsuccessful Payment Handling:** Failed or abandoned Razorpay checkout attempts do not permanently burn the customer's usage quota; only confirmed (`paid` / `cod`) orders increment usage.

---

## 7. Migration & Rollout Plan

1. **Step 1: Backend Foundation & TDD**
   - Create `backend/app/models/coupon.py`.
   - Implement `backend/app/services/coupon_service.py` with calculation engine.
   - Write comprehensive pytest suite covering all positive, negative, and edge test cases.
   - Implement FastAPI endpoints in `backend/app/api/endpoints/coupons.py` and register in router.
   - Update `payments.py` and `orders.py` with server-side validation.
2. **Step 2: Admin Dashboard**
   - Create `/admin/coupons` page in Next.js with full CRUD, toggle, and analytics overview.
   - Add "Coupons & Offers" to Admin sidebar navigation with icon.
3. **Step 3: Storefront Cart & Checkout Integration**
   - Add coupon input & available offers drawer to `app/checkout/page.tsx` and Cart drawer/page.
   - Add celebratory micro-interaction and clear bill breakdown.
   - Seed initial default launch coupons (`DELUZEXVIP` - 10% off, `WELCOME500` - ₹500 off).
4. **Step 4: End-to-End Verification**
   - Run automated backend test suites.
   - Execute browser subagent verification on live storefront and admin panel.
