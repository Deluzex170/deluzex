from fastapi import APIRouter, HTTPException, Query, status, Depends
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app import models
from app.api import deps
from app.core.database import db
from app.schemas.wishlist import WishlistItemCreate, WishlistItemResponse

router = APIRouter()


def serialize_wishlist_item(doc: dict) -> dict:
    if not doc:
        return {}
    doc_copy = dict(doc)
    doc_copy["id"] = str(doc_copy.pop("_id", ""))
    return doc_copy

@router.get("", response_model=List[WishlistItemResponse])
def get_user_wishlist(
    email: Optional[str] = Query(None),
    current_user: Optional[models.User] = Depends(deps.get_current_user_optional),
):
    """
    Fetch all saved wishlist items for a user from MongoDB.
    Enforces privacy boundaries.
    """
    if current_user and not getattr(current_user, "is_admin", False):
        user_email = (current_user.email or "").strip().lower()
        if email and email.strip().lower() != user_email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access wishlist of another user",
            )
        email_clean = user_email
    else:
        email_clean = email.strip().lower() if email else ""

    if not email_clean:
        return []

    query = {"user_email": email_clean}
    docs = list(db.wishlist_items.find(query).sort("created_at", -1))
    return [WishlistItemResponse(**serialize_wishlist_item(d)) for d in docs]


@router.post("", response_model=WishlistItemResponse, status_code=status.HTTP_201_CREATED)
def add_to_wishlist(
    item_in: WishlistItemCreate,
    current_user: Optional[models.User] = Depends(deps.get_current_user_optional),
):
    """
    Add a product to user's wishlist in MongoDB.
    """
    email_clean = item_in.user_email.strip().lower()

    if current_user and not getattr(current_user, "is_admin", False):
        user_clean = (current_user.email or "").strip().lower()
        if email_clean != user_clean:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot add to wishlist of another user",
            )

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


@router.post("/toggle")
def toggle_wishlist_item(
    item_in: WishlistItemCreate,
    current_user: Optional[models.User] = Depends(deps.get_current_user_optional),
):
    """
    Toggle a product in user's wishlist in MongoDB.
    If already wishlisted -> deletes it and returns {"is_wishlisted": False, "item_id": None}.
    If not wishlisted -> inserts it and returns {"is_wishlisted": True, "item_id": str(id), "item": ...}.
    """
    email_clean = item_in.user_email.strip().lower()

    if current_user and not getattr(current_user, "is_admin", False):
        user_clean = (current_user.email or "").strip().lower()
        if email_clean != user_clean:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot modify wishlist of another user",
            )

    duplicate_query = {"user_email": email_clean}
    if item_in.product_id:
        duplicate_query["product_id"] = str(item_in.product_id).strip()
    else:
        duplicate_query["product_title"] = item_in.product_title

    existing = db.wishlist_items.find_one(duplicate_query)
    if existing:
        db.wishlist_items.delete_one({"_id": existing["_id"]})
        return {
            "success": True,
            "is_wishlisted": False,
            "item_id": None,
            "message": "Item removed from wishlist",
        }
    else:
        doc_data = item_in.model_dump()
        doc_data["user_email"] = email_clean
        doc_data["created_at"] = datetime.utcnow()
        res = db.wishlist_items.insert_one(doc_data)
        created_doc = db.wishlist_items.find_one({"_id": res.inserted_id})
        return {
            "success": True,
            "is_wishlisted": True,
            "item_id": str(res.inserted_id),
            "message": "Item added to wishlist",
            "item": serialize_wishlist_item(created_doc),
        }


@router.delete("/product/{product_id}")
def delete_wishlist_item_by_product_id(
    product_id: str,
    email: str = Query(...),
    current_user: Optional[models.User] = Depends(deps.get_current_user_optional),
):
    """
    Remove an item from MongoDB wishlist by product_id and user_email.
    """
    email_clean = email.strip().lower()
    if current_user and not getattr(current_user, "is_admin", False):
        user_clean = (current_user.email or "").strip().lower()
        if email_clean != user_clean:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete wishlist item of another user",
            )

    result = db.wishlist_items.delete_many({
        "user_email": email_clean,
        "$or": [
            {"product_id": product_id},
            {"product_id": str(product_id)},
        ]
    })
    return {"success": True, "deleted_count": result.deleted_count, "message": "Item removed from wishlist"}


@router.get("/check")
def check_wishlist_status(
    email: str = Query(...),
    product_id: Optional[str] = Query(None),
    product_title: Optional[str] = Query(None),
    current_user: Optional[models.User] = Depends(deps.get_current_user_optional),
):
    """
    Check if a product is in the user's wishlist.
    """
    email_clean = email.strip().lower()
    if current_user and not getattr(current_user, "is_admin", False):
        user_clean = (current_user.email or "").strip().lower()
        if email_clean != user_clean:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to check wishlist of another user",
            )

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
def delete_wishlist_item(
    item_id: str,
    current_user: Optional[models.User] = Depends(deps.get_current_user_optional),
):
    """
    Remove an item from MongoDB wishlist.
    """
    if not ObjectId.is_valid(item_id):
        raise HTTPException(status_code=400, detail="Invalid wishlist item ID format")

    existing = db.wishlist_items.find_one({"_id": ObjectId(item_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Wishlist item not found")

    if current_user and not getattr(current_user, "is_admin", False):
        user_clean = (current_user.email or "").strip().lower()
        item_email = (existing.get("user_email") or "").strip().lower()
        if item_email != user_clean:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete wishlist item of another user",
            )

    db.wishlist_items.delete_one({"_id": ObjectId(item_id)})
    return {"success": True, "message": "Item removed from wishlist"}


@router.delete("")
def clear_user_wishlist(
    email: str = Query(...),
    current_user: Optional[models.User] = Depends(deps.get_current_user_optional),
):
    """
    Clear all items in user's wishlist.
    """
    email_clean = email.strip().lower()
    if current_user and not getattr(current_user, "is_admin", False):
        user_clean = (current_user.email or "").strip().lower()
        if email_clean != user_clean:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to clear wishlist of another user",
            )

    db.wishlist_items.delete_many({"user_email": email_clean})
    return {"success": True, "message": "Wishlist cleared successfully"}
