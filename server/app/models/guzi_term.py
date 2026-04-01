"""
谷子黑话/术语数据模型
用于管理谷子（动漫/游戏周边）领域的术语和黑话
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class GuziTerm(BaseModel):
    """谷子术语模型"""
    id: str = Field(..., alias="_id", description="术语ID，MongoDB自动生成")
    term: str = Field(..., description="术语名称，如: 谷子、吧唧")
    meaning: str = Field(..., description="含义解释")
    usage_scenario: str = Field(..., description="使用场景")
    category: Optional[str] = Field(default=None, description="分类，如: 周边类型、交易术语、圈内黑话")
    example: Optional[str] = Field(default=None, description="使用示例")
    is_active: bool = Field(default=True, description="是否启用")
    ai_copywriting: Optional[str] = Field(default=None, description="AI口播文案")
    ai_script: Optional[str] = Field(default=None, description="AI镜头脚本")
    video_generated: bool = Field(default=False, description="视频是否已生成")
    video_published: bool = Field(default=False, description="视频是否已发布")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="更新时间")

    class Config:
        populate_by_name = True


class GuziTermCreate(BaseModel):
    """创建谷子术语请求模型"""
    term: str = Field(..., description="术语名称，如: 谷子、吧唧")
    meaning: str = Field(..., description="含义解释")
    usage_scenario: str = Field(..., description="使用场景")
    category: Optional[str] = Field(default=None, description="分类")
    example: Optional[str] = Field(default=None, description="使用示例")


class GuziTermUpdate(BaseModel):
    """更新谷子术语请求模型"""
    term: Optional[str] = Field(default=None, description="术语名称")
    meaning: Optional[str] = Field(default=None, description="含义解释")
    usage_scenario: Optional[str] = Field(default=None, description="使用场景")
    category: Optional[str] = Field(default=None, description="分类")
    example: Optional[str] = Field(default=None, description="使用示例")
    is_active: Optional[bool] = Field(default=None, description="是否启用")
    ai_copywriting: Optional[str] = Field(default=None, description="AI口播文案")
    ai_script: Optional[str] = Field(default=None, description="AI镜头脚本")
    video_generated: Optional[bool] = Field(default=None, description="视频是否已生成")
    video_published: Optional[bool] = Field(default=None, description="视频是否已发布")


class GuziTermResponse(BaseModel):
    """谷子术语响应模型（用于API响应）"""
    id: str
    term: str
    meaning: str
    usage_scenario: str
    category: Optional[str] = None
    example: Optional[str] = None
    is_active: bool = True
    ai_copywriting: Optional[str] = None
    ai_script: Optional[str] = None
    video_generated: bool = False
    video_published: bool = False
    created_at: datetime
    updated_at: datetime
