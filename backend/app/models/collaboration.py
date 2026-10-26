from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime
from app.models.common import PyObjectId

class CollaborationSubmission(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=20)
    city: Optional[str] = Field(default=None, max_length=100)
    role: Optional[str] = Field(default=None, max_length=100)
    studio_or_college: Optional[str] = Field(default=None, max_length=200)
    has_made_before: Optional[str] = Field(default="no", max_length=10)
    concept_title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    portfolio_link: Optional[str] = Field(default=None, max_length=1000)
    file_url: Optional[str] = Field(default=None, max_length=1000)
    status: str = Field(default="pending", max_length=50)  # "pending", "reviewed", "shortlisted", "archived"
    source: str = Field(default="collaborate_page", max_length=50)  # "collaborate_page" or "homepage_modal"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
