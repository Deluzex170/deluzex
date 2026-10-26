from pydantic import BaseModel, ConfigDict, Field
from typing import Optional

class TestimonialBase(BaseModel):
    model_config = ConfigDict(extra="forbid")
    author_name: str = Field(..., min_length=1, max_length=100)
    author_title: Optional[str] = Field(default=None, max_length=150)
    text: str = Field(..., min_length=2, max_length=3000)
    rating: float = Field(default=5.0, ge=1.0, le=5.0)
    avatar_url: Optional[str] = Field(default=None, max_length=1000)

class TestimonialCreate(TestimonialBase):
    pass

class Testimonial(TestimonialBase):
    id: int

    class Config:
        from_attributes = True
