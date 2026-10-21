from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator
from app.models.coupon import DiscountType

class CouponCreateRequest(BaseModel):
    code: str
    title: str
    description: Optional[str] = ""
    discount_type: DiscountType = "percentage"
    discount_value: float = 0.0
    max_discount_cap: Optional[float] = None
    min_order_value: float = 0.0
    is_active: bool = True
    is_public: bool = True
    is_first_order_only: bool = False
    start_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    max_uses: Optional[int] = None
    max_uses_per_user: int = 1

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return v.strip().upper()

class CouponUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    discount_type: Optional[DiscountType] = None
    discount_value: Optional[float] = None
    max_discount_cap: Optional[float] = None
    min_order_value: Optional[float] = None
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None
    is_first_order_only: Optional[bool] = None
    start_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    max_uses: Optional[int] = None
    max_uses_per_user: Optional[int] = None

class CouponResponse(BaseModel):
    id: str = Field(alias="_id")
    code: str
    title: str
    description: Optional[str] = ""
    discount_type: DiscountType
    discount_value: float
    max_discount_cap: Optional[float] = None
    min_order_value: float
    is_active: bool
    is_public: bool
    is_first_order_only: bool
    start_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    max_uses: Optional[int] = None
    times_used: int
    max_uses_per_user: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True

class AvailableCouponResponse(BaseModel):
    code: str
    title: str
    description: Optional[str] = ""
    discount_type: DiscountType
    discount_value: float
    max_discount_cap: Optional[float] = None
    min_order_value: float
    is_first_order_only: bool
    expiry_date: Optional[datetime] = None

class CouponValidateRequest(BaseModel):
    code: str
    subtotal: float
    email: Optional[str] = None

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return v.strip().upper()

class CouponValidateResponse(BaseModel):
    valid: bool
    code: str
    reason: Optional[str] = None
    message: str
    discount_type: Optional[DiscountType] = None
    discount_value: Optional[float] = None
    discount_amount: float = 0.0
    discount_breakdown: Optional[dict] = None
    new_subtotal: float = 0.0
    gst: float = 0.0
    delivery: float = 0.0
    grand_total: float = 0.0
    required_more: Optional[float] = None
