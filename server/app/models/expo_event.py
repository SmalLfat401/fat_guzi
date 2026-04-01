"""
漫展活动数据模型 - 热点追踪系统核心
用于存储从微博帖子中提取的漫展活动信息
集合名称: expo_events
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class EventStatus(str, Enum):
    """活动状态枚举"""
    UPCOMING = "upcoming"    # 即将举办
    ONGOING = "ongoing"      # 正在进行
    ENDED = "ended"          # 已结束
    CANCELLED = "cancelled"  # 已取消
    UNKNOWN = "unknown"      # 未知


class UpdateType(str, Enum):
    """更新类型枚举"""
    ANNOUNCEMENT = "announcement"      # 公告
    SCHEDULE = "schedule"              # 行程/日程
    GUEST = "guest"                    # 嘉宾
    EXHIBITOR = "exhibitor"            # 参展商
    VENDOR = "vendor"                  # 摊主/摊位
    TICKET = "ticket"                  # 票务
    CHANGE = "change"                  # 变动（重要）
    PROGRESS = "progress"              # 进度
    OTHER = "other"                    # 其他


class ExpoEvent(BaseModel):
    """
    漫展活动模型 - 热点追踪系统的核心实体

    特点：
    - 一个活动可关联多条微博帖子
    - 每条帖子作为一条更新记录
    - 活动信息从多条帖子中提取合并
    """
    # 主键 - 使用活动名称+年份的hash作为ID
    event_id: str = Field(..., description="活动唯一标识（md5或规则生成）")

    # 基础信息（从多条帖子提取合并）
    name: str = Field(..., description="活动名称")
    year: Optional[int] = Field(default=None, description="活动年份")
    session: Optional[str] = Field(default=None, description="届次，如'春季展'、'夏季展'、'第十届'")

    # 时间信息
    dates: Optional[Dict[str, str]] = Field(
        default=None,
        description="活动日期，格式: {start: '2026-05-01', end: '2026-05-03'}"
    )
    status: EventStatus = Field(default=EventStatus.UPCOMING, description="活动状态")

    # 地点信息
    location: Optional[str] = Field(default=None, description="活动地点")
    venue: Optional[str] = Field(default=None, description="场馆名称")
    city: Optional[str] = Field(default=None, description="城市")

    # 票务信息
    ticket_info: Optional[str] = Field(default=None, description="票务信息/购票渠道")

    # 联动信息（从多帖合并去重）
    ips: List[str] = Field(default_factory=list, description="参展IP/联动IP列表")
    guests: List[str] = Field(default_factory=list, description="嘉宾列表")
    exhibitors: List[str] = Field(default_factory=list, description="参展商列表")

    # 关键词（用于识别）
    keywords: List[str] = Field(default_factory=list, description="识别关键词列表")

    # 帖子关联
    source_posts: List[str] = Field(default_factory=list, description="来源帖子MID列表")
    post_count: int = Field(default=0, description="关联帖子数量")

    # 最新动态
    latest_post_at: Optional[datetime] = Field(default=None, description="最新帖子发布时间")
    latest_update_at: Optional[datetime] = Field(default=None, description="最新更新时间")
    latest_update_type: Optional[UpdateType] = Field(default=None, description="最新更新类型")

    # 重要标记
    has_important_update: bool = Field(default=False, description="是否有重要变动")
    key_info: Optional[str] = Field(default=None, description="关键信息摘要（如有重要变动）")

    # 更新历史（按帖子粒度）
    update_history: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="更新历史记录列表"
    )

    # 元数据
    created_at: datetime = Field(default_factory=datetime.utcnow, description="首次创建时间")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="最后更新时间")
    crawl_source: str = Field(default="weibo", description="数据来源")

    class Config:
        use_enum_values = True


class ExpoEventCreate(BaseModel):
    """创建漫展活动的请求模型"""
    name: str
    year: Optional[int] = None
    session: Optional[str] = None
    dates: Optional[Dict[str, str]] = None
    location: Optional[str] = None
    venue: Optional[str] = None
    city: Optional[str] = None
    ticket_info: Optional[str] = None


class ExpoEventUpdate(BaseModel):
    """更新漫展活动的请求模型"""
    name: Optional[str] = None
    year: Optional[int] = None
    session: Optional[str] = None
    dates: Optional[Dict[str, str]] = None
    location: Optional[str] = None
    venue: Optional[str] = None
    city: Optional[str] = None
    ticket_info: Optional[str] = None
    ips: Optional[List[str]] = None
    guests: Optional[List[str]] = None
    exhibitors: Optional[List[str]] = None
    status: Optional[EventStatus] = None


class ExpoEventResponse(BaseModel):
    """漫展活动响应模型（简化版）"""
    event_id: str
    name: str
    year: Optional[int] = None
    session: Optional[str] = None
    dates: Optional[Dict[str, str]] = None
    location: Optional[str] = None
    venue: Optional[str] = None
    city: Optional[str] = None
    ticket_info: Optional[str] = None
    ips: List[str] = []
    guests: List[str] = []
    status: str
    post_count: int = 0
    latest_post_at: Optional[datetime] = None
    latest_update_type: Optional[str] = None
    has_important_update: bool = False
    key_info: Optional[str] = None
    update_history: List[Dict[str, Any]] = []

    class Config:
        from_attributes = True
