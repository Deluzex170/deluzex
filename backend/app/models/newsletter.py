from pydantic import BaseModel, EmailStr, Field, ConfigDict
from datetime import datetime
from typing import Optional
from app.models.common import PyObjectId

class NewsletterSubscriber(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    email: EmailStr
    subscribed_at: datetime = Field(default_factory=datetime.utcnow)
    is_notified: bool = Field(default=False)
    notified_at: Optional[datetime] = None
    source: Optional[str] = Field(default="coming_soon", max_length=100)

    class Config:
        populate_by_name = True

class NewsletterSubscriberCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    source: Optional[str] = Field(default="coming_soon", max_length=100)
