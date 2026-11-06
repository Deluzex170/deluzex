"""
Deluzex Luxury E-Commerce Backend - Master QA Automation Suite
==============================================================
Senior QA Lead: Autonomous Verification Suite
Target: FastAPI API routes, MongoDB Atlas Database, E-Commerce Core Services

Covers:
  1. Product CRUD & Inventory (Positive, Negative, Edge: slug case-insensitivity, duplicate SKU, auto-healing, nullifying optional fields)
  2. Category CRUD (Lifecycle & Safe product orphan reassignment to 'Uncategorized')
  3. Cart & Wishlist Operations (CRUD, Negative clamping, Multi-tenant isolation between User A & B)
  4. Addresses CRUD (Customer lifecycle, default address management, tenant security & tampering prevention)
  5. Coupons Engine (Percentage & flat calculations, caps, expiry, min spend, admin update without 422)
  6. Order Lifecycle, Concurrency & Overselling Prevention (Stock decrements, overselling block, transitions, idempotency of stock restoration)
  7. Shiprocket & Returns (Strict enforcement of 'delivered' status for returns, customer privacy)
"""

import sys
import os
import unittest
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
from bson import ObjectId

# Ensure backend directory is in path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
# Check if current dir is backend/tests or scratch
if os.path.basename(CURRENT_DIR) == "tests":
    BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
else:
    PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
    BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi.testclient import TestClient
from main import app
from app.api import deps
from app.core.database import db
from app.services.inventory import decrement_product_stock, restore_product_stock

client = TestClient(app)

# ANSI formatting for executive QA reporting
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


