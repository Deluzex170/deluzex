from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.common import PyObjectId

class FAQItem(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    question: str
    answer: str
    category: str = "collaborate"  # "collaborate", "support", "general"
    sequence: int = 1
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
