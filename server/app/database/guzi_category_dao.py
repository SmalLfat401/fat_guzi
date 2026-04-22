"""
谷子商品一级分类 DAO - 数据访问层
集合名称: guzi_categories
"""
from typing import Optional, List
from datetime import datetime
from pymongo import ASCENDING
import logging

from app.database.mongo_pool import mongo_pool
from app.models.guzi_category import (
    GuziCategory,
    GuziCategoryCreate,
    GuziCategoryUpdate,
)

logger = logging.getLogger(__name__)

COLLECTION_NAME = "guzi_categories"


class GuziCategoryDAO:
    """一级分类数据访问对象"""

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
            if "name_unique" not in existing:
                self.collection.create_index(
                    "name",
                    unique=True,
                    name="name_unique"
                )
            if "order_1" not in existing:
                self.collection.create_index([("order", ASCENDING)])
            if "is_active_1" not in existing:
                self.collection.create_index("is_active")
            logger.info(f"MongoDB索引检查完成: {COLLECTION_NAME}")
        except Exception as e:
            logger.warning(f"索引创建警告: {e}")

    def create(self, category: GuziCategoryCreate) -> GuziCategory:
        data = {
            "name": category.name,
            "color": category.color,
            "order": category.order,
            "is_active": category.is_active,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        result = self.collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return GuziCategory(**data)

    def find_by_id(self, category_id: str) -> Optional[GuziCategory]:
        from bson import ObjectId
        try:
            doc = self.collection.find_one({"_id": ObjectId(category_id)})
        except Exception:
            doc = self.collection.find_one({"_id": category_id})
        if doc:
            doc["_id"] = str(doc["_id"])
            return GuziCategory(**doc)
        return None

    def find_by_name(self, name: str) -> Optional[GuziCategory]:
        doc = self.collection.find_one({"name": name})
        if doc:
            doc["_id"] = str(doc["_id"])
            return GuziCategory(**doc)
        return None

    def find_all(
        self,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> List[GuziCategory]:
        query = {}
        if is_active is not None:
            query["is_active"] = is_active
        if search:
            query["name"] = {"$regex": search, "$options": "i"}

        cursor = (
            self.collection.find(query)
            .skip(skip)
            .limit(limit)
            .sort([("order", ASCENDING), ("_id", ASCENDING)])
        )
        categories = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            categories.append(GuziCategory(**doc))
        return categories

    def count(
        self,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> int:
        query = {}
        if is_active is not None:
            query["is_active"] = is_active
        if search:
            query["name"] = {"$regex": search, "$options": "i"}
        return self.collection.count_documents(query)

    def update(self, category_id: str, update_data: GuziCategoryUpdate) -> Optional[GuziCategory]:
        from bson import ObjectId
        try:
            oid = ObjectId(category_id)
            query = {"_id": oid}
        except Exception:
            query = {"_id": category_id}

        update_dict = update_data.model_dump(exclude_unset=True)
        if update_dict:
            update_dict["updated_at"] = datetime.utcnow()
            self.collection.update_one(query, {"$set": update_dict})
        return self.find_by_id(category_id)

    def delete(self, category_id: str) -> bool:
        from bson import ObjectId
        try:
            oid = ObjectId(category_id)
            result = self.collection.delete_one({"_id": oid})
        except Exception:
            result = self.collection.delete_one({"_id": category_id})
        return result.deleted_count > 0


guzi_category_dao = GuziCategoryDAO()
