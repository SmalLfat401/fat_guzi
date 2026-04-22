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
    # 价格
    price: float = Field(..., description="券后价/到手价")
    original_price: Optional[float] = Field(default=None, description="标价/划线价（reserve_price）")
    zk_final_price: Optional[float] = Field(default=None, description="折扣价（未用券前，zk_final_price）")
    # 佣金
    commission_rate: float = Field(..., description="佣金率，percent，如 10.5 表示 10.5%")
    commission_amount: float = Field(default=0.0, description="预估佣金金额")
    commission_type: Optional[str] = Field(default=None, description="佣金类型：COMMON-通用, MKT-营销, ZX-自营")
    # 优惠券
    coupon_amount: Optional[float] = Field(default=None, description="优惠券金额（元）")
    coupon_url: Optional[str] = Field(default=None, description="优惠券链接（完整 URL）")
    coupon_share_url: Optional[str] = Field(default=None, description="优惠券领取链接（uland.taobao.com）")
    # 店铺信息
    shop_title: Optional[str] = Field(default=None, description="店铺名称")
    seller_id: Optional[str] = Field(default=None, description="卖家ID")
    user_type: Optional[int] = Field(default=None, description="店铺类型：0=淘宝店, 1=天猫店")
    provcity: Optional[str] = Field(default=None, description="发货地，如：浙江 金华")
    real_post_fee: Optional[str] = Field(default=None, description="实际运费，如 0.00 表示包邮")
    # 商品属性（来自 item_detail）
    item_url: Optional[str] = Field(default=None, description="商品详情页URL")
    free_shipment: Optional[bool] = Field(default=None, description="是否包邮")
    is_prepay: Optional[bool] = Field(default=None, description="是否支持花呗/信用卡支付")
    # 销量
    volume: int = Field(default=0, description="30天引导销量")
    annual_vol: Optional[str] = Field(default=None, description="年销量/预估年销量，如 200+, 5000+")
    tk_total_sales: Optional[str] = Field(default=None, description="淘客引导付款金额")
    # 推广标签
    promotion_tags: List[str] = Field(default_factory=list, description="推广标签列表，如：包邮, 满1件8折, 淘金币可抵41.28元")
    # 商品描述
    description: Optional[str] = Field(default=None, description="商品副标题/卖点")


class ProductSearchItem(BaseModel):
    title: str
    image_url: str
    small_images: List[str] = Field(default_factory=list, description="商品小图列表（来自 item_basic_info.small_images.string）")
    sub_title: Optional[str] = Field(default=None, description="商品副标题/卖点（来自 sub_title）")
    platforms: List[PlatformProduct]
    recommended_platform: Optional[str] = None
    lowest_price: float
    original_lowest_price: Optional[float] = Field(default=None, description="最低划线价（各平台原价最低）")
    highest_commission: float
    volume: int = Field(default=0, description="30天引导销量")
    annual_vol: Optional[str] = Field(default=None, description="年销量")
    # 商品维度的类目/品牌（取自第一个平台）
    brand_name: Optional[str] = Field(default=None, description="品牌名称")
    category_id: Optional[int] = Field(default=None, description="商品类目ID")
    category_name: Optional[str] = Field(default=None, description="商品类目名称")
    level_one_category_id: Optional[int] = Field(default=None, description="一级类目ID")
    level_one_category_name: Optional[str] = Field(default=None, description="一级类目名称")
    # 搜索匹配信息（当使用二级分类搜索时返回）
    match_score: int = Field(default=0, description="匹配度分数：命中的 aliases 次数 × match_weight − 命中的 exclude 次数 × 10")
    match_detail: Optional[str] = Field(default=None, description="匹配说明，如：命中别名 [吧唧, 马口铁] +1×90，命中排除词 [卡套] -10")
    search_keyword: Optional[str] = Field(default=None, description="实际使用的搜索关键词（IP名称 + aliases 拼接）")


class ProductSearchResponse(BaseModel):
    """搜索结果分页响应"""
    items: List[ProductSearchItem] = Field(..., description="商品列表")
    total: int = Field(..., description="搜索结果总数")
    page_no: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页条数")


# ── CRUD 模型 ──────────────────────────────────────────────

class GuziProductBase(BaseModel):
    """谷子商品基础模型"""
    title: str = Field(..., description="商品标题")
    image_url: str = Field(..., description="商品图片URL（本地存储路径）")
    original_image_url: Optional[str] = Field(default="", description="原始图片URL（淘宝CDN）")
    # 多图
    small_images: List[str] = Field(default_factory=list, description="商品小图列表（主图之外的图片）")
    platforms: List[PlatformProduct] = Field(default_factory=list, description="多平台商品信息")
    description: Optional[str] = Field(default=None, description="商品文案/描述")
    ip_tags: List[str] = Field(default_factory=list, description="IP标签ID列表，如：火影忍者、EVA")
    category_tags: List[str] = Field(default_factory=list, description="类别标签ID列表，如：吧唧、立牌、棉花娃娃")
    # 类目/品牌
    brand_name: Optional[str] = Field(default=None, description="品牌名称")
    category_id: Optional[int] = Field(default=None, description="商品类目ID")
    category_name: Optional[str] = Field(default=None, description="商品类目名称")
    level_one_category_id: Optional[int] = Field(default=None, description="一级类目ID")
    level_one_category_name: Optional[str] = Field(default=None, description="一级类目名称")


class GuziProductCreate(GuziProductBase):
    """创建谷子商品"""
    pass


class GuziProductUpdate(BaseModel):
    """更新谷子商品"""
    title: Optional[str] = None
    image_url: Optional[str] = None
    original_image_url: Optional[str] = None
    small_images: Optional[List[str]] = None
    platforms: Optional[List[PlatformProduct]] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    ip_tags: Optional[List[str]] = None
    category_tags: Optional[List[str]] = None
    brand_name: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    level_one_category_id: Optional[int] = None
    level_one_category_name: Optional[str] = None
    # 标记是否调用过 fetch-detail 接口
    detail_fetched: Optional[bool] = None


class GuziProductResponse(GuziProductBase):
    """谷子商品响应模型"""
    id: str = Field(..., description="MongoDB 文档ID")
    is_active: bool = Field(default=True)
    created_at: datetime
    updated_at: datetime
    # 是否已调用过 fetch-detail 接口（用于前端区分「抓取详情」和「查看详情」按钮）
    detail_fetched: bool = Field(default=False, description="是否已调用过 fetch-detail 接口")

    # 便捷字段（由 DAO 层计算写入）
    lowest_price: Optional[float] = None
    lowest_price_platform: Optional[str] = None
    highest_commission: Optional[float] = None
    highest_commission_platform: Optional[str] = None
    # 累计销量（由 DAO 层计算）
    total_volume: int = Field(default=0, description="所有平台累计销量")


class GuziProduct(GuziProductResponse):
    """完整谷子商品模型（数据库映射用）"""
    pass

