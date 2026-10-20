from fastapi import APIRouter, HTTPException, status
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app.core.database import db
from app.schemas.cart import (
    CartItemCreate,
    CartItemUpdate,
    CartSyncRequest,
    CartItemResponse,
)

router = APIRouter()

def serialize_cart_item(doc: dict) -> dict:
    """Format MongoDB document into standardized CartItemResponse dictionary,

    enriching from db.products (read-only) if title/price/image are missing.
    """
    item_id = str(doc.get("_id", ""))
    product_id_str = str(doc.get("product_id", "")).strip()
    title = doc.get("title")
    price = doc.get("price")
    image = doc.get("image")
    stock = doc.get("stock")

    # Read-only enrichment from db.products if fields are not cached on cart_item
    if not title or price is None or not image or stock is None:
        product_doc = None
        if ObjectId.is_valid(product_id_str):
            try:
                product_doc = db.products.find_one({"_id": ObjectId(product_id_str)})
            except Exception:
                product_doc = None
        if not product_doc:
            product_doc = db.products.find_one({
                "$or": [{"_id": product_id_str}, {"sku": product_id_str}]
            })

        if product_doc:
            if not title:
                title = product_doc.get("product_title") or product_doc.get("name") or "Product"
            if price is None:
                price = product_doc.get("product_price") or product_doc.get("price") or 0.0
            if not image:
                imgs = product_doc.get("product_images") or []
                image = product_doc.get("product_main_image") or (imgs[0] if imgs else "")
            if stock is None:
                stock = product_doc.get("stock_count", 99)

    return {
        "id": item_id,
        "product_id": product_id_str,
        "title": title or "Product",
        "price": float(price or 0.0),
        "image": image or "",
        "quantity": int(doc.get("quantity", 1)),
        "stock": int(stock if stock is not None else 99),
        "session_id": doc.get("session_id"),
        "user_email": doc.get("user_email"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }

@router.post("/add", response_model=CartItemResponse, status_code=status.HTTP_200_OK)
def add_to_cart(item: CartItemCreate):
    """Add a product to cart or increment quantity if already present.

    Safe, non-destructive: only modifies or creates records in db.cart_items.
    """
    product_id_str = str(item.product_id).strip()
    session_id = item.session_id.strip() if item.session_id else None
    user_email = item.user_email.strip() if item.user_email else None

    if not session_id and not user_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either session_id or user_email must be provided"
        )

    # Read-only lookup from db.products to get fresh title/price/image/stock if omitted
    title = item.title
    price = item.price
    image = item.image
    stock = 99

    product_doc = None
    if ObjectId.is_valid(product_id_str):
        try:
            product_doc = db.products.find_one({"_id": ObjectId(product_id_str)})
        except Exception:
            product_doc = None
    if not product_doc:
        product_doc = db.products.find_one({
            "$or": [{"_id": product_id_str}, {"sku": product_id_str}]
        })

    if product_doc:
        if not title:
            title = product_doc.get("product_title") or product_doc.get("name") or "Product"
        if price is None:
            price = product_doc.get("product_price") or product_doc.get("price") or 0.0
        if not image:
            imgs = product_doc.get("product_images") or []
            image = product_doc.get("product_main_image") or (imgs[0] if imgs else "")
        stock = product_doc.get("stock_count", 99)

    now = datetime.utcnow()

    # Determine query based on whether user is authenticated or guest
    query = {"product_id": product_id_str}
    if user_email:
        query["user_email"] = user_email
    else:
        query["session_id"] = session_id
        query["user_email"] = None

    existing = db.cart_items.find_one(query)
    if existing:
        new_quantity = existing.get("quantity", 1) + max(1, item.quantity)
        db.cart_items.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "quantity": new_quantity,
                    "updated_at": now,
                    "title": title or existing.get("title", "Product"),
                    "price": float(price if price is not None else existing.get("price", 0.0)),
                    "image": image or existing.get("image", ""),
                    "stock": stock,
                }
            }
        )
        existing["quantity"] = new_quantity
        existing["title"] = title or existing.get("title", "Product")
        existing["price"] = float(price if price is not None else existing.get("price", 0.0))
        existing["image"] = image or existing.get("image", "")
        existing["stock"] = stock
        existing["updated_at"] = now
        return serialize_cart_item(existing)
    else:
        new_doc = {
            "session_id": session_id,
            "user_email": user_email,
            "product_id": product_id_str,
            "quantity": max(1, item.quantity),
            "title": title or "Product",
            "price": float(price or 0.0),
            "image": image or "",
            "stock": stock,
            "created_at": now,
            "updated_at": now,
        }
        res = db.cart_items.insert_one(new_doc)
        new_doc["_id"] = res.inserted_id
        return serialize_cart_item(new_doc)

