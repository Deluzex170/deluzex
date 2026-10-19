from datetime import datetime
from typing import Literal, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, model_validator
from app.api.deps import get_current_active_admin
from app.core.database import db
from app.services.email_templates import VARIABLES, defaults, render_content, validate_content

router = APIRouter(dependencies=[Depends(get_current_active_admin)])


class TemplateInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    subject: str = Field(min_length=1, max_length=240)
    text_body: str = Field(min_length=1, max_length=50000)
    html_body: str = Field(min_length=1, max_length=100000)
    event: Optional[Literal["verification", "password_reset"]] = None

    @model_validator(mode="after")
    def check_content(self):
        if not self.name.strip() or not self.subject.strip():
            raise ValueError("Name and subject cannot be blank.")
        validate_content(self.subject, self.text_body, self.html_body, self.event)
        return self


def template_id(value):
    if not ObjectId.is_valid(value):
        raise HTTPException(404, "Template not found.")
    return ObjectId(value)


def serialize(doc, event=None):
    return {**{key: value for key, value in doc.items() if key != "_id"},
            "id": str(doc["_id"]), "event": event}


def bind_event(identifier, event):
    # Fixed event IDs make assignment atomic: at most one active template/event.
    db.email_template_bindings.delete_many({"template_id": identifier, "_id": {"$ne": event}})
    if event:
        db.email_template_bindings.update_one({"_id": event}, {"$set": {"template_id": identifier}}, upsert=True)


@router.get("")
def list_templates():
    bindings = {item["template_id"]: item["_id"] for item in db.email_template_bindings.find({})}
    return {"items": [serialize(doc, bindings.get(doc["_id"]))
                      for doc in db.email_templates.find({}).sort("updated_at", -1)],
            "defaults": defaults(), "variables": VARIABLES}


@router.post("/preview")
def preview_template(payload: TemplateInput):
    return render_content(payload.model_dump(), {"otp": "123456", "user_name": "Sample Customer",
                          "expires_minutes": "10", "brand_name": "Deluzex",
                          "support_email": "support@deluzexlighting.com"})


@router.post("", status_code=201)
def create_template(payload: TemplateInput):
    doc = payload.model_dump(exclude={"event"})
    doc.update(created_at=datetime.utcnow(), updated_at=datetime.utcnow())
    doc["_id"] = db.email_templates.insert_one(doc).inserted_id
    bind_event(doc["_id"], payload.event)
    return serialize(doc, payload.event)


@router.put("/{identifier}")
def update_template(identifier: str, payload: TemplateInput):
    oid = template_id(identifier)
    doc = payload.model_dump(exclude={"event"})
    doc["updated_at"] = datetime.utcnow()
    result = db.email_templates.update_one({"_id": oid}, {"$set": doc})
    if result.matched_count == 0:
        raise HTTPException(404, "Template not found.")
    bind_event(oid, payload.event)
    return serialize({**doc, "_id": oid}, payload.event)


@router.delete("/{identifier}", status_code=204)
def delete_template(identifier: str):
    oid = template_id(identifier)
    if db.email_templates.delete_one({"_id": oid}).deleted_count == 0:
        raise HTTPException(404, "Template not found.")
    db.email_template_bindings.delete_many({"template_id": oid})
    return Response(status_code=204)
