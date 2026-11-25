"""Seed a user_sessions doc for testing."""
import asyncio, os, uuid
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent.parent / ".env")

async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    user_id = "user_testplantia01"
    token = "TEST_SESSION_" + uuid.uuid4().hex
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"user_id": user_id, "email": "TEST_plantia@example.com", "name": "Test Plantia", "picture": None, "created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
    })
    print(token)
    print(user_id)
asyncio.run(main())
