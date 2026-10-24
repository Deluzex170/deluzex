from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class CartItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: Optional[str] = Field(default=None, max_length=128)
    user_email: Optional[str] = Field(default=None, max_length=255)
    product_id: str = Field(..., min_length=1, max_length=100)
    quantity: int = Field(default=1, ge=1, le=100)
    title: Optional[str] = Field(default=None, max_length=255)
    price: Optional[float] = Field(default=None, ge=0)
    image: Optional[str] = Field(default=None, max_length=1000)

class CartItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    quantity: int = Field(..., ge=1, le=100)

class CartSyncRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str = Field(..., min_length=1, max_length=128)
    user_email: str = Field(..., min_length=3, max_length=255)

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

