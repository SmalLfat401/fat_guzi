"""
微博情报提取数据模型 - WeiboIntel
独立于 WeiboPost 的结构化情报记录
集合名称: weibo_intel
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import uuid


class IntelCategory(str, Enum):
    """情报类别枚举"""
    CONVENTION = "convention"          # 漫展/同人展/动漫展/游戏展/嘉年华
    BOOK_SIGNING = "book_signing"      # 签售会/签书会/作家签售
    PRE_ORDER = "pre_order"            # 预售/预约/限定预订
    PRODUCT_LAUNCH = "product_launch"  # 新谷开团/新品发布/周边首发
    OFFLINE_ACTIVITY = "offline_activity"  # 线下活动/聚会/快闪店/主题店
    ONLINE_ACTIVITY = "online_activity"    # 线上活动/直播/联动
    OTHER = "other"                    # 其他

    @classmethod
    def calendar_type_map(cls) -> Dict[str, str]:
        return {
            cls.CONVENTION.value: "convention",
            cls.BOOK_SIGNING.value: "activity",
            cls.PRE_ORDER.value: "activity",
            cls.PRODUCT_LAUNCH.value: "activity",
            cls.OFFLINE_ACTIVITY.value: "activity",
            cls.ONLINE_ACTIVITY.value: "online",
            cls.OTHER.value: "other",
        }

    @classmethod
    def display_name(cls, value: str) -> str:
        names = {
            cls.CONVENTION.value: "漫展",
            cls.BOOK_SIGNING.value: "签售",
            cls.PRE_ORDER.value: "预售",
            cls.PRODUCT_LAUNCH.value: "新谷开团",
            cls.OFFLINE_ACTIVITY.value: "线下活动",
            cls.ONLINE_ACTIVITY.value: "线上活动",
            cls.OTHER.value: "其他",
        }
        return names.get(value, value)


class IntelStatus(str, Enum):
    """情报审核状态"""
    PENDING = "pending"    # 待审核
    APPROVED = "approved"  # 已批准
    REJECTED = "rejected"  # 已拒绝

    # 提取阶段状态（内部使用）
    EXTRACTING = "extracting"   # 提取中
    EXTRACT_FAILED = "extract_failed"  # 提取失败
    NOT_RELATED = "not_related"  # 判定为不相关


class AlertType(str, Enum):
    """告警类型"""
    DATE_CHANGED = "date_changed"          # 日期变更
    LOCATION_CHANGED = "location_changed"  # 地点变更
    PRICE_CHANGED = "price_changed"        # 价格变动
    CANCELLED = "cancelled"               # 活动取消
    CONFLICTING_INFO = "conflicting_info" # 信息冲突


class ExtractMethod(str, Enum):
    """提取方式"""
    RULE = "rule"      # 规则匹配
    AI = "ai"          # AI 提取
    MANUAL = "manual"   # 人工创建


class IntelChange(BaseModel):
    """情报变更记录"""
    changed_at: datetime = Field(default_factory=datetime.utcnow)
    changed_by: str = Field(description="ai / manual / user_name")
    field: Optional[str] = Field(default=None, description="变更的字段名，空表示整条记录变更")
    old_value: Optional[Any] = Field(default=None)
    new_value: Optional[Any] = Field(default=None)
    source_post_mid: Optional[str] = Field(default=None, description="触发变更的帖子MID")
    change_type: str = Field(description="created / updated / merged / approved / rejected / alert_resolved")
    change_reason: Optional[str] = Field(default=None, description="变更原因描述")


class SourcePostRef(BaseModel):
    """情报关联的帖子引用"""
    mid: str = Field(description="帖子MID")
    author_nickname: str
    author_uid: str
    posted_at: Optional[datetime] = None
    linked_at: datetime = Field(default_factory=datetime.utcnow, description="关联到情报的时间")
    update_type: Optional[str] = Field(default=None, description="该帖子带来的更新类型")
    is_trigger_post: bool = Field(default=False, description="是否为触发情报创建的原始帖子")


class WeiboIntel(BaseModel):
    """
    微博情报模型

    特点：
    - 独立于 WeiboPost，按「事件」而非「帖子」组织
    - 支持版本控制和变更历史
    - 支持多帖子关联（同一个活动可能从多条帖子提取）
    - 支持告警机制（日期/地点变更时自动告警）
    """
    # 主键
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="UUID主键")

    # 情报来源
    source_post_mid: str = Field(description="触发情报创建的原始帖子MID")
    source_post_url: Optional[str] = Field(default=None, description="帖子URL")
    author_uid: str = Field(description="帖子作者UID")
    author_nickname: str = Field(description="帖子作者昵称")

    # 情报内容
    category: IntelCategory = Field(description="活动类别")
    title: str = Field(description="事件标题（必填）")
    description: Optional[str] = Field(default=None, description="补充描述")

    # 日历核心字段（直接映射到 CalendarEvent）
    event_start_date: Optional[str] = Field(
        default=None,
        description="开始日期 YYYY-MM-DD"
    )
    event_end_date: Optional[str] = Field(
        default=None,
        description="结束日期 YYYY-MM-DD，单日活动同 start_date"
    )
    event_start_time: Optional[str] = Field(
        default=None,
        description="开始时间 HH:mm"
    )
    event_location: Optional[str] = Field(default=None, description="详细地点")
    event_city: Optional[str] = Field(default=None, description="城市")

    price_info: Optional[str] = Field(default=None, description="价格或票务信息")
    purchase_url: Optional[str] = Field(default=None, description="购买/预约链接")
    participants: List[str] = Field(default_factory=list, description="嘉宾/参与者列表")
    related_ips: List[str] = Field(default_factory=list, description="相关IP列表")
    tags: List[str] = Field(default_factory=list, description="标签列表")
    cover_image: Optional[str] = Field(default=None, description="封面图URL")

    # 状态管理
    status: IntelStatus = Field(default=IntelStatus.PENDING, description="审核状态")
    alert_type: Optional[AlertType] = Field(default=None, description="告警类型")
    alert_message: Optional[str] = Field(default=None, description="告警详情")
    alert_resolved: bool = Field(default=False, description="告警是否已处理")

    # 版本控制
    version: int = Field(default=1, description="版本号，每次更新+1")
    is_latest: bool = Field(default=True, description="是否为该活动的最新版本")

    # 合并信息
    merged_from_ids: List[str] = Field(
        default_factory=list,
        description="合并自哪些 intel id"
    )
    parent_id: Optional[str] = Field(
        default=None,
        description="父 intel id（如果是合并后的版本）"
    )

    # 关联帖子列表
    source_posts: List[SourcePostRef] = Field(
        default_factory=list,
        description="关联的帖子列表"
    )

    # 提取信息
    extract_method: ExtractMethod = Field(
        default=ExtractMethod.AI,
        description="提取方式"
    )
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="置信度 0.0-1.0"
    )
    ai_model: Optional[str] = Field(default=None, description="使用的AI模型")
    ai_raw_response: Optional[Dict[str, Any]] = Field(
        default=None,
        description="AI 原始返回（保留用于调试）"
    )

    # 去重标识
    dedup_hash: Optional[str] = Field(
        default=None,
        description="去重 hash: normalize(title)#city#year"
    )

    # 变更历史
    change_history: List[IntelChange] = Field(
        default_factory=list,
        description="变更记录列表"
    )

    # 日历同步
    synced_to_calendar: bool = Field(
        default=False,
        description="是否已同步到日历数据库"
    )
    calendar_event_id: Optional[str] = Field(
        default=None,
        description="关联的日历事件ID（expo_events 表的 event_id）"
    )
    first_published_at: Optional[datetime] = Field(
        default=None,
        description="首次发布到日历的时间"
    )

    # 发布状态 - 需人工控制才发布到 H5
    is_published: bool = Field(
        default=False,
        description="是否发布到 H5，默认 false 需人工开启"
    )

    # 关键词库反哺（从AI结果中学习到的触发词）
    learned_keywords: List[str] = Field(
        default_factory=list,
        description="从本次提取中学到的触发关键词"
    )

    # 时间戳
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    approved_at: Optional[datetime] = Field(default=None)
    approved_by: Optional[str] = Field(default=None)

    class Config:
        use_enum_values = True


class WeiboIntelCreate(BaseModel):
    """创建情报的请求模型（用于手动创建）"""
    category: IntelCategory
    title: str
    description: Optional[str] = None
    event_start_date: Optional[str] = None
    event_end_date: Optional[str] = None
    event_start_time: Optional[str] = None
    event_location: Optional[str] = None
    event_city: Optional[str] = None
    price_info: Optional[str] = None
    purchase_url: Optional[str] = None
    participants: List[str] = Field(default_factory=list)
    related_ips: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    cover_image: Optional[str] = None
    source_post_mid: Optional[str] = None
    author_uid: Optional[str] = None
    author_nickname: Optional[str] = None
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    extract_method: ExtractMethod = Field(default=ExtractMethod.MANUAL)


class WeiboIntelUpdate(BaseModel):
    """更新情报的请求模型"""
    category: Optional[IntelCategory] = None
    title: Optional[str] = None
    description: Optional[str] = None
    event_start_date: Optional[str] = None
    event_end_date: Optional[str] = None
    event_start_time: Optional[str] = None
    event_location: Optional[str] = None
    event_city: Optional[str] = None
    price_info: Optional[str] = None
    purchase_url: Optional[str] = None
    participants: Optional[List[str]] = None
    related_ips: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    cover_image: Optional[str] = None
    alert_resolved: Optional[bool] = None
    is_published: Optional[bool] = None


class WeiboIntelResponse(BaseModel):
    """情报响应模型（管理端列表展示用）"""
    id: str
    category: str
    category_display: str
    title: str
    description: Optional[str] = None
    event_start_date: Optional[str] = None
    event_end_date: Optional[str] = None
    event_start_time: Optional[str] = None
    event_location: Optional[str] = None
    event_city: Optional[str] = None
    price_info: Optional[str] = None
    purchase_url: Optional[str] = None
    participants: List[str] = []
    related_ips: List[str] = []
    tags: List[str] = []
    cover_image: Optional[str] = None

    status: str
    alert_type: Optional[str] = None
    alert_message: Optional[str] = None
    alert_resolved: bool = False

    version: int = 1
    is_latest: bool = True
    merged_from_ids: List[str] = []
    source_posts_count: int = 0
    first_post_author: Optional[str] = None
    first_post_time: Optional[str] = None

    extract_method: str
    confidence: float = 0.0
    ai_model: Optional[str] = None

    synced_to_calendar: bool = False
    calendar_event_id: Optional[str] = None

    is_published: bool = False

    has_alert: bool = False
    change_history_count: int = 0

    created_at: str
    updated_at: str
    approved_at: Optional[str] = None

    class Config:
        from_attributes = True


class WeiboIntelDetailResponse(WeiboIntelResponse):
    """情报详情响应模型（含完整变更历史和帖子列表）"""
    source_posts: List[Dict[str, Any]] = []
    change_history: List[Dict[str, Any]] = []
    learned_keywords: List[str] = []
    ai_raw_response: Optional[Dict[str, Any]] = None


class IntelStats(BaseModel):
    """情报统计模型"""
    total: int = 0
    pending: int = 0
    approved: int = 0
    rejected: int = 0
    has_alert: int = 0
    synced_to_calendar: int = 0
    by_category: Dict[str, int] = {}
    today_new: int = 0
    extracting: int = 0
    extract_failed: int = 0
    not_related: int = 0


class SingleExtractResult(BaseModel):
    """单帖 AI 提取结果（不持久化，前端展示用）"""
    mid: str
    is_valid: bool = False
    reason: Optional[str] = None
    category: Optional[str] = None
    title: Optional[str] = None
    event_start_date: Optional[str] = None
    event_end_date: Optional[str] = None
    event_start_time: Optional[str] = None
    event_location: Optional[str] = None
    event_city: Optional[str] = None
    price_info: Optional[str] = None
    participants: List[str] = Field(default_factory=list)
    related_ips: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    confidence: float = 0.0
    learned_keywords: List[str] = Field(default_factory=list)


class CreateFromExtract(BaseModel):
    """从提取结果创建情报"""
    mid: str
    category: IntelCategory
    title: str
    description: Optional[str] = None
    event_start_date: Optional[str] = None
    event_end_date: Optional[str] = None
    event_start_time: Optional[str] = None
    event_location: Optional[str] = None
    event_city: Optional[str] = None
    price_info: Optional[str] = None
    participants: List[str] = Field(default_factory=list)
    related_ips: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
