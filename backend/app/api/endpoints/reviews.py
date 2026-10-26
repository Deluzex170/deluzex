import re
from fastapi import APIRouter, HTTPException, Query, status, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel, Field, ConfigDict

from app import models
from app.api import deps
from app.models.review import Review, ReviewCreate
from app.core.database import db
from app.core.sanitizer import sanitize_text, sanitize_search_term

router = APIRouter()

class ReviewApprovalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_approved: bool

def calculate_stats(product_id: str, only_approved: bool = True) -> Dict[str, Any]:
    """Calculate summary rating stats including breakdown counts and percentages."""
    query: Dict[str, Any] = {"product_id": str(product_id)}
    if only_approved:
        query["is_approved"] = {"$ne": False}

    reviews_cursor = list(db.reviews.find(query).sort("created_at", -1))
    
    base_counts = {star: 0 for star in range(1, 6)}

    breakdown = {
        5: {"count": base_counts[5], "pct": 0},
        4: {"count": base_counts[4], "pct": 0},
        3: {"count": base_counts[3], "pct": 0},
        2: {"count": base_counts[2], "pct": 0},
        1: {"count": base_counts[1], "pct": 0},
    }
    
    total_rating_sum = sum(star * count for star, count in base_counts.items())
    total_reviews = sum(base_counts.values())
    
    for r in reviews_cursor:
        star = int(r.get("rating", 5))
        if 1 <= star <= 5:
            breakdown[star]["count"] += 1
            total_rating_sum += star
            total_reviews += 1
            
    avg = round(total_rating_sum / total_reviews, 1) if total_reviews > 0 else 0.0
    
    for s in [1, 2, 3, 4, 5]:
        breakdown[s]["pct"] = round((breakdown[s]["count"] / total_reviews) * 100) if total_reviews > 0 else 0
        
    formatted_reviews = []
    for r in reviews_cursor:
        item = dict(r)
        item["id"] = str(item.pop("_id"))
        formatted_reviews.append(item)
        
    return {
        "average_rating": avg,
        "total_reviews": total_reviews,
        "breakdown": breakdown,
        "reviews": formatted_reviews
    }

@router.get("/stats")
def get_review_stats(admin: models.User = Depends(deps.get_current_active_admin)):
    """Get aggregated statistics across all reviews for admin moderation (Admin only)."""
    total = db.reviews.count_documents({})
    approved = db.reviews.count_documents({"is_approved": {"$ne": False}})
    pending = db.reviews.count_documents({"is_approved": False})
    
    pipeline = [
        {"$match": {"is_approved": {"$ne": False}}},
        {"$group": {"_id": None, "avg_rating": {"$avg": "$rating"}}}
    ]
    avg_res = list(db.reviews.aggregate(pipeline))
    avg_rating = round(avg_res[0]["avg_rating"], 1) if avg_res and avg_res[0].get("avg_rating") else 0.0

    return {
        "total": total,
        "approved": approved,
        "pending": pending,
        "average_rating": avg_rating
    }

