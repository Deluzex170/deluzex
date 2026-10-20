from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, status, Depends
from pydantic import BaseModel, Field

from app import models
from app.api import deps
from app.core.database import db

router = APIRouter()

class InquiryStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="Status must be one of: new, contacted, resolved, archived")

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
        term = search.strip()
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
def create_contact(contact: models.ContactMessage):
    data = contact.model_dump(by_alias=True, exclude_none=True)
    if "status" not in data:
        data["status"] = "new"
    result = db.contacts.insert_one(data)
    contact.id = str(result.inserted_id)
    return contact

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
