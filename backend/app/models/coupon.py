from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator
from app.models.common import PyObjectId

DiscountType = Literal["percentage", "flat", "free_shipping"]

class Coupon(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
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
    times_used: int = 0
    max_uses_per_user: int = 1
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return v.strip().upper()
