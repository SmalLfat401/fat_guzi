"""
发布渠道DAO - 数据访问层
"""
from typing import Optional, List
from datetime import datetime
from pymongo import ASCENDING
import logging

from app.database.mongo_pool import mongo_pool
from app.models.publish_channel import PublishChannel, PublishChannelCreate, PublishChannelUpdate

logger = logging.getLogger(__name__)

COLLECTION_NAME = "publish_channels"


class PublishChannelDAO:
    """发布渠道数据访问对象"""

    def __init__(self):
        self._collection = None

    @property
    def collection(self):
        if self._collection is None:
            self._collection = mongo_pool.get_collection(COLLECTION_NAME)
            self._ensure_indexes()
            self._init_defaults()
        return self._collection

    def _ensure_indexes(self):
        try:
            existing = self.collection.index_information()
            if "name_1" not in existing:
                self.collection.create_index("name", unique=True)
            if "is_active_1" not in existing:
                self.collection.create_index("is_active")
            logger.info(f"MongoDB index check done: {COLLECTION_NAME}")
        except Exception as e:
            logger.warning(f"Index creation warning: {e}")

    def _init_defaults(self):
        defaults = [
            {"name": "抖音", "icon": "🎵", "is_active": True},
            {"name": "小红书", "icon": "📕", "is_active": True},
        ]
        for d in defaults:
            if not self.find_by_name(d["name"]):
                self.create(PublishChannelCreate(**d))

    def create(self, channel: PublishChannelCreate) -> PublishChannel:
        doc = {
            "name": channel.name,
            "icon": channel.icon,
            "is_active": channel.is_active,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        result = self.collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        return PublishChannel(**doc)

    def find_by_id(self, channel_id: str) -> Optional[PublishChannel]:
        from bson import ObjectId
        try:
            doc = self.collection.find_one({"_id": ObjectId(channel_id)})
        except Exception:
            doc = self.collection.find_one({"_id": channel_id})
        if doc:
            doc["_id"] = str(doc["_id"])
            return PublishChannel(**doc)
        return None

    def find_by_name(self, name: str) -> Optional[PublishChannel]:
        doc = self.collection.find_one({"name": name})
        if doc:
            doc["_id"] = str(doc["_id"])
            return PublishChannel(**doc)
        return None

    def find_all(self) -> List[PublishChannel]:
        cursor = self.collection.find().sort("created_at", ASCENDING)
        results = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            results.append(PublishChannel(**doc))
        return results

    def find_active(self) -> List[PublishChannel]:
        cursor = self.collection.find({"is_active": True}).sort("created_at", ASCENDING)
        results = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            results.append(PublishChannel(**doc))
        return results

    def count(self) -> int:
        return self.collection.count_documents({})

    def update(self, channel_id: str, update: PublishChannelUpdate) -> Optional[PublishChannel]:
        from bson import ObjectId
        try:
            query = {"_id": ObjectId(channel_id)}
        except Exception:
            query = {"_id": channel_id}

        update_data = update.model_dump(exclude_unset=True)
        if not update_data:
            return self.find_by_id(channel_id)

        update_data["updated_at"] = datetime.utcnow()
        self.collection.update_one(query, {"$set": update_data})
        return self.find_by_id(channel_id)

    def delete(self, channel_id: str) -> bool:
        from bson import ObjectId
        try:
            result = self.collection.delete_one({"_id": ObjectId(channel_id)})
        except Exception:
            result = self.collection.delete_one({"_id": channel_id})
        return result.deleted_count > 0


publish_channel_dao = PublishChannelDAO()
