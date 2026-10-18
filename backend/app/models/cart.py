from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.common import PyObjectId

class CartItem(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    session_id: Optional[str] = None
    user_email: Optional[str] = None
    product_id: str
    quantity: int = 1
    title: Optional[str] = "Product"
    price: Optional[float] = 0.0
    image: Optional[str] = ""
    stock: Optional[int] = 99
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True

