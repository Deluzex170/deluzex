import unittest
import os
import sys
from bson import ObjectId

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi import HTTPException
from app.core.database import db
from app.services.inventory import decrement_product_stock, restore_product_stock

class TestInventoryConcurrency(unittest.TestCase):
    def setUp(self):
        self.created_prod_ids = []
        # Insert test product with stock = 2
        prod_doc = {
            "title": "Bespoke Versailles Lamp",
            "price": 45000.0,
            "stock_count": 2,
            "in_stock": True,
            "stock_status": "IN STOCK",
        }
        res = db.products.insert_one(prod_doc)
        self.test_prod_id = res.inserted_id
        self.created_prod_ids.append(self.test_prod_id)

    def tearDown(self):
        for pid in self.created_prod_ids:
            db.products.delete_one({"_id": pid})

    def test_01_successful_decrement(self):
        """Standard stock deduction works accurately."""
        items = [{"product_id": str(self.test_prod_id), "quantity": 1, "title": "Bespoke Versailles Lamp"}]
        decrement_product_stock(items)
        prod = db.products.find_one({"_id": self.test_prod_id})
        self.assertEqual(prod["stock_count"], 1)
        self.assertTrue(prod["in_stock"])

    def test_02_concurrency_guard_prevents_overselling(self):
        """When stock is 1, second checkout attempt must be rejected with HTTPException."""
        # Decrement 2 to reach 0
        items = [{"product_id": str(self.test_prod_id), "quantity": 2, "title": "Bespoke Versailles Lamp"}]
        decrement_product_stock(items)
        prod = db.products.find_one({"_id": self.test_prod_id})
        self.assertEqual(prod["stock_count"], 0)
        self.assertFalse(prod["in_stock"])
        self.assertEqual(prod["stock_status"], "OUT OF STOCK")

        # Third attempt when stock is 0 must fail
        with self.assertRaises(HTTPException) as ctx:
            decrement_product_stock(items)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("insufficient stock", ctx.exception.detail.lower())

    def test_03_multi_item_atomic_rollback(self):
        """If one item in a multi-item cart fails decrement, previous items are rolled back."""
        # Create second product with 0 stock
        oos_prod = {
            "title": "Out of Stock Sconce",
            "price": 20000.0,
            "stock_count": 0,
            "in_stock": False,
            "stock_status": "OUT OF STOCK",
        }
        res2 = db.products.insert_one(oos_prod)
        self.created_prod_ids.append(res2.inserted_id)

        cart_items = [
            {"product_id": str(self.test_prod_id), "quantity": 1, "title": "Bespoke Versailles Lamp"},
            {"product_id": str(res2.inserted_id), "quantity": 1, "title": "Out of Stock Sconce"}
        ]

        with self.assertRaises(HTTPException):
            decrement_product_stock(cart_items)

        # Prod 1 stock must be rolled back to 2 (not 1)
        prod1 = db.products.find_one({"_id": self.test_prod_id})
        self.assertEqual(prod1["stock_count"], 2)
