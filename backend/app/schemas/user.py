from pydantic import BaseModel, EmailStr
from typing import Optional, Any
from datetime import datetime

class UserRegister(BaseModel):
    first_name: Optional[str] = "User"
    last_name: Optional[str] = "Customer"
    email: EmailStr
    password: str
    phone: Optional[str] = None
    accept_terms: Optional[bool] = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserData(BaseModel):
    id: str
    first_name: Optional[str] = ""
    last_name: Optional[str] = ""
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    is_verified: bool = False
    is_admin: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

class WhatsAppSendOtpRequest(BaseModel):
    phone: str

class WhatsAppVerifyOtpRequest(BaseModel):
    phone: str
    otp: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class VerifyEmailOtpRequest(BaseModel):
    email: EmailStr
    otp: str

class ResendEmailOtpRequest(BaseModel):
    email: EmailStr

class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None

class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str

class StandardResponse(BaseModel):
    success: bool
    message: str
    access_token: Optional[str] = None
    token_type: Optional[str] = None
    data: Optional[UserData] = None
    requires_verification: Optional[bool] = False
    pending_email: Optional[str] = None
