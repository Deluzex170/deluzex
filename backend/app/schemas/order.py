from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict

from app.models.order import OrderItem, ShippingAddress, OrderStatus, PaymentMethod


class OrderCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: Optional[str] = Field(default=None, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=20)
    shipping_address: ShippingAddress
    items: List[OrderItem] = Field(..., min_length=1, max_length=100)
    subtotal: float = Field(..., ge=0)
    discount: float = Field(default=0.0, ge=0)
    coupon_code: Optional[str] = Field(default=None, max_length=50)
    gst: float = Field(..., ge=0)
    delivery: float = Field(..., ge=0)
    total: float = Field(..., ge=0)
    payment_method: PaymentMethod
    notes: Optional[str] = Field(default=None, max_length=1000)


class OrderStatusUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: OrderStatus
    tracking_number: Optional[str] = Field(default=None, max_length=100)
    courier_partner: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = Field(default=None, max_length=1000)


class OrderResponse(BaseModel):
    id: str = Field(alias="_id")
    order_number: Optional[str] = None
    invoice_number: Optional[str] = None
    user_id: Optional[str] = None
    email: str
    phone: str
    shipping_address: ShippingAddress
    items: List[OrderItem]
    subtotal: float
    discount: float = 0.0
    coupon_code: Optional[str] = None
    gst: float
    delivery: float
    total: float
    payment_method: PaymentMethod
    razorpay_method: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    status: OrderStatus
    tracking_number: Optional[str] = None
    courier_partner: Optional[str] = None
    notes: Optional[str] = None

    # Shiprocket Forward Logistics
    shiprocket_order_id: Optional[int] = None
    shiprocket_shipment_id: Optional[int] = None
    awb_code: Optional[str] = None
    courier_name: Optional[str] = None
    courier_company_id: Optional[int] = None
    pickup_scheduled_date: Optional[str] = None
    pickup_token_number: Optional[str] = None
    label_url: Optional[str] = None
    manifest_url: Optional[str] = None
    invoice_url: Optional[str] = None
    shiprocket_status: Optional[str] = None
    tracking_activities: List[dict] = Field(default_factory=list)

    # Shiprocket Reverse Logistics (Returns)
    return_details: Optional[dict] = None

    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


class OrderListResponse(BaseModel):
    total_count: int
    orders: List[OrderResponse]


class OrderCancelResponse(BaseModel):
    success: bool
    order_id: str
    message: str
    status: str
