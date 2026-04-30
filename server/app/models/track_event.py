"""
埋点事件数据模型
集合名称: track_events（原始事件）
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import uuid


class TrackEventType(str, Enum):
    """埋点事件类型"""
    PV = "pv"           # 页面浏览
    CLICK = "click"     # 点击事件
    EXPOSE = "expose"   # 曝光事件
    SUBMIT = "submit"   # 表单提交
    ACTION = "action"   # 特定行为


class TrackEvent(BaseModel):
    """埋点事件（原始数据）"""
    # 主键
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    # 用户标识
    fid: str = Field(description="浏览器指纹ID（UV标识）")

    # 事件类型
    event: TrackEventType

    # 页面信息
    page: str = Field(description="路由路径，如 /products")
    referrer: Optional[str] = Field(default=None, description="来源页")

    # 业务关联
    item_id: Optional[str] = Field(default=None, description="关联业务ID（商品ID、情报ID等）")
    item_name: Optional[str] = Field(default=None, description="关联名称，便于后台查看")

    # 具体行为
    action: Optional[str] = Field(default=None, description="具体行为标识，如 generate_tkl / favorite / share")

    # 扩展属性（筛选条件、搜索词等）
    extra: Dict[str, Any] = Field(default_factory=dict)

    # 进入详情页时的来源上下文
    ip_tag: Optional[str] = Field(default=None, description="进入详情页时记录：商品所属 IP 标签名称")
    category_tag: Optional[str] = Field(default=None, description="进入详情页时记录：商品所属分类标签名称")

    # 设备信息（可选，前端采集一次后复用）
    device_info: Optional[Dict[str, Any]] = Field(default=None)

    # 时间戳
    timestamp: int = Field(description="Unix 毫秒时间戳")
    date: str = Field(description="日期 YYYY-MM-DD，便于按日期聚合")

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        use_enum_values = True


class TrackEventBatch(BaseModel):
    """批量上报请求"""
    events: List[TrackEvent] = Field(min_length=1, max_length=100)


class TrackEventResponse(BaseModel):
    """上报响应"""
    success: bool
    saved: int = 0


# ──────────────────────────────────────────────
# 看板统计响应模型
# ──────────────────────────────────────────────

class OverviewStats(BaseModel):
    """概览统计"""
    today_pv: int = 0
    today_uv: int = 0
    yesterday_pv: int = 0
    yesterday_uv: int = 0
    pv_change: float = 0  # 环比增长率
    uv_change: float = 0


class PageStatsItem(BaseModel):
    """单页面统计项"""
    page: str
    pv: int
    uv: int
    click: int
    expose: int = 0
    submit: int
    action: int


class ProductDetailStatsItem(BaseModel):
    """商品详情页统计项"""
    item_id: str
    item_name: str = ""
    ip_tag: str = ""
    category_tag: str = ""
    pv: int = 0
    uv: int = 0


class CategoryStatsItem(BaseModel):
    """商品类别统计项"""
    category_tag: str
    pv: int = 0
    uv: int = 0


class HotIpItem(BaseModel):
    """热门 IP 项（按 IP 聚合的点击量排行）"""
    ip_tag: str
    click: int = 0
    pv: int = 0
    detail_count: int = 0  # 进入详情的次数（带 ip_tag 的 PV 事件数）


class ConversionStep(BaseModel):
    """转化漏斗步骤"""
    step: str
    count: int


class ConversionFunnel(BaseModel):
    """转化漏斗"""
    steps: List[ConversionStep]


class RetentionItem(BaseModel):
    """留存数据项"""
    date: str
    new_users: int
    retained_1d: int = 0
    retained_7d: int = 0


class TrackStatsResponse(BaseModel):
    """统计响应"""
    overview: OverviewStats
    page_stats: List[PageStatsItem]
    product_detail_stats: List[ProductDetailStatsItem] = []  # 商品详情页统计
    category_stats: List[CategoryStatsItem] = []  # 商品类别统计
    hot_ips: List[HotIpItem]
    hot_searches: List[Dict[str, Any]]
    conversion: ConversionFunnel
    retention: List[RetentionItem]
