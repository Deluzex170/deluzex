from typing import List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, ConfigDict

from app.models.order import OrderItem, ShippingAddress


class PaymentMethodInfo(BaseModel):
    id: str
    name: str
    description: str
    razorpay_method: str
    icon: str


class CreateOrderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=25)
    shipping_address: ShippingAddress
    items: List[OrderItem] = Field(..., min_length=1, max_length=50)
    subtotal: float = Field(..., ge=0)
    discount: float = Field(default=0.0, ge=0)
    coupon_code: Optional[str] = Field(None, max_length=50)
    gst: float = Field(..., ge=0)
    delivery: float = Field(..., ge=0)
    total: float = Field(..., gt=0)
    payment_method: Literal["upi", "card", "netbanking", "wallet", "cod"]
    razorpay_method: str = Field(..., max_length=50, description="Razorpay method key e.g. upi, card")
    idempotency_key: Optional[str] = Field(None, max_length=100)
    existing_order_id: Optional[str] = Field(None, max_length=50)
    upi_vpa: Optional[str] = Field(None, max_length=100)
    card_last4: Optional[str] = Field(None, max_length=10)
    bank_code: Optional[str] = Field(None, max_length=50)


class CreateOrderResponse(BaseModel):
    success: bool
    order_id: str
    order_number: Optional[str] = None
    razorpay_order_id: str
    amount: int
    currency: str
    key_id: str
    is_resumed: bool = False
    is_already_paid: bool = False


class VerifyPaymentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_id: str = Field(..., min_length=1, max_length=50)
    razorpay_order_id: str = Field(..., min_length=1, max_length=100)
    razorpay_payment_id: str = Field(..., min_length=1, max_length=100)
    razorpay_signature: str = Field(..., min_length=1, max_length=256)


class VerifyPaymentResponse(BaseModel):
    success: bool
    order_id: str
    order_number: Optional[str] = None
    message: str


class CodOrderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=25)
    shipping_address: ShippingAddress
    items: List[OrderItem] = Field(..., min_length=1, max_length=50)
    subtotal: float = Field(..., ge=0)
    discount: float = Field(default=0.0, ge=0)
    coupon_code: Optional[str] = Field(None, max_length=50)
    gst: float = Field(..., ge=0)
    delivery: float = Field(..., ge=0)
    total: float = Field(..., gt=0)
    idempotency_key: Optional[str] = Field(None, max_length=100)
    existing_order_id: Optional[str] = Field(None, max_length=50)


class CodOrderResponse(BaseModel):
    success: bool
    order_id: str
    order_number: Optional[str] = None
    message: str


class PaymentFailurePayload(BaseModel):
    order_id: str
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    status: str = "failed"
    error_code: Optional[str] = None
    error_description: Optional[str] = None
    error_source: Optional[str] = None
    error_step: Optional[str] = None
    error_reason: Optional[str] = None


class PaymentFailureResponse(BaseModel):
    success: bool
    order_id: str
    message: str
    can_resume: bool = True


class InitiateUpiRequest(BaseModel):
    email: EmailStr
    phone: str
    shipping_address: ShippingAddress
    items: List[OrderItem]
    subtotal: float
    gst: float
    delivery: float
    total: float
    upi_vpa: str
    idempotency_key: Optional[str] = None
    existing_order_id: Optional[str] = None


class InitiateUpiResponse(BaseModel):
    success: bool
    order_id: str
    razorpay_order_id: Optional[str] = None
    upi_vpa: str
    amount: float
    status: str = "pending_approval"
    message: str
    payment_url: Optional[str] = None
    expires_in_seconds: int = 300


class PaymentStatusResponse(BaseModel):
    success: bool
    order_id: str
    status: str
    payment_id: Optional[str] = None
    message: str
    error_description: Optional[str] = None
