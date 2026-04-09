"""
谷子商品标签 DAO - 数据访问层
"""
from typing import Optional, List
from datetime import datetime
from pymongo import ASCENDING
import logging

from app.database.mongo_pool import mongo_pool
from app.models.guzi_tag import GuziTag, GuziTagCreate, GuziTagUpdate, TagType

logger = logging.getLogger(__name__)

COLLECTION_NAME = "guzi_tags"


class GuziTagDAO:
    """谷子商品标签数据访问对象"""

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
            existing_indexes = self.collection.index_information()
            # name + tag_type 联合唯一索引，防止同类型下重名
            if "name_tag_type_unique" not in existing_indexes:
                self.collection.create_index(
                    [("name", ASCENDING), ("tag_type", ASCENDING)],
                    unique=True,
                    name="name_tag_type_unique"
                )
            if "tag_type_1" not in existing_indexes:
                self.collection.create_index("tag_type")
            if "is_active_1" not in existing_indexes:
                self.collection.create_index("is_active")
            logger.info(f"MongoDB索引检查完成: {COLLECTION_NAME}")
        except Exception as e:
            logger.warning(f"索引创建警告: {e}")

    def create(self, tag: GuziTagCreate) -> GuziTag:
        """创建标签"""
        data = {
            "tag_type": tag.tag_type.value,
            "name": tag.name,
            "color": tag.color,
            "remark": tag.remark,
            "is_active": True,
            "show_on_h5": tag.show_on_h5,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        result = self.collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return GuziTag(**data)

    def find_by_id(self, tag_id: str) -> Optional[GuziTag]:
        """根据ID查询标签"""
        from bson import ObjectId
        try:
            doc = self.collection.find_one({"_id": ObjectId(tag_id)})
        except Exception:
            doc = self.collection.find_one({"_id": tag_id})
        if doc:
            doc["_id"] = str(doc["_id"])
            return GuziTag(**doc)
        return None

    def find_by_name_and_type(self, name: str, tag_type: TagType) -> Optional[GuziTag]:
        """根据名称和类型查询（用于去重检查）"""
        doc = self.collection.find_one({"name": name, "tag_type": tag_type.value})
        if doc:
            doc["_id"] = str(doc["_id"])
            return GuziTag(**doc)
        return None

    def find_all(
        self,
        skip: int = 0,
        limit: int = 100,
        tag_type: Optional[TagType] = None,
        is_active: Optional[bool] = None,
        show_on_h5: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> List[GuziTag]:
        """查询所有标签，支持筛选"""
        query = {}
        if tag_type is not None:
            query["tag_type"] = tag_type.value
        if is_active is not None:
            query["is_active"] = is_active
        if show_on_h5 is not None:
            query["show_on_h5"] = show_on_h5
        if search:
            query["name"] = {"$regex": search, "$options": "i"}

        cursor = (
            self.collection.find(query)
            .skip(skip)
            .limit(limit)
            .sort([("created_at", ASCENDING), ("_id", ASCENDING)])
        )
        tags = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            tags.append(GuziTag(**doc))
        return tags

    def count(
        self,
        tag_type: Optional[TagType] = None,
        is_active: Optional[bool] = None,
        show_on_h5: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> int:
        """统计标签数量"""
        query = {}
        if tag_type is not None:
            query["tag_type"] = tag_type.value
        if is_active is not None:
            query["is_active"] = is_active
        if show_on_h5 is not None:
            query["show_on_h5"] = show_on_h5
        if search:
            query["name"] = {"$regex": search, "$options": "i"}
        return self.collection.count_documents(query)

    def update(self, tag_id: str, tag_update: GuziTagUpdate) -> Optional[GuziTag]:
        """更新标签信息"""
        from bson import ObjectId
        try:
            oid = ObjectId(tag_id)
            query = {"_id": oid}
        except Exception:
            query = {"_id": tag_id}

        update_data = tag_update.model_dump(exclude_unset=True)
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            result = self.collection.update_one(query, {"$set": update_data})
            if result.modified_count > 0:
                return self.find_by_id(tag_id)
        return self.find_by_id(tag_id)

    def delete(self, tag_id: str) -> bool:
        """删除标签"""
        from bson import ObjectId
        try:
            oid = ObjectId(tag_id)
            result = self.collection.delete_one({"_id": oid})
        except Exception:
            result = self.collection.delete_one({"_id": tag_id})
        return result.deleted_count > 0


# 全局 DAO 实例
guzi_tag_dao = GuziTagDAO()
