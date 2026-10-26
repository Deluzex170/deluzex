# Production Readiness Phase 1 & Phase 2 Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement critical production-readiness security, inventory concurrency controls, shipping notification emails, database indexes, and SEO rich metadata across Deluzex e-commerce without regressing existing functionality.

**Architecture:** Full-stack production hardening across FastAPI backend (dynamic JWT secret key, atomic stock decrementing with optimistic concurrency filter, automated shipping email notifications with courier tracking links, MongoDB index management) and Next.js 16 frontend (SEO `robots.ts`, dynamic `sitemap.ts`, server-rendered OpenGraph and Schema.org Product JSON-LD metadata).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, FastAPI, Python 3.12+, PyMongo, JWT (python-jose), Bcrypt, Razorpay, Pytest.

**Spec:** E-Commerce Market-Standard Production Audit (7 Dimensions: Payments, Concurrency, Logistics, Security, SEO, DevOps, Customer Journey).

## Global Constraints
- All backend unit and integration tests must pass cleanly (`python -m pytest backend/tests -W ignore`).
- Next.js production build must compile with 0 errors (`npm run build`).
- Existing functioning features (catalog, cart drawer, checkout, coupons, tax invoices, admin management) must NOT break.
- Preserve luxury dark styling aesthetic (`#0b0b0b`, `#141414`, `#c49a45`).
- Never invent mock data in production endpoints; real data only.

---

### Task 1: Security Hardening — Dynamic JWT Secret Key & Middleware Fix

**Files:**
- Modify: `backend/app/core/config.py:10-28`
- Modify: `backend/app/core/security.py:6-12`
- Modify: `backend/main.py:84-95`
- Modify: `.env.example:1-32`
- Test: `backend/tests/test_jwt_security_config.py`

**Interfaces:**
- Consumes: `settings.SECRET_KEY`, `settings.ALGORITHM` from `app.core.config`.
- Produces: Dynamic JWT signing with environment secret; reliable user identity decoding in logging middleware without `AttributeError`.

- [ ] **Step 1: Write failing security tests in `backend/tests/test_jwt_security_config.py`**
Verify that:
1. `settings.SECRET_KEY` is defined and read from configuration.
2. `security.create_access_token` and `jwt.decode` work with dynamic `settings.SECRET_KEY`.
3. Tokens signed with an invalid/tampered secret raise `JWTError`.
4. Request logging middleware extracts user attribution without raising `AttributeError`.

```python
import unittest
from jose import jwt
from app.core.config import settings
from app.core import security

class TestJWTSecurityConfig(unittest.TestCase):
    def test_settings_has_secret_key(self):
        self.assertTrue(hasattr(settings, "SECRET_KEY"))
        self.assertTrue(len(settings.SECRET_KEY) >= 16)

    def test_token_creation_and_verification(self):
        token = security.create_access_token(subject="user@example.com", is_admin=True)
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        self.assertEqual(payload.get("sub"), "user@example.com")
        self.assertTrue(payload.get("is_admin"))

    def test_token_rejects_tampered_secret(self):
        token = security.create_access_token(subject="user@example.com", is_admin=True)
        with self.assertRaises(Exception):
            jwt.decode(token, "wrong_secret_key_12345", algorithms=[settings.ALGORITHM])
```

- [ ] **Step 2: Run test to verify it fails**
Run: `python -m pytest backend/tests/test_jwt_security_config.py -W ignore`
Expected: FAIL (missing `SECRET_KEY` on `settings`).

- [ ] **Step 3: Update `backend/app/core/config.py`**
Add `SECRET_KEY` and `ALGORITHM` to `Settings`:
```python
    SECRET_KEY: str = "deluzex_production_jwt_secret_change_me_super_secure_key_2026"
    ALGORITHM: str = "HS256"
```

- [ ] **Step 4: Update `backend/app/core/security.py`**
Reference `settings.SECRET_KEY` and `settings.ALGORITHM`:
```python
from app.core.config import settings

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7
```

- [ ] **Step 5: Verify `backend/main.py` logging middleware**
Confirm `settings.SECRET_KEY` and `settings.ALGORITHM` resolve cleanly without exception.

- [ ] **Step 6: Run tests to verify they pass**
Run: `python -m pytest backend/tests/test_jwt_security_config.py -W ignore`
Expected: PASS.

