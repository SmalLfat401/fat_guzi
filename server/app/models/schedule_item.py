"""
排期内容条目数据模型
用于管理每周的内容发布计划、状态和平台发布记录
"""
from typing import Optional, List, Dict
from pydantic import BaseModel, Field
from datetime import datetime


# 内容类型枚举
class ContentType(str):
    ACTIVITY = "activity"       # 活动速递
    NEW_PRODUCT = "new_product" # 新品情报
    SLANG_SCIENCE = "slang_science"  # 黑话科普
    MEME_INTERACTION = "meme_interaction"  # 比价/互动/梗图


CONTENT_TYPE_LABELS = {
    "activity": "活动速递",
    "new_product": "新品情报",
    "slang_science": "黑话科普",
    "meme_interaction": "比价/互动/梗图",
}

CONTENT_TYPE_CATEGORIES = {
    "slang_science": ["guzi", "coser", "convention", "game"],
}

SLANG_CATEGORY_LABELS = {
    "guzi": "谷子",
    "coser": "Coser",
    "convention": "漫展",
    "game": "游戏",
}

# 发布状态
class PublishStatus(str):
    PENDING = "pending"       # 待审核
    CONFIRMED = "confirmed"  # 已确认
    PUBLISHED = "published"  # 已发布


# 单个平台发布状态
class PlatformPublishStatus(BaseModel):
    """单个平台发布状态"""
    status: str = Field(default=PublishStatus.PENDING, description="发布状态")
    published_at: Optional[datetime] = Field(default=None, description="实际发布时间")
    confirmed_at: Optional[datetime] = Field(default=None, description="确认时间")
    note: Optional[str] = Field(default="", description="备注")


# 关联的术语条目（黑话科普使用）
class LinkedSlangItem(BaseModel):
    """关联的术语条目"""
    slang_id: str = Field(..., description="术语 ID")
    slang_type: str = Field(..., description="术语类型: guzi/coser/convention/game")
    slang_name: str = Field(default="", description="术语名称")


class ScheduleItemBase(BaseModel):
    """排期条目基础模型"""
    week_year: str = Field(..., description="年-周标识，如 2026-W17")
    date: str = Field(..., description="内容日期 YYYY-MM-DD")
    content_type: str = Field(..., description="内容类型: activity/new_product/slang_science/meme_interaction")
    title: str = Field(default="", description="内容标题")
    body: str = Field(default="", description="正文内容")
    images: List[str] = Field(default_factory=list, description="图片 URL 列表")
    slang_category: Optional[str] = Field(default=None, description="黑话科普分类: guzi/coser/convention/game")
    linked_slags: List[LinkedSlangItem] = Field(default_factory=list, description="关联的术语列表")
    is_pinned: bool = Field(default=False, description="是否锚定（置顶）")


class ScheduleItemCreate(ScheduleItemBase):
    """创建排期条目请求模型"""
    pass


class ScheduleItemUpdate(BaseModel):
    """更新排期条目请求模型"""
    title: Optional[str] = None
    body: Optional[str] = None
    images: Optional[List[str]] = None
    slang_category: Optional[str] = None
    linked_slags: Optional[List[LinkedSlangItem]] = None
    is_pinned: Optional[bool] = None


class ScheduleItem(ScheduleItemBase):
    """排期条目完整模型"""
    id: str = Field(..., alias="_id")
    platforms: Dict[str, PlatformPublishStatus] = Field(default_factory=dict, description="各平台发布状态")
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class ScheduleItemResponse(ScheduleItemBase):
    """排期条目响应模型"""
    id: str
    platforms: Dict[str, PlatformPublishStatus] = {}
    is_pinned: bool = False
    created_at: datetime
    updated_at: datetime


class ScheduleItemListResponse(BaseModel):
    """排期条目列表响应模型"""
    items: List[ScheduleItemResponse]
    total: int


# 状态流转请求模型
class UpdateStatusRequest(BaseModel):
    """更新发布状态请求模型"""
    platform_id: str = Field(..., description="平台 ID")
    status: str = Field(..., description="目标状态: pending/confirmed/published")
    note: Optional[str] = Field(default=None, description="备注")


# 批量确认请求模型（用于补发历史日期时的确认窗口）
class BatchConfirmRequest(BaseModel):
    """批量确认请求模型"""
    item_ids: List[str] = Field(..., description="要确认的条目 ID 列表")
    reason: str = Field(default="补发确认", description="确认原因")
