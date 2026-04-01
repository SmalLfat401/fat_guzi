"""
Coser圈黑话术语DAO - 数据访问层
"""
from typing import Optional, List
from datetime import datetime
from pymongo import ASCENDING
import logging

from app.database.mongo_pool import mongo_pool
from app.models.coser_term import CoserTerm, CoserTermCreate, CoserTermUpdate

logger = logging.getLogger(__name__)

COLLECTION_NAME = "coser_terms"


class CoserTermDAO:
    """Coser圈黑话术语数据访问对象"""

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

            if "term_1" not in existing_indexes:
                self.collection.create_index("term", unique=True)
            if "is_active_1" not in existing_indexes:
                self.collection.create_index("is_active")
            if "category_1" not in existing_indexes:
                self.collection.create_index("category")

            logger.info(f"MongoDB索引检查完成: {COLLECTION_NAME}")
        except Exception as e:
            logger.warning(f"索引创建警告: {e}")

    def create(self, term: CoserTermCreate) -> CoserTerm:
        """创建Coser术语"""
        term_data = {
            "term": term.term,
            "meaning": term.meaning,
            "usage_scenario": term.usage_scenario,
            "category": term.category,
            "example": term.example,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        result = self.collection.insert_one(term_data)
        term_data["_id"] = str(result.inserted_id)

        return CoserTerm(**term_data)

    def find_by_id(self, term_id: str) -> Optional[CoserTerm]:
        """根据ID查询术语"""
        from bson import ObjectId
        try:
            doc = self.collection.find_one({"_id": ObjectId(term_id)})
        except Exception:
            doc = self.collection.find_one({"_id": term_id})

        if doc:
            doc["_id"] = str(doc["_id"])
            return CoserTerm(**doc)
        return None

    def find_by_term(self, term: str) -> Optional[CoserTerm]:
        """根据术语名称查询"""
        doc = self.collection.find_one({"term": term})
        if doc:
            doc["_id"] = str(doc["_id"])
            return CoserTerm(**doc)
        return None

    def find_all(
        self,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None,
        category: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[CoserTerm]:
        """查询所有术语，支持筛选和搜索"""
        query = {}

        if is_active is not None:
            query["is_active"] = is_active

        if category:
            query["category"] = category

        if search:
            query["$or"] = [
                {"term": {"$regex": search, "$options": "i"}},
                {"meaning": {"$regex": search, "$options": "i"}}
            ]

        cursor = self.collection.find(query).skip(skip).limit(limit).sort("created_at", ASCENDING)
        terms = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            terms.append(CoserTerm(**doc))
        return terms

    def count(
        self,
        is_active: Optional[bool] = None,
        category: Optional[str] = None,
        search: Optional[str] = None
    ) -> int:
        """统计术语数量"""
        query = {}

        if is_active is not None:
            query["is_active"] = is_active

        if category:
            query["category"] = category

        if search:
            query["$or"] = [
                {"term": {"$regex": search, "$options": "i"}},
                {"meaning": {"$regex": search, "$options": "i"}}
            ]

        return self.collection.count_documents(query)

    def get_all_categories(self) -> List[str]:
        """获取所有分类"""
        categories = self.collection.distinct("category")
        return [c for c in categories if c]

    def update(self, term_id: str, term_update: CoserTermUpdate) -> Optional[CoserTerm]:
        """更新术语信息"""
        from bson import ObjectId
        try:
            oid = ObjectId(term_id)
            query = {"_id": oid}
        except Exception:
            query = {"_id": term_id}

        update_data = term_update.model_dump(exclude_unset=True)
        if update_data:
            update_data["updated_at"] = datetime.utcnow()

            result = self.collection.update_one(
                query,
                {"$set": update_data}
            )

            if result.modified_count > 0:
                return self.find_by_id(term_id)
        return self.find_by_id(term_id)

    def delete(self, term_id: str) -> bool:
        """删除术语"""
        from bson import ObjectId
        try:
            oid = ObjectId(term_id)
            result = self.collection.delete_one({"_id": oid})
        except Exception:
            result = self.collection.delete_one({"_id": term_id})
        return result.deleted_count > 0

    def update_ai_content(self, term_id: str, ai_copywriting: Optional[str] = None, ai_script: Optional[str] = None) -> Optional[CoserTerm]:
        """更新 AI 生成内容（口播文案 / 镜头脚本）"""
        from bson import ObjectId
        try:
            oid = ObjectId(term_id)
            query = {"_id": oid}
        except Exception:
            query = {"_id": term_id}

        update_data = {}
        if ai_copywriting is not None:
            update_data["ai_copywriting"] = ai_copywriting
        if ai_script is not None:
            update_data["ai_script"] = ai_script

        if not update_data:
            return self.find_by_id(term_id)

        update_data["updated_at"] = datetime.utcnow()
        self.collection.update_one(query, {"$set": update_data})
        return self.find_by_id(term_id)

    def toggle_field(self, term_id: str, field: str) -> Optional[CoserTerm]:
        """切换布尔字段状态"""
        from bson import ObjectId
        try:
            oid = ObjectId(term_id)
            query = {"_id": oid}
        except Exception:
            query = {"_id": term_id}

        # 先获取当前值
        doc = self.collection.find_one(query)
        if not doc:
            return None

        current_value = doc.get(field, False)
        new_value = not current_value

        self.collection.update_one(
            query,
            {"$set": {field: new_value, "updated_at": datetime.utcnow()}}
        )
        return self.find_by_id(term_id)


# 全局DAO实例
coser_term_dao = CoserTermDAO()
