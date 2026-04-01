"""
微博用户DAO - 数据访问层
"""
from typing import Optional, List, List, Dict, Any
from datetime import datetime
from pymongo import ASCENDING
from pymongo.errors import PyMongoError
import logging

from app.database.mongo_pool import mongo_pool
from app.models.weibo_user import WeiboUser, WeiboUserCreate, WeiboUserUpdate

logger = logging.getLogger(__name__)

COLLECTION_NAME = "weibo_users"


class WeiboUserDAO:
    """微博用户数据访问对象"""

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
            
            if "uid_1" not in existing_indexes:
                self._collection.create_index("uid", unique=True)
            if "is_active_1" not in existing_indexes:
                self._collection.create_index("is_active")
            if "created_at_1" not in existing_indexes:
                self._collection.create_index("created_at")
                
            logger.info(f"MongoDB索引检查完成: {COLLECTION_NAME}")
        except Exception as e:
            logger.warning(f"索引创建警告: {e}")

    def create(self, user: WeiboUserCreate) -> WeiboUser:
        """创建微博用户"""
        user_data = user.model_dump()
        user_data["profile_url"] = user_data.get("profile_url") or f"https://weibo.com/u/{user.uid}"
        user_data["is_active"] = True
        user_data["created_at"] = datetime.utcnow()
        user_data["updated_at"] = datetime.utcnow()

        result = self.collection.insert_one(user_data)
        user_data["_id"] = result.inserted_id

        return WeiboUser(**user_data)

    def find_by_uid(self, uid: str) -> Optional[WeiboUser]:
        """根据UID查询用户"""
        doc = self.collection.find_one({"uid": uid})
        if doc:
            doc.pop("_id", None)
            return WeiboUser(**doc)
        return None

    def find_all(self, skip: int = 0, limit: int = 100, is_active: Optional[bool] = None,
                 nickname: Optional[str] = None, category_ids: Optional[List[str]] = None) -> List[WeiboUser]:
        """查询所有用户"""
        query = {}
        if is_active is not None:
            query["is_active"] = is_active
        if nickname:
            query["nickname"] = {"$regex": nickname, "$options": "i"}
        if category_ids:
            query["categories"] = {"$in": category_ids}

        cursor = self.collection.find(query).skip(skip).limit(limit).sort("created_at", ASCENDING)
        users = []
        for doc in cursor:
            doc.pop("_id", None)
            users.append(WeiboUser(**doc))
        return users

    def count(self, is_active: Optional[bool] = None,
              nickname: Optional[str] = None, category_ids: Optional[List[str]] = None) -> int:
        """统计用户数量"""
        query = {}
        if is_active is not None:
            query["is_active"] = is_active
        if nickname:
            query["nickname"] = {"$regex": nickname, "$options": "i"}
        if category_ids:
            query["categories"] = {"$in": category_ids}
        return self.collection.count_documents(query)

    def update(self, uid: str, user_update: WeiboUserUpdate) -> Optional[WeiboUser]:
        """更新用户信息"""
        update_data = user_update.model_dump(exclude_unset=True)
        if update_data:
            update_data["updated_at"] = datetime.utcnow()

            result = self.collection.update_one(
                {"uid": uid},
                {"$set": update_data}
            )

            if result.modified_count > 0:
                return self.find_by_uid(uid)
        return self.find_by_uid(uid)

    def delete(self, uid: str) -> bool:
        """删除用户"""
        result = self.collection.delete_one({"uid": uid})
        return result.deleted_count > 0

    def update_last_crawled(self, uid: str) -> bool:
        """更新最后抓取时间"""
        result = self.collection.update_one(
            {"uid": uid},
            {"$set": {"last_crawled_at": datetime.utcnow()}}
        )
        return result.modified_count > 0


# 全局DAO实例
weibo_user_dao = WeiboUserDAO()
