import re
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException, status, Depends
from bson import ObjectId

from app import models
from app.api import deps
from app.core.database import db
from app.schemas.audit import AuditLogResponse, AuditStatsResponse

router = APIRouter()

def serialize_audit_doc(doc: dict) -> dict:
    if not doc:
        return {}
    item = dict(doc)
    item["id"] = str(item.get("_id", ""))
    if "user_id" in item and item["user_id"]:
        item["user_id"] = str(item["user_id"])
    
    # Backwards compatibility with older audit logs
    if not item.get("actor_email") and item.get("user_id"):
        # Attempt to lookup user email
        try:
            u = db.users.find_one({"_id": ObjectId(item["user_id"])})
            if u:
                item["actor_email"] = u.get("email")
                item["actor_name"] = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip() or u.get("email")
                item["actor_role"] = "Admin" if u.get("is_admin") else "Customer"
        except Exception:
            pass

    if not item.get("description"):
        item["description"] = item.get("details") or f"Action {item.get('action', 'executed')}"

    if not item.get("action_category"):
        act = item.get("action", "").upper()
        if "LOGIN" in act or "REGISTER" in act or "AUTH" in act:
            item["action_category"] = "auth"
        elif "PRODUCT" in act or "CATEGORY" in act or "CATALOG" in act:
            item["action_category"] = "catalog"
        elif "ORDER" in act or "PAYMENT" in act:
            item["action_category"] = "orders"
        elif "CONTENT" in act or "CMS" in act:
            item["action_category"] = "cms"
        else:
            item["action_category"] = "general"

    return item

@router.get("/logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    category: Optional[str] = Query(None, description="Filter category: auth, catalog, orders, cms, security, all"),
    search: Optional[str] = Query(None, description="Search by actor name, email, target, or action"),
    status: Optional[str] = Query(None, description="Filter status: SUCCESS, FAILED"),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    admin: models.User = Depends(deps.get_current_active_admin),
):
    query: dict = {}

    if category and category.lower() != "all":
        cat = category.lower()
        if cat == "auth":
            query["$or"] = [
                {"action_category": "auth"},
                {"action": {"$regex": "(LOGIN|REGISTER|AUTH)", "$options": "i"}}
            ]
        elif cat == "catalog":
            query["$or"] = [
                {"action_category": "catalog"},
                {"action": {"$regex": "(PRODUCT|CATEGORY|PROJECT|BLOG)", "$options": "i"}}
            ]
        elif cat == "orders":
            query["$or"] = [
                {"action_category": "orders"},
                {"action": {"$regex": "(ORDER|PAYMENT)", "$options": "i"}}
            ]
        elif cat == "cms":
            query["$or"] = [
                {"action_category": "cms"},
                {"action": {"$regex": "(CONTENT|CMS|SETTING)", "$options": "i"}}
            ]
        else:
            query["action_category"] = cat

    if status:
        query["status"] = status.upper()

    if search:
        s_regex = re.escape(search.strip())
        search_filter = {
            "$or": [
                {"actor_email": {"$regex": s_regex, "$options": "i"}},
                {"actor_name": {"$regex": s_regex, "$options": "i"}},
                {"action": {"$regex": s_regex, "$options": "i"}},
                {"target_name": {"$regex": s_regex, "$options": "i"}},
                {"description": {"$regex": s_regex, "$options": "i"}},
                {"details": {"$regex": s_regex, "$options": "i"}},
                {"ip_address": {"$regex": s_regex, "$options": "i"}},
            ]
        }
        if "$or" in query:
            query = {"$and": [query, search_filter]}
        else:
            query.update(search_filter)

    cursor = db.audit_logs.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = list(cursor)
    return [serialize_audit_doc(d) for d in docs]


@router.get("/stats", response_model=AuditStatsResponse)
def get_audit_stats(admin: models.User = Depends(deps.get_current_active_admin)):
    total_events = db.audit_logs.count_documents({})
    
    # 24h count
    since_24h = datetime.utcnow() - timedelta(hours=24)
    recent_24h_events = db.audit_logs.count_documents({"created_at": {"$gte": since_24h}})

    # Logins count
    total_logins = db.audit_logs.count_documents({
        "$or": [
            {"action_category": "auth"},
            {"action": {"$regex": "(LOGIN|REGISTER)", "$options": "i"}}
        ]
    })

    # Modifications count
    total_modifications = db.audit_logs.count_documents({
        "$or": [
            {"action_category": {"$in": ["catalog", "orders", "cms"]}},
            {"action": {"$regex": "(_CREATE|_UPDATE|_DELETE)", "$options": "i"}}
        ]
    })

    # Unique actors
    distinct_emails = db.audit_logs.distinct("actor_email")
    distinct_user_ids = db.audit_logs.distinct("user_id")
    unique_actors = set(filter(None, distinct_emails + [str(u) for u in distinct_user_ids]))
    total_unique_actors = max(len(unique_actors), 1)

    # Categories
    cat_counts = {
        "auth": total_logins,
        "catalog": db.audit_logs.count_documents({
            "$or": [
                {"action_category": "catalog"},
                {"action": {"$regex": "(PRODUCT|CATEGORY|PROJECT|BLOG)", "$options": "i"}}
            ]
        }),
        "orders": db.audit_logs.count_documents({
            "$or": [
                {"action_category": "orders"},
                {"action": {"$regex": "(ORDER|PAYMENT)", "$options": "i"}}
            ]
        }),
        "cms": db.audit_logs.count_documents({
            "$or": [
                {"action_category": "cms"},
                {"action": {"$regex": "(CONTENT|CMS)", "$options": "i"}}
            ]
        }),
    }

    return {
        "total_events": total_events,
        "total_logins": total_logins,
        "total_modifications": total_modifications,
        "total_unique_actors": total_unique_actors,
        "recent_24h_events": recent_24h_events,
        "category_counts": cat_counts
    }


@router.get("/logs/{log_id}", response_model=AuditLogResponse)
def get_audit_log_detail(
    log_id: str,
    admin: models.User = Depends(deps.get_current_active_admin),
):
    if not ObjectId.is_valid(log_id):
        raise HTTPException(status_code=400, detail="Invalid log ID")
    doc = db.audit_logs.find_one({"_id": ObjectId(log_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Audit log entry not found")
    return serialize_audit_doc(doc)
