import unittest
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from bson import ObjectId
from app.core.database import db
from app.services.inventory import decrement_product_stock, restore_product_stock

class TestStockManagement(unittest.TestCase):
    def setUp(self):
        # Insert a clean test product
        self.test_product_id = db.products.insert_one({
            "name": "Audit Test Chandelier",
            "slug": "audit-test-chandelier",
            "price": 45000.0,
            "stock_count": 5,
            "in_stock": True,
            "stock_status": "IN STOCK",
            "is_active": True
        }).inserted_id

    def tearDown(self):
        # Clean up test product
        db.products.delete_one({"_id": self.test_product_id})

    def test_decrement_stock_positive(self):
        # Decrement by 2
        decrement_product_stock([{"product_id": str(self.test_product_id), "quantity": 2}])
        
        prod = db.products.find_one({"_id": self.test_product_id})
        self.assertIsNotNone(prod)
        self.assertEqual(prod.get("stock_count"), 3)
        self.assertTrue(prod.get("in_stock"))
        self.assertEqual(prod.get("stock_status"), "IN STOCK")

    def test_decrement_to_zero_triggers_out_of_stock(self):
        # Decrement all 5 items
        decrement_product_stock([{"product_id": str(self.test_product_id), "quantity": 5}])

        prod = db.products.find_one({"_id": self.test_product_id})
        self.assertIsNotNone(prod)
        self.assertEqual(prod.get("stock_count"), 0)
        self.assertFalse(prod.get("in_stock"))
        self.assertEqual(prod.get("stock_status"), "OUT OF STOCK")

    def test_decrement_oversell_floors_at_zero(self):
        # Decrement 10 when only 5 exist (should floor at 0 and set OUT OF STOCK)
        decrement_product_stock([{"product_id": str(self.test_product_id), "quantity": 10}])

        prod = db.products.find_one({"_id": self.test_product_id})
        self.assertIsNotNone(prod)
        self.assertEqual(prod.get("stock_count"), 0)
        self.assertFalse(prod.get("in_stock"))
        self.assertEqual(prod.get("stock_status"), "OUT OF STOCK")

    def test_restore_stock_on_cancellation(self):
        # First reduce to 0
        decrement_product_stock([{"product_id": str(self.test_product_id), "quantity": 5}])
        prod_before = db.products.find_one({"_id": self.test_product_id})
        self.assertFalse(prod_before.get("in_stock"))

        # Restore 5 units
        restore_product_stock([{"product_id": str(self.test_product_id), "quantity": 5}])
        prod_after = db.products.find_one({"_id": self.test_product_id})
        self.assertEqual(prod_after.get("stock_count"), 5)
        self.assertTrue(prod_after.get("in_stock"))
        self.assertEqual(prod_after.get("stock_status"), "IN STOCK")

    def test_edge_cases_and_graceful_failures(self):
        # Empty list should not raise error
        decrement_product_stock([])
        restore_product_stock([])

        # Non-existent ObjectId should gracefully log warning without raising exception
        random_id = str(ObjectId())
        decrement_product_stock([{"product_id": random_id, "quantity": 2}])
        restore_product_stock([{"product_id": random_id, "quantity": 2}])

        # Malformed product_id string should gracefully handle without crashing
        decrement_product_stock([{"product_id": "malformed_id_12345", "quantity": 1}])
        restore_product_stock([{"product_id": "malformed_id_12345", "quantity": 1}])

        # Item without product_id
        decrement_product_stock([{"quantity": 5}])
        restore_product_stock([{"quantity": 5}])

if __name__ == "__main__":
    unittest.main()
