from fastapi import APIRouter, HTTPException, Query, status, Depends
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app import models
from app.api import deps
from app.core.database import db
from app.schemas.payment_card import PaymentCardCreate, PaymentCardUpdate, PaymentCardResponse

router = APIRouter()

def serialize_card(doc: dict) -> dict:
    if not doc:
        return {}
    doc_copy = dict(doc)
    doc_copy["id"] = str(doc_copy.get("_id", ""))
    return doc_copy

@router.get("", response_model=List[PaymentCardResponse])
def get_user_cards(
    email: Optional[str] = Query(None),
    current_user: Optional[models.User] = Depends(deps.get_current_user_optional),
):
    """
    Fetch saved payment cards for a user from MongoDB.
    Enforces tenant privacy: users only access their own cards.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to view saved payment cards",
        )

    query = {}
    if not getattr(current_user, "is_admin", False):
        user_email = (current_user.email or "").strip().lower()
        if email and email.strip().lower() != user_email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access cards of another user",
            )
        query["user_email"] = user_email
    else:
        if email:
            query["user_email"] = email.strip().lower()

    docs = list(db.payment_cards.find(query).sort("created_at", -1))
    return [PaymentCardResponse(**serialize_card(d)) for d in docs]


@router.post("", response_model=PaymentCardResponse, status_code=status.HTTP_201_CREATED)
def create_user_card(
    card_in: PaymentCardCreate,
    current_user: Optional[models.User] = Depends(deps.get_current_user_optional),
):
    """
    Save a new payment card to MongoDB.
    """
    email_clean = card_in.user_email.strip().lower()

    if current_user and not getattr(current_user, "is_admin", False):
        user_clean = (current_user.email or "").strip().lower()
        if email_clean != user_clean:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot save payment card under another user's email",
            )

    existing_count = db.payment_cards.count_documents({"user_email": email_clean})
    is_default = card_in.is_default
    if existing_count == 0:
        is_default = True

    if is_default:
        db.payment_cards.update_many(
            {"user_email": email_clean},
            {"$set": {"is_default": False}}
        )

    doc_data = card_in.model_dump()
    doc_data["user_email"] = email_clean
    doc_data["is_default"] = is_default
    doc_data["created_at"] = datetime.utcnow()

    res = db.payment_cards.insert_one(doc_data)
    created_doc = db.payment_cards.find_one({"_id": res.inserted_id})
    return PaymentCardResponse(**serialize_card(created_doc))


@router.put("/{card_id}", response_model=PaymentCardResponse)
def update_user_card(
    card_id: str,
    card_in: PaymentCardUpdate,
    current_user: models.User = Depends(deps.get_current_active_user),
):
    """
    Update a saved card in MongoDB.
    """
    if not ObjectId.is_valid(card_id):
        raise HTTPException(status_code=400, detail="Invalid card ID format")

    existing = db.payment_cards.find_one({"_id": ObjectId(card_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Card not found")

    existing_email = (existing.get("user_email") or "").strip().lower()
    user_email = (current_user.email or "").strip().lower()
    if existing_email != user_email and not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Not authorized to modify this card")

    update_data = {k: v for k, v in card_in.model_dump(exclude_unset=True).items() if v is not None}

    if update_data.get("is_default") is True:
        db.payment_cards.update_many(
            {"user_email": existing["user_email"]},
            {"$set": {"is_default": False}}
        )

    if update_data:
        db.payment_cards.update_one({"_id": ObjectId(card_id)}, {"$set": update_data})

    updated = db.payment_cards.find_one({"_id": ObjectId(card_id)})
    return PaymentCardResponse(**serialize_card(updated))


@router.put("/{card_id}/default", response_model=PaymentCardResponse)
def set_default_card(
    card_id: str,
    current_user: models.User = Depends(deps.get_current_active_user),
):
    """
    Set a saved card as the default payment card.
    """
    if not ObjectId.is_valid(card_id):
        raise HTTPException(status_code=400, detail="Invalid card ID format")

    existing = db.payment_cards.find_one({"_id": ObjectId(card_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Card not found")

    existing_email = (existing.get("user_email") or "").strip().lower()
    user_email = (current_user.email or "").strip().lower()
    if existing_email != user_email and not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Not authorized to modify this card")

    user_email_target = existing.get("user_email")
    if user_email_target:
        db.payment_cards.update_many(
            {"user_email": user_email_target},
            {"$set": {"is_default": False}}
        )

    db.payment_cards.update_one({"_id": ObjectId(card_id)}, {"$set": {"is_default": True}})
    updated = db.payment_cards.find_one({"_id": ObjectId(card_id)})
    return PaymentCardResponse(**serialize_card(updated))


@router.delete("/{card_id}")
def delete_user_card(
    card_id: str,
    current_user: models.User = Depends(deps.get_current_active_user),
):
    """
    Delete a saved card from MongoDB.
    """
    if not ObjectId.is_valid(card_id):
        raise HTTPException(status_code=400, detail="Invalid card ID format")

    existing = db.payment_cards.find_one({"_id": ObjectId(card_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Card not found")

    existing_email = (existing.get("user_email") or "").strip().lower()
    user_email = (current_user.email or "").strip().lower()
    if existing_email != user_email and not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Not authorized to delete this card")

    user_email_target = existing.get("user_email")
    was_default = existing.get("is_default", False)

    db.payment_cards.delete_one({"_id": ObjectId(card_id)})

    if was_default and user_email_target:
        next_card = db.payment_cards.find_one({"user_email": user_email_target}, sort=[("created_at", -1)])
        if next_card:
            db.payment_cards.update_one({"_id": next_card["_id"]}, {"$set": {"is_default": True}})

    return {"success": True, "message": "Card deleted successfully"}
