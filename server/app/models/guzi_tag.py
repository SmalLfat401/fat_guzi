"""
谷子商品标签数据模型
用于管理谷子商品的 IP 标签和类别标签
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class IpCategory(str, Enum):
    """IP类别枚举（仅适用于IP标签）"""
    ANIMATION = "animation"  # 动漫
    GAME = "game"            # 游戏
    OTHER = "other"          # 其他


class TagType(str, Enum):
    """标签类型枚举"""
    IP = "ip"          # IP标签：作品/角色/动漫/游戏
    CATEGORY = "category"  # 类别标签：周边形态


# IP类别中文映射
IP_CATEGORY_LABELS = {
    IpCategory.ANIMATION: "动漫",
    IpCategory.GAME: "游戏",
    IpCategory.OTHER: "其他",
}


class GuziTag(BaseModel):
    """谷子标签模型（MongoDB 文档格式）"""
    id: str = Field(..., alias="_id", description="标签ID，MongoDB自动生成")
    tag_type: TagType = Field(..., description="标签类型：ip=IP标签，category=类别标签")
    name: str = Field(..., description="标签名称，如: 火影忍者、吧唧")
    color: Optional[str] = Field(default=None, description="标签颜色，如: #ff6b6b（用于前端展示）")
    remark: Optional[str] = Field(default=None, description="备注说明")
    is_active: bool = Field(default=True, description="是否启用（管理端搜索用）")
    show_on_h5: bool = Field(default=True, description="是否在H5端显示（管理员控制H5展示）")
    ip_category: Optional[IpCategory] = Field(default=None, description="IP类别：animation=动漫，game=游戏，other=其他（仅IP标签有效）")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="更新时间")

    class Config:
        populate_by_name = True


class GuziTagCreate(BaseModel):
    """创建谷子标签请求模型"""
    tag_type: TagType = Field(..., description="标签类型：ip=IP标签，category=类别标签")
    name: str = Field(..., min_length=1, max_length=100, description="标签名称")
    color: Optional[str] = Field(default=None, description="标签颜色")
    remark: Optional[str] = Field(default=None, max_length=500, description="备注说明")
    show_on_h5: bool = Field(default=True, description="是否在H5端显示")
    ip_category: Optional[IpCategory] = Field(default=None, description="IP类别：animation=动漫，game=游戏，other=其他（仅IP标签有效）")


class GuziTagUpdate(BaseModel):
    """更新谷子标签请求模型"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100, description="标签名称")
    color: Optional[str] = Field(default=None, description="标签颜色")
    remark: Optional[str] = Field(default=None, max_length=500, description="备注说明")
    is_active: Optional[bool] = Field(default=None, description="是否启用（管理端搜索用）")
    show_on_h5: Optional[bool] = Field(default=None, description="是否在H5端显示")
    ip_category: Optional[IpCategory] = Field(default=None, description="IP类别：animation=动漫，game=游戏，other=其他（仅IP标签有效）")


class GuziTagResponse(BaseModel):
    """谷子标签响应模型"""
    model_config = {"populate_by_name": True, "by_alias": True}

    id: str = Field(..., alias="_id", description="标签ID")
    tag_type: TagType
    name: str
    color: Optional[str] = None
    remark: Optional[str] = None
    is_active: bool = True
    show_on_h5: bool = True
    ip_category: Optional[IpCategory] = None
    created_at: datetime
    updated_at: datetime
