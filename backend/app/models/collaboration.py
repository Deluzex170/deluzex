from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from app.models.common import PyObjectId

class CollaborationSubmission(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str
    email: EmailStr
    phone: Optional[str] = None
    city: Optional[str] = None
    role: Optional[str] = None
    studio_or_college: Optional[str] = None
    has_made_before: Optional[str] = "no"
    concept_title: str
    description: Optional[str] = None
    portfolio_link: Optional[str] = None
    file_url: Optional[str] = None
    status: str = "pending"  # "pending", "reviewed", "shortlisted", "archived"
    source: str = "collaborate_page"  # "collaborate_page" or "homepage_modal"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
