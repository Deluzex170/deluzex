from fastapi import APIRouter, HTTPException, Depends, Body, Query, status
from typing import Dict, Any, List, Optional
from datetime import datetime
from bson import ObjectId
from app import models
from app.api.deps import get_current_active_admin
from app.core.database import db

router = APIRouter()

DEFAULT_FAQS = [
    # Collaborate FAQs
    {
        "question": "Can I apply if I'm still studying?",
        "answer": "Yes, Design And Architecture Students Can Apply, Along With Practising Architects, Interior Designers And Lighting Designers.",
        "category": "collaborate",
        "sequence": 1,
        "is_active": True,
    },
    {
        "question": "How are royalties calculated?",
        "answer": "Royalties are calculated as a fixed percentage on the net selling price of every unit sold across our global e-commerce platform, showroom partner network, and bespoke architectural trade orders.",
        "category": "collaborate",
        "sequence": 2,
        "is_active": True,
    },
    {
        "question": "When will I hear back?",
        "answer": "Our design and engineering panel reviews submissions every fortnight. You will receive an initial review status and manufacturing feasibility feedback within 10 to 14 business days.",
        "category": "collaborate",
        "sequence": 3,
        "is_active": True,
    },
    {
        "question": "Who owns the design?",
        "answer": "You retain moral authorship and credit rights as the creator. Deluzex acquires an exclusive manufacturing and worldwide distribution license for the realized commercial product line.",
        "category": "collaborate",
        "sequence": 4,
        "is_active": True,
    },
    {
        "question": "Can I submit a light designed for a client?",
        "answer": "Yes, provided that your client agreement allows you to retain or license the design concept, or if written commercialization permission has been granted.",
        "category": "collaborate",
        "sequence": 5,
        "is_active": True,
    },
    {
        "question": "What happens if my design is not selected?",
        "answer": "Your concept remains your sole intellectual property. With your permission, we keep it in our archive for future thematic collections, or provide guidance on refining it for future consideration.",
        "category": "collaborate",
        "sequence": 6,
        "is_active": True,
    },
    # Support FAQs
    {
        "question": "How long does custom fixture manufacturing take?",
        "answer": "Typically, bespoke or customized architectural pieces take 4-6 weeks to manufacture, electroplate, and inspect prior to white-glove dispatch.",
        "category": "support",
        "sequence": 1,
        "is_active": True,
    },
    {
        "question": "Can I inspect orders and tracking status in real time?",
        "answer": "Yes! Navigate to Track Orders in your dashboard to view your real-time processing and shipping milestones.",
        "category": "support",
        "sequence": 2,
        "is_active": True,
    },
    {
        "question": "What is your warranty and returns coverage?",
        "answer": "Every DeLuzex fixture comes backed by our 5-year structural warranty and 30-day architectural return policy.",
        "category": "support",
        "sequence": 3,
        "is_active": True,
    },
    # Product Page FAQs
    {
        "question": "Do you offer custom lighting solutions?",
        "answer": "Yes, our studio creates bespoke lighting pieces tailored to your exact architectural space, ceiling height, and aesthetic requirements.",
        "category": "product",
        "sequence": 1,
        "is_active": True,
    },
    {
        "question": "What is the lead time for custom architectural orders?",
        "answer": "Standard custom production takes 3-4 weeks depending on the design complexity, hand-blown glass, and artisanal metallic finishes.",
        "category": "product",
        "sequence": 2,
        "is_active": True,
    },
    {
        "question": "Do you provide installation support across India?",
        "answer": "Yes, we provide detailed technical wiring schematics and coordinate with certified electricians and white-glove technicians across major metro cities.",
        "category": "product",
        "sequence": 3,
        "is_active": True,
    },
    {
        "question": "Can I request a specific metallic finish or custom cord length?",
        "answer": "Absolutely! Our studio can customize dimensions, metallic finishes (brushed brass, antique gold, matte black, satin nickel), and suspension drop lengths.",
        "category": "product",
        "sequence": 4,
        "is_active": True,
    },
    {
        "question": "Do your luminaires come with a comprehensive warranty?",
        "answer": "All our luxury lighting fixtures include a comprehensive 3-year warranty covering manufacturing integrity, structural metalwork, and electrical components.",
        "category": "product",
        "sequence": 5,
        "is_active": True,
    },
    {
        "question": "How are fixtures packaged for insured pan-India delivery?",
        "answer": "Every luminaire is secured in custom high-density foam within export-grade reinforced wooden crates, insured against all transit damage.",
        "category": "product",
        "sequence": 6,
        "is_active": True,
    },
    {
        "question": "Are Deluzex luminaires compatible with smart home automation and dimmers?",
        "answer": "All our LED drivers and dimmable chandeliers are engineered to interface smoothly with Lutron, Dali, Control4, Casambi, and standard TRIAC trailing-edge wall dimmers.",
        "category": "product",
        "sequence": 7,
        "is_active": True,
    },
]

