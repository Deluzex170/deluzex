from fastapi import APIRouter, HTTPException, Query, status, Depends
import re
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app import models
from app.api import deps
from app.core.database import db
from app.schemas.address import AddressCreate, AddressUpdate, AddressResponse

router = APIRouter()

def serialize_address(doc: dict) -> dict:
    if not doc:
        return {}
    doc_copy = dict(doc)
    if "_id" in doc_copy:
        doc_copy["id"] = str(doc_copy.pop("_id"))
    return doc_copy

@router.get("", response_model=List[AddressResponse])
def get_user_addresses(
    email: Optional[str] = Query(None),
    current_user: models.User = Depends(deps.get_current_active_user),
):
    """
    Fetch saved delivery addresses from MongoDB (Authenticated users only).
    """
    query = {}
    if not getattr(current_user, "is_admin", False):
        user_email = (current_user.email or "").strip().lower()
        if email and email.strip().lower() != user_email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access addresses of another user",
            )
        query["user_email"] = user_email
    else:
        if email:
            query["user_email"] = email.strip().lower()

    docs = list(db.addresses.find(query).sort("created_at", -1))
    return [AddressResponse(**serialize_address(d)) for d in docs]


@router.post("", response_model=AddressResponse, status_code=status.HTTP_201_CREATED)
def create_user_address(
    address_in: AddressCreate,
    current_user: Optional[models.User] = Depends(deps.get_current_user_optional),
):
    """
    Save a new delivery address to MongoDB, with deduplication protection.
    If the exact same street, city, and pin_code already exists for this user,
    updates mutable attributes and returns existing address rather than duplicating.
    """
    email_clean = address_in.user_email.strip().lower()

    if current_user and not getattr(current_user, "is_admin", False):
        user_clean = (current_user.email or "").strip().lower()
        if email_clean != user_clean:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot save address under another user's email address",
            )

    street_clean = (address_in.street or "").strip()
    city_clean = (address_in.city or "").strip()
    pin_clean = (address_in.pin_code or "").strip()

    # Deduplication check: check if user already has an address with identical street, city, pin
    existing_addr = db.addresses.find_one({
        "user_email": email_clean,
        "street": {"$regex": f"^{re.escape(street_clean)}$", "$options": "i"},
        "city": {"$regex": f"^{re.escape(city_clean)}$", "$options": "i"},
        "pin_code": pin_clean,
    })

    if existing_addr:
        update_fields = {}
        if address_in.first_name:
            update_fields["first_name"] = address_in.first_name.strip()
        if address_in.last_name:
            update_fields["last_name"] = address_in.last_name.strip()
        if address_in.phone:
            update_fields["phone"] = address_in.phone.strip()
        if address_in.state:
            update_fields["state"] = address_in.state.strip()
        if address_in.type:
            update_fields["type"] = address_in.type.strip()

        if address_in.is_default:
            db.addresses.update_many(
                {"user_email": email_clean},
                {"$set": {"is_default": False}}
            )
            update_fields["is_default"] = True

        if update_fields:
            db.addresses.update_one({"_id": existing_addr["_id"]}, {"$set": update_fields})
            existing_addr = db.addresses.find_one({"_id": existing_addr["_id"]})

        return AddressResponse(**serialize_address(existing_addr))

    # Check if user has any existing addresses
    existing_count = db.addresses.count_documents({"user_email": email_clean})
    is_default = address_in.is_default
    if existing_count == 0:
        is_default = True

    # If this is default, reset all other addresses for this user
    if is_default:
        db.addresses.update_many(
            {"user_email": email_clean},
            {"$set": {"is_default": False}}
        )

    doc_data = address_in.model_dump()
    doc_data["user_email"] = email_clean
    doc_data["street"] = street_clean
    doc_data["city"] = city_clean
    doc_data["pin_code"] = pin_clean
    doc_data["is_default"] = is_default
    doc_data["created_at"] = datetime.utcnow()

    res = db.addresses.insert_one(doc_data)
    created_doc = db.addresses.find_one({"_id": res.inserted_id})
    return AddressResponse(**serialize_address(created_doc))


