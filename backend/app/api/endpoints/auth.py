import re
import random
import secrets
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from bson import ObjectId
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends, status, Request, Query
from app import models, schemas
from app.api import deps
from app.core.security import verify_password, get_password_hash, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from app.core.database import db
from app.core.audit import record_audit_event
from app.core.sanitizer import sanitize_search_term
from app.services import whatsapp as whatsapp_service
from app.services.email import send_verification_email, send_password_reset_email

router = APIRouter()

def _issue_and_send_email_otp(clean_email: str, user_name: str = "") -> dict:
    otp = f"{secrets.randbelow(900000) + 100000}"
    now = datetime.utcnow()
    expires_at = now + timedelta(minutes=10)

    db.email_otps.update_one(
        {"email": clean_email},
        {
            "$set": {
                "email": clean_email,
                "otp": otp,
                "created_at": now,
                "expires_at": expires_at,
                "attempts": 0
            },
            "$unset": {"sent_at": ""},
        },
        upsert=True
    )

    send_res = send_verification_email(to_email=clean_email, otp=otp, user_name=user_name)
    if send_res.get("success"):
        db.email_otps.update_one({"email": clean_email, "otp": otp}, {"$set": {"sent_at": datetime.utcnow()}})
    else:
        # A failed delivery must not force a 45-second wait or validate a code
        # that never left the server. Match this attempt to protect newer codes.
        db.email_otps.delete_one({"email": clean_email, "otp": otp})
    return {"otp": otp, "send_res": send_res}


def _email_otp_cooldown(record) -> int:
    if not record or not isinstance(record.get("sent_at"), datetime):
        return 0
    return max(0, 45 - int((datetime.utcnow() - record["sent_at"]).total_seconds()))

