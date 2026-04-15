"""
Application state for sharing global resources.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum
import threading
import json
import os

# 北京时区（UTC+8），确保不管容器时区如何都正确
BEIJING_TZ = timezone(timedelta(hours=8))

# 任务状态持久化文件路径（已废弃，使用数据库）
from app.config.settings import settings as _settings
_TASK_STATE_FILE = os.path.join(os.path.dirname(__file__), "..", ".task_state.json")

# Global playwright client instance
playwright_client: 'PlaywrightClient' = None

# Global browser instance for keeping browser open
global_browser = None
global_context = None
global_page = None

# Chrome process started by start-chrome API
chrome_process_pid = None
chrome_debug_port = None


# ====================
# 微博爬虫任务状态
# ====================

class CrawlerTaskStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPING = "stopping"
    COMPLETED = "completed"
    FAILED = "failed"


class CrawlerLogEntry(Dict):
    """爬虫日志条目"""

    def __init__(self, timestamp: datetime, uid: str, nickname: str,
                 action: str, message: str, success: bool):
        super().__init__()
        self["timestamp"] = timestamp.isoformat()
        self["uid"] = uid
        self["nickname"] = nickname
        self["action"] = action
        self["message"] = message
        self["success"] = success


class CrawlerStats:
    """爬虫进度统计 - 独立管理，接口直接返回"""

    def __init__(self):
        self._lock = threading.RLock()
        self._total_users = 0
        self._processed_users = 0
        self._failed_users = 0
        self._total_blogs = 0
        self._saved_blogs = 0
        self._total_longtext = 0
        self._saved_longtext = 0
        self._failed_longtext = 0
        self._log_count = 0

    def start_task(self, total_users: int):
        """开始新任务，重置统计"""
        with self._lock:
            self._total_users = total_users
            self._processed_users = 0
            self._failed_users = 0
            self._total_blogs = 0
            self._saved_blogs = 0
            self._total_longtext = 0
            self._saved_longtext = 0
            self._failed_longtext = 0
            self._log_count = 0

    def on_user_completed(self, user_uid: str, blogs_count: int = 0,
                          saved_count: int = 0, longtext_count: int = 0):
        """用户处理完成时调用 - 原子更新所有相关统计"""
        with self._lock:
            self._processed_users += 1
            self._total_blogs += blogs_count
            self._saved_blogs += saved_count
            if longtext_count > 0:
                self._total_longtext += longtext_count

    def on_user_failed(self):
        """用户处理失败时调用"""
        with self._lock:
            self._processed_users += 1
            self._failed_users += 1

    def on_longtext_saved(self, count: int = 1):
        """成功保存全文时调用"""
        with self._lock:
            self._saved_longtext += count

    def on_longtext_failed(self, count: int = 1):
        """全文保存失败时调用"""
        with self._lock:
            self._failed_longtext += count

    def get_dict(self) -> Dict[str, Any]:
        """获取统计字典 - 接口直接返回"""
        with self._lock:
            processed = self._processed_users
            total = self._total_users
            progress = round(processed / total * 100, 1) if total > 0 else 0.0
            return {
                "total_users": total,
                "processed_users": processed,
                "failed_users": self._failed_users,
                "total_blogs": self._total_blogs,
                "saved_blogs": self._saved_blogs,
                "total_longtext": self._total_longtext,
                "saved_longtext": self._saved_longtext,
                "failed_longtext": self._failed_longtext,
                "progress": progress,
                "log_count": self._log_count,
            }

    def load_from_file(self, filepath: str = _TASK_STATE_FILE):
        """从文件加载状态（用于服务重启后恢复）"""
        if not os.path.exists(filepath):
            return
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            with self._lock:
                self._total_users = data.get("total_users", 0)
                self._processed_users = data.get("processed_users", 0)
                self._failed_users = data.get("failed_users", 0)
                self._total_blogs = data.get("total_blogs", 0)
                self._saved_blogs = data.get("saved_blogs", 0)
                self._total_longtext = data.get("total_longtext", 0)
                self._saved_longtext = data.get("saved_longtext", 0)
                self._failed_longtext = data.get("failed_longtext", 0)
                self._log_count = data.get("log_count", 0)
        except Exception:
            pass

    def save_to_file(self, filepath: str = _TASK_STATE_FILE):
        """保存状态到文件"""
        with self._lock:
            data = {
                "total_users": self._total_users,
                "processed_users": self._processed_users,
                "failed_users": self._failed_users,
                "total_blogs": self._total_blogs,
                "saved_blogs": self._saved_blogs,
                "total_longtext": self._total_longtext,
                "saved_longtext": self._saved_longtext,
                "failed_longtext": self._failed_longtext,
                "log_count": self._log_count,
            }
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False)
        except Exception:
            pass


class WeiboCrawlerTaskState:
    """微博爬虫任务全局状态"""

    MODE_FULL = "full"
    MODE_LIMITED = "limited"
    MODE_SPECIFIC = "specific"

    def __init__(self):
        self._lock = threading.RLock()
        self._status = CrawlerTaskStatus.IDLE
        self._mode: str = self.MODE_FULL
        self._max_posts: int = 0
        self._target_uids: List[str] = []
        self._stats = CrawlerStats()
        self._logs: List[CrawlerLogEntry] = []
        self._started_at: Optional[datetime] = None
        self._paused_at: Optional[datetime] = None
        self._paused_after_uid: Optional[str] = None

    @property
    def status(self) -> CrawlerTaskStatus:
        with self._lock:
            return self._status

    @property
    def stats(self) -> CrawlerStats:
        return self._stats

    @property
    def total_users(self) -> int:
        return self._stats._total_users

    @property
    def processed_users(self) -> int:
        return self._stats._processed_users

    @property
    def total_longtext(self) -> int:
        return self._stats._total_longtext

    @property
    def saved_longtext(self) -> int:
        return self._stats._saved_longtext

    @property
    def mode(self) -> str:
        with self._lock:
            return self._mode

    @property
    def max_posts(self) -> int:
        with self._lock:
            return self._max_posts

    @property
    def target_uids(self) -> List[str]:
        with self._lock:
            return self._target_uids.copy()

    @property
    def logs(self) -> List[CrawlerLogEntry]:
        with self._lock:
            return self._logs.copy()

    @property
    def started_at(self) -> Optional[datetime]:
        with self._lock:
            return self._started_at

    @property
    def paused_at(self) -> Optional[datetime]:
        with self._lock:
            return self._paused_at

    @property
    def paused_after_uid(self) -> Optional[str]:
        with self._lock:
            return self._paused_after_uid

    def _check_status(self) -> CrawlerTaskStatus:
        return self.status

    def reset(self):
        with self._lock:
            self._status = CrawlerTaskStatus.IDLE
            self._mode = self.MODE_FULL
            self._max_posts = 0
            self._target_uids = []
            self._stats = CrawlerStats()
            self._logs.clear()
            self._started_at = None
            self._paused_at = None
            self._paused_after_uid = None
            try:
                if os.path.exists(_TASK_STATE_FILE):
                    os.remove(_TASK_STATE_FILE)
            except Exception:
                pass

    def restore_from_file(self, filepath: str = _TASK_STATE_FILE):
        if not os.path.exists(filepath):
            return
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            with self._lock:
                self._stats._total_users = data.get("total_users", 0)
                self._stats._processed_users = data.get("processed_users", 0)
                self._stats._failed_users = data.get("failed_users", 0)
                self._stats._total_blogs = data.get("total_blogs", 0)
                self._stats._saved_blogs = data.get("saved_blogs", 0)
                self._stats._total_longtext = data.get("total_longtext", 0)
                self._stats._saved_longtext = data.get("saved_longtext", 0)
                self._stats._failed_longtext = data.get("failed_longtext", 0)
                self._stats._log_count = data.get("log_count", 0)
                self._status = CrawlerTaskStatus.RUNNING
                self._mode = data.get("mode", self.MODE_FULL)
                self._max_posts = data.get("max_posts", 0)
                self._target_uids = data.get("target_uids", [])
                self._started_at = datetime.fromisoformat(data["started_at"]) if data.get("started_at") else None
        except Exception:
            pass

    def save_to_file(self, filepath: str = _TASK_STATE_FILE):
        with self._lock:
            data = {
                "status": self._status.value,
                "mode": self._mode,
                "max_posts": self._max_posts,
                "target_uids": self._target_uids,
                "started_at": self._started_at.isoformat() if self._started_at else None,
                "total_users": self._stats._total_users,
                "processed_users": self._stats._processed_users,
                "failed_users": self._stats._failed_users,
                "total_blogs": self._stats._total_blogs,
                "saved_blogs": self._stats._saved_blogs,
                "total_longtext": self._stats._total_longtext,
                "saved_longtext": self._stats._saved_longtext,
                "failed_longtext": self._stats._failed_longtext,
                "log_count": self._stats._log_count,
            }
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def set_running(self, total_users: int, mode: str = None,
                    max_posts: int = 0, target_uids: list = None):
        with self._lock:
            self._status = CrawlerTaskStatus.RUNNING
            self._mode = mode or self.MODE_FULL
            self._max_posts = max_posts or 0
            self._target_uids = list(target_uids) if target_uids else []
            self._stats = CrawlerStats()
            self._stats.start_task(total_users)
            self._started_at = datetime.now(BEIJING_TZ)
            self._paused_at = None
            self._paused_after_uid = None
            self._logs.clear()

    def add_log(self, uid: str, nickname: str, action: str,
                message: str, success: bool):
        with self._lock:
            self._logs.append(
                CrawlerLogEntry(datetime.now(BEIJING_TZ), uid, nickname,
                                 action, message, success)
            )
            self._stats._log_count += 1
            if len(self._logs) > 200:
                self._logs = self._logs[-200:]

    def pause(self):
        with self._lock:
            if self._status == CrawlerTaskStatus.RUNNING:
                self._status = CrawlerTaskStatus.PAUSED
                self._paused_at = datetime.now(BEIJING_TZ)

    def resume(self):
        with self._lock:
            if self._status == CrawlerTaskStatus.PAUSED:
                self._status = CrawlerTaskStatus.RUNNING
                self._paused_at = None

    def stop(self):
        with self._lock:
            if self._status in (CrawlerTaskStatus.RUNNING, CrawlerTaskStatus.PAUSED):
                self._status = CrawlerTaskStatus.STOPPING

    def set_idle(self):
        with self._lock:
            self._status = CrawlerTaskStatus.IDLE
            self._mode = self.MODE_FULL
            self._max_posts = 0
            self._target_uids = []
            self._started_at = None
            self._paused_at = None
            self._paused_after_uid = None

    def set_paused_uid(self, uid: str):
        with self._lock:
            self._paused_after_uid = uid

    def get_status_dict(self) -> Dict[str, Any]:
        with self._lock:
            stats = self._stats.get_dict()
            return {
                "status": self._status.value,
                "mode": self._mode,
                "max_posts": self._max_posts,
                "target_uids": self._target_uids,
                "total_users": stats["total_users"],
                "processed_users": stats["processed_users"],
                "failed_users": stats["failed_users"],
                "total_blogs": stats["total_blogs"],
                "saved_blogs": stats["saved_blogs"],
                "total_longtext": stats["total_longtext"],
                "saved_longtext": stats["saved_longtext"],
                "failed_longtext": stats["failed_longtext"],
                "progress": stats["progress"],
                "started_at": self._started_at.isoformat() if self._started_at else None,
                "paused_at": self._paused_at.isoformat() if self._paused_at else None,
                "paused_after_uid": self._paused_after_uid,
                "logs": self.logs[-100:],
                "log_count": self._stats._log_count,
            }


# 全局爬虫任务状态实例
weibo_crawler_task_state = WeiboCrawlerTaskState()


def get_playwright_client() -> 'PlaywrightClient':
    """Get the global Playwright client instance."""
    return playwright_client


def set_playwright_client(client: 'PlaywrightClient'):
    """Set the global Playwright client instance."""
    global playwright_client
    playwright_client = client


def set_global_browser(browser, context, page):
    """Set the global browser instance for keeping browser open."""
    global global_browser, global_context, global_page
    global_browser = browser
    global_context = context
    global_page = page


def get_global_browser():
    """Get the global browser instance."""
    return global_browser, global_context, global_page


def clear_global_browser():
    """Clear the global browser instance."""
    global global_browser, global_context, global_page
    global_browser = None
    global_context = None
    global_page = None


def set_chrome_process(pid: int, port: int):
    """Set the Chrome process info started by start-chrome API."""
    global chrome_process_pid, chrome_debug_port
    chrome_process_pid = pid
    chrome_debug_port = port


def get_chrome_process():
    """Get the Chrome process info."""
    return chrome_process_pid, chrome_debug_port


def clear_chrome_process():
    """Clear the Chrome process info."""
    global chrome_process_pid, chrome_debug_port
    chrome_process_pid = None
    chrome_debug_port = None


# ====================
# 数据库任务服务（懒加载）
# ====================

def get_crawler_task_service():
    """获取爬虫任务服务（懒加载，避免循环导入）"""
    from app.services.crawler_task_service import crawler_task_service
    return crawler_task_service