@router.get("/all")
def get_all_reviews_admin(
    status: Optional[str] = Query(None, description="all, approved, pending"),
    search: Optional[str] = Query(None, description="Search by author, email, title, or review text"),
    product_id: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Fetch all reviews across products for admin moderation with product metadata lookup (Admin only).
    """
    query: Dict[str, Any] = {}
    if status == "approved":
        query["is_approved"] = {"$ne": False}
    elif status == "pending" or status == "unapproved":
        query["is_approved"] = False

    if product_id:
        query["product_id"] = str(product_id)

    if search and search.strip():
        term = sanitize_search_term(search)
        query["$or"] = [
            {"author_name": {"$regex": term, "$options": "i"}},
            {"author_email": {"$regex": term, "$options": "i"}},
            {"title": {"$regex": term, "$options": "i"}},
            {"text": {"$regex": term, "$options": "i"}},
        ]

    reviews_cursor = list(db.reviews.find(query).sort("created_at", -1).skip(skip).limit(limit))

    # Batch lookup product details
    raw_pids = [str(r.get("product_id")) for r in reviews_cursor if r.get("product_id")]
    product_map = {}
    obj_ids = []
    str_ids = []
    for pid in set(raw_pids):
        if ObjectId.is_valid(pid):
            obj_ids.append(ObjectId(pid))
        else:
            str_ids.append(pid)

    query_prods = []
    if obj_ids:
        query_prods.append({"_id": {"$in": obj_ids}})
    if str_ids:
        query_prods.append({"slug": {"$in": str_ids}})
        query_prods.append({"sku": {"$in": str_ids}})

    if query_prods:
        prods = db.products.find(
            {"$or": query_prods} if len(query_prods) > 1 else query_prods[0],
            {
                "_id": 1,
                "slug": 1,
                "sku": 1,
                "product_title": 1,
                "product_name": 1,
                "title": 1,
                "product_main_image": 1,
                "product_images": 1,
                "image": 1,
                "images": 1,
            }
        )
        for p in prods:
            name_val = p.get("product_title") or p.get("product_name") or p.get("title") or "Unnamed Product"
            img_val = p.get("product_main_image") or p.get("image")
            if not img_val and p.get("product_images") and len(p.get("product_images")) > 0:
                img_val = p.get("product_images")[0]
            elif not img_val and p.get("images") and len(p.get("images")) > 0:
                img_val = p.get("images")[0]

            item_data = {"name": name_val, "image": img_val}
            product_map[str(p["_id"])] = item_data
            if p.get("slug"):
                product_map[p["slug"]] = item_data
            if p.get("sku"):
                product_map[p["sku"]] = item_data

    formatted = []
    for r in reviews_cursor:
        item = dict(r)
        item["id"] = str(item.pop("_id"))
        if "is_approved" not in item:
            item["is_approved"] = True
        pid = item.get("product_id")
        item["product"] = product_map.get(str(pid), {
            "name": f"Product #{pid[:8]}" if pid else "Unknown Product",
            "image": None
        })
        formatted.append(item)

    return formatted

@router.patch("/{review_id}/approval")
def update_review_approval(
    review_id: str,
    payload: ReviewApprovalRequest,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Approve or reject/hide a customer review. Recalculates product average rating and count (Admin only).
    """
    try:
        obj_id = ObjectId(review_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid review ID")

    review = db.reviews.find_one({"_id": obj_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    db.reviews.update_one({"_id": obj_id}, {"$set": {"is_approved": payload.is_approved}})

    # Recalculate stats for product
    product_id = review.get("product_id")
    if product_id:
        stats = calculate_stats(product_id, only_approved=True)
        try:
            db.products.update_one(
                {"_id": ObjectId(product_id)},
                {"$set": {
                    "product_rating": stats["average_rating"],
                    "review_count": stats["total_reviews"]
                }}
            )
        except Exception:
            pass

    updated = db.reviews.find_one({"_id": obj_id})
    updated["id"] = str(updated.pop("_id"))
    return {"message": "Review approval status updated", "review": updated}

@router.delete("/{review_id}")
def delete_review(
    review_id: str,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Delete a review permanently. Recalculates product average rating and count (Admin only).
    """
    try:
        obj_id = ObjectId(review_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid review ID")

    review = db.reviews.find_one({"_id": obj_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    db.reviews.delete_one({"_id": obj_id})

    product_id = review.get("product_id")
    if product_id:
        stats = calculate_stats(product_id, only_approved=True)
        try:
            db.products.update_one(
                {"_id": ObjectId(product_id)},
                {"$set": {
                    "product_rating": stats["average_rating"],
                    "review_count": stats["total_reviews"]
                }}
            )
        except Exception:
            pass

    return {"message": "Review deleted successfully"}

@router.get("", response_model=Dict[str, Any])
def get_product_reviews(product_id: str):
    """
    Fetch all approved reviews and aggregate rating breakdown for a product.
    Reading reviews never creates review records.
    """
    return calculate_stats(product_id, only_approved=True)

@router.post("", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
def submit_product_review(payload: ReviewCreate):
    """
    Submit a new customer review for a product.
    Updates the aggregate product rating and recalculates the rating breakdown chart.
    """
    if not payload.product_id:
        raise HTTPException(status_code=400, detail="product_id is required")
        
    if not payload.author_name or not payload.author_name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
        
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="Review comment is required")
        
    clean_author_name = sanitize_text(payload.author_name, max_len=100)
    clean_title = sanitize_text(payload.title, max_len=200) if payload.title else None
    clean_text = sanitize_text(payload.text, max_len=5000)
    clean_email = payload.author_email.strip().lower() if payload.author_email else None
    rating = max(1, min(5, int(payload.rating)))
    
    review_doc = {
        "product_id": str(payload.product_id),
        "author_name": clean_author_name,
        "author_email": clean_email,
        "rating": rating,
        "title": clean_title,
        "text": clean_text,
        "is_approved": True,
        "created_at": datetime.utcnow()
    }
    
    result = db.reviews.insert_one(review_doc)
    
    # Recalculate stats
    stats = calculate_stats(payload.product_id, only_approved=True)
    
    # Update product document if exists
    try:
        obj_id = ObjectId(payload.product_id)
        db.products.update_one(
            {"_id": obj_id},
            {"$set": {
                "product_rating": stats["average_rating"],
                "review_count": stats["total_reviews"]
            }}
        )
    except Exception:
        pass
        
    created_review = dict(review_doc)
    created_review["id"] = str(result.inserted_id)
    created_review.pop("_id", None)
    
    return {
        "message": "Review submitted successfully",
        "review": created_review,
        "stats": stats
    }
