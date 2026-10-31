import re
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, status, Depends, BackgroundTasks
from pydantic import BaseModel, Field, ConfigDict

from app import models
from app.api import deps
from app.core.database import db
from app.core.sanitizer import sanitize_text, sanitize_search_term, sanitize_phone
from app.services.email import (
    send_contact_inquiry_notification,
    send_support_ticket_notification,
)

router = APIRouter()

class InquiryStatusUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: str = Field(..., description="Status must be one of: new, contacted, resolved, archived")

class SupportTicketCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    subject: str = Field(..., max_length=200, description="Subject of the support ticket")
    message: str = Field(..., max_length=5000, description="Detailed inquiry message")
    name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=30)

@router.get("", response_model=List[models.ContactMessage])
def read_contacts(
    status: Optional[str] = Query(None, description="Filter by status: new, contacted, resolved, archived"),
    search: Optional[str] = Query(None, description="Search by name, email, phone or message"),
    skip: int = 0,
    limit: int = 100,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    query = {}
    if status and status != "all":
        query["status"] = status.lower()

    if search and search.strip():
        term = sanitize_search_term(search)
        query["$or"] = [
            {"name": {"$regex": term, "$options": "i"}},
            {"email": {"$regex": term, "$options": "i"}},
            {"phone": {"$regex": term, "$options": "i"}},
            {"message": {"$regex": term, "$options": "i"}},
        ]

    docs = list(db.contacts.find(query).sort("created_at", -1).skip(skip).limit(limit))
    results = []
    for doc in docs:
        if "status" not in doc:
            doc["status"] = "new"
        results.append(models.ContactMessage(**doc))
    return results

@router.get("/stats")
def read_contact_stats(admin: models.User = Depends(deps.get_current_active_admin)):
    total = db.contacts.count_documents({})
    new_count = db.contacts.count_documents({"$or": [{"status": "new"}, {"status": {"$exists": False}}]})
    contacted_count = db.contacts.count_documents({"status": "contacted"})
    resolved_count = db.contacts.count_documents({"status": "resolved"})
    archived_count = db.contacts.count_documents({"status": "archived"})
    return {
        "total": total,
        "new": new_count,
        "contacted": contacted_count,
        "resolved": resolved_count,
        "archived": archived_count,
    }

@router.post("", response_model=models.ContactMessage)
def create_contact(
    contact: models.ContactMessageCreate,
    background_tasks: BackgroundTasks,
):
    clean_name = sanitize_text(contact.name, max_len=100) if contact.name else None
    clean_phone = sanitize_phone(contact.phone) if contact.phone else None
    clean_message = sanitize_text(contact.message, max_len=3000)
    clean_email = str(contact.email).strip().lower()

    data = {
        "name": clean_name,
        "email": clean_email,
        "phone": clean_phone,
        "message": clean_message,
        "status": "new",
        "created_at": datetime.utcnow(),
    }
    result = db.contacts.insert_one(data)
    data["_id"] = result.inserted_id

    # Send notification email to admin (settings.ADMIN_INQUIRY_EMAIL) and auto-reply to customer
    background_tasks.add_task(send_contact_inquiry_notification, data)

    return models.ContactMessage(**data)

@router.post("/support")
def create_support_ticket(
    ticket_in: SupportTicketCreate,
    background_tasks: BackgroundTasks,
    current_user: Optional[models.User] = Depends(deps.get_current_user_optional),
):
    """
    Submit a Support & Concierge query from /dashboard/support.
    Saves inquiry to DB and sends an email to settings.ADMIN_INQUIRY_EMAIL.
    """
    user_name = ticket_in.name or (
        f"{getattr(current_user, 'first_name', '') or ''} {getattr(current_user, 'last_name', '') or ''}".strip()
        if current_user else ""
    ) or "Valued Client"
    user_email = (ticket_in.email or (current_user.email if current_user else "") or "").strip().lower()
    user_phone = ticket_in.phone or (getattr(current_user, "phone", None) if current_user else None)

    clean_subject = sanitize_text(ticket_in.subject, max_len=200)
    clean_message = sanitize_text(ticket_in.message, max_len=5000)

    doc = {
        "type": "support_ticket",
        "name": sanitize_text(user_name, max_len=100),
        "email": user_email if user_email else None,
        "phone": sanitize_phone(user_phone) if user_phone else None,
        "subject": clean_subject,
        "message": f"[Subject: {clean_subject}]\n\n{clean_message}",
        "status": "new",
        "created_at": datetime.utcnow(),
    }
    res = db.contacts.insert_one(doc)
    doc["_id"] = str(res.inserted_id)

    # Email notification to admin (settings.ADMIN_INQUIRY_EMAIL) and auto-reply to client
    background_tasks.add_task(send_support_ticket_notification, {
        "name": doc["name"],
        "email": doc["email"],
        "phone": doc["phone"],
        "subject": clean_subject,
        "message": clean_message,
        "ticket_id": str(res.inserted_id),
    })

    return {
        "success": True,
        "message": "Inquiry received! Our concierge team will reach out within 2 hours.",
        "ticket_id": str(res.inserted_id),
        "data": doc,
    }

@router.patch("/{id}/status", response_model=models.ContactMessage)
def update_contact_status(
    id: str,
    payload: InquiryStatusUpdateRequest,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    valid_statuses = ["new", "contacted", "resolved", "archived"]
    normalized_status = payload.status.strip().lower()
    if normalized_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{payload.status}'. Must be one of: {', '.join(valid_statuses)}"
        )

    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid inquiry ID format")

    now = datetime.utcnow()
    res = db.contacts.find_one_and_update(
        {"_id": obj_id},
        {"$set": {"status": normalized_status, "updated_at": now}},
        return_document=True
    )
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inquiry message not found")

    return models.ContactMessage(**res)

@router.delete("/{id}")
def delete_contact(
    id: str,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    try:
        obj_id = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid inquiry ID format")

    res = db.contacts.delete_one({"_id": obj_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inquiry message not found")

    return {"success": True, "message": "Inquiry deleted successfully"}
