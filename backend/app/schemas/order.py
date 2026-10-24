from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, EmailStr, Field

from app.models.order import OrderItem, ShippingAddress, OrderStatus, PaymentMethod


class OrderCreateRequest(BaseModel):
    user_id: Optional[str] = None
    email: EmailStr
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
    notes: Optional[str] = None


class OrderStatusUpdateRequest(BaseModel):
    status: OrderStatus
    tracking_number: Optional[str] = None
    courier_partner: Optional[str] = None
    notes: Optional[str] = None


class OrderResponse(BaseModel):
    id: str = Field(alias="_id")
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