@router.put("/{address_id}", response_model=AddressResponse)
def update_user_address(
    address_id: str,
    address_in: AddressUpdate,
    email: Optional[str] = Query(None),
    current_user: models.User = Depends(deps.get_current_active_user),
):
    """
    Update an existing delivery address in MongoDB.
    """
    if not ObjectId.is_valid(address_id):
        raise HTTPException(status_code=400, detail="Invalid address ID format")

    existing = db.addresses.find_one({"_id": ObjectId(address_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Address not found")

    existing_email = (existing.get("user_email") or "").strip().lower()
    authorized = False
    if getattr(current_user, "is_admin", False):
        authorized = True
    elif (current_user.email or "").strip().lower() == existing_email:
        authorized = True

    if not authorized:
        raise HTTPException(status_code=403, detail="Not authorized to modify this address")

    update_data = {k: v for k, v in address_in.model_dump(exclude_unset=True).items() if v is not None}

    if update_data.get("is_default") is True:
        db.addresses.update_many(
            {"user_email": existing_email},
            {"$set": {"is_default": False}}
        )

    if update_data:
        db.addresses.update_one({"_id": ObjectId(address_id)}, {"$set": update_data})

    updated = db.addresses.find_one({"_id": ObjectId(address_id)})
    return AddressResponse(**serialize_address(updated))


@router.put("/{address_id}/default", response_model=AddressResponse)
def set_default_address(
    address_id: str,
    email: Optional[str] = Query(None),
    current_user: models.User = Depends(deps.get_current_active_user),
):
    """
    Set an address as the default delivery address for the user.
    """
    if not ObjectId.is_valid(address_id):
        raise HTTPException(status_code=400, detail="Invalid address ID format")

    existing = db.addresses.find_one({"_id": ObjectId(address_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Address not found")

    existing_email = (existing.get("user_email") or "").strip().lower()
    authorized = False
    if getattr(current_user, "is_admin", False):
        authorized = True
    elif (current_user.email or "").strip().lower() == existing_email:
        authorized = True

    if not authorized:
        raise HTTPException(status_code=403, detail="Not authorized to modify this address")

    db.addresses.update_many(
        {"user_email": existing_email},
        {"$set": {"is_default": False}}
    )

    db.addresses.update_one({"_id": ObjectId(address_id)}, {"$set": {"is_default": True}})
    updated = db.addresses.find_one({"_id": ObjectId(address_id)})
    return AddressResponse(**serialize_address(updated))


@router.delete("/{address_id}")
def delete_user_address(
    address_id: str,
    email: Optional[str] = Query(None),
    current_user: models.User = Depends(deps.get_current_active_user),
):
    """
    Delete an address from MongoDB.
    """
    if not ObjectId.is_valid(address_id):
        raise HTTPException(status_code=400, detail="Invalid address ID format")

    existing = db.addresses.find_one({"_id": ObjectId(address_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Address not found")

    existing_email = (existing.get("user_email") or "").strip().lower()
    authorized = False
    if getattr(current_user, "is_admin", False):
        authorized = True
    elif (current_user.email or "").strip().lower() == existing_email:
        authorized = True

    if not authorized:
        raise HTTPException(status_code=403, detail="Not authorized to delete this address")

    was_default = existing.get("is_default", False)

    db.addresses.delete_one({"_id": ObjectId(address_id)})

    # If deleted was default, make the most recent remaining address default
    if was_default and existing_email:
        next_addr = db.addresses.find_one({"user_email": existing_email}, sort=[("created_at", -1)])
        if next_addr:
            db.addresses.update_one({"_id": next_addr["_id"]}, {"$set": {"is_default": True}})

    return {"success": True, "message": "Address deleted successfully"}
