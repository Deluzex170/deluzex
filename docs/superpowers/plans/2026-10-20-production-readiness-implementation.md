# Production Readiness & E-Commerce Workflow Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use uperpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate all critical frontend compilation errors, customer checkout continuity gaps, pre-order inventory validation, and API RBAC/privacy security vulnerabilities to make the Deluzex e-commerce web application 100% production-ready.

**Architecture:** Full-stack remediation across Next.js 16 frontend (CSS modules fix, JSX tag syntax correction, checkout redirection preservation, secure user order queries) and FastAPI backend (pre-flight inventory stock validator, guest cart clamping, RBAC admin and ownership dependency enforcement on orders, users, addresses, inquiries, newsletter, and reviews).

**Tech Stack:** Next.js 16, React 19, TypeScript, Redux Toolkit, CSS Modules, FastAPI, Python 3.12, PyMongo, JWT Auth, Razorpay, Pytest.

**Spec:** `docs/superpowers/specs/2026-10-20-production-readiness-workflow-audit.md`

## Global Constraints
- All backend unit and integration tests must pass cleanly (`python -m pytest backend/tests -v`).
- Next.js production build must compile with 0 errors (`npm run build`).
- Dark luxury styling aesthetic (`#0b0b0b`, `#141414`, `#c49a45`) and existing UI component structures must be strictly preserved.
- Real-data only: never invent mock data in production endpoints.

---

### Task 1: Fix Frontend Production Build Blockers (CSS Modules & JSX Syntax)

**Files:**
- Modify: `app/components/OrderInvoiceModal.module.css:308-316`
- Modify: `app/components/CollaborateSection.tsx:231-255`

**Interfaces:**
- Consumes: Next.js CSS loader & Webpack compiler rules.
- Produces: Valid CSS Module selectors and syntactically balanced JSX for `CollaborateSection`.

- [ ] **Step 1: Inspect and fix CSS modules pure selector rule in `OrderInvoiceModal.module.css`**
Replace bare `body *` with `:global(body *)`:
```css
/* Print Overrides */
@media print {
  :global(body *) {
    visibility: hidden;
  }

  .invoiceSheet, .invoiceSheet * {
    visibility: visible;
  }
```

- [ ] **Step 2: Inspect and close missing `</div>` tag in `CollaborateSection.tsx`**
Add missing `</div>` on line 241 closing `<div className={styles.formField}>`.

- [ ] **Step 3: Run Next.js production build to verify syntax fixes pass**
Run: `npm run build`
Expected: Next.js compiles without CSS syntax or JSX syntax errors.

- [ ] **Step 4: Commit changes**
```bash
git add app/components/OrderInvoiceModal.module.css app/components/CollaborateSection.tsx
git commit -m "fix(frontend): resolve CSS pure selector and JSX syntax errors for production build"
```

---

### Task 2: Customer Checkout Flow Continuity & Data Privacy in Frontend Client

**Files:**
- Modify: `app/components/CartSidebar.tsx:23-31`
- Modify: `app/services/api.ts:1620-1645`

**Interfaces:**
- Consumes: `useAuth()`, Redux cart state, Next.js `useRouter()`.
- Produces: Seamless login redirect with `?redirect=/checkout`; strictly isolated order fetch in `fetchUserOrders`.

- [ ] **Step 1: Update `CartSidebar.tsx` to preserve checkout redirect parameter**
When user is unauthenticated, redirect to `/login?redirect=/checkout`:
```typescript
  const handleCheckout = () => {
    if (isAuthenticated) {
      router.push("/checkout");
    } else {
      router.push("/login?redirect=/checkout");
    }
    dispatch(closeCart());
  };
```

- [ ] **Step 2: Secure `fetchUserOrders` in `app/services/api.ts`**
Remove Step 3 unauthenticated fallback that queried global `/orders` without email. If user has no orders for their email, return `localData` or empty array `[]`.

- [ ] **Step 3: Test customer login and checkout URL preservation**
Verify `npm run build` succeeds and routes are intact.

- [ ] **Step 4: Commit changes**
```bash
git add app/components/CartSidebar.tsx app/services/api.ts
git commit -m "fix(checkout): preserve checkout redirect in cart drawer and isolate user order queries"
```

---

### Task 3: Inventory Pre-Flight Stock Validation & Safe Cart Synchronization

**Files:**
- Modify: `backend/app/services/inventory.py`
- Modify: `backend/app/api/endpoints/payments.py:95-135, 410-440`
- Modify: `backend/app/api/endpoints/cart.py:175-205`
- Test: `backend/tests/test_inventory_guardrails.py`

**Interfaces:**
- Produces: `validate_stock_availability(items)` function in `inventory.py`.
- Consumes: MongoDB `db.products` stock counts and item quantity arrays.

- [ ] **Step 1: Write failing test in `backend/tests/test_inventory_guardrails.py`**
Verify that attempting to create a payment order or COD order for an out-of-stock product raises HTTP 400.

- [ ] **Step 2: Run test to verify it fails**
Run: `python -m pytest backend/tests/test_inventory_guardrails.py -v`
Expected: FAIL (missing validator).

