import logging
from typing import List, Union, Dict, Any
from bson import ObjectId
from pymongo import ReturnDocument
from app.core.database import db

logger = logging.getLogger("deluzex.inventory")

def decrement_product_stock(items: List[Union[Dict[str, Any], Any]]) -> None:
    """
    Atomically decrement stock_count for each product in items upon order placement or payment.
    If stock_count drops to 0 or below, automatically updates in_stock=False and stock_status='OUT OF STOCK'.
    """
    if not items:
        return

    for item in items:
        pid = item.get("product_id") if isinstance(item, dict) else getattr(item, "product_id", None)
        qty = item.get("quantity", 1) if isinstance(item, dict) else getattr(item, "quantity", 1)
        if not pid:
            continue

        try:
            prod_query = {"_id": ObjectId(pid)} if ObjectId.is_valid(str(pid)) else {"_id": str(pid)}
        except Exception:
            prod_query = {"_id": str(pid)}

        try:
            updated = db.products.find_one_and_update(
                prod_query,
                {"$inc": {"stock_count": -int(qty)}},
                return_document=ReturnDocument.AFTER
            )
            if updated:
                new_stock = updated.get("stock_count", 0)
                logger.info(f"[INVENTORY] Decremented product {pid} by {qty} (new stock: {new_stock})")
                if new_stock <= 0:
                    db.products.update_one(
                        prod_query,
                        {
                            "$set": {
                                "in_stock": False,
                                "stock_status": "OUT OF STOCK",
                                "stock_count": 0
                            }
                        }
                    )
                    logger.info(f"[INVENTORY] Product {pid} is now OUT OF STOCK")
        except Exception as exc:
            logger.warning(f"[INVENTORY] Failed to decrement stock for product {pid}: {exc}")


def restore_product_stock(items: List[Union[Dict[str, Any], Any]]) -> None:
    """
    Restore stock_count for each product in items when an order is cancelled.
    Sets in_stock=True and stock_status='IN STOCK'.
    """
    if not items:
        return

    for item in items:
        pid = item.get("product_id") if isinstance(item, dict) else getattr(item, "product_id", None)
        qty = item.get("quantity", 1) if isinstance(item, dict) else getattr(item, "quantity", 1)
        if not pid:
            continue

        try:
            prod_query = {"_id": ObjectId(pid)} if ObjectId.is_valid(str(pid)) else {"_id": str(pid)}
        except Exception:
            prod_query = {"_id": str(pid)}

        try:
            db.products.update_one(
                prod_query,
                {
                    "$inc": {"stock_count": int(qty)},
                    "$set": {
                        "in_stock": True,
                        "stock_status": "IN STOCK"
                    }
                }
            )
            logger.info(f"[INVENTORY] Restored product {pid} by {qty}")
        except Exception as exc:
            logger.warning(f"[INVENTORY] Failed to restore stock for product {pid}: {exc}")