class MasterBackendQASuite(unittest.TestCase):
    """
    Comprehensive QA Battery testing all core e-commerce backend operations,
    business rules, boundary validations, and tenant security.
    """

    @classmethod
    def setUpClass(cls):
        print(f"\n{BOLD}{CYAN}========================================================================{RESET}")
        print(f"{BOLD}{CYAN}  DELUZEX MASTER SENIOR QA AUTOMATION BATTERY - TEST SUITE RUNNING      {RESET}")
        print(f"{BOLD}{CYAN}========================================================================{RESET}\n")

    def setUp(self):
        # Multi-tenant test personas
        self.user_a = SimpleNamespace(
            id=str(ObjectId()),
            email="qa.client.a@deluzex.com",
            first_name="Eleanor",
            last_name="Vanderbilt",
            is_admin=False,
            is_active=True,
            is_verified=True,
        )
        self.user_b = SimpleNamespace(
            id=str(ObjectId()),
            email="qa.client.b@deluzex.com",
            first_name="Julian",
            last_name="Rothschild",
            is_admin=False,
            is_active=True,
            is_verified=True,
        )
        self.admin = SimpleNamespace(
            id=str(ObjectId()),
            email="qa.director@deluzex.com",
            first_name="QA",
            last_name="Executive",
            is_admin=True,
            is_active=True,
            is_verified=True,
        )

        # Track database artifacts for guaranteed clean teardown
        self.created_product_ids = []
        self.created_category_ids = []
        self.created_order_ids = []
        self.created_address_ids = []
        self.created_coupon_ids = []

    def tearDown(self):
        app.dependency_overrides.clear()

        # Clean products
        for pid in self.created_product_ids:
            if ObjectId.is_valid(str(pid)):
                db.products.delete_one({"_id": ObjectId(pid)})
            else:
                db.products.delete_one({"_id": str(pid)})

        # Clean categories
        for cid in self.created_category_ids:
            if ObjectId.is_valid(str(cid)):
                db.categories.delete_one({"_id": ObjectId(cid)})
            else:
                db.categories.delete_one({"_id": str(cid)})

        # Clean orders
        for oid in self.created_order_ids:
            if ObjectId.is_valid(str(oid)):
                db.orders.delete_one({"_id": ObjectId(oid)})
            else:
                db.orders.delete_one({"_id": str(oid)})

        # Clean addresses
        for aid in self.created_address_ids:
            if ObjectId.is_valid(str(aid)):
                db.addresses.delete_one({"_id": ObjectId(aid)})
            else:
                db.addresses.delete_one({"_id": str(aid)})

        # Clean coupons
        for cpid in self.created_coupon_ids:
            if ObjectId.is_valid(str(cpid)):
                db.coupons.delete_one({"_id": ObjectId(cpid)})
            else:
                db.coupons.delete_one({"_id": str(cpid)})

        # Clean tenant-specific cart & wishlist items
        test_emails = [self.user_a.email, self.user_b.email]
        db.cart_items.delete_many({"user_email": {"$in": test_emails}})
        db.cart_items.delete_many({"session_id": {"$regex": "^qa_test_"}})
        db.wishlist_items.delete_many({"user_email": {"$in": test_emails}})

    # =========================================================================
    # SECTION 1: PRODUCT CRUD & INVENTORY
    # =========================================================================
    def test_01_product_lifecycle_positive_and_case_insensitive_slug(self):
        """
        Positive: Create product, Get by ID / slug (case-insensitive), Update product, Delete product.
        """
        app.dependency_overrides[deps.get_current_active_admin] = lambda: self.admin

        unique_suffix = ObjectId()
        sku = f"SKU-CHAND-{unique_suffix}"[:20]
        slug = f"palais-royal-chandelier-{unique_suffix}"

        # 1.1 Create product
        form_data = {
            "product_title": f"Palais Royal Grand Chandelier {unique_suffix}",
            "product_price": "145000.0",
            "product_description": "Handcrafted Bohemian crystal with 24k gold leaf finish.",
            "product_category": "Chandeliers",
            "stock_count": "8",
            "sku": sku,
            "dimensions": "120cm x 90cm",
            "material": "Bohemian Crystal & Brass",
            "amazon_link": "https://amazon.in/dp/B0EXAMPLE",
        }
        res_create = client.post("/api/v1/products", data=form_data)
        self.assertEqual(res_create.status_code, 200, f"Product create failed: {res_create.text}")
        created_prod = res_create.json()
        prod_id = created_prod.get("_id") or created_prod.get("id")
        self.assertIsNotNone(prod_id)
        self.created_product_ids.append(prod_id)

        # Manually attach slug in DB to test slug lookups if not generated by default
        db.products.update_one({"_id": ObjectId(prod_id)}, {"$set": {"slug": slug}})

        # 1.2 Get by ID
        res_get_id = client.get(f"/api/v1/products/{prod_id}")
        self.assertEqual(res_get_id.status_code, 200)
        self.assertEqual(res_get_id.json()["product_title"], form_data["product_title"])
        self.assertEqual(res_get_id.json()["stock_count"], 8)
        self.assertTrue(res_get_id.json()["in_stock"])

        # 1.3 Get by slug: Exact match
        res_slug_exact = client.get(f"/api/v1/products/{slug}")
        self.assertEqual(res_slug_exact.status_code, 200)
        self.assertEqual(res_slug_exact.json()["sku"], sku)

        # 1.3.1 Get by slug: CASE-INSENSITIVE match (all uppercase)
        res_slug_upper = client.get(f"/api/v1/products/{slug.upper()}")
        self.assertEqual(res_slug_upper.status_code, 200, "Slug lookup must be case-insensitive!")
        self.assertEqual(res_slug_upper.json()["_id"], prod_id)

        # 1.4 Update product details
        update_data = {
            "product_price": "155000.0",
            "product_description": "Updated luxury crystal formulation.",
            "dimensions": "130cm x 95cm",
        }
        res_update = client.put(f"/api/v1/products/{prod_id}", data=update_data)
        self.assertEqual(res_update.status_code, 200)
        updated_prod = res_update.json()
        self.assertEqual(float(updated_prod["product_price"]), 155000.0)
        self.assertEqual(updated_prod["dimensions"], "130cm x 95cm")

        # 1.5 Delete product
        res_del = client.delete(f"/api/v1/products/{prod_id}")
        self.assertEqual(res_del.status_code, 200)
        self.assertTrue(res_del.json().get("success"))

        # Subsequent lookup must return 404
        res_after_del = client.get(f"/api/v1/products/{prod_id}")
        self.assertEqual(res_after_del.status_code, 404)

    def test_02_product_negative_cases_and_auto_healing(self):
        """
        Negative/Edge:
          - Duplicate SKU creation must fail with 400.
          - Negative stock must be rejected with 400.
          - Negative price must be rejected with 400.
          - Auto-healing in_stock flag when stock > 0.
          - Nullifying optional fields (e.g. clearing amazon_link to empty string).
        """
        app.dependency_overrides[deps.get_current_active_admin] = lambda: self.admin

        sku_unique = f"SKU-DUP-{ObjectId()}"[:20]

        # 2.1 Create base product with SKU
        res_base = client.post("/api/v1/products", data={
            "product_title": "Original Palace Lamp",
            "product_price": "25000.0",
            "stock_count": "5",
            "sku": sku_unique,
            "amazon_link": "https://amazon.in/dp/ORIGINAL1",
        })
        self.assertEqual(res_base.status_code, 200)
        prod_id = res_base.json()["_id"]
        self.created_product_ids.append(prod_id)

        # 2.2 Attempt duplicate SKU -> Must fail with 400
        res_dup_sku = client.post("/api/v1/products", data={
            "product_title": "Counterfeit Duplicate Lamp",
            "product_price": "22000.0",
            "stock_count": "2",
            "sku": sku_unique,
        })
        self.assertEqual(res_dup_sku.status_code, 400)
        self.assertIn("already in use", res_dup_sku.json()["detail"].lower())

        # 2.3 Attempt negative stock count on creation -> Must fail with 400
        res_neg_stock = client.post("/api/v1/products", data={
            "product_title": "Negative Stock Lamp",
            "product_price": "10000.0",
            "stock_count": "-5",
        })
        self.assertEqual(res_neg_stock.status_code, 400)
        self.assertIn("cannot be negative", res_neg_stock.json()["detail"].lower())

        # 2.4 Attempt negative price on creation -> Must fail with 400
        res_neg_price = client.post("/api/v1/products", data={
            "product_title": "Negative Price Lamp",
            "product_price": "-500.0",
            "stock_count": "5",
        })
        self.assertEqual(res_neg_price.status_code, 400)
        self.assertIn("cannot be negative", res_neg_price.json()["detail"].lower())

        # 2.5 Auto-healing in_stock flag:
        # Step A: Update stock to 0 -> in_stock must auto-sync to False
        res_zero_stock = client.put(f"/api/v1/products/{prod_id}", data={"stock_count": "0"})
        self.assertEqual(res_zero_stock.status_code, 200)
        self.assertEqual(res_zero_stock.json()["stock_count"], 0)
        self.assertFalse(res_zero_stock.json()["in_stock"])

        # Step B: Replenish stock to 15 without specifying in_stock -> in_stock must auto-heal to True
        res_replenish = client.put(f"/api/v1/products/{prod_id}", data={"stock_count": "15"})
        self.assertEqual(res_replenish.status_code, 200)
        self.assertEqual(res_replenish.json()["stock_count"], 15)
        self.assertTrue(res_replenish.json()["in_stock"], "in_stock flag must auto-heal to True when stock > 0")

        # 2.6 Nullifying optional fields:
        # Base product had an amazon_link. Sending empty string "" should nullify it.
        res_nullify = client.put(f"/api/v1/products/{prod_id}", data={"amazon_link": ""})
        self.assertEqual(res_nullify.status_code, 200)
        self.assertIsNone(res_nullify.json().get("amazon_link"))
        # Verify directly in MongoDB Atlas
        db_doc = db.products.find_one({"_id": ObjectId(prod_id)})
        self.assertIsNone(db_doc.get("amazon_link"))

    # =========================================================================
    # SECTION 2: CATEGORY CRUD & ORPHAN PRODUCT REASSIGNMENT
    # =========================================================================
    def test_03_category_crud_and_safe_product_reassignment(self):
        """
        Verify:
          - Category creation, listing, updating, deletion.
          - EDGE CASE: Deleting a category re-assigns its products to 'Uncategorized'
            so products are never lost/orphaned.
        """
        app.dependency_overrides[deps.get_current_active_admin] = lambda: self.admin

        cat_suffix = str(ObjectId())[-6:]
        cat_name = f"Murano Art Glass {cat_suffix}"
        cat_slug = f"murano-art-glass-{cat_suffix}"

        # 2.1 Create category
        res_cat = client.post("/api/v1/categories", json={
            "name": cat_name,
            "category_id": cat_slug,
            "description": "Venetian blown artisan glass lighting.",
        })
        self.assertEqual(res_cat.status_code, 200)
        cat_data = res_cat.json()
        cat_id = cat_data["_id"]
        self.created_category_ids.append(cat_id)

        # 2.2 List categories
        res_list = client.get("/api/v1/categories")
        self.assertEqual(res_list.status_code, 200)
        all_cats = res_list.json()
        self.assertTrue(any(c["name"] == cat_name for c in all_cats))

        # 2.3 Seed product linked to this category
        prod_doc = {
            "_id": ObjectId(),
            "product_title": f"Murano Droplet Sconce {cat_suffix}",
            "product_price": 42000.0,
            "stock_count": 6,
            "in_stock": True,
            "product_category": cat_name,
        }
        db.products.insert_one(prod_doc)
        test_prod_id = prod_doc["_id"]
        self.created_product_ids.append(test_prod_id)

        # 2.4 Update category description
        res_update_cat = client.put(f"/api/v1/categories/{cat_id}", json={
            "description": "Refined Venetian artisan glass collection.",
        })
        self.assertEqual(res_update_cat.status_code, 200)
        self.assertEqual(res_update_cat.json()["description"], "Refined Venetian artisan glass collection.")

        # 2.5 Delete category -> Must reassign product to 'Uncategorized'
        res_del_cat = client.delete(f"/api/v1/categories/{cat_id}")
        self.assertEqual(res_del_cat.status_code, 200)
        self.assertIn("deleted successfully", res_del_cat.json()["message"].lower())
        self.assertGreaterEqual(res_del_cat.json().get("reassigned_products_count", 0), 1)

        # 2.6 Verify category is deleted from DB
        self.assertIsNone(db.categories.find_one({"_id": ObjectId(cat_id)}))

        # 2.7 Verify product still exists in DB and is safely tagged 'Uncategorized'
        orphaned_product = db.products.find_one({"_id": test_prod_id})
        self.assertIsNotNone(orphaned_product, "Product must NEVER be deleted when category is removed!")
        self.assertEqual(
            orphaned_product.get("product_category"),
            "Uncategorized",
            "Orphaned product must be safely reassigned to 'Uncategorized'!"
        )

    # =========================================================================
    # SECTION 3: CART & WISHLIST MULTI-TENANT ISOLATION
    # =========================================================================
    def test_04_cart_crud_and_multi_tenant_isolation(self):
        """
        Verify:
          - Add to cart, update quantity, remove item.
          - Negative: Reject negative or zero quantity updates.
          - CRITICAL Tenant Isolation: ensure Cart operations of User A never affect User B's cart.
        """
        # Create a test product
        p_id = ObjectId()
        db.products.insert_one({
            "_id": p_id,
            "product_title": "Grand Imperial Sconce",
            "product_price": 38000.0,
            "stock_count": 20,
            "in_stock": True,
        })
        self.created_product_ids.append(p_id)

        # 3.1 User A adds item to cart
        res_add_a = client.post("/api/v1/cart/add", json={
            "user_email": self.user_a.email,
            "product_id": str(p_id),
            "quantity": 2,
        })
        self.assertEqual(res_add_a.status_code, 200)
        self.assertEqual(res_add_a.json()["quantity"], 2)
        self.assertEqual(res_add_a.json()["user_email"], self.user_a.email)

        # 3.2 User A updates quantity to 4
        res_up_a = client.put(f"/api/v1/cart/{self.user_a.email}/items/{p_id}", json={"quantity": 4})
        self.assertEqual(res_up_a.status_code, 200)
        self.assertEqual(res_up_a.json()["quantity"], 4)

        # 3.3 Negative Case: Reject negative or zero quantity in CartItemUpdate schema
        res_zero = client.put(f"/api/v1/cart/{self.user_a.email}/items/{p_id}", json={"quantity": 0})
        self.assertEqual(res_zero.status_code, 422, "Zero quantity update must be rejected with 422")

        res_neg = client.put(f"/api/v1/cart/{self.user_a.email}/items/{p_id}", json={"quantity": -2})
        self.assertEqual(res_neg.status_code, 422, "Negative quantity update must be rejected with 422")

        # 3.4 CRITICAL MULTI-TENANT ISOLATION:
        # User B queries their own cart -> User A's item must NOT appear
        res_b_cart = client.get(f"/api/v1/cart/{self.user_b.email}")
        self.assertEqual(res_b_cart.status_code, 200)
        self.assertEqual(len(res_b_cart.json()), 0, "User B's cart must be completely empty!")

        # User B attempts to maliciously update Product X quantity using User B's identifier
        res_b_tamper = client.put(f"/api/v1/cart/{self.user_b.email}/items/{p_id}", json={"quantity": 99})
        self.assertEqual(res_b_tamper.status_code, 404, "User B updating item not in their cart must return 404!")

        # Verify User A's cart item quantity is completely UNTOUCHED (still 4)
        res_a_verify = client.get(f"/api/v1/cart/{self.user_a.email}")
        self.assertEqual(res_a_verify.status_code, 200)
        self.assertEqual(len(res_a_verify.json()), 1)
        self.assertEqual(res_a_verify.json()[0]["quantity"], 4, "Tenant Isolation failure: User A cart was tampered!")

        # 3.5 User A removes item
        res_remove = client.delete(f"/api/v1/cart/{self.user_a.email}/items/{p_id}")
        self.assertEqual(res_remove.status_code, 200)
        self.assertTrue(res_remove.json().get("success"))

        # Verify cart is empty
        res_empty = client.get(f"/api/v1/cart/{self.user_a.email}")
        self.assertEqual(len(res_empty.json()), 0)

    def test_05_wishlist_operations_and_security(self):
        """
        Verify:
          - Wishlist Add, Check exists, Remove.
          - Enforce authenticated user & multi-tenant isolation.
        """
        app.dependency_overrides[deps.get_current_user_optional] = lambda: self.user_a
        app.dependency_overrides[deps.get_current_active_user] = lambda: self.user_a

        test_prod_id = str(ObjectId())

        # 5.1 User A adds to wishlist
        res_add = client.post("/api/v1/wishlist", json={
            "user_email": self.user_a.email,
            "product_id": test_prod_id,
            "product_title": "Art Deco Opal Chandelier",
            "product_price": 75000.0,
        })
        self.assertEqual(res_add.status_code, 201)

        # 5.2 Check exists for User A
        res_check = client.get(f"/api/v1/wishlist/check?email={self.user_a.email}&product_id={test_prod_id}")
        self.assertEqual(res_check.status_code, 200)
        self.assertTrue(res_check.json()["is_wishlisted"])

        # 5.3 Switch to User B: Attempt to view User A's wishlist -> 403 Forbidden
        app.dependency_overrides[deps.get_current_user_optional] = lambda: self.user_b
        app.dependency_overrides[deps.get_current_active_user] = lambda: self.user_b

        res_b_view = client.get(f"/api/v1/wishlist?email={self.user_a.email}")
        self.assertEqual(res_b_view.status_code, 403, "User B must not access User A wishlist!")

        # 5.4 Switch back to User A: Remove from wishlist
        app.dependency_overrides[deps.get_current_user_optional] = lambda: self.user_a
        app.dependency_overrides[deps.get_current_active_user] = lambda: self.user_a

        res_del = client.delete(f"/api/v1/wishlist/product/{test_prod_id}?email={self.user_a.email}")
        self.assertEqual(res_del.status_code, 200)
        self.assertTrue(res_del.json().get("success"))

        # Verify not wishlisted
        res_check_after = client.get(f"/api/v1/wishlist/check?email={self.user_a.email}&product_id={test_prod_id}")
        self.assertFalse(res_check_after.json()["is_wishlisted"])

    # =========================================================================
    # SECTION 4: ADDRESSES CRUD & SECURITY BOUNDARIES
    # =========================================================================
    def test_06_addresses_crud_and_tenant_security(self):
        """
        Verify:
          - Create address, list addresses, update address, delete address.
          - Default address promotion.
          - Enforce authenticated user security (tampering rejected with 403).
        """
        app.dependency_overrides[deps.get_current_active_user] = lambda: self.user_a
        app.dependency_overrides[deps.get_current_user_optional] = lambda: self.user_a

        # 4.1 User A creates Address 1
        res_addr1 = client.post("/api/v1/addresses", json={
            "user_email": self.user_a.email,
            "type": "Penthouse",
            "first_name": "Eleanor",
            "last_name": "Vanderbilt",
            "street": "100 Marine Drive",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pin_code": "400020",
            "phone": "+91 9820011223",
            "is_default": True,
        })
        self.assertEqual(res_addr1.status_code, 201)
        addr1_id = res_addr1.json()["id"]
        self.created_address_ids.append(addr1_id)
        self.assertTrue(res_addr1.json()["is_default"])

        # 4.2 User A creates Address 2 set as default -> Address 1 should become non-default
        res_addr2 = client.post("/api/v1/addresses", json={
            "user_email": self.user_a.email,
            "type": "Villa",
            "first_name": "Eleanor",
            "last_name": "Vanderbilt",
            "street": "Villa 4, Palm Jumeirah Estate",
            "city": "Goa",
            "state": "Goa",
            "pin_code": "403509",
            "phone": "+91 9820011223",
            "is_default": True,
        })
        self.assertEqual(res_addr2.status_code, 201)
        addr2_id = res_addr2.json()["id"]
        self.created_address_ids.append(addr2_id)
        self.assertTrue(res_addr2.json()["is_default"])

        # Verify Address 1 is_default flipped to False
        addr1_db = db.addresses.find_one({"_id": ObjectId(addr1_id)})
        self.assertFalse(addr1_db.get("is_default", False))

        # 4.3 Update address details
        res_update = client.put(f"/api/v1/addresses/{addr1_id}", json={
            "phone": "+91 9999988888",
            "type": "Sky Villa",
        })
        self.assertEqual(res_update.status_code, 200)
        self.assertEqual(res_update.json()["phone"], "+91 9999988888")

        # 4.4 Multi-Tenant Security Check: Switch to User B
        app.dependency_overrides[deps.get_current_active_user] = lambda: self.user_b
        app.dependency_overrides[deps.get_current_user_optional] = lambda: self.user_b

        # User B attempts to read User A's addresses via query param -> 403 Forbidden
        res_b_list = client.get(f"/api/v1/addresses?email={self.user_a.email}")
        self.assertEqual(res_b_list.status_code, 403)

        # User B attempts to update User A's address -> 403 Forbidden
        res_b_tamper = client.put(f"/api/v1/addresses/{addr1_id}", json={"city": "Hacked City"})
        self.assertEqual(res_b_tamper.status_code, 403)

        # User B attempts to delete User A's address -> 403 Forbidden
        res_b_del = client.delete(f"/api/v1/addresses/{addr1_id}")
        self.assertEqual(res_b_del.status_code, 403)

        # 4.5 Switch back to User A: Delete Address 2 (current default)
        app.dependency_overrides[deps.get_current_active_user] = lambda: self.user_a
        app.dependency_overrides[deps.get_current_user_optional] = lambda: self.user_a

        res_del_addr2 = client.delete(f"/api/v1/addresses/{addr2_id}")
        self.assertEqual(res_del_addr2.status_code, 200)

        # Verify remaining Address 1 automatically gets promoted to default
        addr1_db_after = db.addresses.find_one({"_id": ObjectId(addr1_id)})
        self.assertTrue(addr1_db_after.get("is_default", False), "Remaining address must be promoted to default!")

    # =========================================================================
    # SECTION 5: COUPONS ENGINE
    # =========================================================================
    def test_07_coupons_engine_discounts_negative_cases_and_admin_update(self):
        """
        Verify:
          - Positive: Percentage coupon with cap & Flat discount coupon.
          - Negative: Invalid code, expired coupon, subtotal below minimum spend.
          - Admin: Update coupon without 422 error, toggle status.
        """
        app.dependency_overrides[deps.get_current_active_admin] = lambda: self.admin

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        pct_code = f"QAPCT{ObjectId()}"[:12].upper()
        flat_code = f"QAFLAT{ObjectId()}"[:12].upper()
        exp_code = f"QAEXP{ObjectId()}"[:12].upper()

        # Seed Percentage Coupon (15% off, min spend 2000, cap 600)
        c_pct = {
            "code": pct_code,
            "title": "VIP 15% Privilege",
            "discount_type": "percentage",
            "discount_value": 15.0,
            "max_discount_cap": 600.0,
            "min_order_value": 2000.0,
            "is_active": True,
            "is_public": True,
            "start_date": now,
            "expiry_date": now + timedelta(days=30),
            "times_used": 0,
            "created_at": now,
            "updated_at": now,
        }
        res_c1 = db.coupons.insert_one(c_pct)
        self.created_coupon_ids.append(res_c1.inserted_id)

        # Seed Flat Discount Coupon (Flat 500 off, min spend 3000)
        c_flat = {
            "code": flat_code,
            "title": "Concierge ₹500 Voucher",
            "discount_type": "flat",
            "discount_value": 500.0,
            "max_discount_cap": None,
            "min_order_value": 3000.0,
            "is_active": True,
            "is_public": True,
            "start_date": now,
            "expiry_date": now + timedelta(days=30),
            "times_used": 0,
            "created_at": now,
            "updated_at": now,
        }
        res_c2 = db.coupons.insert_one(c_flat)
        self.created_coupon_ids.append(res_c2.inserted_id)

        # Seed Expired Coupon
        c_exp = {
            "code": exp_code,
            "title": "Expired Voucher",
            "discount_type": "percentage",
            "discount_value": 20.0,
            "min_order_value": 1000.0,
            "is_active": True,
            "is_public": True,
            "start_date": now - timedelta(days=30),
            "expiry_date": now - timedelta(days=1),  # Expired yesterday
            "times_used": 0,
            "created_at": now - timedelta(days=30),
            "updated_at": now,
        }
        res_c3 = db.coupons.insert_one(c_exp)
        self.created_coupon_ids.append(res_c3.inserted_id)

        # 5.1 Test Percentage coupon calculation (subtotal 3000 -> 15% is 450, under cap 600)
        val_pct = client.post("/api/v1/coupons/validate", json={"code": pct_code, "subtotal": 3000.0})
        self.assertEqual(val_pct.status_code, 200)
        self.assertTrue(val_pct.json()["valid"])
        self.assertEqual(val_pct.json()["discount_amount"], 450.0)

        # 5.1.2 Test Percentage coupon capped at 600 (subtotal 10000 -> 15% is 1500, capped to 600)
        val_pct_cap = client.post("/api/v1/coupons/validate", json={"code": pct_code, "subtotal": 10000.0})
        self.assertEqual(val_pct_cap.status_code, 200)
        self.assertTrue(val_pct_cap.json()["valid"])
        self.assertEqual(val_pct_cap.json()["discount_amount"], 600.0)

        # 5.2 Test Flat discount coupon (subtotal 5000 -> discount 500)
        val_flat = client.post("/api/v1/coupons/validate", json={"code": flat_code, "subtotal": 5000.0})
        self.assertEqual(val_flat.status_code, 200)
        self.assertTrue(val_flat.json()["valid"])
        self.assertEqual(val_flat.json()["discount_amount"], 500.0)

        # 5.3 Negative: Non-existent coupon code
        val_inv = client.post("/api/v1/coupons/validate", json={"code": "NONEXISTENT_CODE_999", "subtotal": 5000.0})
        self.assertEqual(val_inv.status_code, 200)
        self.assertFalse(val_inv.json()["valid"])
        self.assertEqual(val_inv.json()["reason"], "NOT_FOUND")

        # 5.4 Negative: Expired coupon code
        val_exp = client.post("/api/v1/coupons/validate", json={"code": exp_code, "subtotal": 5000.0})
        self.assertEqual(val_exp.status_code, 200)
        self.assertFalse(val_exp.json()["valid"])
        self.assertIn("expired", val_exp.json()["reason"].lower())

        # 5.5 Negative: Subtotal below minimum order spend (pct_code min spend is 2000, send 1500)
        val_min = client.post("/api/v1/coupons/validate", json={"code": pct_code, "subtotal": 1500.0})
        self.assertEqual(val_min.status_code, 200)
        self.assertFalse(val_min.json()["valid"])
        self.assertIn("min", val_min.json()["reason"].lower())

        # 5.6 Admin Coupon Update: Must update cleanly WITHOUT 422 Unprocessable Entity
        res_adm_up = client.put(f"/api/v1/admin/coupons/{res_c1.inserted_id}", json={
            "title": "VIP 15% Privilege (Updated)",
            "max_discount_cap": 750.0,
            "min_order_value": 2500.0,
        })
        self.assertEqual(res_adm_up.status_code, 200, f"Admin coupon update failed with status: {res_adm_up.text}")
        self.assertEqual(res_adm_up.json()["title"], "VIP 15% Privilege (Updated)")
        self.assertEqual(res_adm_up.json()["max_discount_cap"], 750.0)

    # =========================================================================
    # SECTION 6: ORDER LIFECYCLE, CONCURRENCY & OVERSELLING
    # =========================================================================
    def test_08_order_stock_decrement_oversell_and_cancellation_idempotency(self):
        """
        Verify:
          - Place order, verify stock decrement.
          - Edge: Attempt to order more than available stock (must be rejected with 400).
          - Order Status Transition: Confirm/Paid -> Shipped -> Delivered.
          - Order Cancellation: verify stock is restored exactly once (no duplicate restoration).
        """
        app.dependency_overrides[deps.get_current_active_user] = lambda: self.user_a
        app.dependency_overrides[deps.get_current_user_optional] = lambda: self.user_a

        # Seed test product with stock_count = 5
        prod_id = ObjectId()
        db.products.insert_one({
            "_id": prod_id,
            "product_title": "Versailles Crystal Luminaire",
            "product_price": 50000.0,
            "stock_count": 5,
            "in_stock": True,
            "stock_status": "IN STOCK",
        })
        self.created_product_ids.append(prod_id)

        # 6.1 Place order for 2 units
        order_payload = {
            "email": self.user_a.email,
            "phone": "+91 9820011223",
            "user_id": str(self.user_a.id),
            "payment_method": "cod",
            "shipping_address": {
                "first_name": "Eleanor",
                "last_name": "Vanderbilt",
                "street": "100 Marine Drive",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pin_code": "400020",
            },
            "items": [
                {
                    "product_id": str(prod_id),
                    "title": "Versailles Crystal Luminaire",
                    "price": 50000.0,
                    "quantity": 2,
                }
            ],
            "subtotal": 100000.0,
            "gst": 18000.0,
            "delivery": 0.0,
            "total": 118000.0,
        }

        res_order = client.post("/api/v1/orders", json=order_payload)
        self.assertEqual(res_order.status_code, 201)
        created_order = res_order.json()
        order_id = created_order["_id"]
        self.created_order_ids.append(order_id)

        # Assert stock decremented from 5 to 3 in MongoDB Atlas
        prod_after_order = db.products.find_one({"_id": prod_id})
        self.assertEqual(prod_after_order["stock_count"], 3, "Stock count must be decremented by ordered quantity!")

        # 6.2 Edge: Attempt to order 10 units when only 3 remain in stock -> Must fail with 400
        oversell_order = {
            "email": self.user_a.email,
            "phone": "+91 9820011223",
            "shipping_address": {
                "first_name": "Eleanor",
                "last_name": "Vanderbilt",
                "street": "100 Marine Drive",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pin_code": "400020",
            },
            "items": [
                {
                    "product_id": str(prod_id),
                    "title": "Versailles Crystal Luminaire",
                    "price": 50000.0,
                    "quantity": 10,
                }
            ],
            "subtotal": 500000.0,
            "gst": 90000.0,
            "delivery": 0.0,
            "total": 590000.0,
        }
        res_oversell = client.post("/api/v1/payments/cod", json=oversell_order)
        self.assertEqual(res_oversell.status_code, 400, "Overselling checkout must be blocked with 400!")
        self.assertIn("only 3 unit(s)", res_oversell.json()["detail"].lower())

        # Also verify direct order creation endpoint blocks oversell with 400
        oversell_direct = dict(order_payload)
        oversell_direct["items"] = [
            {
                "product_id": str(prod_id),
                "title": "Versailles Crystal Luminaire",
                "price": 50000.0,
                "quantity": 10,
            }
        ]
        res_oversell_direct = client.post("/api/v1/orders", json=oversell_direct)
        self.assertEqual(res_oversell_direct.status_code, 400, "Direct oversell order placement must be blocked with 400!")
        self.assertIn("only 3 unit(s)", res_oversell_direct.json()["detail"].lower())

        # Verify stock was not corrupted (still exactly 3)
        prod_check = db.products.find_one({"_id": prod_id})
        self.assertEqual(prod_check["stock_count"], 3)

        # 6.3 Order Status Transitions (Admin only)
        app.dependency_overrides[deps.get_current_active_admin] = lambda: self.admin

        # Transition 1: cod/pending -> processing
        res_proc = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "processing"})
        self.assertEqual(res_proc.status_code, 200)
        self.assertEqual(res_proc.json()["status"], "processing")

        # Transition 2: processing -> shipped
        res_ship = client.patch(f"/api/v1/orders/{order_id}/status", json={
            "status": "shipped",
            "tracking_number": "TRK-SR-998822",
            "courier_partner": "BlueDart Apex",
        })
        self.assertEqual(res_ship.status_code, 200)
        self.assertEqual(res_ship.json()["status"], "shipped")
        self.assertEqual(res_ship.json()["tracking_number"], "TRK-SR-998822")

        # Transition 3: shipped -> delivered
        res_deliv = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "delivered"})
        self.assertEqual(res_deliv.status_code, 200)
        self.assertEqual(res_deliv.json()["status"], "delivered")

        # 6.4 Order Cancellation & Stock Restoration (Exactly Once)
        # Seed a cancellable pending order with 2 units of another product
        prod_cancel_id = ObjectId()
        db.products.insert_one({
            "_id": prod_cancel_id,
            "product_title": "Palais Pendant",
            "product_price": 20000.0,
            "stock_count": 8,
            "in_stock": True,
        })
        self.created_product_ids.append(prod_cancel_id)

        # Decrement stock as if ordered: 8 -> 6
        decrement_product_stock([{"product_id": str(prod_cancel_id), "quantity": 2}])
        prod_at_order = db.products.find_one({"_id": prod_cancel_id})
        self.assertEqual(prod_at_order["stock_count"], 6)

        cancellable_order_doc = {
            "_id": ObjectId(),
            "email": self.user_a.email,
            "user_id": str(self.user_a.id),
            "status": "pending",
            "total": 40000.0,
            "items": [{"product_id": str(prod_cancel_id), "quantity": 2, "price": 20000.0, "title": "Palais Pendant"}],
            "created_at": datetime.utcnow(),
        }
        db.orders.insert_one(cancellable_order_doc)
        c_oid = str(cancellable_order_doc["_id"])
        self.created_order_ids.append(c_oid)

        # Act as Customer A: Cancel the order
        app.dependency_overrides[deps.get_current_user_optional] = lambda: self.user_a
        app.dependency_overrides[deps.get_current_active_user] = lambda: self.user_a

        res_cancel = client.put(f"/api/v1/orders/{c_oid}/cancel", json={"reason": "Customer requested cancellation"})
        self.assertEqual(res_cancel.status_code, 200)
        self.assertTrue(res_cancel.json()["success"])

        # Stock must be restored from 6 back to 8
        prod_after_cancel = db.products.find_one({"_id": prod_cancel_id})
        self.assertEqual(prod_after_cancel["stock_count"], 8, "Stock must be restored upon cancellation!")

        # CRITICAL RE-ENTRANCY CHECK:
        # Attempt to cancel the exact same order a second time.
        # Must be rejected with 400 and must NOT restore stock again!
        res_duplicate_cancel = client.put(f"/api/v1/orders/{c_oid}/cancel", json={"reason": "Duplicate cancel attempt"})
        self.assertEqual(res_duplicate_cancel.status_code, 400, "Second cancellation must be rejected with 400!")
        self.assertIn("already 'cancelled'", res_duplicate_cancel.json()["detail"].lower())

        # Assert stock is STILL 8 (NOT 10!)
        prod_reentrancy_check = db.products.find_one({"_id": prod_cancel_id})
        self.assertEqual(prod_reentrancy_check["stock_count"], 8, "Stock must NEVER be restored multiple times!")

    # =========================================================================
    # SECTION 7: SHIPROCKET & RETURNS ENFORCEMENT
    # =========================================================================
    def test_09_returns_enforcement_and_delivered_status_guardrail(self):
        """
        Verify:
          - Returns only permitted for orders with status == 'delivered'.
          - Pre-delivery orders (processing, shipped, etc.) must be rejected with 400.
          - Delivered order return request succeeds and records PENDING_APPROVAL.
          - Customer privacy / authorization is enforced.
        """
        # Seed an order in 'processing' status
        proc_order_id = ObjectId()
        db.orders.insert_one({
            "_id": proc_order_id,
            "email": self.user_a.email,
            "user_id": str(self.user_a.id),
            "status": "processing",
            "items": [{"product_id": str(ObjectId()), "title": "Bespoke Sconce", "quantity": 1}],
            "total": 35000.0,
            "shipping_address": {
                "first_name": "Eleanor",
                "last_name": "Vanderbilt",
                "street": "100 Marine Drive",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pin_code": "400020",
            },
        })
        self.created_order_ids.append(proc_order_id)

        # 7.1 Customer A attempts return on 'processing' order -> Must be rejected with 400
        app.dependency_overrides[deps.get_current_user_optional] = lambda: self.user_a
        res_ret_proc = client.post("/api/v1/shiprocket/returns/customer-request", json={
            "order_id": str(proc_order_id),
            "reason": "Change of mind",
            "customer_email": self.user_a.email,
        })
        self.assertEqual(res_ret_proc.status_code, 400, "Returns on non-delivered orders must be rejected!")
        self.assertIn("only permitted for delivered orders", res_ret_proc.json()["detail"].lower())

        # Update order to 'delivered'
        db.orders.update_one({"_id": proc_order_id}, {"$set": {"status": "delivered"}})

        # 7.2 Customer B attempts to request return on Customer A's delivered order -> 403 Forbidden
        app.dependency_overrides[deps.get_current_user_optional] = lambda: self.user_b
        res_ret_b = client.post("/api/v1/shiprocket/returns/customer-request", json={
            "order_id": str(proc_order_id),
            "reason": "Unauthorized attempt",
            "customer_email": self.user_b.email,
        })
        self.assertEqual(res_ret_b.status_code, 403, "Customer B must not request return on Customer A order!")

        # 7.3 Customer A requests return on delivered order -> Accepted with 200
        app.dependency_overrides[deps.get_current_user_optional] = lambda: self.user_a
        res_ret_a = client.post("/api/v1/shiprocket/returns/customer-request", json={
            "order_id": str(proc_order_id),
            "reason": "Finishing shade variance from architectural plan",
            "customer_notes": "Photos attached showing finish tone discrepancy.",
            "images": ["https://images.deluzex.com/proof_1.jpg"],
            "customer_email": self.user_a.email,
        })
        self.assertEqual(res_ret_a.status_code, 200)
        ret_result = res_ret_a.json()
        self.assertTrue(ret_result["success"])
        self.assertEqual(ret_result["return_details"]["status"], "PENDING_APPROVAL")
        self.assertEqual(ret_result["return_details"]["reason"], "Finishing shade variance from architectural plan")

        # Verify DB status updated to return_requested
        db_order = db.orders.find_one({"_id": proc_order_id})
        self.assertEqual(db_order["status"], "return_requested")
        self.assertEqual(db_order["return_details"]["status"], "PENDING_APPROVAL")


if __name__ == "__main__":
    unittest.main()
