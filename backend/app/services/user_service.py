from typing import Optional
from bson import ObjectId
from app.core.database import db
from app.core.logger import app_logger
from app.services import whatsapp as whatsapp_service


def auto_update_user_checkout_email(email: Optional[str], phone: Optional[str] = None, user_id: Optional[str] = None) -> bool:
    """
    Frictionless Checkout Email Capture:
    If a customer provides a valid email on checkout, and their customer account has
    no email or has an auto-generated placeholder (@deluzex.com), save the email to their
    MongoDB profile so returning customers are never asked again.
    """
    clean_email = (email or "").strip().lower()
    if not clean_email or "@" not in clean_email or clean_email.endswith("@deluzex.com"):
        return False

    try:
        query = None
        if user_id and ObjectId.is_valid(user_id):
            query = {"_id": ObjectId(user_id)}
        elif phone:
            norm_phone = whatsapp_service.normalize_phone_number(phone)
            phone_variants = [norm_phone, phone, f"+{norm_phone}"]
            if norm_phone.startswith("91") and len(norm_phone) == 12:
                phone_variants.append(norm_phone[2:])
            elif len(norm_phone) == 10:
                phone_variants.append(f"91{norm_phone}")
                phone_variants.append(f"+91{norm_phone}")
            query = {"phone": {"$in": phone_variants}}

        if query:
            user_doc = db.users.find_one(query)
            if user_doc:
                curr_email = str(user_doc.get("email") or "")
                if not curr_email or curr_email.endswith("@deluzex.com"):
                    db.users.update_one(
                        {"_id": user_doc["_id"]},
                        {"$set": {"email": clean_email}}
                    )
                    app_logger.info(f"Auto-saved customer {user_doc['_id']} checkout email: {clean_email}")
                    return True
    except Exception as exc:
        app_logger.warning(f"Failed to auto-update customer checkout email: {exc}")

    return False
