import sys
import os
import pytest
from unittest.mock import MagicMock, patch
from bson import ObjectId
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.inventory import validate_stock_availability, decrement_product_stock, restore_product_stock

class TestInventoryGuardrails:
    @patch("app.services.inventory.db")
    def test_validate_stock_availability_success(self, mock_db):
        prod_id = str(ObjectId())
        mock_db.products.find_one.return_value = {
            "_id": ObjectId(prod_id),
            "product_title": "Grand Versailles Chandelier",
            "stock_count": 5,
            "in_stock": True
        }
        items = [{"product_id": prod_id, "quantity": 2, "title": "Grand Versailles Chandelier"}]
        # Should not raise
        validate_stock_availability(items)

    @patch("app.services.inventory.db")
    def test_validate_stock_availability_out_of_stock_fails(self, mock_db):
        prod_id = str(ObjectId())
        mock_db.products.find_one.return_value = {
            "_id": ObjectId(prod_id),
            "product_title": "Bespoke Glass Pendant",
            "stock_count": 0,
            "in_stock": False
        }
        items = [{"product_id": prod_id, "quantity": 1, "title": "Bespoke Glass Pendant"}]
        with pytest.raises(HTTPException) as exc_info:
            validate_stock_availability(items)
        assert exc_info.value.status_code == 400
        assert "out of stock" in exc_info.value.detail.lower()

    @patch("app.services.inventory.db")
    def test_validate_stock_availability_quantity_exceeds_stock_fails(self, mock_db):
        prod_id = str(ObjectId())
        mock_db.products.find_one.return_value = {
            "_id": ObjectId(prod_id),
            "product_title": "Artisan Wall Sconce",
            "stock_count": 2,
            "in_stock": True
        }
        items = [{"product_id": prod_id, "quantity": 5, "title": "Artisan Wall Sconce"}]
        with pytest.raises(HTTPException) as exc_info:
            validate_stock_availability(items)
        assert exc_info.value.status_code == 400
        assert "only 2 unit(s)" in exc_info.value.detail.lower()

    @patch("app.services.inventory.db")
    def test_validate_stock_availability_non_existent_product_fails(self, mock_db):
        prod_id = str(ObjectId())
        mock_db.products.find_one.return_value = None
        items = [{"product_id": prod_id, "quantity": 1, "title": "Deleted Light"}]
        with pytest.raises(HTTPException) as exc_info:
            validate_stock_availability(items)
        assert exc_info.value.status_code == 400
        assert "no longer available" in exc_info.value.detail.lower()