def ensure_faqs_seeded():
    """Seed default FAQs if the collection is empty."""
    count = db.faqs.count_documents({})
    if count == 0:
        now = datetime.utcnow()
        seeded_docs = []
        for item in DEFAULT_FAQS:
            doc = {**item, "created_at": now, "updated_at": now}
            seeded_docs.append(doc)
        if seeded_docs:
            db.faqs.insert_many(seeded_docs)

@router.get("")
def get_faqs(
    category: Optional[str] = Query(None, description="Filter by category: collaborate, support, or general"),
    include_inactive: bool = Query(False, description="Include inactive FAQs (admin usage)"),
):
    """
    Get all active FAQs (or filter by category). Auto-seeds defaults on first access.
    """
    ensure_faqs_seeded()

    query: Dict[str, Any] = {}
    if not include_inactive:
        query["is_active"] = True

    if category and category.lower() != "all":
        query["category"] = category.lower()

    docs = list(db.faqs.find(query).sort("sequence", 1))

    items = []
    for doc in docs:
        doc["_id"] = str(doc["_id"])
        items.append(doc)

    return items

@router.post("", status_code=status.HTTP_201_CREATED)
def create_faq(
    faq: models.FAQItem,
    current_user: models.User = Depends(get_current_active_admin),
):
    """
    Create a new FAQ item (Admin only).
    """
    now = datetime.utcnow()
    doc = faq.model_dump(by_alias=True, exclude_none=True)
    doc.pop("_id", None)
    doc["created_at"] = now
    doc["updated_at"] = now

    result = db.faqs.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc

@router.put("/{faq_id}")
def update_faq(
    faq_id: str,
    payload: Dict[str, Any] = Body(...),
    current_user: models.User = Depends(get_current_active_admin),
):
    """
    Update an existing FAQ item (Admin only).
    """
    try:
        obj_id = ObjectId(faq_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid FAQ ID format")

    update_fields = {}
    if "question" in payload:
        update_fields["question"] = str(payload["question"]).strip()
    if "answer" in payload:
        update_fields["answer"] = str(payload["answer"]).strip()
    if "category" in payload:
        update_fields["category"] = str(payload["category"]).strip().lower()
    if "sequence" in payload:
        update_fields["sequence"] = int(payload["sequence"])
    if "is_active" in payload:
        update_fields["is_active"] = bool(payload["is_active"])

    update_fields["updated_at"] = datetime.utcnow()

    result = db.faqs.update_one({"_id": obj_id}, {"$set": update_fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="FAQ not found")

    updated_doc = db.faqs.find_one({"_id": obj_id})
    updated_doc["_id"] = str(updated_doc["_id"])
    return updated_doc

@router.delete("/{faq_id}")
def delete_faq(
    faq_id: str,
    current_user: models.User = Depends(get_current_active_admin),
):
    """
    Delete an FAQ item (Admin only).
    """
    try:
        obj_id = ObjectId(faq_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid FAQ ID format")

    result = db.faqs.delete_one({"_id": obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="FAQ not found")

    return {"success": True, "id": faq_id}

@router.post("/seed")
def seed_faqs_manually(
    current_user: models.User = Depends(get_current_active_admin),
):
    """
    Force re-seed default FAQs (Admin only).
    """
    ensure_faqs_seeded()
    return {"success": True, "message": "Default FAQs verified/seeded successfully."}
