from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime

class AddressBase(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_email: str = Field(..., min_length=3, max_length=255)
    type: str = Field(default="Home", max_length=50)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: Optional[str] = Field(default="", max_length=100)
    street: str = Field(..., min_length=3, max_length=300)
    city: str = Field(..., min_length=2, max_length=100)
    state: str = Field(..., min_length=2, max_length=100)
    pin_code: str = Field(..., min_length=4, max_length=10)
    phone: str = Field(..., min_length=10, max_length=20)
    is_default: bool = False

class AddressCreate(AddressBase):
    pass

class AddressUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Optional[str] = Field(default=None, max_length=50)
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)
    street: Optional[str] = Field(default=None, max_length=300)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    pin_code: Optional[str] = Field(default=None, max_length=10)
    phone: Optional[str] = Field(default=None, max_length=20)
    is_default: Optional[bool] = None

class AddressResponse(AddressBase):
    id: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True, extra="ignore")
