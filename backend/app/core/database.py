import os
import time
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient
from app.core.logger import app_logger

# Ensure environment variables are loaded from root or backend directory (.env.local or .env)
for _candidate in [
    Path(__file__).resolve().parents[3] / ".env.local",
    Path(__file__).resolve().parents[3] / ".env",
    Path(__file__).resolve().parents[2] / ".env.local",
    Path(__file__).resolve().parents[2] / ".env",
]:
    if _candidate.exists():
        load_dotenv(_candidate)

MONGO_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI") or "mongodb://localhost:27017"
DATABASE_NAME = os.getenv("MONGODB_DATABASE", "Deluzex")

# Defer DNS/connection work until startup or the first database operation, so
# a temporary database outage cannot prevent the API routes from importing.
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, connect=False)
db = client[DATABASE_NAME]


def init_db():
    """Validates MongoDB connection, logs latency, and returns (db, ping_ms, is_connected)."""
    t0 = time.perf_counter()
    try:
        client.admin.command("ping")
        ping_ms = (time.perf_counter() - t0) * 1000.0
        collections = db.list_collection_names()
        app_logger.info(f"MongoDB connection verified: '{DATABASE_NAME}' ({len(collections)} collections, {ping_ms:.1f}ms ping)")
        return db, ping_ms, True
    except Exception as exc:
        app_logger.error(f"Failed to connect to MongoDB: {exc}")
        return db, 0.0, False


def ensure_database_indexes(database=None) -> bool:
    """
    Creates essential compound, unique, and TTL database indexes for high performance in production.
    Idempotent operation: creates indexes only if missing.
    """
    target_db = database if database is not None else db
    try:
        # Users: Unique email
        target_db.users.create_index("email", unique=True, sparse=True)
        # Coupons: Unique promotional code
        target_db.coupons.create_index("code", unique=True)
        # Orders: Fast customer queries & order status filtering
        target_db.orders.create_index([("email", 1), ("created_at", -1)])
        target_db.orders.create_index("status")
        target_db.orders.create_index("razorpay_order_id", sparse=True)
        # Products: Fast category & availability filtering
        target_db.products.create_index("category")
        target_db.products.create_index("in_stock")
        # Cart Items: Fast lookup by user or guest session
        target_db.cart_items.create_index("user_email")
        target_db.cart_items.create_index("session_id")
        # TTL Index: Automatic MongoDB purge of OTPs after 600 seconds
        target_db.email_otps.create_index("created_at", expireAfterSeconds=600)

        app_logger.info("MongoDB production database indexes verified and established successfully.")
        return True
    except Exception as exc:
        app_logger.warning(f"Database index creation warning: {exc}")
        return False

