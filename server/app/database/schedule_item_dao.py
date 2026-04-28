"""
排期条目DAO - 数据访问层
"""
from typing import Optional, List, Dict
from datetime import datetime
from pymongo import ASCENDING, DESCENDING
import logging

from app.database.mongo_pool import mongo_pool
from app.models.schedule_item import (
    ScheduleItem, ScheduleItemCreate, ScheduleItemUpdate,
    PlatformPublishStatus, LinkedSlangItem,
    PublishStatus,
)

logger = logging.getLogger(__name__)

COLLECTION_NAME = "schedule_items"


class ScheduleItemDAO:
    """排期条目数据访问对象"""

    def __init__(self):
        self._collection = None

    @property
    def collection(self):
        if self._collection is None:
            self._collection = mongo_pool.get_collection(COLLECTION_NAME)
            self._ensure_indexes()
        return self._collection

    def _ensure_indexes(self):
        try:
            existing = self.collection.index_information()
            if "week_year_1" not in existing:
                self.collection.create_index([("week_year", ASCENDING), ("date", ASCENDING), ("content_type", ASCENDING)])
            if "date_1" not in existing:
                self.collection.create_index("date")
            if "content_type_1" not in existing:
                self.collection.create_index("content_type")
            if "created_at_-1" not in existing:
                self.collection.create_index([("created_at", DESCENDING)])
            logger.info(f"MongoDB index check done: {COLLECTION_NAME}")
        except Exception as e:
            logger.warning(f"Index creation warning: {e}")

    def create(self, item: ScheduleItemCreate) -> ScheduleItem:
        # 从渠道DAO获取所有已激活渠道，初始化空状态
        from app.database.publish_channel_dao import publish_channel_dao
        active_channels = publish_channel_dao.find_active()
        platforms: Dict[str, PlatformPublishStatus] = {}
        for ch in active_channels:
            platforms[ch.id] = PlatformPublishStatus(status=PublishStatus.PENDING)

        doc = {
            "week_year": item.week_year,
            "date": item.date,
            "content_type": item.content_type,
            "title": item.title,
            "body": item.body,
            "images": item.images,
            "slang_category": item.slang_category,
            "linked_slags": [s.model_dump() for s in item.linked_slags] if item.linked_slags else [],
            "is_pinned": item.is_pinned,
            "platforms": {k: v.model_dump() for k, v in platforms.items()},
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        result = self.collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        return self._doc_to_model(doc)

    def _doc_to_model(self, doc: dict) -> ScheduleItem:
        doc["_id"] = str(doc["_id"])
        # 反序列化 platforms
        if "platforms" in doc:
            doc["platforms"] = {
                k: PlatformPublishStatus(**v) for k, v in doc["platforms"].items()
            }
        # 反序列化 linked_slags
        if "linked_slags" in doc and doc["linked_slags"]:
            doc["linked_slags"] = [LinkedSlangItem(**s) for s in doc["linked_slags"]]
        return ScheduleItem(**doc)

    def find_by_id(self, item_id: str) -> Optional[ScheduleItem]:
        from bson import ObjectId
        try:
            doc = self.collection.find_one({"_id": ObjectId(item_id)})
        except Exception:
            doc = self.collection.find_one({"_id": item_id})
        if doc:
            return self._doc_to_model(doc)
        return None

    def find_by_ids(self, item_ids: List[str]) -> List[ScheduleItem]:
        from bson import ObjectId
        oids = []
        for iid in item_ids:
            try:
                oids.append(ObjectId(iid))
            except Exception:
                oids.append(iid)
        cursor = self.collection.find({"_id": {"$in": oids}})
        return [self._doc_to_model(doc) for doc in cursor]

    def find_by_week(self, week_year: str) -> List[ScheduleItem]:
        cursor = self.collection.find({"week_year": week_year}).sort("date", ASCENDING)
        return [self._doc_to_model(doc) for doc in cursor]

    def find_by_date_range(self, start_date: str, end_date: str) -> List[ScheduleItem]:
        cursor = self.collection.find({
            "date": {"$gte": start_date, "$lte": end_date}
        }).sort("date", ASCENDING)
        return [self._doc_to_model(doc) for doc in cursor]

    def find_all(self, skip: int = 0, limit: int = 100,
                 content_type: Optional[str] = None,
                 week_year: Optional[str] = None) -> List[ScheduleItem]:
        query = {}
        if content_type:
            query["content_type"] = content_type
        if week_year:
            query["week_year"] = week_year
        cursor = self.collection.find(query).skip(skip).limit(limit).sort([("date", DESCENDING)])
        return [self._doc_to_model(doc) for doc in cursor]

    def count(self, content_type: Optional[str] = None) -> int:
        query = {}
        if content_type:
            query["content_type"] = content_type
        return self.collection.count_documents(query)

    def update(self, item_id: str, update: ScheduleItemUpdate) -> Optional[ScheduleItem]:
        from bson import ObjectId
        try:
            query = {"_id": ObjectId(item_id)}
        except Exception:
            query = {"_id": item_id}

        update_data = update.model_dump(exclude_unset=True)
        if not update_data:
            return self.find_by_id(item_id)

        if "linked_slags" in update_data:
            update_data["linked_slags"] = [s if isinstance(s, dict) else s.model_dump() for s in update_data["linked_slags"]]

        update_data["updated_at"] = datetime.utcnow()
        self.collection.update_one(query, {"$set": update_data})
        return self.find_by_id(item_id)

    def update_platform_status(
        self,
        item_id: str,
        platform_id: str,
        status: str,
        note: Optional[str] = None
    ) -> Optional[ScheduleItem]:
        item = self.find_by_id(item_id)
        if not item:
            return None

        # 获取当前平台状态
        current = item.platforms.get(platform_id)
        if current is None:
            current = PlatformPublishStatus()

        new_platforms = dict(item.platforms)
        new_platforms[platform_id] = PlatformPublishStatus(
            status=status,
            published_at=current.published_at,
            confirmed_at=current.confirmed_at,
            note=note if note is not None else current.note,
        )

        if status == PublishStatus.PUBLISHED:
            new_platforms[platform_id].published_at = datetime.utcnow()
        elif status == PublishStatus.CONFIRMED:
            new_platforms[platform_id].confirmed_at = datetime.utcnow()

        from bson import ObjectId
        try:
            query = {"_id": ObjectId(item_id)}
        except Exception:
            query = {"_id": item_id}

        self.collection.update_one(query, {
            "$set": {
                f"platforms.{platform_id}": new_platforms[platform_id].model_dump(),
                "updated_at": datetime.utcnow(),
            }
        })
        return self.find_by_id(item_id)

    def toggle_pinned(self, item_id: str) -> Optional[ScheduleItem]:
        item = self.find_by_id(item_id)
        if not item:
            return None
        from bson import ObjectId
        try:
            query = {"_id": ObjectId(item_id)}
        except Exception:
            query = {"_id": item_id}
        self.collection.update_one(query, {
            "$set": {"is_pinned": not item.is_pinned, "updated_at": datetime.utcnow()}
        })
        return self.find_by_id(item_id)

    def delete(self, item_id: str) -> bool:
        from bson import ObjectId
        try:
            result = self.collection.delete_one({"_id": ObjectId(item_id)})
        except Exception:
            result = self.collection.delete_one({"_id": item_id})
        return result.deleted_count > 0


schedule_item_dao = ScheduleItemDAO()
