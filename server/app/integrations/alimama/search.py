"""
Alimama (淘宝客) 商品搜索适配器

基于 TOP API: taobao.tbk.dg.material.optional.upgrade

Ref: https://open.taobao.com/doc.htm?docId=118475&docType=1
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, TypedDict

from app.integrations.alimama.top_client import TopClient
from app.integrations.alimama.config import DEFAULT_CONFIG, PID_ADZONE_ID_INT

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
#  数据结构定义
# ──────────────────────────────────────────────

class NormalizedProduct(TypedDict):
    """规范化后的商品数据结构（来自搜索接口）"""
    title: str
    image_url: str
    url: str  # 原始 click_url（长链接）
    price: float
    commission_rate: float  # 百分比，如 18.9
    commission_amount: float  # 预估佣金
    commission_type: Optional[str]  # COMMON / MKT / ZX
    platform_product_id: str
    coupon_amount: Optional[float]
    coupon_url: Optional[str]
    coupon_share_url: Optional[str]
    shop_title: Optional[str]
    seller_id: Optional[str]
    user_type: Optional[int]  # 0=淘宝, 1=天猫
    provcity: Optional[str]
    real_post_fee: Optional[str]
    volume: int
    annual_vol: Optional[str]
    tk_total_sales: Optional[str]
    original_price: Optional[float]  # 标价/划线价（reserve_price）
    zk_final_price: Optional[float]  # 折扣价（zk_final_price）
    description: Optional[str]  # sub_title
    # 多图
    small_images: List[str]
    # 类目/品牌
    brand_name: Optional[str]
    category_id: Optional[int]
    category_name: Optional[str]
    level_one_category_id: Optional[int]
    level_one_category_name: Optional[str]
    # 推广标签（promotion_tag_list）
    promotion_tags: List[str]


class SearchResult(TypedDict):
    """搜索结果封装"""
    items: List[NormalizedProduct]
    total_results: int
    page_no: int
    page_size: int
    error: Optional[str]


# ──────────────────────────────────────────────
#  排序枚举
# ──────────────────────────────────────────────

class SortType:
    """排序类型常量，对应 TOP API sort 参数"""
    TK_RATE_DESC = "tk_rate_des"       # 佣金率降序（默认）
    TK_RATE_ASC = "tk_rate_asc"         # 佣金率升序
    TK_SALES_DESC = "total_sales_des"   # 销量降序
    TK_SALES_ASC = "total_sales_asc"    # 销量升序
    TKcommiRATE_ASC = "tk_rate_asc"
    PRICE_ASC = "price_asc"             # 价格升序
    PRICE_DESC = "price_des"            # 价格降序


# ──────────────────────────────────────────────
#  搜索函数
# ──────────────────────────────────────────────

def search_products(
    *,
    client: TopClient,
    keyword: str,
    page_no: int = 1,
    page_size: int = 20,
    adzone_id: Optional[int] = None,
    material_id: int = 80309,
    sort: str = SortType.TK_RATE_DESC,
    is_tmall: bool = False,
    is_overseas: bool = False,
    has_coupon: bool = False,
    start_dsr: int = 0,
    npx_level: int = 1,
    get_topn_rate: int = 0,
    promotion_type: int = 2,
    biz_scene_id: int = 1,
    ucrowd_id: int = 1,
    mgc_status: int = 0,
    include_dxjh: bool = True,
    include_ranking_rate: bool = False,
) -> SearchResult:
    """
    调用 taobao.tbk.dg.material.optional.upgrade 搜索淘宝客商品。

    支持的物料ID（material_id）：
      - 80309: 爆品库（排球少年等关键词场景）
      - 17004: 官方精选
      - 16518: 物料精选
      - 16516: 物料搜索

    Args:
        client:       TopClient 实例（需包含 app_key, app_secret, adzone_id）
        keyword:       搜索关键词
        page_no:      页码，从1开始
        page_size:    每页数量，默认20
        adzone_id:    广告位ID（若不传则使用 client 中的默认值）
        material_id:  物料ID，默认为80309（爆品库）
        sort:         排序方式，默认佣金率降序
        is_tmall:     是否仅限天猫商品
        is_overseas:  是否仅限海外商品
        has_coupon:   是否仅显示有优惠券的商品
        start_dsr:    最低DSR评分（0-5）
        npx_level:    价格等级（1=全部，2=中等，3=高等，4=不限）
        get_topn_rate: 是否获取TOP-N佣金率（0=否，1=是）
        promotion_type: 营销类型（1=官方活动，2=全部）
        biz_scene_id: 业务场景ID
        ucrowd_id:    人群ID
        mgc_status:   是否特惠（0=不限，1=特惠）
        include_dxjh: 是否包含定向计划
        include_ranking_rate: 是否包含实时排名

    Returns:
        SearchResult: 包含 items 列表、total_results、page_no、page_size 的字典
    """
    biz_params: Dict[str, Any] = {
        "q": keyword,
        "page_no": page_no,
        "page_size": page_size,
        "adzone_id": adzone_id if adzone_id is not None else client.adzone_id,
        "material_id": material_id,
        "sort": sort,
        "is_tmall": str(is_tmall).lower(),
        "is_overseas": str(is_overseas).lower(),
        "has_coupon": str(has_coupon).lower(),
        "start_dsr": start_dsr,
        "npx_level": npx_level,
        "get_topn_rate": get_topn_rate,
        "promotion_type": promotion_type,
        "biz_scene_id": biz_scene_id,
        "ucrowd_id": ucrowd_id,
        "mgc_status": mgc_status,
        "include_dxjh": str(include_dxjh).lower(),
        "include_ranking_rate": str(include_ranking_rate).lower(),
    }

    method = "taobao.tbk.dg.material.optional.upgrade"
    response_key = "tbk_dg_material_optional_upgrade_response"

    try:
        data = client.request_with_pid(method, biz_params=biz_params)
    except Exception as e:
        logger.error(f"[Alimama] 请求失败: {e}")
        return SearchResult(
            items=[],
            total_results=0,
            page_no=page_no,
            page_size=page_size,
            error=str(e),
        )

    # 检查错误响应
    if isinstance(data, dict) and data.get("error_response"):
        err = data["error_response"]
        code = err.get("code")
        msg = err.get("msg", "")
        sub_msg = err.get("sub_msg", "")
        error_str = f"code={code}, msg={msg} {sub_msg}"
        logger.error(f"[Alimama] API错误: {error_str}")
        return SearchResult(
            items=[],
            total_results=0,
            page_no=page_no,
            page_size=page_size,
            error=error_str,
        )

    # 解析响应
    resp = data.get(response_key) or {}
    result_list = resp.get("result_list") or {}
    items_raw: List[Dict[str, Any]] = result_list.get("map_data") or []
    total_results: int = resp.get("total_results") or 0

    if not items_raw:
        logger.warning("[Alimama] 返回结果为空，可能关键词无匹配或API参数有误")

    normalized = _normalize_items(items_raw)

    return SearchResult(
        items=normalized,
        total_results=total_results,
        page_no=page_no,
        page_size=page_size,
        error=None,
    )


# ──────────────────────────────────────────────
#  数据规范化
# ──────────────────────────────────────────────

def _merge_field(it: Dict[str, Any], *candidates) -> Any:
    """依次尝试多个候选键，返回第一个有值的结果"""
    for key in candidates:
        val = it.get(key)
        if val:
            return val
    return None


def _normalize_items(items: List[Dict[str, Any]]) -> List[NormalizedProduct]:
    """
    将 TOP API 返回的原始商品数据规范化为统一格式。

    upgrade 接口返回嵌套结构:
      {
        "item_basic_info": {...},
        "price_promotion_info": {...},
        "publish_info": {"click_url": "...", "income_info": {...}},
        ...
      }
    """

    normalized: List[NormalizedProduct] = []

    for it in items:
        # ── 嵌套数据块 ──
        item_basic = it.get("item_basic_info") or {}
        price_info = it.get("price_promotion_info") or {}
        publish_info = it.get("publish_info") or {}
        income_info = (publish_info.get("income_info") or {}) if publish_info else {}

        # ── 基本字段 ──
        title = (
            _merge_field(item_basic, "title", "short_title", "real_title")
            or _merge_field(it, "title", "short_title", "real_title")
            or ""
        )
        image_url = (
            item_basic.get("pict_url")
            or item_basic.get("white_image")
            or _merge_field(it, "pict_url", "white_image")
            or ""
        )
        platform_product_id = (
            str(item_basic.get("item_id", ""))
            or str(_merge_field(it, "item_id", "num_iid") or "")
        )
        description = (
            item_basic.get("sub_title")
            or _merge_field(it, "item_description", "sub_title")
        )

        # ── 多图 small_images ──
        raw_small: List[str] = []
        small_images_wrapper = item_basic.get("small_images") or {}
        if isinstance(small_images_wrapper, dict):
            raw_small = small_images_wrapper.get("string") or []
        elif isinstance(small_images_wrapper, list):
            raw_small = small_images_wrapper
        small_images: List[str] = [str(u) for u in raw_small if u]

        # ── 类目/品牌 ──
        brand_name = item_basic.get("brand_name") or None
        category_id = item_basic.get("category_id")
        if category_id:
            try:
                category_id = int(category_id)
            except (ValueError, TypeError):
                category_id = None
        category_name = item_basic.get("category_name") or None
        level_one_category_id = item_basic.get("level_one_category_id")
        if level_one_category_id:
            try:
                level_one_category_id = int(level_one_category_id)
            except (ValueError, TypeError):
                level_one_category_id = None
        level_one_category_name = item_basic.get("level_one_category_name") or None

        # ── 销量 ──
        volume_str = item_basic.get("volume")
        try:
            volume = int(volume_str) if volume_str is not None else 0
        except (ValueError, TypeError):
            volume = 0
        annual_vol = item_basic.get("annual_vol") or None
        tk_total_sales = item_basic.get("tk_total_sales") or None

        # ── 店铺信息 ──
        shop_title = item_basic.get("shop_title") or None
        seller_id = item_basic.get("seller_id")
        if seller_id:
            seller_id = str(seller_id)
        user_type = item_basic.get("user_type")
        if user_type is not None:
            try:
                user_type = int(user_type)
            except (ValueError, TypeError):
                user_type = None
        provcity = item_basic.get("provcity") or None
        real_post_fee = item_basic.get("real_post_fee") or None

        # ── 价格 ──
        price_str = (
            price_info.get("final_promotion_price")
            or price_info.get("zk_final_price")
            or price_info.get("reserve_price")
            or _merge_field(it, "zk_final_price", "reserve_price", "final_price")
        )
        try:
            price = float(price_str) if price_str else 0.0
        except (ValueError, TypeError):
            price = 0.0

        original_price_str = price_info.get("reserve_price")
        try:
            original_price = float(original_price_str) if original_price_str else None
        except (ValueError, TypeError):
            original_price = None

        zk_final_price_str = price_info.get("zk_final_price")
        try:
            zk_final_price = float(zk_final_price_str) if zk_final_price_str else None
        except (ValueError, TypeError):
            zk_final_price = None

        # ── 佣金 ──
        rate_str = (
            publish_info.get("income_rate")
            or income_info.get("commission_rate")
            or _merge_field(it, "commission_rate", "tk_rate")
            or 0
        )
        try:
            rate = float(rate_str)
            commission_rate = rate / 100.0 if rate > 100 else rate
        except (ValueError, TypeError):
            commission_rate = 0.0

        commission_amount_str = income_info.get("commission_amount")
        try:
            commission_amount = (
                float(commission_amount_str)
                if commission_amount_str
                else round(price * commission_rate / 100.0, 2)
            )
        except (ValueError, TypeError):
            commission_amount = round(price * commission_rate / 100.0, 2)

        commission_type = publish_info.get("commission_type") or None

        # ── 优惠券 ──
        coupon_amount: Optional[float] = None
        coupon_url: Optional[str] = None
        coupon_share_url: Optional[str] = None

        coupon_info = price_info.get("coupon_info") or {}
        if coupon_info:
            try:
                coupon_amount = float(coupon_info.get("coupon_amount", 0))
            except (ValueError, TypeError):
                coupon_amount = None

        coupon_share_url = (
            publish_info.get("coupon_share_url")
            or _merge_field(it, "coupon_share_url", "coupon_click_url")
        )

        # ── 推广标签 ──
        promotion_tags: List[str] = []
        promo_tag_list = price_info.get("promotion_tag_list") or {}
        promo_tag_map = promo_tag_list.get("promotion_tag_map_data") or []
        for tag_entry in promo_tag_map:
            tag_name = tag_entry.get("tag_name")
            if tag_name:
                promotion_tags.append(str(tag_name))

        # ── 推广链接 ──
        click_url = (
            publish_info.get("click_url")
            or _merge_field(it, "click_url", "coupon_share_url", "coupon_click_url")
            or ""
        )

        normalized.append(NormalizedProduct(
            title=title,
            image_url=image_url,
            url=click_url,
            price=price,
            commission_rate=round(commission_rate, 2),
            commission_amount=commission_amount,
            commission_type=commission_type,
            platform_product_id=platform_product_id,
            coupon_amount=coupon_amount,
            coupon_url=coupon_url,
            coupon_share_url=coupon_share_url,
            shop_title=shop_title,
            seller_id=seller_id,
            user_type=user_type,
            provcity=provcity,
            real_post_fee=real_post_fee,
            volume=volume,
            annual_vol=annual_vol,
            tk_total_sales=tk_total_sales,
            original_price=original_price,
            zk_final_price=zk_final_price,
            description=description if description else None,
            small_images=small_images,
            brand_name=brand_name,
            category_id=category_id,
            category_name=category_name,
            level_one_category_id=level_one_category_id,
            level_one_category_name=level_one_category_name,
            promotion_tags=promotion_tags,
        ))

    return normalized
