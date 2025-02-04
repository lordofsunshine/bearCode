from datetime import datetime, timedelta
from typing import Dict, List, Optional
import os
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database

load_dotenv()

MONGODB_URI = os.getenv('MONGODB_URI')
if not MONGODB_URI:
    raise ValueError("MONGODB_URI must be set in .env file")

class DatabaseManager:
    def __init__(self):
        self.client = MongoClient(MONGODB_URI)
        self.db: Database = self.client.brevocode
        self.chats: Collection = self.db.chats
        self.shared: Collection = self.db.shared
        self._setup_indexes()

    def _setup_indexes(self):
        self.chats.create_index("metadata.created_at", expireAfterSeconds=30 * 24 * 60 * 60)
        self.shared.create_index("created_at", expireAfterSeconds=30 * 24 * 60 * 60)

    def create_chat(self, chat_id: str) -> bool:
        try:
            self.chats.insert_one({
                "chat_id": chat_id,
                "messages": [],
                "metadata": {
                    "created_at": datetime.utcnow(),
                    "title": "New Chat"
                }
            })
            return True
        except Exception:
            return False

    def get_chat(self, chat_id: str) -> Optional[Dict]:
        return self.chats.find_one({"chat_id": chat_id}, {"_id": 0})

    def update_chat(self, chat_id: str, messages: List[Dict], metadata: Dict) -> bool:
        try:
            self.chats.update_one(
                {"chat_id": chat_id},
                {
                    "$set": {
                        "messages": messages,
                        "metadata": metadata
                    }
                },
                upsert=True
            )
            return True
        except Exception:
            return False

    def share_chat(self, chat_id: str) -> bool:
        try:
            chat = self.get_chat(chat_id)
            if not chat:
                return False

            self.shared.update_one(
                {"chat_id": chat_id},
                {
                    "$set": {
                        "messages": chat["messages"],
                        "metadata": chat["metadata"],
                        "created_at": datetime.utcnow()
                    }
                },
                upsert=True
            )
            return True
        except Exception:
            return False

    def get_shared_chat(self, chat_id: str) -> Optional[Dict]:
        return self.shared.find_one({"chat_id": chat_id}, {"_id": 0})

    def cleanup_old_data(self):
        month_ago = datetime.utcnow() - timedelta(days=30)
        self.chats.delete_many({"metadata.created_at": {"$lt": month_ago}})
        self.shared.delete_many({"created_at": {"$lt": month_ago}})

    def close(self):
        self.client.close()

db = DatabaseManager() 