- [ ] **Step 7: Commit changes**
```bash
git add backend/app/core/config.py backend/app/core/security.py backend/main.py backend/tests/test_jwt_security_config.py
git commit -m "sec(auth): enforce dynamic JWT secret key from environment configuration and fix logging middleware"
```

---

### Task 2: Atomic Inventory Concurrency Guard (Anti-Overselling)

**Files:**
- Modify: `backend/app/services/inventory.py:44-86`
- Modify: `backend/app/api/endpoints/payments.py:380-390, 500-515, 570-585, 1110-1120`
- Test: `backend/tests/test_inventory_concurrency.py`

**Interfaces:**
- Produces: `decrement_product_stock(items)` returning boolean `True` if all stock was atomically deducted, or raising `HTTPException(409)` if any item has insufficient stock during concurrency.
- Consumes: MongoDB `find_one_and_update` with filter `{"_id": pid, "stock_count": {"$gte": qty}}`.

- [ ] **Step 1: Write failing concurrency tests in `backend/tests/test_inventory_concurrency.py`**
Verify:
1. When stock is 1, two simultaneous decrement attempts: first succeeds, second raises 400/409 (preventing overselling).
2. Stock is never decremented to negative numbers.
3. If decrement fails on second item of a multi-item cart, previously decremented items in that cart are rolled back.

- [ ] **Step 2: Run test to verify it fails**
Run: `python -m pytest backend/tests/test_inventory_concurrency.py -W ignore`
Expected: FAIL.

- [ ] **Step 3: Implement atomic optimistic deduction in `backend/app/services/inventory.py`**
```python
def decrement_product_stock(items: List[Union[Dict[str, Any], Any]]) -> None:
    """
    Atomically decrement stock_count for each product in items upon order placement or payment.
    Enforces optimistic concurrency check: stock_count must be >= quantity.
    Raises HTTPException(400) if insufficient stock is found, and rolls back any partial decrements.
    """
    if not items:
        return

    decremented_so_far = []

    for item in items:
        pid = item.get("product_id") if isinstance(item, dict) else getattr(item, "product_id", None)
        qty = int(item.get("quantity", 1) if isinstance(item, dict) else getattr(item, "quantity", 1))
        title = item.get("title") if isinstance(item, dict) else getattr(item, "title", "Product")
        if not pid or qty <= 0:
            continue

        prod_query = {"_id": ObjectId(pid)} if ObjectId.is_valid(str(pid)) else {"_id": str(pid)}
        # Atomic optimistic concurrency check: only decrement if stock_count >= qty
        atomic_query = {**prod_query, "stock_count": {"$gte": qty}}

        try:
            updated = db.products.find_one_and_update(
                atomic_query,
                {"$inc": {"stock_count": -qty}},
                return_document=ReturnDocument.AFTER
            )
            if not updated:
                # Rollback previous decrements in this order
                restore_product_stock(decremented_so_far)
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for '{title}'. Someone else may have just purchased the remaining units."
                )

            decremented_so_far.append({"product_id": pid, "quantity": qty})
            new_stock = updated.get("stock_count", 0)
            if new_stock <= 0:
                db.products.update_one(
                    prod_query,
                    {"$set": {"in_stock": False, "stock_status": "OUT OF STOCK", "stock_count": 0}}
                )
        except HTTPException:
            raise
        except Exception as exc:
            restore_product_stock(decremented_so_far)
            logger.error(f"[INVENTORY] Error during atomic decrement: {exc}")
            raise HTTPException(status_code=500, detail="Failed to reserve inventory stock.")
```

- [ ] **Step 4: Run tests to verify they pass**
Run: `python -m pytest backend/tests/test_inventory_concurrency.py -W ignore`
Expected: PASS.

- [ ] **Step 5: Run full existing test suite to ensure no regression**
Run: `python -m pytest backend/tests -W ignore`
Expected: 100% PASS.

- [ ] **Step 6: Commit changes**
```bash
git add backend/app/services/inventory.py backend/tests/test_inventory_concurrency.py
git commit -m "fix(inventory): implement atomic optimistic concurrency check and rollback to prevent overselling"
```

---

### Task 3: Shipping Notification Email with Courier Tracking Link

**Files:**
- Modify: `backend/app/services/email.py:440-479`
- Modify: `backend/app/api/endpoints/orders.py:310-345`
- Test: `backend/tests/test_shipping_email_notification.py`

