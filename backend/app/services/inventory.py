import logging
from typing import List, Union, Dict, Any
from bson import ObjectId
from pymongo import ReturnDocument
from fastapi import HTTPException
from app.core.database import db

logger = logging.getLogger("deluzex.inventory")

def validate_stock_availability(items: List[Union[Dict[str, Any], Any]]) -> None:
    """
    Validate that each product in items exists and has sufficient stock available.
    Raises HTTPException(400) if any product is out of stock or requested quantity exceeds available stock.
    """
    if not items:
        return

    for item in items:
        pid = item.get("product_id") if isinstance(item, dict) else getattr(item, "product_id", None)
        qty = int(item.get("quantity", 1) if isinstance(item, dict) else getattr(item, "quantity", 1))
        title = item.get("title") if isinstance(item, dict) else getattr(item, "title", "Product")
        if not pid:
            continue

        is_valid_oid = ObjectId.is_valid(str(pid))
        try:
            prod_query = {"_id": ObjectId(pid)} if is_valid_oid else {"_id": str(pid)}
        except Exception:
            prod_query = {"_id": str(pid)}

        product = db.products.find_one(prod_query)
        if not product and is_valid_oid:
            raise HTTPException(status_code=400, detail=f"Product '{title}' is no longer available.")

        if product:
            if product.get("in_stock") is False or int(product.get("stock_count", 0)) <= 0:
                raise HTTPException(status_code=400, detail=f"Product '{title}' is currently out of stock.")

            avail = int(product.get("stock_count", 0))
            if avail < qty:
                raise HTTPException(status_code=400, detail=f"Only {avail} unit(s) of '{title}' available in stock.")


def decrement_product_stock(items: List[Union[Dict[str, Any], Any]]) -> None:
    """
    Atomically decrement stock_count for each product in items upon order placement or payment.
    Enforces optimistic concurrency check: stock_count must be >= quantity.
    Raises HTTPException(400) if insufficient stock is found, and rolls back any partial decrements.
    If a product does not exist in the database (e.g. untracked or mock item), logs warning gracefully.
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

        # Check if product is tracked in MongoDB
        existing_prod = db.products.find_one(prod_query)
        if not existing_prod:
            logger.warning(f"[INVENTORY] Product {pid} not found in database; skipping stock decrement.")
            continue

        current_stock = int(existing_prod.get("stock_count", 0))
        if current_stock <= 0 or not existing_prod.get("in_stock", True):
            if decremented_so_far:
                restore_product_stock(decremented_so_far)
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for '{title}'. Another customer may have just purchased the remaining units."
            )

        try:
            if current_stock >= qty:
                # Atomic optimistic concurrency check: only decrement if stock_count >= qty
                atomic_query = {**prod_query, "stock_count": {"$gte": qty}}
                updated = db.products.find_one_and_update(
                    atomic_query,
                    {"$inc": {"stock_count": -qty}},
                    return_document=ReturnDocument.AFTER
                )
            else:
                # Stock exists but is less than requested quantity: floor at 0
                atomic_query = {**prod_query, "stock_count": {"$gt": 0}}
                updated = db.products.find_one_and_update(
                    atomic_query,
                    {"$set": {"stock_count": 0, "in_stock": False, "stock_status": "OUT OF STOCK"}},
                    return_document=ReturnDocument.AFTER
                )

            if not updated:
                # Race condition: another concurrent checkout reduced stock between find and update
                if decremented_so_far:
                    restore_product_stock(decremented_so_far)
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for '{title}'. Another customer may have just purchased the remaining units."
                )

            decremented_so_far.append({"product_id": pid, "quantity": qty})
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
        except HTTPException:
            raise
        except Exception as exc:
            if decremented_so_far:
                restore_product_stock(decremented_so_far)
            logger.error(f"[INVENTORY] Error during atomic decrement: {exc}")
            raise HTTPException(status_code=500, detail="Failed to reserve inventory stock.")


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
