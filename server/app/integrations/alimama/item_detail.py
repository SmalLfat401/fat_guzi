"""
阿里妈妈商品详情适配器

接口: taobao.tbk.item.info.upgrade.get

用于：根据商品ID（num_iid）获取单个商品的完整详情，
     并将数据以字段补充的形式填充到已有的 guzi_products 记录中。

Ref: https://open.taobao.com/doc.htm?docId=118475&docType=1
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, TypedDict

from app.integrations.alimama.top_client import TopClient
from app.integrations.alimama.config import DEFAULT_CONFIG

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
#  数据结构定义
# ──────────────────────────────────────────────

class ItemDetail(TypedDict, total=False):
    """规范化后的商品详情数据结构"""
    # 基本信息
    title: str
    short_title: Optional[str]
    pict_url: str
    white_image: str
    item_url: str
    small_images: List[str]
    # 销量
    volume: int
    annual_vol: Optional[str]
    tk_total_sales: Optional[str]
    # 店铺
    shop_title: Optional[str]
    seller_id: Optional[str]
    user_type: Optional[int]
    provcity: Optional[str]
    free_shipment: bool
    is_prepay: bool
    # 类目/品牌
    brand_name: Optional[str]
    category_id: Optional[int]
    category_name: Optional[str]
    level_one_category_id: Optional[int]
    level_one_category_name: Optional[str]
    # 价格
    reserve_price: Optional[float]
    zk_final_price: Optional[float]
    final_promotion_price: Optional[float]
    predict_rounding_up_price: Optional[float]
    predict_rounding_up_price_desc: Optional[str]
    # 佣金
    commission_rate: float
    commission_amount: float
    income_rate: float
    # 优惠券
    coupon_amount: Optional[float]
    coupon_url: Optional[str]
    coupon_share_url: Optional[str]
    # 促销标签
    promotion_tags: List[str]
    # 更多促销
    more_promotions: List[Dict[str, Any]]
    # 原始 ID
    item_id: str
    input_item_iid: str


class ItemDetailResult(TypedDict):
    """商品详情查询结果封装"""
    item: Optional[ItemDetail]
    error: Optional[str]


# ──────────────────────────────────────────────
#  详情查询函数
# ──────────────────────────────────────────────

def get_item_detail(
    client: TopClient,
    item_id: str,
    biz_scene_id: int = 1,
    promotion_type: int = 2,
    get_tlj_info: int = 0,
    relation_id: Optional[int] = None,
    manage_item_pub_id: Optional[int] = None,
) -> ItemDetailResult:
    """
    调用 taobao.tbk.item.info.upgrade.get 获取单个商品的详细信息。

    与物料搜索接口（material.optional.upgrade）不同，此接口专门用于：
      1. 获取单个商品的完整详情
      2. 生成带推广位的转链

    Args:
        client:             TopClient 实例（需包含 app_key, app_secret, adzone_id）
        item_id:            商品ID（num_iid），支持原始数字ID或加密后的字符串ID
        biz_scene_id:       业务场景ID，默认1
        promotion_type:      营销类型（1=官方活动，2=全部），默认2
        get_tlj_info:       是否获取淘礼金信息（0=否，1=是），默认0
        relation_id:        渠道关系ID（可选）
        manage_item_pub_id: 管理媒体ID（可选）

    Returns:
        ItemDetailResult: 包含 item 详情或 error 信息
    """
    biz_params: Dict[str, Any] = {
        "item_id": item_id,
        "biz_scene_id": biz_scene_id,
        "promotion_type": promotion_type,
        "get_tlj_info": get_tlj_info,
        "adzone_id": client.adzone_id,
    }
    if relation_id is not None:
        biz_params["relation_id"] = relation_id
    if manage_item_pub_id is not None:
        biz_params["manage_item_pub_id"] = manage_item_pub_id

    method = "taobao.tbk.item.info.upgrade.get"
    response_key = "tbk_item_info_upgrade_get_response"

    try:
        data = client.request_with_pid(method, biz_params=biz_params)
    except Exception as e:
        logger.error(f"[ItemDetail] 请求失败: {e}")
        return ItemDetailResult(item=None, error=str(e))

    # 检查错误响应
    if isinstance(data, dict) and data.get("error_response"):
        err = data["error_response"]
        code = err.get("code")
        msg = err.get("msg", "")
        sub_msg = err.get("sub_msg", "")
        error_str = f"code={code}, msg={msg} {sub_msg}"
        logger.error(f"[ItemDetail] API错误: {error_str}")
        return ItemDetailResult(item=None, error=error_str)

    # 解析响应
    resp = data.get(response_key) or {}
    results_wrapper = resp.get("results") or {}
    items: List[Dict[str, Any]] = results_wrapper.get("tbk_item_detail") or []

    if not items:
        logger.warning(f"[ItemDetail] 未找到商品 {item_id} 的详情")
        return ItemDetailResult(item=None, error="商品不存在或无详情")

    normalized = _normalize_item(items[0])
    return ItemDetailResult(item=normalized, error=None)


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


def _normalize_item(it: Dict[str, Any]) -> ItemDetail:
    """
    将 TOP API 返回的原始商品详情数据规范化为统一格式。

    upgrade 接口返回嵌套结构:
      {
        "input_item_iid": "...",
        "item_id": "...",
        "item_basic_info": {...},
        "price_promotion_info": {...},
        "publish_info": {"income_info": {...}},
        "presale_info": {...},
      }
    """
    # ── 嵌套数据块 ──
    item_basic = it.get("item_basic_info") or {}
    price_info = it.get("price_promotion_info") or {}
    publish_info = it.get("publish_info") or {}
    income_info = publish_info.get("income_info") or {}

    # ── 基本字段 ──
    title = (
        item_basic.get("title")
        or item_basic.get("short_title")
        or _merge_field(it, "title", "short_title")
        or ""
    )
    short_title = (
        item_basic.get("short_title")
        or _merge_field(it, "short_title")
    )
    pict_url = (
        item_basic.get("pict_url")
        or item_basic.get("white_image")
        or _merge_field(it, "pict_url", "white_image")
        or ""
    )
    white_image = item_basic.get("white_image") or _merge_field(it, "white_image") or ""
    item_url = item_basic.get("item_url") or _merge_field(it, "item_url") or ""
    item_id = it.get("item_id") or _merge_field(it, "item_id", "num_iid") or ""
    input_item_iid = it.get("input_item_iid") or ""

    # ── 多图 small_images ──
    raw_small: List[str] = []
    small_images_wrapper = item_basic.get("small_images") or {}
    if isinstance(small_images_wrapper, dict):
        raw_small = small_images_wrapper.get("string") or []
    elif isinstance(small_images_wrapper, list):
        raw_small = small_images_wrapper
    small_images: List[str] = [str(u) for u in raw_small if u]

    # ── 销量 ──
    volume_str = item_basic.get("volume")
    try:
        volume = int(volume_str) if volume_str is not None else 0
    except (ValueError, TypeError):
        volume = 0
    annual_vol = item_basic.get("annual_vol") or None
    tk_total_sales = item_basic.get("tk_total_sales") or None

    # ── 店铺 ──
    shop_title = item_basic.get("shop_title") or None
    seller_id_raw = item_basic.get("seller_id")
    seller_id: Optional[str] = None
    if seller_id_raw is not None:
        seller_id = str(seller_id_raw)
    user_type_raw = item_basic.get("user_type")
    try:
        user_type = int(user_type_raw) if user_type_raw is not None else None
    except (ValueError, TypeError):
        user_type = None
    provcity = item_basic.get("provcity") or None
    free_shipment = bool(item_basic.get("free_shipment", False))
    is_prepay = bool(item_basic.get("is_prepay", False))

    # ── 类目/品牌 ──
    brand_name = item_basic.get("brand_name") or None
    category_id_raw = item_basic.get("category_id")
    category_id: Optional[int] = None
    if category_id_raw is not None:
        try:
            category_id = int(category_id_raw)
        except (ValueError, TypeError):
            category_id = None
    category_name = item_basic.get("category_name") or None
    level_one_category_id_raw = item_basic.get("level_one_category_id")
    level_one_category_id: Optional[int] = None
    if level_one_category_id_raw is not None:
        try:
            level_one_category_id = int(level_one_category_id_raw)
        except (ValueError, TypeError):
            level_one_category_id = None
    level_one_category_name = item_basic.get("level_one_category_name") or None

    # ── 价格 ──
    reserve_price_str = price_info.get("reserve_price")
    try:
        reserve_price = float(reserve_price_str) if reserve_price_str else None
    except (ValueError, TypeError):
        reserve_price = None

    zk_final_price_str = price_info.get("zk_final_price")
    try:
        zk_final_price = float(zk_final_price_str) if zk_final_price_str else None
    except (ValueError, TypeError):
        zk_final_price = None

    final_promotion_price_str = price_info.get("final_promotion_price")
    try:
        final_promotion_price = float(final_promotion_price_str) if final_promotion_price_str else None
    except (ValueError, TypeError):
        final_promotion_price = None

    predict_rounding_up_price_str = price_info.get("predict_rounding_up_price")
    try:
        predict_rounding_up_price = float(predict_rounding_up_price_str) if predict_rounding_up_price_str else None
    except (ValueError, TypeError):
        predict_rounding_up_price = None
    predict_rounding_up_price_desc = price_info.get("predict_rounding_up_price_desc") or None

    # ── 佣金 ──
    income_rate_str = publish_info.get("income_rate") or income_info.get("commission_rate") or 0
    try:
        income_rate = float(income_rate_str)
        # API返回的是 basis_points (如 450 表示 4.5%)，需除以100
        commission_rate = income_rate / 100.0 if income_rate > 100 else income_rate
    except (ValueError, TypeError):
        commission_rate = 0.0
        income_rate = 0.0

    commission_amount_str = income_info.get("commission_amount")
    try:
        commission_amount = float(commission_amount_str) if commission_amount_str else 0.0
    except (ValueError, TypeError):
        commission_amount = 0.0

    # ── 优惠券 ──
    coupon_amount: Optional[float] = None
    coupon_url: Optional[str] = None
    coupon_share_url: Optional[str] = None
    more_promotions: List[Dict[str, Any]] = []

    # more_promotion_list 解析
    more_promo_wrapper = price_info.get("more_promotion_list") or {}
    more_promo_data = more_promo_wrapper.get("more_promotion_map_data") or []
    if isinstance(more_promo_data, list):
        for promo in more_promo_data:
            more_promotions.append({
                "promotion_id": promo.get("promotion_id"),
                "promotion_title": promo.get("promotion_title"),
                "promotion_desc": promo.get("promotion_desc"),
                "promotion_start_time": promo.get("promotion_start_time"),
                "promotion_end_time": promo.get("promotion_end_time"),
            })

    # ── 推广标签 ──
    promotion_tags: List[str] = []
    promo_tag_wrapper = price_info.get("promotion_tag_list") or {}
    promo_tag_data = promo_tag_wrapper.get("promotion_tag_map_data") or []
    if isinstance(promo_tag_data, list):
        for tag_entry in promo_tag_data:
            tag_name = tag_entry.get("tag_name")
            if tag_name:
                promotion_tags.append(str(tag_name))

    return ItemDetail(
        title=title,
        short_title=short_title,
        pict_url=pict_url,
        white_image=white_image,
        item_url=item_url,
        small_images=small_images,
        volume=volume,
        annual_vol=annual_vol,
        tk_total_sales=tk_total_sales,
        shop_title=shop_title,
        seller_id=seller_id,
        user_type=user_type,
        provcity=provcity,
        free_shipment=free_shipment,
        is_prepay=is_prepay,
        brand_name=brand_name,
        category_id=category_id,
        category_name=category_name,
        level_one_category_id=level_one_category_id,
        level_one_category_name=level_one_category_name,
        reserve_price=reserve_price,
        zk_final_price=zk_final_price,
        final_promotion_price=final_promotion_price,
        predict_rounding_up_price=predict_rounding_up_price,
        predict_rounding_up_price_desc=predict_rounding_up_price_desc,
        commission_rate=round(commission_rate, 2),
        commission_amount=commission_amount,
        income_rate=round(income_rate, 4),
        coupon_amount=coupon_amount,
        coupon_url=coupon_url,
        coupon_share_url=coupon_share_url,
        promotion_tags=promotion_tags,
        more_promotions=more_promotions,
        item_id=str(item_id),
        input_item_iid=str(input_item_iid),
    )