**Interfaces:**
- Produces: `send_shipping_notification_email(order, tracking_number, courier_partner)` in `email.py`.
- Consumes: Admin order update action in `orders.py:update_order_status` when status changes to `"shipped"`.

- [ ] **Step 1: Write failing test in `backend/tests/test_shipping_email_notification.py`**
Verify:
1. `build_shipping_notification_email_html` generates luxury email with courier name, tracking number, items, and direct tracking URL (BlueDart / Delhivery / Shiprocket / FedEx).
2. `send_shipping_notification_email` sends email when order is updated to `"shipped"` with tracking.
3. If order status is changed to something else (e.g. `"processing"`), shipping email is NOT sent.

- [ ] **Step 2: Run test to verify it fails**
Run: `python -m pytest backend/tests/test_shipping_email_notification.py -W ignore`
Expected: FAIL.

- [ ] **Step 3: Implement courier URL builder and shipping email in `backend/app/services/email.py`**
```python
def get_courier_tracking_url(courier: str, tracking_number: str) -> str:
    c = (courier or "").lower()
    t = (tracking_number or "").strip()
    if not t:
        return ""
    if "bluedart" in c:
        return f"https://www.bluedart.com/tracking?numbers={t}"
    if "delhivery" in c:
        return f"https://www.delhivery.com/track/package/{t}"
    if "shiprocket" in c:
        return f"https://shiprocket.co/tracking/{t}"
    if "dtdc" in c:
        return f"https://www.dtdc.in/tracking.asp?trk_id={t}"
    if "fedex" in c:
        return f"https://www.fedex.com/fedextrack/?trknbr={t}"
    return f"https://www.google.com/search?q={c}+{t}+tracking"

def send_shipping_notification_email(order: Any, tracking_number: str = "", courier_partner: str = "") -> Dict[str, Any]:
    ...
```

- [ ] **Step 4: Wire shipping notification in `backend/app/api/endpoints/orders.py`**
In `update_order_status`, if `payload.status == "shipped"` and old status was not `"shipped"`:
Call `send_shipping_notification_email(doc, payload.tracking_number, payload.courier_partner)`.

- [ ] **Step 5: Run tests to verify they pass**
Run: `python -m pytest backend/tests/test_shipping_email_notification.py -W ignore`
Expected: PASS.

- [ ] **Step 6: Commit changes**
```bash
git add backend/app/services/email.py backend/app/api/endpoints/orders.py backend/tests/test_shipping_email_notification.py
git commit -m "feat(notifications): add automated shipping dispatch email with courier tracking links"
```

---

### Task 4: Automated MongoDB Production Database Indexing

**Files:**
- Modify: `backend/app/core/database.py:25-40`
- Modify: `backend/main.py:38-52`
- Test: `backend/tests/test_database_indexes.py`

**Interfaces:**
- Produces: `ensure_database_indexes(db)` function in `database.py`.
- Consumes: MongoDB `create_index` across collections: `users`, `products`, `orders`, `coupons`, `email_otps`, `cart_items`.

- [ ] **Step 1: Write failing test in `backend/tests/test_database_indexes.py`**
Verify:
1. `ensure_database_indexes` creates indexes on `users.email` (unique).
2. Creates indexes on `coupons.code` (unique).
3. Creates indexes on `orders.email`, `orders.created_at`, `orders.status`.
4. Creates TTL index on `email_otps.created_at` (expiresAfterSeconds=600).
5. Creates index on `cart_items.user_email` and `cart_items.session_id`.

- [ ] **Step 2: Run test to verify it fails**
Run: `python -m pytest backend/tests/test_database_indexes.py -W ignore`
Expected: FAIL.

- [ ] **Step 3: Implement `ensure_database_indexes` in `backend/app/core/database.py`**
```python
def ensure_database_indexes(database):
    """
    Creates essential compound, unique, and TTL database indexes for high performance in production.
    """
    try:
        database.users.create_index("email", unique=True, sparse=True)
        database.coupons.create_index("code", unique=True)
        database.orders.create_index([("email", 1), ("created_at", -1)])
        database.orders.create_index("status")
        database.orders.create_index("razorpay_order_id", sparse=True)
        database.products.create_index("category")
        database.products.create_index("in_stock")
        database.cart_items.create_index("user_email")
        database.cart_items.create_index("session_id")
        database.email_otps.create_index("created_at", expireAfterSeconds=600)
        app_logger.info("MongoDB production database indexes verified successfully.")
    except Exception as exc:
        app_logger.warning(f"Database index creation warning: {exc}")
```

