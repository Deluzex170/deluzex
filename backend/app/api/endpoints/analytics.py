import re
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Request, Query, status
from bson import ObjectId

from app.core.database import db
from app.schemas.visitor_log import (
    VisitEventCreate,
    VisitorLogResponse,
    AnalyticsStatsResponse,
    DeviceBreakdown,
    TopPage,
    DailyTrend,
    MemberActivity,
)

router = APIRouter()

def serialize_log(doc: dict) -> dict:
    if not doc:
        return {}
    doc_copy = dict(doc)
    doc_copy["id"] = str(doc_copy.get("_id", ""))
    return doc_copy

def parse_user_agent(ua_str: str, screen_width: Optional[int] = None) -> tuple[str, str, str]:
    ua = ua_str.lower() if ua_str else ""

    # Device
    if screen_width and screen_width <= 768:
        device = "Mobile"
    elif screen_width and screen_width <= 1024:
        device = "Tablet"
    elif "ipad" in ua or "tablet" in ua:
        device = "Tablet"
    elif "mobi" in ua or "android" in ua or "iphone" in ua:
        device = "Mobile"
    else:
        device = "Desktop"

    # Browser
    if "edg" in ua:
        browser = "Edge"
    elif "chrome" in ua and "chromium" not in ua:
        browser = "Chrome"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "opera" in ua or "opr" in ua:
        browser = "Opera"
    else:
        browser = "Other"

    # OS
    if "windows" in ua:
        os = "Windows"
    elif "macintosh" in ua or "mac os" in ua:
        os = "macOS"
    elif "iphone" in ua or "ipad" in ua or "ios" in ua:
        os = "iOS"
    elif "android" in ua:
        os = "Android"
    elif "linux" in ua:
        os = "Linux"
    else:
        os = "Other"

    return device, browser, os

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "127.0.0.1"


@router.post("/visit", status_code=status.HTTP_201_CREATED)
def record_visitor(event: VisitEventCreate, request: Request):
    """
    Record a page visit event into MongoDB.
    """
    ip = get_client_ip(request)
    device, browser, os_name = parse_user_agent(event.user_agent or "", event.screen_width)

    # Don't log admin pages into visitor logs
    if event.path.startswith("/admin"):
        return {"success": True, "skipped": True}

    doc = {
        "visitor_id": event.visitor_id,
        "session_id": event.session_id,
        "path": event.path or "/",
        "referrer": event.referrer or "",
        "ip_address": ip,
        "user_agent": event.user_agent or "",
        "device_type": device,
        "browser": browser,
        "os": os_name,
        "is_member": bool(event.is_member),
        "user_email": event.user_email.strip().lower() if event.user_email else None,
        "user_name": event.user_name.strip() if event.user_name else None,
        "user_id": str(event.user_id) if event.user_id else None,
        "created_at": datetime.utcnow(),
    }

    res = db.visitor_logs.insert_one(doc)
    return {"success": True, "id": str(res.inserted_id)}


