"""
爬虫任务DAO - 数据访问层
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging
import uuid

from pymongo import DESCENDING
from pymongo.errors import PyMongoError

from app.database.mongo_pool import mongo_pool
from app.models.crawler_task import CrawlerTask, TaskStatus, CrawlerLogEntry, UserProgress

logger = logging.getLogger(__name__)

COLLECTION_NAME = "crawler_tasks"


class CrawlerTaskDao:
    """爬虫任务数据访问对象"""

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

            if "task_id_1" not in existing_indexes:
                self.collection.create_index("task_id", unique=True)
            if "status_1" not in existing_indexes:
                self.collection.create_index("status")
            if "created_at_-1" not in existing_indexes:
                self.collection.create_index([("created_at", DESCENDING)])
            # 复合索引：优化 find_active + 排序场景
            if "status_1_created_at_-1" not in existing_indexes:
                self.collection.create_index([("status", 1), ("created_at", DESCENDING)])

            logger.info(f"MongoDB索引检查完成: {COLLECTION_NAME}")
        except Exception as e:
            logger.warning(f"索引创建警告: {e}")

    def create(self, category_id: Optional[str] = None, category_name: Optional[str] = None,
               mode: str = "full", max_posts: int = 0, target_uids: List[str] = None) -> CrawlerTask:
        """创建新任务"""
        task_id = str(uuid.uuid4())
        now = datetime.utcnow()

        task = CrawlerTask(
            task_id=task_id,
            category_id=category_id,
            category_name=category_name,
            mode=mode,
            max_posts=max_posts,
            target_uids=target_uids or [],
            total_users=len(target_uids) if target_uids else 0,
            status=TaskStatus.IDLE,
            created_at=now,
            updated_at=now,
        )

        data = task.model_dump()
        self.collection.insert_one(data)
        logger.info(f"[CrawlerTaskDao] 创建任务: {task_id}, 用户数: {len(target_uids) if target_uids else 0}")
        return task

    def find_by_task_id(self, task_id: str) -> Optional[CrawlerTask]:
        """根据任务ID查询"""
        doc = self.collection.find_one({"task_id": task_id})
        if doc:
            doc.pop("_id", None)
            return CrawlerTask(**doc)
        return None

    def find_active(self) -> Optional[CrawlerTask]:
        """查找当前正在运行或暂停的任务（仅返回核心字段，排除大数组）"""
        # 排除 logs 和 user_progress，这两个字段可能很大
        projection = {
            "_id": 0,
            "task_id": 1,
            "status": 1,
            "category_id": 1,
            "category_name": 1,
            "mode": 1,
            "max_posts": 1,
            "target_uids": 1,
            "total_users": 1,
            "processed_users": 1,
            "failed_users": 1,
            "total_blogs": 1,
            "saved_blogs": 1,
            "total_longtext": 1,
            "saved_longtext": 1,
            "failed_longtext": 1,
            "current_uid": 1,
            "paused_after_uid": 1,
            "started_at": 1,
            "paused_at": 1,
            "completed_at": 1,
            "created_at": 1,
            "updated_at": 1,
        }
        doc = self.collection.find_one(
            {"status": {"$in": [TaskStatus.RUNNING.value, TaskStatus.PAUSED.value]}},
            projection=projection
        )
        if doc:
            doc.pop("_id", None)
            return CrawlerTask(**doc)
        return None

    def find_latest(self) -> Optional[CrawlerTask]:
        """查找最新创建的任务（仅返回核心字段，排除大数组）"""
        # 排除 logs 和 user_progress，这两个字段可能很大
        projection = {
            "_id": 0,
            "task_id": 1,
            "status": 1,
            "category_id": 1,
            "category_name": 1,
            "mode": 1,
            "max_posts": 1,
            "target_uids": 1,
            "total_users": 1,
            "processed_users": 1,
            "failed_users": 1,
            "total_blogs": 1,
            "saved_blogs": 1,
            "total_longtext": 1,
            "saved_longtext": 1,
            "failed_longtext": 1,
            "current_uid": 1,
            "paused_after_uid": 1,
            "started_at": 1,
            "paused_at": 1,
            "completed_at": 1,
            "created_at": 1,
            "updated_at": 1,
        }
        doc = self.collection.find_one(sort=[("created_at", DESCENDING)], projection=projection)
        if doc:
            doc.pop("_id", None)
            return CrawlerTask(**doc)
        return None

    def update(self, task: CrawlerTask) -> bool:
        """更新任务"""
        task.updated_at = datetime.utcnow()
        data = task.model_dump()
        result = self.collection.update_one(
            {"task_id": task.task_id},
            {"$set": data}
        )
        return result.modified_count > 0

    def update_status(self, task_id: str, status: TaskStatus) -> bool:
        """更新任务状态"""
        update_data: Dict[str, Any] = {
            "status": status.value,
            "updated_at": datetime.utcnow(),
        }
        if status == TaskStatus.RUNNING:
            update_data["started_at"] = datetime.utcnow()
        elif status == TaskStatus.COMPLETED:
            update_data["completed_at"] = datetime.utcnow()
        elif status == TaskStatus.PAUSED:
            update_data["paused_at"] = datetime.utcnow()

        result = self.collection.update_one(
            {"task_id": task_id},
            {"$set": update_data}
        )
        return result.modified_count > 0

    def update_progress(self, task_id: str,
                        processed_users: Optional[int] = None,
                        failed_users: Optional[int] = None,
                        total_blogs: Optional[int] = None,
                        saved_blogs: Optional[int] = None,
                        total_longtext: Optional[int] = None,
                        saved_longtext: Optional[int] = None,
                        failed_longtext: Optional[int] = None,
                        current_uid: Optional[str] = None,
                        paused_after_uid: Optional[str] = None) -> bool:
        """更新进度统计"""
        update_data: Dict[str, Any] = {"updated_at": datetime.utcnow()}

        if processed_users is not None:
            update_data["processed_users"] = processed_users
        if failed_users is not None:
            update_data["failed_users"] = failed_users
        if total_blogs is not None:
            update_data["total_blogs"] = total_blogs
        if saved_blogs is not None:
            update_data["saved_blogs"] = saved_blogs
        if total_longtext is not None:
            update_data["total_longtext"] = total_longtext
        if saved_longtext is not None:
            update_data["saved_longtext"] = saved_longtext
        if failed_longtext is not None:
            update_data["failed_longtext"] = failed_longtext
        if current_uid is not None:
            update_data["current_uid"] = current_uid
        if paused_after_uid is not None:
            update_data["paused_after_uid"] = paused_after_uid

        result = self.collection.update_one(
            {"task_id": task_id},
            {"$set": update_data}
        )
        return result.modified_count > 0

    def add_log(self, task_id: str, log_entry: CrawlerLogEntry) -> bool:
        """添加日志条目"""
        log_data = log_entry.model_dump()
        result = self.collection.update_one(
            {"task_id": task_id},
            {
                "$push": {"logs": {"$each": [log_data], "$slice": -200}},  # 只保留最近200条
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        return result.modified_count > 0

    def update_user_progress(self, task_id: str, user_progress: UserProgress) -> bool:
        """更新用户进度"""
        result = self.collection.update_one(
            {"task_id": task_id},
            {
                "$set": {
                    f"user_progress.{user_progress.uid}": user_progress.model_dump(),
                    "updated_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0

    def increment_stats(self, task_id: str,
                        processed_users: int = 0,
                        failed_users: int = 0,
                        total_blogs: int = 0,
                        saved_blogs: int = 0,
                        total_longtext: int = 0,
                        saved_longtext: int = 0,
                        failed_longtext: int = 0) -> bool:
        """原子递增统计"""
        inc_data: Dict[str, Any] = {}
        if processed_users:
            inc_data["processed_users"] = processed_users
        if failed_users:
            inc_data["failed_users"] = failed_users
        if total_blogs:
            inc_data["total_blogs"] = total_blogs
        if saved_blogs:
            inc_data["saved_blogs"] = saved_blogs
        if total_longtext:
            inc_data["total_longtext"] = total_longtext
        if saved_longtext:
            inc_data["saved_longtext"] = saved_longtext
        if failed_longtext:
            inc_data["failed_longtext"] = failed_longtext

        if not inc_data:
            return False

        inc_data["updated_at"] = datetime.utcnow()

        result = self.collection.update_one(
            {"task_id": task_id},
            {"$inc": inc_data}
        )
        return result.modified_count > 0

    def reset(self, task_id: str) -> bool:
        """重置任务状态"""
        result = self.collection.update_one(
            {"task_id": task_id},
            {"$set": {
                "status": TaskStatus.IDLE.value,
                "processed_users": 0,
                "failed_users": 0,
                "total_blogs": 0,
                "saved_blogs": 0,
                "total_longtext": 0,
                "saved_longtext": 0,
                "failed_longtext": 0,
                "current_uid": None,
                "paused_after_uid": None,
                "user_progress": {},
                "logs": [],
                "updated_at": datetime.utcnow(),
            }}
        )
        return result.modified_count > 0

    def delete(self, task_id: str) -> bool:
        """删除任务"""
        result = self.collection.delete_one({"task_id": task_id})
        return result.deleted_count > 0


# 全局单例
crawler_task_dao = CrawlerTaskDao()