- [ ] **Step 4: Wire index initialization into `main.py` lifespan startup**
Call `ensure_database_indexes(db)` in `lifespan` handler.

- [ ] **Step 5: Run tests to verify they pass**
Run: `python -m pytest backend/tests/test_database_indexes.py -W ignore`
Expected: PASS.

- [ ] **Step 6: Commit changes**
```bash
git add backend/app/core/database.py backend/main.py backend/tests/test_database_indexes.py
git commit -m "perf(database): configure automated unique, compound, and TTL indexes for production"
```

---

### Task 5: SEO Infrastructure — `robots.ts` & Dynamic `sitemap.ts`

**Files:**
- Create: `app/robots.ts`
- Create: `app/sitemap.ts`

**Interfaces:**
- Consumes: Next.js Metadata Route APIs (`MetadataRoute.Robots`, `MetadataRoute.Sitemap`).
- Produces: `/robots.txt` and `/sitemap.xml` for Google, Bing, and search crawlers.

- [ ] **Step 1: Create `app/robots.ts`**
Allow public storefront paths, disallow admin, auth, and private dashboard paths:
```typescript
import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://deluzexlighting.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/shop", "/product/", "/categories", "/about", "/contact", "/collaborate", "/projects", "/blogs"],
        disallow: ["/admin/", "/dashboard/", "/api/", "/login", "/checkout"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

- [ ] **Step 2: Create `app/sitemap.ts`**
Fetch categories, products, blogs, and build XML sitemap with last modified dates and change frequencies:
```typescript
import { MetadataRoute } from "next";
import { fetchCategories, fetchProducts } from "./services/api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://deluzexlighting.com";

  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/shop",
    "/about",
    "/contact",
    "/collaborate",
    "/projects",
    "/blogs",
    "/privacy",
    "/shipping",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1.0 : 0.8,
  }));

  try {
    const products = await fetchProducts("limit=100");
    const productRoutes: MetadataRoute.Sitemap = (products || []).map((p: any) => ({
      url: `${baseUrl}/product/${p.id || p._id}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    }));

    return [...staticRoutes, ...productRoutes];
  } catch (error) {
    return staticRoutes;
  }
}
```

- [ ] **Step 3: Run Next.js build to verify metadata routes compile cleanly**
Run: `npm run build`
Expected: Next.js lists `/robots.txt` and `/sitemap.xml` as prerendered static routes.

- [ ] **Step 4: Commit changes**
```bash
git add app/robots.ts app/sitemap.ts
git commit -m "feat(seo): add automated robots.txt rules and dynamic XML sitemap generation"
```

---

### Task 6: Product Page OpenGraph & Schema.org JSON-LD Structured Data

**Files:**
- Create: `app/product/[slug]/layout.tsx` (server layout generating dynamic metadata & Schema.org JSON-LD)
- Modify: `app/product/[slug]/page.tsx`

**Interfaces:**
- Consumes: Next.js `generateMetadata({ params })`.
- Produces: Rich OpenGraph social sharing preview card and Google Rich Snippet JSON-LD for products.

- [ ] **Step 1: Create `app/product/[slug]/layout.tsx`**
Implement server-side `generateMetadata` fetching product details to inject `title`, `description`, `openGraph` (images, price, currency, availability), `twitter` card, and Schema.org `Product` JSON-LD snippet.

- [ ] **Step 2: Run Next.js build to verify metadata works without breaking client component**
Run: `npm run build`
Expected: 0 errors.

- [ ] **Step 3: Commit changes**
```bash
git add app/product/[slug]/layout.tsx
git commit -m "feat(seo): add dynamic OpenGraph social cards and Schema.org Product JSON-LD rich snippets"
```

---

### Task 7: Comprehensive End-to-End Verification & Quality Gate

**Files:**
- Run: Full backend pytest suite (`python -m pytest backend/tests -W ignore`)
- Run: Full frontend production build (`npm run build`)

- [ ] **Step 1: Execute all backend test suites**
Run: `python -m pytest backend/tests -W ignore`
Expected: All tests PASS with 0 failures.

- [ ] **Step 2: Execute frontend production build**
Run: `npm run build`
Expected: 48+ routes compile cleanly with 0 TypeScript/CSS errors.

- [ ] **Step 3: Verify git status is clean**
Run: `git status`
Expected: Clean working tree.
