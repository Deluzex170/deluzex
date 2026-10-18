from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CartItemCreate(BaseModel):
    session_id: Optional[str] = None
    user_email: Optional[str] = None
    product_id: str
    quantity: int = 1
    title: Optional[str] = None
    price: Optional[float] = None
    image: Optional[str] = None

class CartItemUpdate(BaseModel):
    quantity: int

class CartSyncRequest(BaseModel):
    session_id: str
    user_email: str

class CartItemResponse(BaseModel):
    id: str
    product_id: str
    title: str
    price: float
    image: str
    quantity: int
    stock: Optional[int] = 99
    session_id: Optional[str] = None
    user_email: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True