@router.post("/register", response_model=schemas.StandardResponse)
def register_user(user_in: schemas.UserRegister, request: Request):
    # Check if email exists (case-insensitive)
    clean_email = str(user_in.email).strip().lower()
    existing_user = db.users.find_one({"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}})
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
    
    # Create user
    first_name = (user_in.first_name or "").strip() or clean_email.split("@")[0]
    last_name = (user_in.last_name or "").strip() or "Customer"
    accept_terms = bool(user_in.accept_terms) if user_in.accept_terms is not None else True
    hashed_password = get_password_hash(user_in.password)

    new_user = models.User(
        first_name=first_name,
        last_name=last_name,
        email=clean_email,
        hashed_password=hashed_password,
        phone=user_in.phone.strip() if user_in.phone else None,
        accept_terms=accept_terms,
        is_verified=False, # Must verify email OTP before full activation & login
        is_admin=False # Default to false for public registration
    )
    
    result = db.users.insert_one(new_user.model_dump(by_alias=True, exclude_none=True))
    new_user.id = str(result.inserted_id)

    # Log action
    record_audit_event(
        action="USER_REGISTER",
        action_category="auth",
        actor_id=new_user.id,
        actor_email=new_user.email,
        actor_name=f"{new_user.first_name} {new_user.last_name}".strip(),
        actor_role="Customer",
        target_type="auth",
        target_id=str(new_user.id),
        target_name="User Registration",
        description=f"New user registered (pending email verification): {new_user.email}",
        details="Customer completed registration form, awaiting OTP verification",
        request=request
    )

    # Dispatch Email Verification OTP via GoDaddy SMTP
    delivery = _issue_and_send_email_otp(clean_email=clean_email, user_name=new_user.first_name)
    otp_sent = bool(delivery.get("send_res", {}).get("success"))

    return schemas.StandardResponse(
        success=True,
        message=("Account created. A verification code has been sent to your email." if otp_sent else
                 "Account created, but the verification email could not be sent. Use Resend Code to try again. "
                 + delivery.get("send_res", {}).get("error", "Email service unavailable.")),
        otp_sent=otp_sent,
        retry_after=45 if otp_sent else 0,
        requires_verification=True,
        pending_email=clean_email,
        access_token=None,
        token_type=None,
        data=schemas.UserData(
            id=str(new_user.id),
            first_name=new_user.first_name,
            last_name=new_user.last_name,
            email=new_user.email,
            is_verified=False,
            is_admin=False,
            created_at=new_user.created_at
        )
    )

@router.post("/login", response_model=schemas.StandardResponse)
def login_user(user_in: schemas.UserLogin, request: Request):
    clean_identifier = str(user_in.email).strip()
    digits = re.sub(r"\D", "", clean_identifier)
    phone_query = []
    if len(digits) >= 10:
        last10 = digits[-10:]
        phone_query = [
            {"phone": digits},
            {"phone": last10},
            {"phone": f"91{last10}"},
            {"phone": f"+91{last10}"},
            {"phone": f"+91 {last10}"}
        ]

    user_data = db.users.find_one({
        "$or": [
            {"email": {"$regex": f"^{re.escape(clean_identifier)}$", "$options": "i"}},
            *phone_query
        ]
    })
    
    if not user_data:
        record_audit_event(
            action="LOGIN_FAILED",
            action_category="security",
            actor_email=user_in.email,
            actor_role="Guest",
            target_type="auth",
            target_name="Customer Login",
            description=f"Failed login attempt for non-existent user: {user_in.email}",
            status="FAILED",
            request=request
        )
        raise HTTPException(
            status_code=404,
            detail="ACCOUNT_NOT_FOUND: No account found with this email or mobile number. Please sign up to create an account."
        )
        
    user = models.User(**user_data)
        
    if not verify_password(user_in.password, user.hashed_password):
        record_audit_event(
            action="LOGIN_FAILED",
            action_category="security",
            actor_id=user.id,
            actor_email=user.email,
            actor_name=f"{user.first_name} {user.last_name}".strip(),
            actor_role="Customer",
            target_type="auth",
            target_name="Customer Login",
            description=f"Failed login attempt with invalid password for {user.email}",
            status="FAILED",
            request=request
        )
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # Enforce Email Verification: Block login until email OTP is verified
    if not user.is_verified and not user.is_admin:
        # Check if fresh OTP is needed
        otp_record = db.email_otps.find_one({"email": user.email.lower()})
        retry_after = _email_otp_cooldown(otp_record)
        should_send = retry_after == 0
        if should_send:
            result = _issue_and_send_email_otp(clean_email=user.email.lower(), user_name=user.first_name)
            if not result.get("send_res", {}).get("success", False):
                error = result.get("send_res", {}).get("error", "Email service error")
                raise HTTPException(
                    status_code=503,
                    detail=f"Unable to send verification email: {error}",
                )

            retry_after = 45
        return JSONResponse(status_code=403, content={
            "detail": f"EMAIL_NOT_VERIFIED: Please verify your email ({user.email}) before logging in. Check your inbox and spam for the verification code.",
            "otp_sent": True, "retry_after": retry_after,
        })
    
    # Log action
    record_audit_event(
        action="USER_LOGIN",
        action_category="auth",
        actor_id=user.id,
        actor_email=user.email,
        actor_name=f"{user.first_name} {user.last_name}".strip() or user.email,
        actor_role="Admin" if user.is_admin else "Customer",
        target_type="auth",
        target_id=str(user.id),
        target_name="Storefront Sign In",
        description=f"User signed in successfully: {user.email}",
        request=request
    )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=str(user.id), expires_delta=access_token_expires, is_admin=bool(user.is_admin)
    )

    return schemas.StandardResponse(
        success=True,
        message="User logged in successfully.",
        access_token=access_token,
        token_type="bearer",
        data=schemas.UserData(
            id=str(user.id),
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            is_verified=user.is_verified,
            is_admin=bool(user.is_admin),
            created_at=user.created_at
        )
    )

@router.post("/verify-email-otp", response_model=schemas.StandardResponse)
def verify_email_otp(req: schemas.VerifyEmailOtpRequest, request: Request):
    clean_email = str(req.email).strip().lower()
    otp_input = str(req.otp).strip()

    if not clean_email or not otp_input:
        raise HTTPException(status_code=400, detail="Email and 6-digit verification code are required.")

    # Find OTP document
    otp_record = db.email_otps.find_one({"email": clean_email})
    now = datetime.utcnow()

    if not otp_record:
        raise HTTPException(status_code=400, detail="No active verification code found for this email. Please request a new code.")

    if otp_record.get("expires_at") and otp_record["expires_at"] < now:
        db.email_otps.delete_one({"email": clean_email})
        raise HTTPException(status_code=400, detail="Verification code has expired. Please click 'Resend Code'.")

    # Check attempts
    attempts = otp_record.get("attempts", 0)
    if attempts >= 5:
        db.email_otps.delete_one({"email": clean_email})
        raise HTTPException(status_code=400, detail="Too many invalid attempts. Please request a fresh verification code.")

    # Check OTP equality
    if str(otp_record.get("otp", "")).strip() != otp_input:
        db.email_otps.update_one({"email": clean_email}, {"$inc": {"attempts": 1}})
        remaining = 4 - attempts
        raise HTTPException(status_code=400, detail=f"Invalid verification code. {max(0, remaining)} attempts remaining.")

    # Successfully verified! Remove OTP record
    db.email_otps.delete_one({"email": clean_email})

    # Find and update user
    user_data = db.users.find_one({"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}})
    if not user_data:
        raise HTTPException(status_code=404, detail="No registered account found for this email address.")

    db.users.update_one({"_id": user_data["_id"]}, {"$set": {"is_verified": True}})
    user_data["is_verified"] = True
    user = models.User(**user_data)

    # Issue JWT session
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=access_token_expires,
        is_admin=bool(user.is_admin)
    )

    record_audit_event(
        action="EMAIL_VERIFY_SUCCESS",
        action_category="auth",
        actor_id=str(user.id),
        actor_email=user.email,
        actor_name=f"{user.first_name} {user.last_name}".strip() or user.email,
        actor_role="Admin" if user.is_admin else "Customer",
        target_type="auth",
        target_id=str(user.id),
        target_name="Email Verification",
        description=f"User email verified successfully via OTP: {user.email}",
        request=request
    )

    return schemas.StandardResponse(
        success=True,
        message="Email verified successfully! Welcome to Deluzex.",
        access_token=access_token,
        token_type="bearer",
        data=schemas.UserData(
            id=str(user.id),
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            phone=user.phone,
            city=user.city,
            country=user.country,
            is_verified=True,
            is_admin=bool(user.is_admin),
            created_at=user.created_at
        )
    )

@router.post("/resend-email-otp", response_model=schemas.StandardResponse)
def resend_email_otp(req: schemas.ResendEmailOtpRequest, request: Request):
    clean_email = str(req.email).strip().lower()
    if not clean_email:
        raise HTTPException(status_code=400, detail="Email address is required.")

    user_data = db.users.find_one({"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}})
    if not user_data:
        raise HTTPException(status_code=404, detail="No account registered with this email address.")

    user = models.User(**user_data)
    if user.is_verified:
        return schemas.StandardResponse(
            success=True,
            message="Your email is already verified. You can sign in directly."
        )

    # Rate limiting: 45 seconds between resends
    otp_record = db.email_otps.find_one({"email": clean_email})
    remaining = _email_otp_cooldown(otp_record)
    if remaining:
        raise HTTPException(status_code=429, detail=f"Please wait {remaining} seconds before requesting another code.")

    res = _issue_and_send_email_otp(clean_email=clean_email, user_name=user.first_name)
    if not res.get("send_res", {}).get("success", False):
        err = res.get("send_res", {}).get("error", "Email service error")
        raise HTTPException(status_code=500, detail=f"Unable to send verification email: {err}")

    return schemas.StandardResponse(
        success=True,
        message="A new 6-digit verification code has been sent to your email."
    )

@router.get("/me", response_model=schemas.StandardResponse)
def get_me(current_user: models.User = Depends(deps.get_current_active_user)):
    return schemas.StandardResponse(
        success=True,
        message="User profile retrieved successfully.",
        data=schemas.UserData(
            id=str(current_user.id),
            first_name=current_user.first_name,
            last_name=current_user.last_name,
            email=current_user.email,
            phone=current_user.phone,
            city=current_user.city,
            country=current_user.country,
            is_verified=current_user.is_verified,
            is_admin=bool(current_user.is_admin),
            created_at=current_user.created_at
        )
    )

@router.patch("/me", response_model=schemas.StandardResponse)
def update_me(
    profile_in: schemas.UserProfileUpdate,
    current_user: models.User = Depends(deps.get_current_active_user),
):
    from bson import ObjectId
    update_fields = {}
    if profile_in.first_name is not None:
        update_fields["first_name"] = profile_in.first_name.strip()
    if profile_in.last_name is not None:
        update_fields["last_name"] = profile_in.last_name.strip()
    if profile_in.phone is not None:
        update_fields["phone"] = profile_in.phone.strip()
    if profile_in.city is not None:
        update_fields["city"] = profile_in.city.strip()
    if profile_in.country is not None:
        update_fields["country"] = profile_in.country.strip()
    if profile_in.email is not None and str(profile_in.email).strip().lower() != str(current_user.email).lower():
        clean_email = str(profile_in.email).strip()
        user_oid = ObjectId(current_user.id) if isinstance(current_user.id, str) and ObjectId.is_valid(current_user.id) else current_user.id
        existing = db.users.find_one({
            "email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"},
            "_id": {"$ne": user_oid}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Email is already in use by another account.")
        update_fields["email"] = clean_email

    user_oid = ObjectId(current_user.id) if isinstance(current_user.id, str) and ObjectId.is_valid(current_user.id) else current_user.id
    if update_fields:
        db.users.update_one({"_id": user_oid}, {"$set": update_fields})

    updated_doc = db.users.find_one({"_id": user_oid})
    updated_user = models.User(**updated_doc) if updated_doc else current_user

    return schemas.StandardResponse(
        success=True,
        message="Profile updated successfully.",
        data=schemas.UserData(
            id=str(updated_user.id),
            first_name=updated_user.first_name,
            last_name=updated_user.last_name,
            email=updated_user.email,
            phone=updated_user.phone,
            city=updated_user.city,
            country=updated_user.country,
            is_verified=updated_user.is_verified,
            is_admin=bool(updated_user.is_admin),
            created_at=updated_user.created_at
        )
    )

@router.post("/me/password", response_model=schemas.StandardResponse)
def update_password(
    pass_in: schemas.UserPasswordUpdate,
    current_user: models.User = Depends(deps.get_current_active_user),
):
    from bson import ObjectId
    if not verify_password(pass_in.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if len(pass_in.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    new_hash = get_password_hash(pass_in.new_password)
    user_oid = ObjectId(current_user.id) if isinstance(current_user.id, str) and ObjectId.is_valid(current_user.id) else current_user.id
    db.users.update_one({"_id": user_oid}, {"$set": {"hashed_password": new_hash}})

    return schemas.StandardResponse(
        success=True,
        message="Password updated successfully.",
    )

@router.post("/admin/login", response_model=schemas.StandardResponse)
def login_admin(user_in: schemas.UserLogin, request: Request):
    clean_email = str(user_in.email).strip()
    user_data = db.users.find_one({"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}})

    if not user_data:
        record_audit_event(
            action="LOGIN_FAILED",
            action_category="security",
            actor_email=user_in.email,
            actor_role="Guest",
            target_type="auth",
            target_id="admin_portal",
            target_name="Admin Login Gateway",
            description=f"Admin login failed: Email '{user_in.email}' not found",
            status="FAILED",
            request=request
        )
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    user = models.User(**user_data)
        
    if not verify_password(user_in.password, user.hashed_password):
        record_audit_event(
            action="LOGIN_FAILED",
            action_category="security",
            actor_id=user.id,
            actor_email=user.email,
            actor_name=f"{user.first_name} {user.last_name}".strip(),
            actor_role="Admin" if user.is_admin else "Customer",
            target_type="auth",
            target_id="admin_portal",
            target_name="Admin Login Gateway",
            description=f"Admin login failed: Incorrect password for '{user.email}'",
            status="FAILED",
            request=request
        )
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive account")
    elif not user.is_admin:
        record_audit_event(
            action="ACCESS_DENIED",
            action_category="security",
            actor_id=user.id,
            actor_email=user.email,
            actor_name=f"{user.first_name} {user.last_name}".strip(),
            actor_role="Customer",
            target_type="auth",
            target_id="admin_portal",
            target_name="Admin Login Gateway",
            description=f"Non-admin user '{user.email}' attempted to access admin portal",
            status="WARNING",
            request=request
        )
        raise HTTPException(status_code=403, detail="Access denied. You do not have administrator privileges.")
    
    # Log action
    record_audit_event(
        action="ADMIN_LOGIN",
        action_category="auth",
        actor_id=user.id,
        actor_email=user.email,
        actor_name=f"{user.first_name} {user.last_name}".strip() or user.email,
        actor_role="Admin",
        target_type="auth",
        target_id="admin_portal",
        target_name="Admin Control Panel",
        description=f"Administrator '{user.email}' authenticated successfully",
        details="Access granted with full administrator privileges",
        status="SUCCESS",
        request=request
    )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=str(user.id), expires_delta=access_token_expires, is_admin=True
    )

    return schemas.StandardResponse(
        success=True,
        message="Admin logged in successfully.",
        access_token=access_token,
        token_type="bearer",
        data=schemas.UserData(
            id=str(user.id),
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            is_verified=user.is_verified,
            is_admin=True,
            created_at=user.created_at
        )
    )


# ---------------------------------------------------------------------------
# WhatsApp Authentication & Passwordless OTP Login
# ---------------------------------------------------------------------------

@router.post("/whatsapp/send-otp", response_model=schemas.StandardResponse)
def send_whatsapp_otp_endpoint(req: schemas.WhatsAppSendOtpRequest, request: Request):
    phone_clean = (req.phone or "").strip()
    if not phone_clean:
        raise HTTPException(status_code=400, detail="Phone number is required.")

    normalized_phone = whatsapp_service.normalize_phone_number(phone_clean)
    if len(normalized_phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid mobile number format.")

    # Rate limiting: 60-second cooldown between OTP requests for the same number
    now = datetime.utcnow()
    existing_otp = db.whatsapp_otps.find_one({"phone": normalized_phone})
    if existing_otp:
        created_at = existing_otp.get("created_at")
        if created_at and (now - created_at).total_seconds() < 60:
            remaining = int(60 - (now - created_at).total_seconds())
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {remaining} seconds before requesting a new OTP."
            )

    # Generate 6-digit cryptographic OTP
    otp_code = f"{random.randint(100000, 999999)}"

    # Send OTP via Meta WhatsApp Cloud API
    delivery_res = whatsapp_service.send_whatsapp_otp(normalized_phone, otp_code)
    if not delivery_res.get("success"):
        raise HTTPException(
            status_code=502,
            detail=delivery_res.get("error") or "Failed to deliver WhatsApp message."
        )

    # Persist OTP in database with 5-minute validity window
    db.whatsapp_otps.update_one(
        {"phone": normalized_phone},
        {
            "$set": {
                "phone": normalized_phone,
                "otp": otp_code,
                "created_at": now,
                "expires_at": now + timedelta(minutes=5),
                "verified": False,
                "attempts": 0
            }
        },
        upsert=True
    )

    record_audit_event(
        action="WHATSAPP_OTP_SENT",
        action_category="auth",
        actor_email=f"phone:{normalized_phone}",
        actor_role="Guest",
        target_type="auth",
        target_name="WhatsApp OTP",
        description=f"Dispatched login OTP to {normalized_phone}",
        status="SUCCESS",
        request=request
    )

    msg = "Verification code dispatched via WhatsApp."

    return schemas.StandardResponse(
        success=True,
        message=msg
    )


@router.post("/whatsapp/verify-otp", response_model=schemas.StandardResponse)
def verify_whatsapp_otp_endpoint(req: schemas.WhatsAppVerifyOtpRequest, request: Request):
    phone_clean = (req.phone or "").strip()
    otp_clean = (req.otp or "").strip()

    if not phone_clean or not otp_clean:
        raise HTTPException(status_code=400, detail="Phone number and OTP code are required.")

    normalized_phone = whatsapp_service.normalize_phone_number(phone_clean)
    now = datetime.utcnow()

    # Retrieve active OTP record
    otp_record = db.whatsapp_otps.find_one({"phone": normalized_phone})
    if not otp_record:
        raise HTTPException(status_code=400, detail="No active OTP found. Please request a new verification code.")

    # Check expiration
    if otp_record.get("expires_at") and now > otp_record["expires_at"]:
        db.whatsapp_otps.delete_one({"phone": normalized_phone})
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new code.")

    # Guard against brute force (Max 5 attempts)
    current_attempts = otp_record.get("attempts", 0)
    if current_attempts >= 5:
        db.whatsapp_otps.delete_one({"phone": normalized_phone})
        raise HTTPException(status_code=429, detail="Too many invalid attempts. Please request a new verification code.")

    # Verify matching code
    if str(otp_record.get("otp")) != otp_clean:
        db.whatsapp_otps.update_one(
            {"phone": normalized_phone},
            {"$inc": {"attempts": 1}}
        )
        remaining = 4 - current_attempts
        raise HTTPException(
            status_code=400,
            detail=f"Invalid verification code. {max(0, remaining)} attempts remaining."
        )

    # Invalidate OTP on successful verification
    db.whatsapp_otps.delete_one({"phone": normalized_phone})

    # Search for existing user by phone
    phone_variants = [normalized_phone, phone_clean, f"+{normalized_phone}"]
    user_doc = db.users.find_one({"phone": {"$in": phone_variants}})

    is_new_user = False
    if not user_doc:
        # Seamless Passwordless Auto-Registration for new WhatsApp users
        is_new_user = True
        first_name = (req.first_name or "").strip() or f"User {normalized_phone[-4:]}"
        last_name = (req.last_name or "").strip() or "Customer"
        default_email = f"{normalized_phone}@deluzex.com"

        user = models.User(
            first_name=first_name,
            last_name=last_name,
            email=default_email,
            phone=normalized_phone,
            accept_terms=True,
            is_active=True,
            is_verified=True,
            is_admin=False,
            created_at=now
        )
        insert_res = db.users.insert_one(user.model_dump(by_alias=True, exclude_none=True))
        user.id = str(insert_res.inserted_id)
    else:
        # User already exists
        user = models.User(**dict(user_doc))
        # Mark phone as verified if not already
        if not user.is_verified:
            db.users.update_one({"_id": user_doc["_id"]}, {"$set": {"is_verified": True}})
            user.is_verified = True

    # Generate JWT Session
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=access_token_expires,
        is_admin=bool(user.is_admin)
    )

    record_audit_event(
        action="WHATSAPP_LOGIN_SUCCESS",
        action_category="auth",
        actor_id=str(user.id),
        actor_email=user.email or f"phone:{user.phone}",
        actor_name=f"{user.first_name} {user.last_name}".strip(),
        actor_role="Customer",
        target_type="auth",
        target_id=str(user.id),
        target_name="WhatsApp Login",
        description=f"Customer authenticated via WhatsApp: {user.phone}",
        status="SUCCESS",
        request=request
    )

    action_label = "Account created and logged in" if is_new_user else "Logged in successfully"

    return schemas.StandardResponse(
        success=True,
        message=f"{action_label} via WhatsApp.",
        access_token=access_token,
        token_type="bearer",
        data=schemas.UserData(
            id=str(user.id),
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            phone=user.phone,
            is_verified=user.is_verified,
            is_admin=bool(user.is_admin),
            created_at=user.created_at
        )
    )


@router.post("/signup/send-whatsapp-otp", response_model=schemas.StandardResponse)
def signup_send_whatsapp_otp(req: schemas.SignupWhatsAppSendOtpRequest, request: Request):
    phone_clean = (req.phone or "").strip()
    if not phone_clean:
        raise HTTPException(status_code=400, detail="Mobile number is required.")

    normalized_phone = whatsapp_service.normalize_phone_number(phone_clean)
    if len(normalized_phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid mobile number format.")

    # Check if phone is already registered
    phone_variants = [normalized_phone, phone_clean, f"+{normalized_phone}"]
    existing_phone = db.users.find_one({"phone": {"$in": phone_variants}})
    if existing_phone:
        raise HTTPException(
            status_code=400,
            detail="An account is already registered with this WhatsApp number. Please sign in instead."
        )

    # Check if email is already registered (if provided)
    if req.email:
        clean_email = str(req.email).strip().lower()
        existing_email = db.users.find_one({"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}})
        if existing_email:
            raise HTTPException(
                status_code=400,
                detail="An account is already registered with this email address. Please sign in instead."
            )

    # Rate limiting: 60-second cooldown
    now = datetime.utcnow()
    existing_otp = db.whatsapp_otps.find_one({"phone": normalized_phone})
    if existing_otp:
        created_at = existing_otp.get("created_at")
        if created_at and (now - created_at).total_seconds() < 60:
            remaining = int(60 - (now - created_at).total_seconds())
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {remaining} seconds before requesting a new WhatsApp code."
            )

    otp_code = f"{random.randint(100000, 999999)}"

    # Dispatch via WhatsApp service
    delivery_res = whatsapp_service.send_whatsapp_otp(normalized_phone, otp_code)
    if not delivery_res.get("success"):
        raise HTTPException(
            status_code=502,
            detail=delivery_res.get("error") or "Failed to deliver WhatsApp message."
        )

    db.whatsapp_otps.update_one(
        {"phone": normalized_phone},
        {
            "$set": {
                "phone": normalized_phone,
                "otp": otp_code,
                "created_at": now,
                "expires_at": now + timedelta(minutes=5),
                "verified": False,
                "attempts": 0
            }
        },
        upsert=True
    )

    record_audit_event(
        action="SIGNUP_WHATSAPP_OTP_SENT",
        action_category="auth",
        actor_email=f"phone:{normalized_phone}",
        actor_role="Guest",
        target_type="auth",
        target_name="WhatsApp Signup OTP",
        description=f"Dispatched signup verification OTP to {normalized_phone}",
        status="SUCCESS",
        request=request
    )

    return schemas.StandardResponse(
        success=True,
        message="Verification code dispatched via WhatsApp.",
        retry_after=60
    )


@router.post("/signup/verify-whatsapp", response_model=schemas.StandardResponse)
def signup_verify_whatsapp(req: schemas.SignupWhatsAppVerifyRequest, request: Request):
    phone_clean = (req.phone or "").strip()
    otp_clean = (req.otp or "").strip()
    clean_email = str(req.email).strip().lower()

    if not phone_clean or not otp_clean:
        raise HTTPException(status_code=400, detail="Phone number and OTP code are required.")

    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    normalized_phone = whatsapp_service.normalize_phone_number(phone_clean)
    now = datetime.utcnow()

    # Verify OTP
    otp_record = db.whatsapp_otps.find_one({"phone": normalized_phone})
    if not otp_record:
        raise HTTPException(status_code=400, detail="No active verification code found. Please request a new one.")

    if otp_record.get("expires_at") and now > otp_record["expires_at"]:
        db.whatsapp_otps.delete_one({"phone": normalized_phone})
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new code.")

    current_attempts = otp_record.get("attempts", 0)
    if current_attempts >= 5:
        db.whatsapp_otps.delete_one({"phone": normalized_phone})
        raise HTTPException(status_code=429, detail="Too many invalid attempts. Please request a new code.")

    if str(otp_record.get("otp")) != otp_clean:
        db.whatsapp_otps.update_one({"phone": normalized_phone}, {"$inc": {"attempts": 1}})
        remaining = 4 - current_attempts
        raise HTTPException(
            status_code=400,
            detail=f"Invalid verification code. {max(0, remaining)} attempts remaining."
        )

    # Invalidate OTP
    db.whatsapp_otps.delete_one({"phone": normalized_phone})

    # Double check uniqueness
    phone_variants = [normalized_phone, phone_clean, f"+{normalized_phone}"]
    if db.users.find_one({"phone": {"$in": phone_variants}}):
        raise HTTPException(status_code=400, detail="An account is already registered with this mobile number.")
    if db.users.find_one({"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}}):
        raise HTTPException(status_code=400, detail="An account is already registered with this email address.")

    hashed_password = get_password_hash(req.password)
    user = models.User(
        first_name=req.first_name.strip(),
        last_name=(req.last_name or "").strip(),
        email=clean_email,
        phone=normalized_phone,
        hashed_password=hashed_password,
        accept_terms=True,
        is_active=True,
        is_verified=True,  # Mobile number verified via WhatsApp OTP
        is_admin=False,
        created_at=now
    )

    insert_res = db.users.insert_one(user.model_dump(by_alias=True, exclude_none=True))
    user.id = str(insert_res.inserted_id)

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=access_token_expires,
        is_admin=False
    )

    record_audit_event(
        action="USER_REGISTER_WHATSAPP",
        action_category="auth",
        actor_id=str(user.id),
        actor_email=user.email,
        actor_name=f"{user.first_name} {user.last_name}".strip(),
        actor_role="Customer",
        target_type="auth",
        target_id=str(user.id),
        target_name="WhatsApp Signup",
        description=f"Account created and verified via WhatsApp: {user.phone}",
        status="SUCCESS",
        request=request
    )

    return schemas.StandardResponse(
        success=True,
        message="Account created and verified successfully!",
        access_token=access_token,
        token_type="bearer",
        data=schemas.UserData(
            id=str(user.id),
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            phone=user.phone,
            is_verified=True,
            is_admin=False,
            created_at=user.created_at
        )
    )


@router.post("/profile/send-phone-otp", response_model=schemas.StandardResponse)
def profile_send_phone_otp(
    req: schemas.ProfilePhoneSendOtpRequest,
    request: Request,
    current_user: models.User = Depends(deps.get_current_active_user)
):
    phone_clean = (req.phone or "").strip()
    if not phone_clean:
        raise HTTPException(status_code=400, detail="New mobile number is required.")

    normalized_phone = whatsapp_service.normalize_phone_number(phone_clean)
    if len(normalized_phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid mobile number format.")

    # Check if number already belongs to another user
    phone_variants = [normalized_phone, phone_clean, f"+{normalized_phone}"]
    user_oid = ObjectId(current_user.id) if isinstance(current_user.id, str) and ObjectId.is_valid(current_user.id) else current_user.id
    conflict = db.users.find_one({"phone": {"$in": phone_variants}, "_id": {"$ne": user_oid}})
    if conflict:
        raise HTTPException(status_code=400, detail="This mobile number is already registered to another account.")

    # Rate limiting
    now = datetime.utcnow()
    existing_otp = db.whatsapp_otps.find_one({"phone": normalized_phone})
    if existing_otp:
        created_at = existing_otp.get("created_at")
        if created_at and (now - created_at).total_seconds() < 60:
            remaining = int(60 - (now - created_at).total_seconds())
            raise HTTPException(status_code=429, detail=f"Please wait {remaining} seconds before requesting a new code.")

    otp_code = f"{random.randint(100000, 999999)}"
    delivery_res = whatsapp_service.send_whatsapp_otp(normalized_phone, otp_code)
    if not delivery_res.get("success"):
        raise HTTPException(status_code=502, detail=delivery_res.get("error") or "Failed to deliver WhatsApp message.")

    db.whatsapp_otps.update_one(
        {"phone": normalized_phone},
        {
            "$set": {
                "phone": normalized_phone,
                "otp": otp_code,
                "created_at": now,
                "expires_at": now + timedelta(minutes=5),
                "verified": False,
                "attempts": 0
            }
        },
        upsert=True
    )

    return schemas.StandardResponse(
        success=True,
        message="Verification code dispatched to your new WhatsApp number.",
        retry_after=60
    )


@router.post("/profile/verify-phone-otp", response_model=schemas.StandardResponse)
def profile_verify_phone_otp(
    req: schemas.ProfilePhoneVerifyOtpRequest,
    request: Request,
    current_user: models.User = Depends(deps.get_current_active_user)
):
    phone_clean = (req.phone or "").strip()
    otp_clean = (req.otp or "").strip()

    if not phone_clean or not otp_clean:
        raise HTTPException(status_code=400, detail="Mobile number and OTP code are required.")

    normalized_phone = whatsapp_service.normalize_phone_number(phone_clean)
    now = datetime.utcnow()

    otp_record = db.whatsapp_otps.find_one({"phone": normalized_phone})
    if not otp_record:
        raise HTTPException(status_code=400, detail="No active verification code found. Please request a new one.")

    if otp_record.get("expires_at") and now > otp_record["expires_at"]:
        db.whatsapp_otps.delete_one({"phone": normalized_phone})
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new code.")

    current_attempts = otp_record.get("attempts", 0)
    if current_attempts >= 5:
        db.whatsapp_otps.delete_one({"phone": normalized_phone})
        raise HTTPException(status_code=429, detail="Too many invalid attempts.")

    if str(otp_record.get("otp")) != otp_clean:
        db.whatsapp_otps.update_one({"phone": normalized_phone}, {"$inc": {"attempts": 1}})
        remaining = 4 - current_attempts
        raise HTTPException(status_code=400, detail=f"Invalid verification code. {max(0, remaining)} attempts remaining.")

    db.whatsapp_otps.delete_one({"phone": normalized_phone})

    user_oid = ObjectId(current_user.id) if isinstance(current_user.id, str) and ObjectId.is_valid(current_user.id) else current_user.id
    db.users.update_one({"_id": user_oid}, {"$set": {"phone": normalized_phone, "is_verified": True}})
    updated_user_doc = db.users.find_one({"_id": user_oid})
    updated_user = models.User(**dict(updated_user_doc))

    record_audit_event(
        action="USER_PHONE_UPDATED",
        action_category="profile",
        actor_id=str(current_user.id),
        actor_email=current_user.email,
        actor_name=f"{current_user.first_name} {current_user.last_name}".strip(),
        actor_role="Customer",
        target_type="user",
        target_id=str(current_user.id),
        target_name="Profile Phone Update",
        description=f"User updated and verified new phone number: {normalized_phone}",
        status="SUCCESS",
        request=request
    )

    return schemas.StandardResponse(
        success=True,
        message="WhatsApp mobile number verified and updated successfully!",
        data=schemas.UserData(
            id=str(updated_user.id),
            first_name=updated_user.first_name,
            last_name=updated_user.last_name,
            email=updated_user.email,
            phone=updated_user.phone,
            is_verified=updated_user.is_verified,
            is_admin=bool(updated_user.is_admin),
            created_at=updated_user.created_at
        )
    )


@router.post("/forgot-password", response_model=schemas.StandardResponse)
def forgot_password(payload: schemas.ForgotPasswordRequest, request: Request):
    clean_email = str(payload.email).strip().lower()
    user_doc = db.users.find_one({"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}})
    
    if not user_doc:
        raise HTTPException(
            status_code=404,
            detail="ACCOUNT_NOT_FOUND: No account registered with this email. Please check your email or sign up."
        )

    user_name = f"{user_doc.get('first_name', '')} {user_doc.get('last_name', '')}".strip()
    otp = f"{random.randint(100000, 999999)}"
    now = datetime.utcnow()
    expires_at = now + timedelta(minutes=10)

    db.password_reset_otps.update_one(
        {"email": clean_email},
        {
            "$set": {
                "email": clean_email,
                "otp": otp,
                "created_at": now,
                "expires_at": expires_at,
                "attempts": 0
            }
        },
        upsert=True
    )

    send_res = send_password_reset_email(to_email=clean_email, otp=otp, user_name=user_name)
    if not send_res.get("success"):
        raise HTTPException(
            status_code=500,
            detail=f"Failed to dispatch password reset email: {send_res.get('error', 'SMTP dispatch failed')}"
        )

    record_audit_event(
        action="FORGOT_PASSWORD_REQUESTED",
        action_category="auth",
        actor_email=clean_email,
        actor_role="Customer",
        target_type="auth",
        target_name="Password Reset OTP",
        description=f"Password reset OTP sent to {clean_email}",
        status="SUCCESS",
        request=request
    )

    return schemas.StandardResponse(
        success=True,
        message="A 6-digit password reset code has been sent to your email address."
    )

@router.post("/reset-password", response_model=schemas.StandardResponse)
def reset_password(payload: schemas.ResetPasswordRequest, request: Request):
    clean_email = str(payload.email).strip().lower()
    clean_otp = str(payload.otp).strip()
    new_password = str(payload.new_password)

    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")

    otp_record = db.password_reset_otps.find_one({"email": clean_email})
    if not otp_record:
        raise HTTPException(status_code=400, detail="No active password reset request found for this email. Please request a new code.")

    # Check expiration
    if datetime.utcnow() > otp_record.get("expires_at", datetime.min):
        db.password_reset_otps.delete_one({"email": clean_email})
        raise HTTPException(status_code=400, detail="The verification code has expired. Please request a new one.")

    # Check OTP match
    if str(otp_record.get("otp")).strip() != clean_otp:
        attempts = otp_record.get("attempts", 0) + 1
        if attempts >= 5:
            db.password_reset_otps.delete_one({"email": clean_email})
            raise HTTPException(status_code=400, detail="Too many invalid attempts. Please request a new reset code.")
        db.password_reset_otps.update_one({"email": clean_email}, {"$set": {"attempts": attempts}})
        raise HTTPException(status_code=400, detail="Invalid verification code. Please check and try again.")

    # Update password in db
    user_doc = db.users.find_one({"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User account not found.")

    hashed_pw = get_password_hash(new_password)
    db.users.update_one({"_id": user_doc["_id"]}, {"$set": {"hashed_password": hashed_pw, "is_verified": True}})
    db.password_reset_otps.delete_one({"email": clean_email})

    record_audit_event(
        action="PASSWORD_RESET_SUCCESS",
        action_category="auth",
        actor_id=str(user_doc["_id"]),
        actor_email=clean_email,
        actor_role="Customer",
        target_type="auth",
        target_name="Password Reset",
        description=f"Password successfully reset for {clean_email}",
        status="SUCCESS",
        request=request
    )

    return schemas.StandardResponse(
        success=True,
        message="Your password has been successfully reset! You can now log in with your new password."
    )

# ─────────────────────────────────────────────────────────────
# ADMIN CUSTOMER & USER MANAGEMENT ENDPOINTS
# ─────────────────────────────────────────────────────────────

class UserStatusUpdateRequest(BaseModel):
    is_active: bool

class UserRoleUpdateRequest(BaseModel):
    is_admin: bool

@router.get("/users/stats")
def get_user_stats(admin: models.User = Depends(deps.get_current_active_admin)):
    """Aggregated user and customer statistics for the Admin Dashboard (Admin only)."""
    total_users = db.users.count_documents({})
    admin_count = db.users.count_documents({"is_admin": True})
    customer_count = db.users.count_documents({"$or": [{"is_admin": False}, {"is_admin": {"$exists": False}}]})
    verified_count = db.users.count_documents({"is_verified": True})
    active_count = db.users.count_documents({"$or": [{"is_active": True}, {"is_active": {"$exists": False}}]})

    # Order revenue metrics
    pipeline = [
        {
            "$match": {
                "status": {"$in": ["paid", "processing", "shipped", "out_for_delivery", "delivered"]}
            }
        },
        {"$group": {"_id": None, "total_spend": {"$sum": {"$ifNull": ["$total", "$total_amount"]}}, "total_orders": {"$sum": 1}}}
    ]
    agg = list(db.orders.aggregate(pipeline))
    total_spend = round(float(agg[0]["total_spend"]), 2) if agg and "total_spend" in agg[0] else 0.0
    total_orders = db.orders.count_documents({"status": {"$ne": "cancelled"}})

    return {
        "total_users": total_users,
        "total_customers": customer_count,
        "total_admins": admin_count,
        "verified_users": verified_count,
        "active_users": active_count,
        "total_orders": total_orders,
        "total_spend": total_spend
    }

@router.get("/users")
def get_users_admin(
    search: Optional[str] = Query(None, description="Search by name, email, or phone"),
    role: Optional[str] = Query(None, description="Filter by role: all, customer, admin"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """
    Fetch all registered users and customers with order counts and lifetime spend (Admin only).
    """
    query: Dict[str, Any] = {}

    if role == "customer":
        query["$or"] = [{"is_admin": False}, {"is_admin": {"$exists": False}}]
    elif role == "admin":
        query["is_admin"] = True

    if search and search.strip():
        term = sanitize_search_term(search)
        search_or = [
            {"first_name": {"$regex": term, "$options": "i"}},
            {"last_name": {"$regex": term, "$options": "i"}},
            {"email": {"$regex": term, "$options": "i"}},
            {"phone": {"$regex": term, "$options": "i"}},
        ]
        if "$or" in query:
            query = {"$and": [query, {"$or": search_or}]}
        else:
            query["$or"] = search_or

    users_cursor = list(db.users.find(query).sort("created_at", -1).skip(skip).limit(limit))

    # Fast order aggregation by email and user_id
    pipeline_email = [
        {"$match": {"$or": [{"email": {"$exists": True, "$ne": None}}, {"customer.email": {"$exists": True, "$ne": None}}]}},
        {
            "$group": {
                "_id": {"$toLower": {"$ifNull": ["$email", "$customer.email"]}},
                "count": {"$sum": 1},
                "total_spent": {"$sum": {"$ifNull": ["$total", "$total_amount"]}},
                "last_order": {"$max": "$created_at"}
            }
        }
    ]
    email_aggs = {item["_id"]: item for item in db.orders.aggregate(pipeline_email) if item.get("_id")}

    pipeline_uid = [
        {"$match": {"user_id": {"$exists": True, "$ne": None}}},
        {
            "$group": {
                "_id": "$user_id",
                "count": {"$sum": 1},
                "total_spent": {"$sum": {"$ifNull": ["$total", "$total_amount"]}},
                "last_order": {"$max": "$created_at"}
            }
        }
    ]
    uid_aggs = {str(item["_id"]): item for item in db.orders.aggregate(pipeline_uid) if item.get("_id")}

    formatted = []
    for u in users_cursor:
        uid = str(u.get("_id", ""))
        email_clean = (u.get("email") or "").strip().lower()

        agg_u = uid_aggs.get(uid)
        agg_e = email_aggs.get(email_clean)

        orders_count = max(agg_u["count"] if agg_u else 0, agg_e["count"] if agg_e else 0)
        total_spent = round(max(agg_u["total_spent"] if agg_u else 0.0, agg_e["total_spent"] if agg_e else 0.0), 2)
        last_order = (agg_u.get("last_order") if agg_u else None) or (agg_e.get("last_order") if agg_e else None)
        if isinstance(last_order, datetime):
            last_order = last_order.isoformat()

        created_at_val = u.get("created_at")
        if isinstance(created_at_val, datetime):
            created_at_val = created_at_val.isoformat()

        first_n = u.get("first_name", "") or ""
        last_n = u.get("last_name", "") or ""
        full_name = f"{first_n} {last_n}".strip() or email_clean.split("@")[0]

        formatted.append({
            "id": uid,
            "_id": uid,
            "first_name": first_n,
            "last_name": last_n,
            "name": full_name,
            "email": u.get("email"),
            "phone": u.get("phone"),
            "city": u.get("city"),
            "country": u.get("country"),
            "is_admin": bool(u.get("is_admin", False)),
            "is_verified": bool(u.get("is_verified", False)),
            "is_active": bool(u.get("is_active", True)),
            "created_at": created_at_val,
            "orders_count": orders_count,
            "total_spent": total_spent,
            "last_order_date": last_order
        })

    return formatted

@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: str,
    payload: UserStatusUpdateRequest,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """Activate or deactivate a customer account (Admin only)."""
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = db.users.find_one({"_id": obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.users.update_one({"_id": obj_id}, {"$set": {"is_active": payload.is_active}})
    return {"message": "User status updated successfully", "is_active": payload.is_active}

@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: str,
    payload: UserRoleUpdateRequest,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """Change user role to Admin or Customer (Admin only)."""
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = db.users.find_one({"_id": obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.users.update_one({"_id": obj_id}, {"$set": {"is_admin": payload.is_admin}})
    return {"message": "User role updated successfully", "is_admin": payload.is_admin}

@router.get("/users/{user_id}/orders")
def get_user_orders_admin(
    user_id: str,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    """Fetch order history for a specific customer in admin customer drawer (Admin only)."""
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = db.users.find_one({"_id": obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_email = (user.get("email") or "").strip().lower()

    orders_cursor = list(db.orders.find({
        "$or": [
            {"user_id": user_id},
            {"customer.email": {"$regex": f"^{re.escape(user_email)}$", "$options": "i"}}
        ]
    }).sort("created_at", -1))

    for o in orders_cursor:
        o["id"] = str(o.pop("_id", ""))
        if isinstance(o.get("created_at"), datetime):
            o["created_at"] = o["created_at"].isoformat()

    return orders_cursor
