"""
类别关键词 DAO - 数据访问层
集合名称: category_keywords
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging

from pymongo import ASCENDING
from pymongo.errors import PyMongoError

from app.database.mongo_pool import mongo_pool
from app.models.category_keywords import (
    CategoryKeywords,
    KeywordCandidate,
)

logger = logging.getLogger(__name__)

COLLECTION_NAME = "category_keywords"
CANDIDATES_COLLECTION = "keyword_candidates"


class CategoryKeywordsDAO:
    """类别关键词数据访问对象"""

    def __init__(self):
        self._collection = None
        self._candidates_collection = None

    @property
    def collection(self):
        if self._collection is None:
            self._collection = mongo_pool.get_collection(COLLECTION_NAME)
            self._ensure_indexes()
        return self._collection

    @property
    def candidates_collection(self):
        if self._candidates_collection is None:
            self._candidates_collection = mongo_pool.get_collection(CANDIDATES_COLLECTION)
            self._ensure_candidates_indexes()
        return self._candidates_collection

    def _ensure_indexes(self):
        try:
            existing = self.collection.index_information()
            if "category_1" not in existing:
                self.collection.create_index("category")
            if "is_active_1" not in existing:
                self.collection.create_index("is_active")
            if "usage_count_-1" not in existing:
                self.collection.create_index([("usage_count", ASCENDING)])
            logger.info(f"关键词库索引检查完成: {COLLECTION_NAME}")
        except Exception as e:
            logger.warning(f"关键词库索引创建警告: {e}")

    def _ensure_candidates_indexes(self):
        try:
            existing = self.candidates_collection.index_information()
            if "category_1" not in existing:
                self.candidates_collection.create_index("category")
            if "status_1" not in existing:
                self.candidates_collection.create_index("status")
            if "created_at_-1" not in existing:
                self.candidates_collection.create_index([("created_at", ASCENDING)])
            logger.info(f"候选关键词索引检查完成: {CANDIDATES_COLLECTION}")
        except Exception as e:
            logger.warning(f"候选关键词索引创建警告: {e}")

    # ==================== 关键词组 CRUD ====================

    def create(self, keywords: CategoryKeywords) -> CategoryKeywords:
        try:
            data = keywords.model_dump()
            self.collection.insert_one(data)
            logger.info(f"创建关键词组: category={keywords.category}")
            return keywords
        except PyMongoError as e:
            logger.error(f"创建关键词组失败: {e}")
            raise

    def find_by_category(self, category: str) -> Optional[CategoryKeywords]:
        doc = self.collection.find_one({"category": category})
        if doc:
            doc.pop("_id", None)
            return CategoryKeywords(**doc)
        return None

    def find_all(self) -> List[CategoryKeywords]:
        cursor = self.collection.find().sort("usage_count", ASCENDING)
        results = []
        for doc in cursor:
            doc.pop("_id", None)
            results.append(CategoryKeywords(**doc))
        return results

    def find_active(self) -> List[CategoryKeywords]:
        cursor = self.collection.find({"is_active": True}).sort("usage_count", ASCENDING)
        results = []
        for doc in cursor:
            doc.pop("_id", None)
            results.append(CategoryKeywords(**doc))
        return results

    def update(self, category: str, data: Dict[str, Any]) -> bool:
        data["updated_at"] = datetime.utcnow()
        result = self.collection.update_one(
            {"category": category},
            {"$set": data}
        )
        return result.modified_count > 0

    def delete(self, category: str) -> bool:
        result = self.collection.delete_one({"category": category})
        return result.deleted_count > 0

    def upsert(self, keywords: CategoryKeywords) -> CategoryKeywords:
        """upsert：按 category 唯一，存在则更新"""
        data = keywords.model_dump()
        self.collection.update_one(
            {"category": keywords.category},
            {"$set": data},
            upsert=True
        )
        return keywords

    def increment_usage(self, category: str, count: int = 1) -> bool:
        """增加命中计数"""
        result = self.collection.update_one(
            {"category": category},
            {
                "$inc": {"usage_count": count},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        return result.modified_count > 0

    def increment_today_hit(self, category: str) -> bool:
        """增加今日命中计数"""
        result = self.collection.update_one(
            {"category": category},
            {
                "$inc": {"hit_count_today": 1},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        return result.modified_count > 0

    def reset_today_hits(self) -> int:
        """重置所有今日命中计数（每日定时调用）"""
        result = self.collection.update_many(
            {"hit_count_today": {"$gt": 0}},
            {"$set": {"hit_count_today": 0}}
        )
        return result.modified_count

    def add_keywords(self, category: str, keywords: List[str]) -> bool:
        """追加关键词到已有组"""
        result = self.collection.update_one(
            {"category": category},
            {
                "$addToSet": {"keywords": {"$each": keywords}},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        return result.modified_count > 0

    def remove_keywords(self, category: str, keywords: List[str]) -> bool:
        """从已有组移除关键词"""
        result = self.collection.update_one(
            {"category": category},
            {
                "$pull": {"keywords": {"$in": keywords}},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        return result.modified_count > 0

    def count(self) -> int:
        return self.collection.count_documents({})

    def count_active(self) -> int:
        return self.collection.count_documents({"is_active": True})

    # ==================== 候选关键词管理 ====================

    def add_candidate(self, candidate: KeywordCandidate) -> KeywordCandidate:
        data = candidate.model_dump()
        self.candidates_collection.insert_one(data)
        return candidate

    def add_candidates_batch(self, candidates: List[KeywordCandidate]) -> int:
        if not candidates:
            return 0
        data = [c.model_dump() for c in candidates]
        result = self.candidates_collection.insert_many(data)
        return len(result.inserted_ids)

    def find_candidates(
        self,
        status: Optional[str] = None,
        category: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[KeywordCandidate]:
        query = {}
        if status:
            query["status"] = status
        if category:
            query["category"] = category

        cursor = self.candidates_collection.find(query).skip(skip).limit(limit).sort("created_at", -1)
        results = []
        for doc in cursor:
            doc.pop("_id", None)
            results.append(KeywordCandidate(**doc))
        return results

    def find_candidates_by_intel_id(self, intel_id: str) -> List[KeywordCandidate]:
        cursor = self.candidates_collection.find({"source_intel_id": intel_id})
        results = []
        for doc in cursor:
            doc.pop("_id", None)
            results.append(KeywordCandidate(**doc))
        return results

    def approve_candidate(self, candidate_id: str, approved_by: str) -> bool:
        result = self.candidates_collection.update_one(
            {"id": candidate_id},
            {
                "$set": {
                    "status": "approved",
                    "reviewed_by": approved_by,
                    "reviewed_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0

    def reject_candidate(self, candidate_id: str, rejected_by: str) -> bool:
        result = self.candidates_collection.update_one(
            {"id": candidate_id},
            {
                "$set": {
                    "status": "rejected",
                    "reviewed_by": rejected_by,
                    "reviewed_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0

    def approve_candidates_batch(self, candidate_ids: List[str], approved_by: str) -> int:
        result = self.candidates_collection.update_many(
            {"id": {"$in": candidate_ids}},
            {
                "$set": {
                    "status": "approved",
                    "reviewed_by": approved_by,
                    "reviewed_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count

    def count_candidates(self, status: Optional[str] = None) -> int:
        query = {} if not status else {"status": status}
        return self.candidates_collection.count_documents(query)

    def delete_candidate(self, candidate_id: str) -> bool:
        result = self.candidates_collection.delete_one({"id": candidate_id})
        return result.deleted_count > 0

    def delete_approved_candidates(self) -> int:
        """删除已批准（已合并到关键词库）的候选"""
        result = self.candidates_collection.delete_many({"status": "approved"})
        return result.deleted_count


# 全局实例
category_keywords_dao = CategoryKeywordsDAO()
keyword_candidates_dao = CategoryKeywordsDAO()