@router.post("/sync", response_model=List[CartItemResponse])
def sync_cart(payload: CartSyncRequest):
    """Merge guest cart items into an authenticated user's cart on login.

    Safe, non-destructive: updates only db.cart_items.
    """
    session_id = payload.session_id.strip() if payload.session_id else None
    user_email = payload.user_email.strip() if payload.user_email else None

    if not session_id or not user_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="session_id and user_email are required for sync"
        )

    now = datetime.utcnow()
    # Find all guest items for this session that aren't yet assigned to an email
    guest_items = list(db.cart_items.find({
        "session_id": session_id,
        "$or": [{"user_email": None}, {"user_email": ""}, {"user_email": {"$exists": False}}]
    }))

    for g_item in guest_items:
        p_id = str(g_item.get("product_id", "")).strip()
        user_item = db.cart_items.find_one({"user_email": user_email, "product_id": p_id})

        prod_doc = None
        if ObjectId.is_valid(p_id):
            prod_doc = db.products.find_one({"_id": ObjectId(p_id)})
        if not prod_doc:
            prod_doc = db.products.find_one({"_id": p_id})

        stock_limit = int(prod_doc.get("stock_count", 99)) if prod_doc else 99

        if user_item:
            # Item already exists in user's cart: add quantities together, clamped to available stock
            merged_qty = min(user_item.get("quantity", 1) + g_item.get("quantity", 1), max(1, stock_limit))
            db.cart_items.update_one(
                {"_id": user_item["_id"]},
                {"$set": {"quantity": merged_qty, "updated_at": now}}
            )
            # Remove guest duplicate
            db.cart_items.delete_one({"_id": g_item["_id"]})
        else:
            # Reassign guest item to the authenticated user, clamped to available stock
            guest_qty = min(g_item.get("quantity", 1), max(1, stock_limit))
            db.cart_items.update_one(
                {"_id": g_item["_id"]},
                {"$set": {"user_email": user_email, "quantity": guest_qty, "updated_at": now}}
            )

    # Return the full hydrated cart for this user
    docs = list(db.cart_items.find({"user_email": user_email}))
    return [serialize_cart_item(doc) for doc in docs]

@router.put("/{identifier}/items/{product_id}")
def update_cart_item_quantity(identifier: str, product_id: str, update: CartItemUpdate):
    """Update item quantity in cart. If quantity <= 0, the item is removed."""
    identifier = identifier.strip()
    product_id_str = product_id.strip()

    query = {
        "$and": [
            {"$or": [{"session_id": identifier}, {"user_email": identifier}]},
            {"product_id": product_id_str}
        ]
    }

    if update.quantity <= 0:
        db.cart_items.delete_many(query)
        return {
            "id": product_id_str,
            "product_id": product_id_str,
            "quantity": 0,
            "message": "Item removed from cart"
        }

    now = datetime.utcnow()
    result = db.cart_items.find_one_and_update(
        query,
        {"$set": {"quantity": update.quantity, "updated_at": now}},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found")

    return serialize_cart_item(result)

@router.delete("/{identifier}/items/{product_id}")
def remove_cart_item(identifier: str, product_id: str):
    """Remove a specific product from cart."""
    identifier = identifier.strip()
    product_id_str = product_id.strip()

    query = {
        "$and": [
            {"$or": [{"session_id": identifier}, {"user_email": identifier}]},
            {"product_id": product_id_str}
        ]
    }

    result = db.cart_items.delete_many(query)
    return {
        "success": True,
        "deleted_count": result.deleted_count,
        "message": "Item removed from cart"
    }

@router.delete("/{identifier}")
def clear_cart(identifier: str):
    """Clear all cart items for a guest session or user email."""
    identifier = identifier.strip()
    query = {"$or": [{"session_id": identifier}, {"user_email": identifier}]}
    result = db.cart_items.delete_many(query)
    return {
        "success": True,
        "deleted_count": result.deleted_count,
        "message": "Cart cleared successfully"
    }

@router.get("/{identifier}", response_model=List[CartItemResponse])
def get_cart(identifier: str):
    """Get all cart items for a given session ID or user email, enriched with product details."""
    identifier = identifier.strip()
    query = {"$or": [{"session_id": identifier}, {"user_email": identifier}]}
    docs = list(db.cart_items.find(query))
    return [serialize_cart_item(doc) for doc in docs]


