"""
求谷表单模型
用户提交的想要谷子的反馈
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, model_validator
from enum import Enum


class WantGuziStatus(str, Enum):
    """求谷状态"""
    PENDING = "pending"  # 待处理
    PROCESSING = "processing"  # 处理中
    COMPLETED = "completed"  # 已完成
    CLOSED = "closed"  # 已关闭


class WantGuziBase(BaseModel):
    """求谷表单基础模型"""
    ip_name: str = Field(..., description="用户想要的IP名称")
    category_tags: List[str] = Field(default_factory=list, description="谷子类别标签ID列表")
    remark: Optional[str] = Field(default=None, description="用户备注")


class WantGuziCreate(WantGuziBase):
    """创建求谷表单"""
    pass


class WantGuziUpdate(BaseModel):
    """更新求谷表单"""
    status: Optional[WantGuziStatus] = Field(default=None, description="处理状态")
    reply: Optional[str] = Field(default=None, description="管理员回复")
    admin_remark: Optional[str] = Field(default=None, description="管理员备注")


class WantGuzi(WantGuziBase):
    """求谷表单完整模型"""
    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "ip_name": "蓝色监狱",
                "category_tags": ["类别标签ID"],
                "remark": "想要徽章和立牌",
                "status": "pending",
                "reply": None,
                "admin_remark": None,
                "created_at": "2024-01-01T00:00:00",
                "updated_at": "2024-01-01T00:00:00"
            }
        }
    )

    id: Optional[str] = Field(default=None, description="文档ID")
    status: WantGuziStatus = Field(default=WantGuziStatus.PENDING, description="处理状态")
    reply: Optional[str] = Field(default=None, description="管理员回复")
    admin_remark: Optional[str] = Field(default=None, description="管理员备注")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    @model_validator(mode='before')
    @classmethod
    def convert_mongo_id(cls, data):
        """处理MongoDB数据，将 _id 转换为 id"""
        if isinstance(data, dict):
            if '_id' in data:
                if 'id' not in data or data.get('id') is None:
                    data['id'] = str(data['_id'])
                del data['_id']
        return data


class WantGuziResponse(BaseModel):
    """求谷表单响应模型"""
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = Field(default=None, description="文档ID")
    ip_name: str = Field(..., description="用户想要的IP名称")
    category_tags: List[str] = Field(default_factory=list, description="谷子类别标签ID列表")
    remark: Optional[str] = Field(default=None, description="用户备注")
    status: WantGuziStatus = Field(default=WantGuziStatus.PENDING, description="处理状态")
    reply: Optional[str] = Field(default=None, description="管理员回复")
    admin_remark: Optional[str] = Field(default=None, description="管理员备注")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class WantGuziListResponse(BaseModel):
    """求谷表单列表响应模型（含分页信息）"""
    items: List[WantGuziResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
