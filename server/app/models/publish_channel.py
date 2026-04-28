"""
发布渠道配置模型
用于管理内容发布的目标平台（抖音、小红书、微博等）
"""
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


class PublishChannelBase(BaseModel):
    """发布渠道基础模型"""
    name: str = Field(..., description="渠道名称，如：抖音、小红书")
    icon: Optional[str] = Field(default="", description="渠道图标（emoji 或 URL）")
    is_active: bool = Field(default=True, description="是否启用")


class PublishChannelCreate(PublishChannelBase):
    """创建发布渠道请求模型"""
    pass


class PublishChannelUpdate(BaseModel):
    """更新发布渠道请求模型"""
    name: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None


class PublishChannel(PublishChannelBase):
    """发布渠道完整模型"""
    id: str = Field(..., alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class PublishChannelResponse(PublishChannelBase):
    """发布渠道响应模型"""
    id: str
    created_at: datetime
    updated_at: datetime
