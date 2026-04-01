"""
微博账户类别数据模型
用于管理微博账户的类型/分类
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class Category(BaseModel):
    """微博账户类别模型"""
    id: str = Field(..., alias="_id", description="类别ID，MongoDB自动生成")
    name: str = Field(..., description="类别名称")
    description: Optional[str] = Field(default=None, description="类别描述")
    is_active: bool = Field(default=True, description="是否启用")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="更新时间")

    class Config:
        populate_by_name = True


class CategoryCreate(BaseModel):
    """创建类别请求模型"""
    name: str = Field(..., description="类别名称，如: 娱乐、科技、体育等")
    description: Optional[str] = Field(default=None, description="类别描述")


class CategoryUpdate(BaseModel):
    """更新类别请求模型"""
    name: Optional[str] = Field(default=None, description="类别名称")
    description: Optional[str] = Field(default=None, description="类别描述")
    is_active: Optional[bool] = Field(default=None, description="是否启用")


class CategoryResponse(BaseModel):
    """类别响应模型"""
    id: str = Field(..., alias="_id", description="类别ID")
    name: str
    description: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
