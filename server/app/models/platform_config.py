"""
电商平台配置模型
"""
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class PlatformConfigBase(BaseModel):
    """平台配置基础模型"""
    platform_id: str = Field(..., description="平台标识: alimama/jd/pdd")
    platform_name: str = Field(..., description="平台名称")
    app_key: str = Field(default="", description="AppKey")
    app_secret: str = Field(default="", description="AppSecret (加密存储)")
    pid: str = Field(default="", description="推广位PID (用于佣金追踪)")
    is_active: bool = Field(default=False, description="是否启用")


class PlatformConfigCreate(PlatformConfigBase):
    """创建平台配置请求模型"""
    pass


class PlatformConfigUpdate(BaseModel):
    """更新平台配置请求模型"""
    app_key: Optional[str] = None
    app_secret: Optional[str] = None
    pid: Optional[str] = None
    is_active: Optional[bool] = None


class PlatformConfigResponse(PlatformConfigBase):
    """平台配置响应模型"""
    id: str = Field(..., alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class PlatformConfig(PlatformConfigBase):
    """平台配置完整模型"""
    id: str = Field(..., alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


# 支持的平台列表
SUPPORTED_PLATFORMS = [
    {
        "platform_id": "alimama",
        "platform_name": "阿里妈妈",
        "icon": "🅰️",
        "description": "淘宝客API，提供商品搜索、佣金查询、订单跟踪等功能",
        "doc_url": "https://pub.alimama.com/",
    },
    {
        "platform_id": "jd",
        "platform_name": "京东联盟",
        "icon": "🅹",
        "description": "京东联盟API，提供商品推广、佣金结算、订单查询等功能",
        "doc_url": "https://union.jd.com/",
    },
    {
        "platform_id": "pdd",
        "platform_name": "多多客",
        "icon": "🅿️",
        "description": "拼多多多多客API，提供商品推广、佣金查询、订单跟踪等功能",
        "doc_url": "https://www.pinduoduo.com/",
    },
]