- [ ] **Step 3: Implement `validate_stock_availability` in `inventory.py`**
```python
def validate_stock_availability(items: List[Union[Dict[str, Any], Any]]) -> None:
    """
    Validate that each product in items exists and has sufficient stock available.
    Raises HTTPException(400) if any product is out of stock or requested quantity exceeds available stock.
    """
    for item in items:
        pid = item.get("product_id") if isinstance(item, dict) else getattr(item, "product_id", None)
        qty = int(item.get("quantity", 1) if isinstance(item, dict) else getattr(item, "quantity", 1))
        title = item.get("title") if isinstance(item, dict) else getattr(item, "title", "Product")
        if not pid:
            continue
        try:
            prod_query = {"_id": ObjectId(pid)} if ObjectId.is_valid(str(pid)) else {"_id": str(pid)}
        except Exception:
            prod_query = {"_id": str(pid)}
        product = db.products.find_one(prod_query)
        if not product:
            raise HTTPException(status_code=400, detail=f"Product '{title}' is no longer available.")
        if product.get("in_stock") is False or product.get("stock_count", 0) <= 0:
            raise HTTPException(status_code=400, detail=f"Product '{title}' is currently out of stock.")
        if product.get("stock_count", 0) < qty:
            available = product.get("stock_count", 0)
            raise HTTPException(status_code=400, detail=f"Only {available} unit(s) of '{title}' available in stock.")
```

- [ ] **Step 4: Wire validation into `payments.py` (`create_order` and `create_cod_order`)**
Call `validate_stock_availability(payload.items)` before creating gateway or COD orders.

- [ ] **Step 5: Add stock clamping in `cart.py:sync_cart`**
Ensure merged cart quantity cannot exceed available product stock.

- [ ] **Step 6: Run tests to verify they pass**
Run: `python -m pytest backend/tests/test_inventory_guardrails.py -v`
Expected: PASS.

- [ ] **Step 7: Commit changes**
```bash
git add backend/app/services/inventory.py backend/app/api/endpoints/payments.py backend/app/api/endpoints/cart.py backend/tests/test_inventory_guardrails.py
git commit -m "feat(inventory): add pre-flight stock availability validator and cart quantity clamping"
```

---

### Task 4: Backend RBAC Security & Privacy Hardening

**Files:**
- Modify: `backend/app/api/endpoints/orders.py`
- Modify: `backend/app/api/endpoints/addresses.py`
- Modify: `backend/app/api/endpoints/auth.py`
- Modify: `backend/app/api/endpoints/contact.py`
- Modify: `backend/app/api/endpoints/newsletter.py`
- Modify: `backend/app/api/endpoints/reviews.py`
- Modify: `backend/app/api/endpoints/analytics.py`
- Modify: `backend/app/api/endpoints/audit.py`
- Test: `backend/tests/test_rbac_security.py`

**Interfaces:**
- Consumes: `get_current_active_user`, `get_current_active_admin` from `app.api.deps`.
- Produces: 100% RBAC-guarded administrative endpoints and customer ownership verification.

- [ ] **Step 1: Write failing security tests in `backend/tests/test_rbac_security.py`**
Verify unauthorized access to `/auth/users`, global `/orders`, and other customers' cancellation returns 401/403.

- [ ] **Step 2: Run security test to verify failure**
Run: `python -m pytest backend/tests/test_rbac_security.py -v`
Expected: FAIL.

- [ ] **Step 3: Harden `orders.py`**
- Require `get_current_active_admin` on `list_orders` when no email is supplied.
- If email is supplied by a non-admin, verify `current_user.email == email`.
- Require `get_current_active_admin` on `update_order_status`, `delete_order`, and `get_order_stats`.
- In `cancel_order`: verify `current_user.is_admin` OR `doc.get("email") == current_user.email`.

- [ ] **Step 4: Harden `addresses.py`**
Require `email` parameter or `current_user`. Non-admin users can ONLY list addresses for their own verified email.

- [ ] **Step 5: Harden `auth.py`, `contact.py`, `newsletter.py`, `reviews.py`, `analytics.py`, `audit.py`**
Add `current_user: models.User = Depends(get_current_active_admin)` to all admin queries and mutation endpoints.

- [ ] **Step 6: Run security test suite and existing test suite**
Run: `python -m pytest backend/tests -v`
Expected: 100% PASS with 0 failures.

- [ ] **Step 7: Commit changes**
```bash
git add backend/app/api/endpoints/ backend/tests/test_rbac_security.py
git commit -m "sec(rbac): enforce admin role checks and customer ownership boundaries across all endpoints"
```

---

### Task 5: End-to-End Production Verification & Quality Gate

**Files:**
- Test: `backend/tests/test_production_readiness_e2e.py`

- [ ] **Step 1: Write comprehensive positive, negative, and edge-case integration tests**
Cover:
1. Registration -> OTP -> Login -> JWT.
2. Catalog out-of-stock guard -> Pre-flight checkout rejection.
3. Razorpay payment verification with valid signature vs tampered signature.
4. Order cancellation stock restoration vs cancellation of shipped order rejection.
5. Admin status update with courier tracking.

- [ ] **Step 2: Run all backend test suites**
Run: `python -m pytest backend/tests -v`
Expected: All tests pass.

- [ ] **Step 3: Run production frontend build**
Run: `npm run build`
Expected: Production build completes successfully.

- [ ] **Step 4: Commit changes**
```bash
git add backend/tests/test_production_readiness_e2e.py
git commit -m "test(e2e): add comprehensive production-readiness workflow verification suite"
```
