"""
谷子商品二级分类 DAO - 数据访问层
集合名称: guzi_sub_categories
"""
from typing import Optional, List
from datetime import datetime
from pymongo import ASCENDING
import logging

from app.database.mongo_pool import mongo_pool
from app.models.guzi_category import (
    GuziSubCategory,
    GuziSubCategoryCreate,
    GuziSubCategoryUpdate,
)

logger = logging.getLogger(__name__)

COLLECTION_NAME = "guzi_sub_categories"


class GuziSubCategoryDAO:
    """二级分类数据访问对象"""

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
            if "parent_id_1" not in existing:
                self.collection.create_index("parent_id", name="parent_id_1")
            if "name_parent_unique" not in existing:
                self.collection.create_index(
                    [("parent_id", ASCENDING), ("name", ASCENDING)],
                    unique=True,
                    name="name_parent_unique"
                )
            if "is_active_1" not in existing:
                self.collection.create_index("is_active")
            if "order_1" not in existing:
                self.collection.create_index([("order", ASCENDING)])
            logger.info(f"MongoDB索引检查完成: {COLLECTION_NAME}")
        except Exception as e:
            logger.warning(f"索引创建警告: {e}")

    def create(self, sub: GuziSubCategoryCreate) -> GuziSubCategory:
        data = {
            "parent_id": sub.parent_id,
            "name": sub.name,
            "color": sub.color,
            "order": sub.order,
            "is_active": sub.is_active,
            "taobao_search_terms": sub.taobao_search_terms,
            "aliases": sub.aliases,
            "match_weight": sub.match_weight,
            "exclude": sub.exclude,
            "material_tags": sub.material_tags,
            "remark": sub.remark,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        result = self.collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return GuziSubCategory(**data)

    def find_by_id(self, sub_id: str) -> Optional[GuziSubCategory]:
        from bson import ObjectId
        try:
            doc = self.collection.find_one({"_id": ObjectId(sub_id)})
        except Exception:
            doc = self.collection.find_one({"_id": sub_id})
        if doc:
            doc["_id"] = str(doc["_id"])
            return GuziSubCategory(**doc)
        return None

    def find_by_name_and_parent(self, name: str, parent_id: str) -> Optional[GuziSubCategory]:
        doc = self.collection.find_one({"name": name, "parent_id": parent_id})
        if doc:
            doc["_id"] = str(doc["_id"])
            return GuziSubCategory(**doc)
        return None

    def find_by_parent(
        self,
        parent_id: str,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None,
    ) -> List[GuziSubCategory]:
        query = {"parent_id": parent_id}
        if is_active is not None:
            query["is_active"] = is_active

        cursor = (
            self.collection.find(query)
            .skip(skip)
            .limit(limit)
            .sort([("order", ASCENDING), ("_id", ASCENDING)])
        )
        results = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            results.append(GuziSubCategory(**doc))
        return results

    def find_all(
        self,
        skip: int = 0,
        limit: int = 100,
        parent_id: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> List[GuziSubCategory]:
        query = {}
        if parent_id is not None:
            query["parent_id"] = parent_id
        if is_active is not None:
            query["is_active"] = is_active
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"aliases": {"$regex": search, "$options": "i"}},
            ]

        cursor = (
            self.collection.find(query)
            .skip(skip)
            .limit(limit)
            .sort([("order", ASCENDING), ("_id", ASCENDING)])
        )
        results = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            results.append(GuziSubCategory(**doc))
        return results

    def count(
        self,
        parent_id: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> int:
        query = {}
        if parent_id is not None:
            query["parent_id"] = parent_id
        if is_active is not None:
            query["is_active"] = is_active
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"aliases": {"$regex": search, "$options": "i"}},
            ]
        return self.collection.count_documents(query)

    def update(self, sub_id: str, update_data: GuziSubCategoryUpdate) -> Optional[GuziSubCategory]:
        from bson import ObjectId
        try:
            oid = ObjectId(sub_id)
            query = {"_id": oid}
        except Exception:
            query = {"_id": sub_id}

        update_dict = update_data.model_dump(exclude_unset=True)
        if update_dict:
            update_dict["updated_at"] = datetime.utcnow()
            self.collection.update_one(query, {"$set": update_dict})
        return self.find_by_id(sub_id)

    def delete(self, sub_id: str) -> bool:
        from bson import ObjectId
        try:
            oid = ObjectId(sub_id)
            result = self.collection.delete_one({"_id": oid})
        except Exception:
            result = self.collection.delete_one({"_id": sub_id})
        return result.deleted_count > 0

    def delete_by_parent(self, parent_id: str) -> int:
        """删除某一级分类下的所有二级分类"""
        result = self.collection.delete_many({"parent_id": parent_id})
        return result.deleted_count


guzi_sub_category_dao = GuziSubCategoryDAO()
