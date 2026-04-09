"""
谷子黑话术语DAO - 数据访问层
"""
from typing import Optional, List
from datetime import datetime
from pymongo import ASCENDING
import logging

from app.database.mongo_pool import mongo_pool
from app.models.guzi_term import GuziTerm, GuziTermCreate, GuziTermUpdate

logger = logging.getLogger(__name__)

COLLECTION_NAME = "guzi_terms"


class GuziTermDAO:
    """谷子黑话术语数据访问对象"""

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

    def create(self, term: GuziTermCreate) -> GuziTerm:
        """创建谷子术语"""
        term_data = {
            "term": term.term,
            "meaning": term.meaning,
            "usage_scenario": term.usage_scenario,
            "category": term.category,
            "example": term.example,
            "is_active": True,
            "video_generated": False,
            "video_published": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        result = self.collection.insert_one(term_data)
        term_data["_id"] = str(result.inserted_id)

        return GuziTerm(**term_data)

    def find_by_id(self, term_id: str) -> Optional[GuziTerm]:
        """根据ID查询术语"""
        from bson import ObjectId
        try:
            doc = self.collection.find_one({"_id": ObjectId(term_id)})
        except Exception:
            doc = self.collection.find_one({"_id": term_id})

        if doc:
            doc["_id"] = str(doc["_id"])
            return GuziTerm(**doc)
        return None

    def find_by_term(self, term: str) -> Optional[GuziTerm]:
        """根据术语名称查询"""
        doc = self.collection.find_one({"term": term})
        if doc:
            doc["_id"] = str(doc["_id"])
            return GuziTerm(**doc)
        return None

    def find_all(
        self,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None,
        category: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[GuziTerm]:
        """查询所有术语，支持筛选和搜索"""
        query = {}

        if is_active is not None:
            query["is_active"] = is_active

        if category:
            query["category"] = category

        if search:
            # 模糊搜索术语名称或含义
            query["$or"] = [
                {"term": {"$regex": search, "$options": "i"}},
                {"meaning": {"$regex": search, "$options": "i"}}
            ]

        cursor = self.collection.find(query).skip(skip).limit(limit).sort([("created_at", ASCENDING), ("_id", ASCENDING)])
        terms = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            terms.append(GuziTerm(**doc))
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
        return [c for c in categories if c]  # 过滤空值

    def update(self, term_id: str, term_update: GuziTermUpdate) -> Optional[GuziTerm]:
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

    def update_ai_content(self, term_id: str, ai_copywriting: Optional[str] = None, ai_script: Optional[str] = None) -> Optional[GuziTerm]:
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

    def toggle_field(self, term_id: str, field: str) -> Optional[GuziTerm]:
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

    def delete(self, term_id: str) -> bool:
        """删除术语"""
        from bson import ObjectId
        try:
            oid = ObjectId(term_id)
            result = self.collection.delete_one({"_id": oid})
        except Exception:
            result = self.collection.delete_one({"_id": term_id})
        return result.deleted_count > 0


# 全局DAO实例
guzi_term_dao = GuziTermDAO()
