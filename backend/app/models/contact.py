from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from app.models.common import PyObjectId
from datetime import datetime

class ContactMessage(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: Optional[str] = Field(default=None, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=20)
    message: str = Field(..., min_length=2, max_length=3000)
    status: str = Field(default="new")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True

class ContactMessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Optional[str] = Field(default=None, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=20)
    message: str = Field(..., min_length=2, max_length=3000)
