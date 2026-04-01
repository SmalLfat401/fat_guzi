"""
类别DAO - 数据访问层
"""
from typing import Optional, List
from datetime import datetime
from pymongo import ASCENDING
import logging

from app.database.mongo_pool import mongo_pool
from app.models.category import Category, CategoryCreate, CategoryUpdate

logger = logging.getLogger(__name__)

COLLECTION_NAME = "categories"


class CategoryDAO:
    """类别数据访问对象"""

    def __init__(self):
        self._collection = None

    @property
    def collection(self):
        """获取集合，自动初始化"""
        if self._collection is None:
            self._collection = mongo_pool.get_collection(COLLECTION_NAME)
            self._ensure_indexes()
        return self._collection

    def _ensure_indexes(self):
        """确保索引创建"""
        try:
            existing_indexes = self._collection.index_information()
            
            if "name_1" not in existing_indexes:
                self._collection.create_index("name", unique=True)
            if "is_active_1" not in existing_indexes:
                self._collection.create_index("is_active")
                
            logger.info(f"MongoDB索引检查完成: {COLLECTION_NAME}")
        except Exception as e:
            logger.warning(f"索引创建警告: {e}")

    def create(self, category: CategoryCreate) -> Category:
        """创建类别"""
        category_data = {
            "name": category.name,
            "description": category.description,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        result = self.collection.insert_one(category_data)
        category_data["_id"] = str(result.inserted_id)

        return Category(**category_data)

    def find_by_id(self, category_id: str) -> Optional[Category]:
        """根据ID查询类别"""
        from bson import ObjectId
        try:
            doc = self.collection.find_one({"_id": ObjectId(category_id)})
        except Exception:
            doc = self.collection.find_one({"_id": category_id})
        
        if doc:
            doc["_id"] = str(doc["_id"])
            return Category(**doc)
        return None

    def find_by_name(self, name: str) -> Optional[Category]:
        """根据名称查询类别"""
        doc = self.collection.find_one({"name": name})
        if doc:
            doc["_id"] = str(doc["_id"])
            return Category(**doc)
        return None

    def find_all(self, skip: int = 0, limit: int = 100, is_active: Optional[bool] = None) -> List[Category]:
        """查询所有类别"""
        query = {}
        if is_active is not None:
            query["is_active"] = is_active

        cursor = self.collection.find(query).skip(skip).limit(limit).sort("created_at", ASCENDING)
        categories = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            categories.append(Category(**doc))
        return categories

    def count(self, is_active: Optional[bool] = None) -> int:
        """统计类别数量"""
        query = {}
        if is_active is not None:
            query["is_active"] = is_active
        return self.collection.count_documents(query)

    def update(self, category_id: str, category_update: CategoryUpdate) -> Optional[Category]:
        """更新类别信息"""
        from bson import ObjectId
        try:
            oid = ObjectId(category_id)
            query = {"_id": oid}
        except Exception:
            query = {"_id": category_id}

        update_data = category_update.model_dump(exclude_unset=True)
        if update_data:
            update_data["updated_at"] = datetime.utcnow()

            result = self.collection.update_one(
                query,
                {"$set": update_data}
            )

            if result.modified_count > 0:
                return self.find_by_id(category_id)
        return self.find_by_id(category_id)

    def delete(self, category_id: str) -> bool:
        """删除类别"""
        from bson import ObjectId
        try:
            oid = ObjectId(category_id)
            result = self.collection.delete_one({"_id": oid})
        except Exception:
            result = self.collection.delete_one({"_id": category_id})
        return result.deleted_count > 0


# 全局DAO实例
category_dao = CategoryDAO()
