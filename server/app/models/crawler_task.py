"""
爬虫任务数据模型 - 用于存储批量爬虫任务的状态
集合名称: crawler_tasks
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class TaskStatus(str, Enum):
    """任务状态"""
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPING = "stopping"
    COMPLETED = "completed"
    FAILED = "failed"


class CrawlerLogEntry(BaseModel):
    """爬虫日志条目"""
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    uid: str = Field(default="", description="用户UID，空表示系统日志")
    nickname: str = Field(default="", description="用户昵称")
    action: str = Field(..., description="动作类型: start/stop/user_completed/user_failed/paused/error")
    message: str = Field(..., description="日志消息")
    success: bool = Field(default=True, description="是否成功")


class UserProgress(BaseModel):
    """单个用户的进度"""
    uid: str = Field(..., description="用户UID")
    nickname: str = Field(..., description="用户昵称")
    status: str = Field(default="pending", description="pending/running/completed/failed")
    blogs_count: int = Field(default=0, description="该用户贡献的帖子数")
    saved_count: int = Field(default=0, description="新增保存的帖子数")
    longtext_total: int = Field(default=0, description="需要全文的数量")
    longtext_saved: int = Field(default=0, description="已保存全文数量")
    longtext_failed: int = Field(default=0, description="全文失败数量")
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


class CrawlerTask(BaseModel):
    """爬虫任务模型 - 对应 crawler_tasks 集合

    一个文档 = 一次批量任务，包含所有状态和进度信息
    """
    # 任务标识
    task_id: str = Field(..., description="任务ID（UUID）")
    category_id: Optional[str] = Field(default=None, description="关联的分类ID")
    category_name: Optional[str] = Field(default=None, description="分类名称")

    # 任务配置
    mode: str = Field(default="full", description="模式: full/limited/specific")
    max_posts: int = Field(default=0, description="限量模式每用户最大条数")

    # 目标用户
    target_uids: List[str] = Field(default_factory=list, description="目标用户UID列表")
    total_users: int = Field(default=0, description="总用户数")

    # 任务状态
    status: TaskStatus = Field(default=TaskStatus.IDLE, description="任务状态")

    # 时间信息
    started_at: Optional[datetime] = Field(default=None, description="开始时间")
    completed_at: Optional[datetime] = Field(default=None, description="完成时间")
    paused_at: Optional[datetime] = Field(default=None, description="暂停时间")

    # 进度统计
    processed_users: int = Field(default=0, description="已处理用户数")
    failed_users: int = Field(default=0, description="失败用户数")
    total_blogs: int = Field(default=0, description="获取到的微博总数")
    saved_blogs: int = Field(default=0, description="保存的新微博数")
    total_longtext: int = Field(default=0, description="需要全文的总数")
    saved_longtext: int = Field(default=0, description="已保存全文数")
    failed_longtext: int = Field(default=0, description="失败全文数")

    # 当前处理位置（用于断点续传）
    current_uid: Optional[str] = Field(default=None, description="当前处理的UID")
    paused_after_uid: Optional[str] = Field(default=None, description="暂停时的最后一个UID")

    # 每个用户的详细进度
    user_progress: Dict[str, UserProgress] = Field(default_factory=dict, description="用户进度字典")

    # 日志（限制最近100条）
    logs: List[CrawlerLogEntry] = Field(default_factory=list, description="日志列表")

    # 元数据
    created_at: datetime = Field(default_factory=datetime.utcnow, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="更新时间")

    @property
    def progress(self) -> float:
        """计算进度百分比"""
        if self.total_users == 0:
            return 0.0
        return round(self.processed_users / self.total_users * 100, 1)

    def get_dict(self) -> Dict[str, Any]:
        """转换为API响应字典"""
        return {
            "task_id": self.task_id,
            "category_id": self.category_id,
            "category_name": self.category_name,
            "mode": self.mode,
            "max_posts": self.max_posts,
            "target_uids": self.target_uids,
            "total_users": self.total_users,
            "status": self.status.value if isinstance(self.status, TaskStatus) else self.status,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "paused_at": self.paused_at.isoformat() if self.paused_at else None,
            "processed_users": self.processed_users,
            "failed_users": self.failed_users,
            "total_blogs": self.total_blogs,
            "saved_blogs": self.saved_blogs,
            "total_longtext": self.total_longtext,
            "saved_longtext": self.saved_longtext,
            "failed_longtext": self.failed_longtext,
            "progress": self.progress,
            "current_uid": self.current_uid,
            "paused_after_uid": self.paused_after_uid,
            "logs": [
                {
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                    "uid": log.uid,
                    "nickname": log.nickname,
                    "action": log.action,
                    "message": log.message,
                    "success": log.success,
                }
                for log in self.logs[-100:]  # 只返回最近100条日志
            ],
            "log_count": len(self.logs),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
