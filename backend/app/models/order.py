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
    product_id: str
    title: str
    price: float
    quantity: int
    image: Optional[str] = None


class ShippingAddress(BaseModel):
    first_name: str
    last_name: str
    street: str
    city: str
    state: str
    pin_code: str


class Order(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: Optional[str] = None
    email: str
    phone: str
    shipping_address: ShippingAddress
    items: List[OrderItem]
    subtotal: float
    discount: float = 0.0
    coupon_code: Optional[str] = None
    discount_breakdown: Optional[dict] = None
    gst: float
    delivery: float
    total: float
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

