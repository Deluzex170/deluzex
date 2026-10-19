from fastapi import APIRouter, HTTPException, status
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
from app import models
from app.models.review import Review, ReviewCreate
from app.core.database import db

router = APIRouter()

def calculate_stats(product_id: str) -> Dict[str, Any]:
    """Calculate summary rating stats including breakdown counts and percentages."""
    reviews_cursor = list(db.reviews.find({"product_id": str(product_id)}).sort("created_at", -1))
    
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

@router.get("", response_model=Dict[str, Any])
def get_product_reviews(product_id: str):
    """
    Fetch all reviews and aggregate rating breakdown for a product.
    Reading reviews never creates review records.
    """
    return calculate_stats(product_id)

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
        
    rating = max(1, min(5, int(payload.rating)))
    
    review_doc = {
        "product_id": str(payload.product_id),
        "author_name": payload.author_name.strip(),
        "author_email": payload.author_email.strip() if payload.author_email else None,
        "rating": rating,
        "title": payload.title.strip() if payload.title else None,
        "text": payload.text.strip(),
        "created_at": datetime.utcnow()
    }
    
    result = db.reviews.insert_one(review_doc)
    
    # Recalculate stats
    stats = calculate_stats(payload.product_id)
    
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
