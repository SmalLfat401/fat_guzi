from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class PlatformProduct(BaseModel):
    platform_id: str
    platform_name: str
    platform_product_id: str
    url: str = Field(..., description="原始推广链接（click_url）")
    short_link: Optional[str] = Field(default=None, description="短链接（s.click.taobao.com/xxx），由单独接口生成")
    tkl: Optional[str] = Field(default=None, description="淘口令短码（₤xxx₤），由单独接口生成")
    tkl_text: Optional[str] = Field(default=None, description="淘口令码（₤xxx₤），用于拼接推广文案，不存完整model")
    link_generated_at: Optional[datetime] = Field(default=None, description="短链接/淘口令生成时间（UTC）")
    link_expires_at: Optional[datetime] = Field(default=None, description="短链接/淘口令过期时间（UTC）")
    price: float
    commission_rate: float = Field(..., description="percent, e.g. 10.5")
    commission_amount: float
    coupon_amount: Optional[float] = None
    coupon_url: Optional[str] = None
    shop_title: Optional[str] = None
    description: Optional[str] = None


class ProductSearchItem(BaseModel):
    title: str
    image_url: str
    platforms: List[PlatformProduct]
    recommended_platform: Optional[str] = None
    lowest_price: float
    highest_commission: float


# ── CRUD 模型 ──────────────────────────────────────────────

class GuziProductBase(BaseModel):
    """谷子商品基础模型"""
    title: str = Field(..., description="商品标题")
    image_url: str = Field(..., description="商品图片URL（本地存储路径）")
    original_image_url: Optional[str] = Field(default="", description="原始图片URL（淘宝CDN）")
    platforms: List[PlatformProduct] = Field(default_factory=list, description="多平台商品信息")
    description: Optional[str] = Field(default=None, description="商品文案/描述")
    ip_tags: List[str] = Field(default_factory=list, description="IP标签ID列表，如：火影忍者、EVA")
    category_tags: List[str] = Field(default_factory=list, description="类别标签ID列表，如：吧唧、立牌、棉花娃娃")


class GuziProductCreate(GuziProductBase):
    """创建谷子商品"""
    pass


class GuziProductUpdate(BaseModel):
    """更新谷子商品"""
    title: Optional[str] = None
    image_url: Optional[str] = None
    original_image_url: Optional[str] = None
    platforms: Optional[List[PlatformProduct]] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    ip_tags: Optional[List[str]] = None
    category_tags: Optional[List[str]] = None


class GuziProductResponse(GuziProductBase):
    """谷子商品响应模型"""
    id: str = Field(..., description="MongoDB 文档ID")
    is_active: bool = Field(default=True)
    created_at: datetime
    updated_at: datetime

    # 便捷字段（由 DAO 层计算写入）
    lowest_price: Optional[float] = None
    lowest_price_platform: Optional[str] = None
    highest_commission: Optional[float] = None
    highest_commission_platform: Optional[str] = None


class GuziProduct(GuziProductResponse):
    """完整谷子商品模型（数据库映射用）"""
    pass

