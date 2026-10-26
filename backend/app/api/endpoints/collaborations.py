import re
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, Form, Body, status
from typing import Dict, Any, List, Optional
from datetime import datetime
from bson import ObjectId
from app import models
from app.api.deps import get_current_active_admin
from app.services.imagekit import upload_image_to_imagekit
from app.core.database import db
from app.core.sanitizer import sanitize_text, sanitize_phone, sanitize_search_term

router = APIRouter()

@router.post("")
async def create_collaboration_submission(
    request: Request,
    file: Optional[UploadFile] = File(None),
    name: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    city: Optional[str] = Form(None),
    role: Optional[str] = Form(None),
    studio_or_college: Optional[str] = Form(None),
    has_made_before: Optional[str] = Form("no"),
    concept_title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    portfolio_link: Optional[str] = Form(None),
    source: Optional[str] = Form("collaborate_page"),
):
    """
    Submit a lighting concept / design collaboration request.
    Supports multipart/form-data with file upload or JSON payload.
    """
    content_type = request.headers.get("content-type", "")

    file_url = None
    if file and file.filename:
        try:
            file_url = await upload_image_to_imagekit(file, folder="/collaborations")
        except Exception as e:
            print(f"Error uploading collaboration file: {e}")

    # Case 1: Multipart form submission
    if "multipart/form-data" in content_type:
        if not name or not email or not concept_title:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Name, email, and concept title are required.",
            )

        doc = {
            "name": sanitize_text(name, max_len=100),
            "email": email.strip().lower(),
            "phone": sanitize_phone(phone) if phone else None,
            "city": sanitize_text(city, max_len=100) if city else None,
            "role": sanitize_text(role, max_len=100) if role else None,
            "studio_or_college": sanitize_text(studio_or_college, max_len=200) if studio_or_college else None,
            "has_made_before": sanitize_text(has_made_before, max_len=10) if has_made_before else "no",
            "concept_title": sanitize_text(concept_title, max_len=200),
            "description": sanitize_text(description, max_len=5000) if description else None,
            "portfolio_link": sanitize_text(portfolio_link, max_len=1000) if portfolio_link else None,
            "file_url": file_url,
            "status": "pending",
            "source": sanitize_text(source, max_len=50) if source else "collaborate_page",
            "created_at": datetime.utcnow(),
        }
    else:
        # Case 2: JSON payload
        try:
            body = await request.json()
        except Exception:
            body = {}

        if not body.get("name") or not body.get("email") or not body.get("concept_title"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Name, email, and concept title are required.",
            )

        doc = {
            "name": sanitize_text(str(body.get("name", "")), max_len=100),
            "email": str(body.get("email", "")).strip().lower(),
            "phone": sanitize_phone(str(body.get("phone", ""))) if body.get("phone") else None,
            "city": sanitize_text(str(body.get("city", "")), max_len=100) if body.get("city") else None,
            "role": sanitize_text(str(body.get("role", "")), max_len=100) if body.get("role") else None,
            "studio_or_college": sanitize_text(str(body.get("studio_or_college", "")), max_len=200) if body.get("studio_or_college") else None,
            "has_made_before": sanitize_text(str(body.get("has_made_before", "no")), max_len=10),
            "concept_title": sanitize_text(str(body.get("concept_title", "")), max_len=200),
            "description": sanitize_text(str(body.get("description", "")), max_len=5000) if body.get("description") else None,
            "portfolio_link": sanitize_text(str(body.get("portfolio_link", "")), max_len=1000) if body.get("portfolio_link") else None,
            "file_url": body.get("file_url") or file_url,
            "status": "pending",
            "source": sanitize_text(str(body.get("source", "homepage_modal")), max_len=50),
            "created_at": datetime.utcnow(),
        }

    result = db.collaborations.insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    return {
        "success": True,
        "id": str(result.inserted_id),
        "message": "Concept submitted successfully! Our design curation panel will review it.",
        "data": doc,
    }

@router.get("")
def get_collaborations(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = None,
    role_filter: Optional[str] = None,
    search: Optional[str] = None,
    current_user: models.User = Depends(get_current_active_admin),
):
    """
    Get all collaboration submissions with filtering, search, and pagination (Admin only).
    """
    query: Dict[str, Any] = {}

    if status_filter and status_filter.lower() != "all":
        query["status"] = status_filter.lower()

    if role_filter and role_filter.lower() != "all":
        query["role"] = role_filter

    if search and search.strip():
        term = sanitize_search_term(search)
        regex = {"$regex": term, "$options": "i"}
        query["$or"] = [
            {"name": regex},
            {"email": regex},
            {"concept_title": regex},
            {"studio_or_college": regex},
            {"city": regex},
        ]

    total = db.collaborations.count_documents(query)
    docs = list(db.collaborations.find(query).sort("created_at", -1).skip(skip).limit(limit))

    items = []
    for doc in docs:
        doc["_id"] = str(doc["_id"])
        items.append(doc)

    return {
        "total": total,
        "items": items,
        "skip": skip,
        "limit": limit,
    }

@router.get("/{submission_id}")
def get_collaboration_by_id(
    submission_id: str,
    current_user: models.User = Depends(get_current_active_admin),
):
    """
    Get a single collaboration submission by ID (Admin only).
    """
    try:
        obj_id = ObjectId(submission_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid submission ID format")

    doc = db.collaborations.find_one({"_id": obj_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Collaboration submission not found")

    doc["_id"] = str(doc["_id"])
    return doc

@router.patch("/{submission_id}/status")
def update_collaboration_status(
    submission_id: str,
    payload: Dict[str, str] = Body(...),
    current_user: models.User = Depends(get_current_active_admin),
):
    """
    Update collaboration status (pending, reviewed, shortlisted, archived) (Admin only).
    """
    try:
        obj_id = ObjectId(submission_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid submission ID format")

    new_status = payload.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Status is required")

    result = db.collaborations.update_one(
        {"_id": obj_id},
        {"$set": {"status": new_status.lower(), "updated_at": datetime.utcnow()}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Collaboration submission not found")

    return {"success": True, "status": new_status.lower(), "id": submission_id}

@router.delete("/{submission_id}")
def delete_collaboration(
    submission_id: str,
    current_user: models.User = Depends(get_current_active_admin),
):
    """
    Delete a collaboration submission (Admin only).
    """
    try:
        obj_id = ObjectId(submission_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid submission ID format")

    result = db.collaborations.delete_one({"_id": obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Collaboration submission not found")

    return {"success": True, "id": submission_id}
