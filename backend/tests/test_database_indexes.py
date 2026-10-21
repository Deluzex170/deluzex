import unittest
import os
import sys

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.database import db, ensure_database_indexes

class TestDatabaseIndexes(unittest.TestCase):
    def test_01_ensure_database_indexes_creates_required_indexes(self):
        """Verify that ensure_database_indexes configures all critical unique, compound, and TTL indexes."""
        # Execute index creation
        res = ensure_database_indexes(db)
        self.assertTrue(res)

        # 1. users: unique email
        user_indexes = db.users.index_information()
        user_email_idx = any(
            info.get("key") == [("email", 1)] and info.get("unique") is True
            for info in user_indexes.values()
        )
        self.assertTrue(user_email_idx, f"Unique email index missing on users: {user_indexes}")

        # 2. coupons: unique code
        coupon_indexes = db.coupons.index_information()
        coupon_code_idx = any(
            info.get("key") == [("code", 1)] and info.get("unique") is True
            for info in coupon_indexes.values()
        )
        self.assertTrue(coupon_code_idx, f"Unique code index missing on coupons: {coupon_indexes}")

        # 3. orders: compound (email, created_at) and status
        order_indexes = db.orders.index_information()
        order_email_date_idx = any(
            info.get("key") == [("email", 1), ("created_at", -1)]
            for info in order_indexes.values()
        )
        order_status_idx = any(
            info.get("key") == [("status", 1)]
            for info in order_indexes.values()
        )
        self.assertTrue(order_email_date_idx, f"Compound (email, created_at) index missing on orders: {order_indexes}")
        self.assertTrue(order_status_idx, f"Status index missing on orders: {order_indexes}")

        # 4. email_otps: TTL index
        otp_indexes = db.email_otps.index_information()
        otp_ttl_idx = any(
            info.get("key") == [("created_at", 1)] and info.get("expireAfterSeconds") == 600
            for info in otp_indexes.values()
        )
        self.assertTrue(otp_ttl_idx, f"TTL index (600s) missing on email_otps: {otp_indexes}")

        # 5. cart_items: user_email and session_id
        cart_indexes = db.cart_items.index_information()
        cart_user_idx = any(info.get("key") == [("user_email", 1)] for info in cart_indexes.values())
        cart_session_idx = any(info.get("key") == [("session_id", 1)] for info in cart_indexes.values())
        self.assertTrue(cart_user_idx, f"user_email index missing on cart_items: {cart_indexes}")
        self.assertTrue(cart_session_idx, f"session_id index missing on cart_items: {cart_indexes}")

        # 6. products: category and in_stock
        product_indexes = db.products.index_information()
        prod_cat_idx = any(info.get("key") == [("category", 1)] for info in product_indexes.values())
        prod_stock_idx = any(info.get("key") == [("in_stock", 1)] for info in product_indexes.values())
        self.assertTrue(prod_cat_idx, f"category index missing on products: {product_indexes}")
        self.assertTrue(prod_stock_idx, f"in_stock index missing on products: {product_indexes}")

if __name__ == "__main__":
    unittest.main()
