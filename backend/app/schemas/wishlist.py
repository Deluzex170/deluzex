from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Union
from datetime import datetime

class WishlistItemBase(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_email: str = Field(..., min_length=3, max_length=255)
    product_id: Optional[str] = Field(default=None, max_length=100)
    product_title: str = Field(..., min_length=1, max_length=255)
    product_price: Union[str, float, int]
    product_image: Optional[str] = Field(default=None, max_length=1000)
    product_slug: Optional[str] = Field(default=None, max_length=255)

class WishlistItemCreate(WishlistItemBase):
    pass

class WishlistItemResponse(WishlistItemBase):
    id: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
