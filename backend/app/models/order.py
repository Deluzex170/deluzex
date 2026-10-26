from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.models.common import PyObjectId

OrderStatus = Literal[
    "pending",
    "paid",
    "failed",
    "cod",
    "processing",
    "shipped",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "rto_initiated",
    "rto_delivered",
    "return_requested",
    "return_approved",
    "return_rejected",
    "return_in_transit",
    "returned",
]
PaymentMethod = str


class OrderItem(BaseModel):
    product_id: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=1, max_length=200)
    price: float = Field(..., ge=0, description="Price must be non-negative")
    quantity: int = Field(..., gt=0, le=100, description="Quantity must be between 1 and 100")
    image: Optional[str] = Field(None, max_length=500)


class ShippingAddress(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(default="", max_length=100)
    street: str = Field(..., min_length=3, max_length=300)
    city: str = Field(..., min_length=2, max_length=30)
    state: str = Field(..., min_length=2, max_length=30)
    pin_code: str = Field(..., min_length=4, max_length=10)


class Order(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: Optional[str] = None
    email: str = Field(..., max_length=150)
    phone: str = Field(..., max_length=15)
    shipping_address: ShippingAddress
    items: List[OrderItem]
    subtotal: float = Field(..., ge=0)
    discount: float = Field(default=0.0, ge=0)
    coupon_code: Optional[str] = Field(None, max_length=50)
    discount_breakdown: Optional[dict] = None
    gst: float = Field(..., ge=0)
    delivery: float = Field(..., ge=0)
    total: float = Field(..., ge=0)
    payment_method: PaymentMethod
    razorpay_method: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    status: OrderStatus = "pending"
    tracking_number: Optional[str] = None
    courier_partner: Optional[str] = None
    notes: Optional[str] = None
    idempotency_key: Optional[str] = None
    retry_count: int = 0
    payment_attempts: List[dict] = Field(default_factory=list)
    error_code: Optional[str] = None
    error_description: Optional[str] = None
    upi_vpa: Optional[str] = None
    card_last4: Optional[str] = None

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

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True

