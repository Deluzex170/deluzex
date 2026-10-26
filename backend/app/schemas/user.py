from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, Any
from datetime import datetime

class UserRegister(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: Optional[str] = Field("User", max_length=80)
    last_name: Optional[str] = Field("Customer", max_length=80)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128, description="Password between 6 and 128 characters")
    phone: Optional[str] = Field(None, max_length=25)
    accept_terms: Optional[bool] = True

class UserLogin(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(..., min_length=3, max_length=120, description="Email address or mobile phone number")
    password: str = Field(..., min_length=1, max_length=128)

class UserData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    first_name: Optional[str] = ""
    last_name: Optional[str] = ""
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    is_verified: bool = False
    is_admin: bool = False
    created_at: datetime

class WhatsAppSendOtpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phone: str = Field(..., min_length=10, max_length=25)

class WhatsAppVerifyOtpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phone: str = Field(..., min_length=10, max_length=25)
    otp: str = Field(..., min_length=4, max_length=8)
    first_name: Optional[str] = Field(None, max_length=80)
    last_name: Optional[str] = Field(None, max_length=80)

class VerifyEmailOtpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    otp: str = Field(..., min_length=4, max_length=8)

class ResendEmailOtpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr

class UserProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: Optional[str] = Field(None, max_length=80)
    last_name: Optional[str] = Field(None, max_length=80)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    remove_avatar: Optional[bool] = False
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None

class UserPasswordUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=6, max_length=128)

class ForgotPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr

class ResetPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    otp: str = Field(..., min_length=4, max_length=8)
    new_password: str = Field(..., min_length=6, max_length=128)

class SignupWhatsAppSendOtpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phone: str = Field(..., min_length=10, max_length=25)
    email: Optional[EmailStr] = None

class SignupWhatsAppVerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phone: str = Field(..., min_length=10, max_length=25)
    otp: str = Field(..., min_length=4, max_length=8)
    first_name: str = Field(..., min_length=1, max_length=80)
    last_name: Optional[str] = Field(default="", max_length=80)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)

class ProfilePhoneSendOtpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phone: str = Field(..., min_length=10, max_length=25)

class ProfilePhoneVerifyOtpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phone: str = Field(..., min_length=10, max_length=25)
    otp: str = Field(..., min_length=4, max_length=8)

class StandardResponse(BaseModel):
    success: bool
    message: str
    access_token: Optional[str] = None
    token_type: Optional[str] = None
    data: Optional[UserData] = None
    requires_verification: Optional[bool] = False
    pending_email: Optional[str] = None
    otp_sent: Optional[bool] = None
    retry_after: int = 0
