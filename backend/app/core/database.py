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

