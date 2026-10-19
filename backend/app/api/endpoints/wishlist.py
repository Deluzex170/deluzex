from fastapi import APIRouter, HTTPException, Query, status
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app.core.database import db
from app.schemas.wishlist import WishlistItemCreate, WishlistItemResponse

router = APIRouter()


def serialize_wishlist_item(doc: dict) -> dict:
    if not doc:
        return {}
    doc_copy = dict(doc)
    doc_copy["id"] = str(doc_copy.get("_id", ""))
    return doc_copy

@router.get("", response_model=List[WishlistItemResponse])
def get_user_wishlist(email: Optional[str] = Query(None)):
    """
    Fetch all saved wishlist items for a user from MongoDB.
    """
    email_clean = email.strip().lower() if email else ""
    if not email_clean:
        return []
    query = {"user_email": email_clean}

    docs = list(db.wishlist_items.find(query).sort("created_at", -1))
    return [WishlistItemResponse(**serialize_wishlist_item(d)) for d in docs]


@router.post("", response_model=WishlistItemResponse, status_code=status.HTTP_201_CREATED)
def add_to_wishlist(item_in: WishlistItemCreate):
    """
    Add a product to user's wishlist in MongoDB.
    """
    email_clean = item_in.user_email.strip().lower()

    # Check for duplicate
    duplicate_query = {"user_email": email_clean}
    if item_in.product_id:
        duplicate_query["product_id"] = item_in.product_id
    else:
        duplicate_query["product_title"] = item_in.product_title

    existing = db.wishlist_items.find_one(duplicate_query)
    if existing:
        return WishlistItemResponse(**serialize_wishlist_item(existing))

    doc_data = item_in.model_dump()
    doc_data["user_email"] = email_clean
    doc_data["created_at"] = datetime.utcnow()

    res = db.wishlist_items.insert_one(doc_data)
    created_doc = db.wishlist_items.find_one({"_id": res.inserted_id})
    return WishlistItemResponse(**serialize_wishlist_item(created_doc))


@router.get("/check")
def check_wishlist_status(
    email: str = Query(...),
    product_id: Optional[str] = Query(None),
    product_title: Optional[str] = Query(None),
):
    """
    Check if a product is in the user's wishlist.
    """
    email_clean = email.strip().lower()
    query = {"user_email": email_clean}

    if product_id:
        query["product_id"] = product_id
    elif product_title:
        query["product_title"] = product_title
    else:
        return {"is_wishlisted": False, "item_id": None}

    doc = db.wishlist_items.find_one(query)
    if doc:
        return {"is_wishlisted": True, "item_id": str(doc["_id"])}
    return {"is_wishlisted": False, "item_id": None}


@router.delete("/{item_id}")
def delete_wishlist_item(item_id: str):
    """
    Remove an item from MongoDB wishlist.
    """
    if not ObjectId.is_valid(item_id):
        raise HTTPException(status_code=400, detail="Invalid wishlist item ID format")

    existing = db.wishlist_items.find_one({"_id": ObjectId(item_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Wishlist item not found")

    db.wishlist_items.delete_one({"_id": ObjectId(item_id)})
    return {"success": True, "message": "Item removed from wishlist"}


@router.delete("")
def clear_user_wishlist(email: str = Query(...)):
    """
    Clear all items in user's wishlist.
    """
    email_clean = email.strip().lower()
    db.wishlist_items.delete_many({"user_email": email_clean})
    return {"success": True, "message": "Wishlist cleared successfully"}
