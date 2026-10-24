from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from app.models.common import PyObjectId

class Review(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    product_id: str
    author_name: str
    author_email: Optional[str] = None
    rating: int = Field(default=5, ge=1, le=5)
    title: Optional[str] = None
    text: str
    is_approved: bool = Field(default=True)
    created_at: Optional[datetime] = None

    class Config:
        populate_by_name = True

class ReviewCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    product_id: str = Field(..., min_length=1, max_length=100)
    author_name: str = Field(..., min_length=1, max_length=100)
    author_email: Optional[str] = Field(default=None, max_length=255)
    rating: int = Field(default=5, ge=1, le=5)
    title: Optional[str] = Field(default=None, max_length=200)
    text: str = Field(..., min_length=2, max_length=5000)
