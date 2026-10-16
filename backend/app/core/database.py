from pymongo import MongoClient
import os
import time
from app.core.logger import app_logger

MONGO_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI") or "mongodb://localhost:27017"
DATABASE_NAME = os.getenv("MONGODB_DATABASE", "Deluzex")

client = MongoClient(MONGO_URI)
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

