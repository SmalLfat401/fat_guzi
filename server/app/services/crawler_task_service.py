"""
爬虫任务服务层 - 提供给爬虫代码使用的简洁接口
"""
from typing import Optional, List
from datetime import datetime
import threading
import logging

from app.models.crawler_task import CrawlerTask, TaskStatus, CrawlerLogEntry, UserProgress
from app.database.crawler_task_dao import crawler_task_dao

logger = logging.getLogger(__name__)

# 最大日志保留条数
MAX_LOGS = 200


class CrawlerTaskService:
    """爬虫任务服务 - 管理任务状态和数据库同步"""

    def __init__(self):
        self._lock = threading.RLock()
        self._current_task: Optional[CrawlerTask] = None
        self._db_save_interval = 5  # 每处理N个用户保存一次数据库
        self._user_count_since_save = 0

    @property
    def current_task(self) -> Optional[CrawlerTask]:
        """获取当前任务"""
        with self._lock:
            return self._current_task

    @property
    def task_id(self) -> Optional[str]:
        """获取当前任务ID"""
        with self._lock:
            return self._current_task.task_id if self._current_task else None

    @property
    def status(self) -> TaskStatus:
        """获取任务状态"""
        with self._lock:
            return self._current_task.status if self._current_task else TaskStatus.IDLE

    @property
    def total_users(self) -> int:
        """获取总用户数"""
        with self._lock:
            return self._current_task.total_users if self._current_task else 0

    @property
    def processed_users(self) -> int:
        """获取已处理用户数"""
        with self._lock:
            return self._current_task.processed_users if self._current_task else 0

    @property
    def paused_after_uid(self) -> Optional[str]:
        """获取暂停后的UID"""
        with self._lock:
            return self._current_task.paused_after_uid if self._current_task else None

    def create_task(self, category_id: Optional[str] = None,
                   category_name: Optional[str] = None,
                   mode: str = "full",
                   max_posts: int = 0,
                   target_uids: List[str] = None) -> CrawlerTask:
        """创建新任务（若已有旧任务则自动清理后创建）"""
        with self._lock:
            # 如果有旧任务（任意状态），先清理
            if self._current_task:
                old_status = self._current_task.status
                # 如果旧任务处于 PAUSED 或 STOPPING 状态，自动标记为 IDLE
                if old_status in (TaskStatus.PAUSED, TaskStatus.STOPPING):
                    crawler_task_dao.update_status(self._current_task.task_id, TaskStatus.IDLE)
                self._current_task = None

            # 创建数据库记录
            task = crawler_task_dao.create(
                category_id=category_id,
                category_name=category_name,
                mode=mode,
                max_posts=max_posts,
                target_uids=target_uids,
            )
            self._current_task = task
            self._user_count_since_save = 0
            logger.info(f"[CrawlerTaskService] 创建任务: {task.task_id}, 用户数: {len(target_uids) if target_uids else 0}")
            return task

    def start_task(self) -> bool:
        """启动任务"""
        with self._lock:
            if not self._current_task:
                logger.warning("[CrawlerTaskService] 没有活动任务")
                return False

            self._current_task.status = TaskStatus.RUNNING
            self._current_task.started_at = datetime.utcnow()
            crawler_task_dao.update(self._current_task)
            logger.info(f"[CrawlerTaskService] 启动任务: {self._current_task.task_id}")
            return True

    def set_idle(self) -> bool:
        """设置任务为空闲"""
        with self._lock:
            if not self._current_task:
                return False

            self._current_task.status = TaskStatus.IDLE
            self._current_task.completed_at = datetime.utcnow()
            crawler_task_dao.update(self._current_task)
            logger.info(f"[CrawlerTaskService] 任务结束: {self._current_task.task_id}")
            return True

    def set_stopping(self) -> bool:
        """设置任务为停止中（仅更新内存，数据库已在API层写入）"""
        with self._lock:
            if not self._current_task:
                return False

            self._current_task.status = TaskStatus.STOPPING
            logger.info(f"[CrawlerTaskService] 设置为停止中: {self._current_task.task_id}")
            return True

    def set_paused_uid(self, uid: str) -> bool:
        """设置暂停时的UID"""
        with self._lock:
            if not self._current_task:
                return False

            self._current_task.paused_after_uid = uid
            return True

    def add_log(self, uid: str = "", nickname: str = "",
               action: str = "", message: str = "", success: bool = True) -> bool:
        """添加日志"""
        with self._lock:
            if not self._current_task:
                return False

            log_entry = CrawlerLogEntry(
                timestamp=datetime.utcnow(),
                uid=uid,
                nickname=nickname,
                action=action,
                message=message,
                success=success,
            )

            # 添加到内存
            self._current_task.logs.append(log_entry)
            # 只保留最近200条
            if len(self._current_task.logs) > MAX_LOGS:
                self._current_task.logs = self._current_task.logs[-MAX_LOGS:]

            # 保存到数据库
            crawler_task_dao.add_log(self._current_task.task_id, log_entry)
            return True

    def on_user_completed(self, uid: str, nickname: str,
                         blogs_count: int = 0, saved_count: int = 0,
                         longtext_count: int = 0) -> bool:
        """用户处理完成"""
        with self._lock:
            if not self._current_task:
                return False

            # 更新进度
            self._current_task.processed_users += 1
            self._current_task.total_blogs += blogs_count
            self._current_task.saved_blogs += saved_count
            self._current_task.total_longtext += longtext_count
            self._current_task.current_uid = uid

            # 记录用户进度
            self._current_task.user_progress[uid] = UserProgress(
                uid=uid,
                nickname=nickname,
                status="completed",
                blogs_count=blogs_count,
                saved_count=saved_count,
                longtext_total=longtext_count,
                longtext_saved=0,  # 后面会更新
                longtext_failed=0,
                completed_at=datetime.utcnow(),
            )

            self._user_count_since_save += 1

            # 每N个用户保存一次
            if self._user_count_since_save >= self._db_save_interval:
                self._save_to_db()
                self._user_count_since_save = 0

            logger.info(f"[CrawlerTaskService] 用户完成: {nickname}, "
                       f"progress={self._current_task.processed_users}/{self._current_task.total_users}")
            return True

    def on_longtext_saved(self, uid: str) -> bool:
        """全文保存成功"""
        with self._lock:
            if not self._current_task or uid not in self._current_task.user_progress:
                return False

            self._current_task.saved_longtext += 1
            self._current_task.user_progress[uid].longtext_saved += 1
            return True

    def on_longtext_failed(self, uid: str) -> bool:
        """全文保存失败"""
        with self._lock:
            if not self._current_task or uid not in self._current_task.user_progress:
                return False

            self._current_task.failed_longtext += 1
            self._current_task.user_progress[uid].longtext_failed += 1
            return True

    def on_user_failed(self, uid: str, nickname: str, error_message: str = "") -> bool:
        """用户处理失败"""
        with self._lock:
            if not self._current_task:
                return False

            self._current_task.processed_users += 1
            self._current_task.failed_users += 1
            self._current_task.current_uid = uid

            # 记录用户进度
            self._current_task.user_progress[uid] = UserProgress(
                uid=uid,
                nickname=nickname,
                status="failed",
                error_message=error_message,
                completed_at=datetime.utcnow(),
            )

            self._user_count_since_save += 1

            # 每N个用户保存一次
            if self._user_count_since_save >= self._db_save_interval:
                self._save_to_db()
                self._user_count_since_save = 0

            logger.info(f"[CrawlerTaskService] 用户失败: {nickname}")
            return True

    def on_task_stopped(self, uid: str, nickname: str) -> bool:
        """任务被停止"""
        with self._lock:
            if not self._current_task:
                return False

            self._current_task.status = TaskStatus.IDLE
            self._current_task.completed_at = datetime.utcnow()
            self._save_to_db()
            logger.info(f"[CrawlerTaskService] 任务已停止: {self._current_task.task_id}")
            return True

    def on_task_error(self, error_message: str) -> bool:
        """任务异常"""
        with self._lock:
            if not self._current_task:
                return False

            self._current_task.status = TaskStatus.FAILED
            self._current_task.completed_at = datetime.utcnow()
            self._save_to_db()
            return True

    def _save_to_db(self) -> bool:
        """保存当前状态到数据库"""
        if not self._current_task:
            return False

        try:
            crawler_task_dao.update(self._current_task)
            logger.debug(f"[CrawlerTaskService] 保存到数据库: {self._current_task.task_id}")
            return True
        except Exception as e:
            logger.error(f"[CrawlerTaskService] 保存失败: {e}")
            return False

    def save_final(self) -> bool:
        """最终保存（任务结束时调用）"""
        with self._lock:
            if not self._current_task:
                return False

            self._current_task.status = TaskStatus.COMPLETED
            self._current_task.completed_at = datetime.utcnow()
            return self._save_to_db()

    def get_status(self) -> dict:
        """获取状态（用于API响应）"""
        with self._lock:
            if not self._current_task:
                return {
                    "status": TaskStatus.IDLE.value,
                    "total_users": 0,
                    "processed_users": 0,
                    "failed_users": 0,
                    "total_blogs": 0,
                    "saved_blogs": 0,
                    "total_longtext": 0,
                    "saved_longtext": 0,
                    "failed_longtext": 0,
                    "progress": 0.0,
                    "logs": [],
                    "log_count": 0,
                }

            return self._current_task.get_dict()

    def restore_from_db(self) -> bool:
        """从数据库恢复任务（仅恢复核心状态，日志和用户进度懒加载）"""
        with self._lock:
            # 查找运行中的任务（仅查询核心字段）
            task_doc = crawler_task_dao.find_active()
            if task_doc:
                self._current_task = task_doc
                # 日志和 user_progress 为空，需要时再加载
                logger.info(f"[CrawlerTaskService] 从数据库恢复任务: {task_doc.task_id}, "
                           f"状态={task_doc.status}, 进度={task_doc.processed_users}/{task_doc.total_users}")
                return True

            # 没有运行中的任务，尝试获取最新的（仅核心字段）
            latest_doc = crawler_task_dao.find_latest()
            if latest_doc:
                self._current_task = latest_doc
                logger.info(f"[CrawlerTaskService] 加载最新任务: {latest_doc.task_id}, 状态={latest_doc.status}")
                return True

            logger.info("[CrawlerTaskService] 没有找到历史任务")
            return False

    def reset(self) -> bool:
        """重置服务状态"""
        with self._lock:
            self._current_task = None
            self._user_count_since_save = 0
            return True


# 全局单例
crawler_task_service = CrawlerTaskService()