@router.get("/stats", response_model=AnalyticsStatsResponse)
def get_analytics_stats():
    """
    Get aggregated analytics: total views, unique visitors, member visits,
    active now, device breakdown, top visited pages, and 7-day trend.
    """
    total_views = db.visitor_logs.count_documents({})

    # Unique visitors by visitor_id
    unique_visitors_list = db.visitor_logs.distinct("visitor_id")
    total_unique = len(unique_visitors_list)

    # Registered members visited
    member_emails = db.visitor_logs.distinct("user_email", {"is_member": True, "user_email": {"$ne": None}})
    total_members = len(member_emails)
    total_guests = max(0, total_unique - total_members)

    # Active now (visited within last 15 minutes)
    fifteen_mins_ago = datetime.utcnow() - timedelta(minutes=15)
    active_now_list = db.visitor_logs.distinct("visitor_id", {"created_at": {"$gte": fifteen_mins_ago}})
    active_now = len(active_now_list)

    # Device breakdown
    desktop_count = db.visitor_logs.count_documents({"device_type": "Desktop"})
    mobile_count = db.visitor_logs.count_documents({"device_type": "Mobile"})
    tablet_count = db.visitor_logs.count_documents({"device_type": "Tablet"})

    # Top visited pages
    pipeline_pages = [
        {"$group": {"_id": "$path", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 6},
    ]
    top_pages_agg = list(db.visitor_logs.aggregate(pipeline_pages))
    top_pages = [TopPage(path=p["_id"] or "/", views=p["count"]) for p in top_pages_agg]

    # Daily trends (last 7 days)
    daily_trends = []
    for i in range(6, -1, -1):
        day_start = (datetime.utcnow() - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        day_str = day_start.strftime("%b %d")

        views_count = db.visitor_logs.count_documents({"created_at": {"$gte": day_start, "$lt": day_end}})
        unique_count = len(db.visitor_logs.distinct("visitor_id", {"created_at": {"$gte": day_start, "$lt": day_end}}))
        members_count = db.visitor_logs.count_documents({"is_member": True, "created_at": {"$gte": day_start, "$lt": day_end}})

        daily_trends.append(DailyTrend(
            date=day_str,
            total_views=views_count,
            unique_visitors=unique_count,
            member_views=members_count,
        ))

    return AnalyticsStatsResponse(
        total_page_views=total_views,
        total_unique_visitors=total_unique,
        total_member_visitors=total_members,
        total_guest_visitors=total_guests,
        active_now=active_now,
        devices=DeviceBreakdown(desktop=desktop_count, mobile=mobile_count, tablet=tablet_count),
        top_pages=top_pages,
        daily_trends=daily_trends,
    )


@router.get("/visitors", response_model=List[VisitorLogResponse])
def get_visitor_logs(
    filter: str = Query("all", description="all, members, guests"),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """
    Get detailed visitor logs with filtering and search.
    """
    query = {}
    if filter == "members":
        query["is_member"] = True
    elif filter == "guests":
        query["is_member"] = False

    if search and search.strip():
        term = re.escape(search.strip())
        query["$or"] = [
            {"user_email": {"$regex": term, "$options": "i"}},
            {"user_name": {"$regex": term, "$options": "i"}},
            {"path": {"$regex": term, "$options": "i"}},
            {"ip_address": {"$regex": term, "$options": "i"}},
            {"visitor_id": {"$regex": term, "$options": "i"}},
        ]

    docs = list(
        db.visitor_logs.find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return [VisitorLogResponse(**serialize_log(d)) for d in docs]


@router.get("/members", response_model=List[MemberActivity])
def get_member_visitors():
    """
    Get all registered members who have visited the website,
    with their visit frequency, last seen time, and last visited path.
    """
    pipeline = [
        {"$match": {"is_member": True, "user_email": {"$ne": None}}},
        {"$sort": {"created_at": -1}},
        {
            "$group": {
                "_id": "$user_email",
                "name": {"$first": "$user_name"},
                "total_visits": {"$sum": 1},
                "last_seen": {"$first": "$created_at"},
                "last_path": {"$first": "$path"},
            }
        },
        {"$sort": {"last_seen": -1}},
        {"$limit": 50},
    ]

    agg = list(db.visitor_logs.aggregate(pipeline))
    result = []
    for item in agg:
        email = item["_id"]
        name = item.get("name") or email.split("@")[0].capitalize()
        result.append(MemberActivity(
            email=email,
            name=name,
            total_visits=item["total_visits"],
            last_seen=item["last_seen"],
            last_path=item.get("last_path") or "/",
        ))

    return result


@router.get("/dashboard-summary")
def get_dashboard_summary():
    """
    High-level executive dashboard summary combining revenue, orders, inventory,
    customer, inquiry, review, and traffic metrics.
    """
    # 1. Revenue & Orders
    pipeline_rev = [
        {
            "$group": {
                "_id": None,
                "total_revenue": {"$sum": "$total_amount"},
                "total_orders": {"$sum": 1}
            }
        }
    ]
    rev_agg = list(db.orders.aggregate(pipeline_rev))
    total_rev = round(rev_agg[0]["total_revenue"], 2) if rev_agg else 0.0
    total_orders = rev_agg[0]["total_orders"] if rev_agg else 0

    pending_orders = db.orders.count_documents({
        "status": {"$in": ["pending", "confirmed", "processing"]}
    })
    delivered_orders = db.orders.count_documents({"status": "delivered"})

    # Recent 5 orders
    recent_orders_docs = list(db.orders.find({}).sort("created_at", -1).limit(5))
    recent_orders = []
    for o in recent_orders_docs:
        c_name = o.get("customer", {}).get("name") if isinstance(o.get("customer"), dict) else "Customer"
        recent_orders.append({
            "id": str(o.get("_id", "")),
            "order_number": o.get("order_number") or f"ORD-{str(o.get('_id', ''))[:6]}",
            "customer_name": c_name,
            "total_amount": o.get("total_amount", 0.0),
            "status": o.get("status", "pending"),
            "created_at": o.get("created_at").isoformat() if isinstance(o.get("created_at"), datetime) else str(o.get("created_at", ""))
        })

    # 2. Inventory Alerts
    total_products = db.products.count_documents({})
    low_stock_docs = list(db.products.find({"stock": {"$lte": 5}}).limit(6))
    low_stock_count = db.products.count_documents({"stock": {"$lte": 5}})
    out_of_stock_count = db.products.count_documents({"stock": {"$lte": 0}})

    low_stock_items = []
    for p in low_stock_docs:
        low_stock_items.append({
            "id": str(p.get("_id", "")),
            "name": p.get("product_name") or p.get("title") or "Unnamed Piece",
            "stock": p.get("stock", 0)
        })

    # 3. Inquiries & Moderation
    pending_inquiries = db.contacts.count_documents({
        "$or": [{"status": "new"}, {"status": {"$exists": False}}]
    })
    pending_reviews = db.reviews.count_documents({"is_approved": False})

    # 4. Audience
    total_customers = db.users.count_documents({"$or": [{"is_admin": False}, {"is_admin": {"$exists": False}}]})
    newsletter_subscribers = db.newsletter_subscribers.count_documents({})
    total_visits = db.visitor_logs.count_documents({})

    return {
        "revenue": {
            "total": total_rev,
            "orders_count": total_orders,
            "pending_orders": pending_orders,
            "delivered_orders": delivered_orders,
            "recent_orders": recent_orders
        },
        "inventory": {
            "total_products": total_products,
            "low_stock_count": low_stock_count,
            "out_of_stock_count": out_of_stock_count,
            "low_stock_items": low_stock_items
        },
        "operations": {
            "pending_inquiries": pending_inquiries,
            "pending_reviews": pending_reviews,
            "total_customers": total_customers,
            "newsletter_subscribers": newsletter_subscribers,
            "total_visits": total_visits
        }
    }
