import io
import csv
import re
from fastapi import APIRouter, HTTPException, Query, status, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict
from bson import ObjectId
from app import models
from app.api import deps
from app.core.database import db
from app.core.sanitizer import sanitize_search_term, sanitize_text
from datetime import datetime
from typing import Optional, List, Dict, Any

router = APIRouter()

class SubscriberNotifiedUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_notified: bool

@router.post("/subscribe")
def subscribe_newsletter(subscriber: models.NewsletterSubscriberCreate):
    email = str(subscriber.email).strip().lower()
    
    # Check if already subscribed
    existing = db.newsletter_subscribers.find_one({"email": email})
    if existing:
        return {
            "status": "already_subscribed",
            "message": "You're already subscribed. We'll notify you once we go live.",
            "email": email,
            "subscribed_at": existing.get("subscribed_at")
        }
    
    doc = {
        "email": email,
        "subscribed_at": datetime.utcnow(),
        "is_notified": False,
        "notified_at": None,
        "source": subscriber.source or "coming_soon"
    }
    
    result = db.newsletter_subscribers.insert_one(doc)
    doc_id = str(result.inserted_id)
    
    return {
        "status": "success",
        "message": "Thank you. We will notify you as soon as we launch.",
        "subscriber": {
            "id": doc_id,
            "email": email,
            "subscribed_at": doc["subscribed_at"].isoformat(),
            "is_notified": False,
            "source": doc["source"]
        }
    }

@router.get("/subscribers")
def get_subscribers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    notified: Optional[bool] = None,
    search: Optional[str] = None,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    query: Dict[str, Any] = {}
    if notified is not None:
        query["is_notified"] = notified

    if search and search.strip():
        term = sanitize_search_term(search)
        query["$or"] = [
            {"email": {"$regex": term, "$options": "i"}},
            {"source": {"$regex": term, "$options": "i"}}
        ]
        
    total_count = db.newsletter_subscribers.count_documents({})
    pending_count = db.newsletter_subscribers.count_documents({"is_notified": False})
    notified_count = db.newsletter_subscribers.count_documents({"is_notified": True})
    
    cursor = db.newsletter_subscribers.find(query).sort("subscribed_at", -1).skip(skip).limit(limit)
    subscribers = []
    for doc in cursor:
        doc["id"] = str(doc.get("_id", ""))
        doc["_id"] = str(doc.get("_id", ""))
        if isinstance(doc.get("subscribed_at"), datetime):
            doc["subscribed_at"] = doc["subscribed_at"].isoformat()
        if isinstance(doc.get("notified_at"), datetime):
            doc["notified_at"] = doc["notified_at"].isoformat()
        subscribers.append(doc)
        
    return {
        "total": total_count,
        "pending": pending_count,
        "notified": notified_count,
        "subscribers": subscribers
    }

@router.patch("/subscribers/{subscriber_id}/notified")
def update_subscriber_notified(
    subscriber_id: str,
    payload: SubscriberNotifiedUpdateRequest,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    try:
        obj_id = ObjectId(subscriber_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid subscriber ID")

    sub = db.newsletter_subscribers.find_one({"_id": obj_id})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscriber not found")

    update_fields = {"is_notified": payload.is_notified}
    if payload.is_notified:
        update_fields["notified_at"] = datetime.utcnow()
    else:
        update_fields["notified_at"] = None

    db.newsletter_subscribers.update_one({"_id": obj_id}, {"$set": update_fields})
    updated = db.newsletter_subscribers.find_one({"_id": obj_id})
    updated["id"] = str(updated.pop("_id"))
    return {"message": "Subscriber notification status updated", "subscriber": updated}

@router.delete("/subscribers/{subscriber_id}")
def delete_subscriber(
    subscriber_id: str,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    try:
        obj_id = ObjectId(subscriber_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid subscriber ID")

    res = db.newsletter_subscribers.delete_one({"_id": obj_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subscriber not found")

    return {"message": "Subscriber removed successfully"}

@router.get("/export-csv")
def export_subscribers_csv(admin: models.User = Depends(deps.get_current_active_admin)):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Email", "Subscribed At (UTC)", "Is Notified", "Notified At", "Source"])
    
    cursor = db.newsletter_subscribers.find({}).sort("subscribed_at", -1)
    for doc in cursor:
        writer.writerow([
            str(doc.get("_id", "")),
            doc.get("email", ""),
            str(doc.get("subscribed_at", "")),
            doc.get("is_notified", False),
            str(doc.get("notified_at", "") or ""),
            doc.get("source", "coming_soon")
        ])
        
    output.seek(0)
    filename = f"deluzex_subscribers_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
