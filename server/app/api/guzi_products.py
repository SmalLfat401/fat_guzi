"""
Guzi products API (multi-platform search scaffold).

Currently implements:
  - GET /guzi-products/search (alimama only for now)
"""

from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from pydantic import Field
from typing import Any, Dict, List, Optional

from app.database.platform_config_dao import platform_config_dao
from app.database.guzi_product_dao import guzi_product_dao
from app.integrations.alimama.top_client import TopClient
from app.integrations.alimama.search import search_products as alimama_search
from app.integrations.alimama.link_gen import generate_promotion_links
from app.models.guzi_product import (
    GuziProduct,
    GuziProductCreate,
    GuziProductUpdate,
    GuziProductListResponse,
    ProductSearchItem,
    ProductSearchResponse,
    PlatformProduct,
)


router = APIRouter(prefix="/guzi-products", tags=["谷子商品管理"])


def _calc_recommendation(platforms: List[PlatformProduct]) -> tuple[float, float, Optional[str]]:
    lowest = min((p.price for p in platforms), default=0.0)
    highest_commission = max((p.commission_amount for p in platforms), default=0.0)

    # Very simple rule for now:
    # - if lowest price platform exists and commission is not too low, recommend it
    # - otherwise recommend highest commission
    lowest_p = None
    highest_c = None
    for p in platforms:
        if p.price == lowest:
            lowest_p = p
        if p.commission_amount == highest_commission:
            highest_c = p

    recommended = None
    if lowest_p and highest_c:
        # If lowest is within 5% price of lowest (itself) and has commission >= 60% of max, recommend lowest.
        if highest_commission == 0 or lowest_p.commission_amount >= highest_commission * 0.6:
            recommended = lowest_p.platform_id
        else:
            recommended = highest_c.platform_id
    elif lowest_p:
        recommended = lowest_p.platform_id
    elif highest_c:
        recommended = highest_c.platform_id

    return lowest, highest_commission, recommended


def _parse_adzone_id_from_pid(pid: str) -> Optional[int]:
    """
    从PID解析adzone_id
    PID格式: mm_xxx_yyy_zzz -> zzz就是adzone_id
    """
    if not pid:
        return None
    parts = pid.split("_")
    if len(parts) >= 4:
        try:
            return int(parts[3])
        except (ValueError, IndexError):
            return None
    return None


# ──────────────────────────────────────────────
#  智能合并策略（用于详情填充）
# ──────────────────────────────────────────────

def _is_meaningful(v: Any) -> bool:
    """判断一个值是否有意义（应覆盖已有数据）"""
    if v is None:
        return False
    if isinstance(v, str) and v.strip() == "":
        return False
    if isinstance(v, (int, float)) and v == 0:
        return False
    if isinstance(v, (list, dict)) and len(v) == 0:
        return False
    return True


# 强制保留字段：永远不让详情 API 的值覆盖这些字段
# 这些字段应由搜索/转链接口维护
_PROTECTED_PLATFORM_FIELDS = frozenset({
    "url",
    "tkl",
    "tkl_text",
    "link_generated_at",
    "real_post_fee",
})


def _smart_merge_platform(
    existing: dict,
    new_detail: dict,
) -> dict:
    """
    智能合并已有平台数据与详情 API 数据。

    核心原则：详情 API 的值只有在"有意义"时才覆盖已有数据。
    关键推广字段（url/link/tkl 等）永远保留已有值。

    Args:
        existing:     已有 PlatformProduct 的 model_dump() 字典
        new_detail:   详情 API 构造的 pp_dict 字典

    Returns:
        合并后的字典，可直接用于 PlatformProduct(**)
    """
    merged = dict(existing)
    for k, v in new_detail.items():
        if k in _PROTECTED_PLATFORM_FIELDS:
            continue  # 保护字段不被动
        if _is_meaningful(v):
            merged[k] = v
    return merged


def _get_mock_products(keyword: str) -> List[Dict[str, Any]]:
    """模拟商品数据，用于测试或API不可用时"""
    import random
    return [
        {
            "title": f"【{keyword}】潮流盲盒手办卡通动漫周边",
            "image_url": "https://img.alicdn.com/bao/uploaded/i1/1234567890123456789.jpg",
            "url": "https://s.click.taobao.com/mock_link",
            "price": round(random.uniform(20, 200), 2),
            "commission_rate": round(random.uniform(5, 20), 2),
            "commission_amount": 0,
            "platform_product_id": f"mock_{i}_1234567890",
            "description": "热门潮玩盲盒",
        }
        for i in range(10)
    ]


# 是否使用模拟数据（当API权限不可用时）
# TODO: 权限通过后改为 False
MOCK_MODE = False


@router.get("/search", response_model=ProductSearchResponse)
async def search_guzi_products(
    keyword: str = Query(..., min_length=1),
    platforms: Optional[str] = Query(None, description="comma separated, e.g. alimama,jd,pdd"),
    page_no: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    adzone_id: Optional[int] = Query(None, description="阿里妈妈推广位 adzone_id（可选，不填则自动从PID解析）"),
    material_id: Optional[int] = Query(None, description="物料ID（可选，默认为80309-爆品库）"),
    sort: Optional[str] = Query("tk_rate_des", description="排序方式: tk_rate_des佣金率降序, tk_rate_asc佣金率升序, total_sales_des销量降序, total_sales_asc销量升序, price_asc价格升序, price_des价格降序"),
    save: bool = Query(False, description="是否将搜索结果批量保存到数据库"),
):

    platform_list = [p.strip() for p in (platforms or "alimama").split(",") if p.strip()]

    results: List[ProductSearchItem] = []
    total_results: int = 0

    # 物料ID默认值：80309=爆品库（更适合“谷子/周边”搜索场景）
    # 也可传 material_id 覆盖（如 17004 官方精选）
    default_material_id = 80309
    resolved_material_id = material_id or default_material_id

    if "alimama" in platform_list:
        cfg = platform_config_dao.find_by_platform_id("alimama")
        if not cfg:
            raise HTTPException(status_code=404, detail="未找到阿里妈妈平台配置")
        if not cfg.app_key or not cfg.app_secret:
            raise HTTPException(status_code=400, detail="阿里妈妈 AppKey/AppSecret 未配置")
        if not cfg.is_active:
            raise HTTPException(status_code=400, detail="阿里妈妈平台未启用，请先在返佣账号管理中启用")

        # 自动从PID解析adzone_id
        resolved_adzone_id = adzone_id
        if resolved_adzone_id is None and cfg.pid:
            resolved_adzone_id = _parse_adzone_id_from_pid(cfg.pid)

        if not resolved_adzone_id:
            raise HTTPException(status_code=400, detail="未找到有效的推广位ID，请检查PID配置")

        client = TopClient(
            app_key=cfg.app_key,
            app_secret=cfg.app_secret,
            adzone_id=resolved_adzone_id,
        )
        
        # ── 搜索 ───────────────────────────────────────────────────────────
        items: List[Dict[str, Any]] = []
        try:
            search_result = alimama_search(
                client=client,
                keyword=keyword,
                page_no=page_no,
                page_size=page_size,
                adzone_id=resolved_adzone_id,
                material_id=resolved_material_id,
                sort=sort,
            )
            items = search_result.get("items") or []
            total_results = search_result.get("total_results") or 0
        except Exception as e:
            # API调用失败时使用模拟数据
            if MOCK_MODE:
                print(f"[Gu zi] API调用失败，使用模拟数据: {e}")
                items = _get_mock_products(keyword)
            else:
                raise HTTPException(status_code=502, detail=f"阿里妈妈搜索失败: {e}")

        # ── 为每个结果生成淘口令 ──────────────────────────────────────
        link_gen_result = generate_promotion_links(client, items)

        # ── 组装返回结果 ─────────────────────────────────────────────────
        for it, link_res in zip(items, link_gen_result.results):
            pp = PlatformProduct(
                platform_id="alimama",
                platform_name="淘宝",
                platform_product_id=it.get("platform_product_id", ""),
                url=it.get("url", ""),
                tkl=link_res.tkl,
                link_generated_at=link_res.generated_at,
                price=float(it.get("price") or 0.0),
                original_price=it.get("original_price"),
                zk_final_price=it.get("zk_final_price"),
                commission_rate=float(it.get("commission_rate") or 0.0),
                commission_amount=float(it.get("commission_amount") or 0.0),
                commission_type=it.get("commission_type"),
                coupon_amount=it.get("coupon_amount"),
                coupon_url=it.get("coupon_url"),
                coupon_share_url=it.get("coupon_share_url"),
                shop_title=it.get("shop_title"),
                seller_id=it.get("seller_id"),
                user_type=it.get("user_type"),
                provcity=it.get("provcity"),
                real_post_fee=it.get("real_post_fee"),
                volume=it.get("volume") or 0,
                annual_vol=it.get("annual_vol"),
                tk_total_sales=it.get("tk_total_sales"),
                promotion_tags=it.get("promotion_tags") or [],
                description=it.get("description"),
            )
            platforms_norm = [pp]
            lowest_price, highest_commission, recommended = _calc_recommendation(platforms_norm)

            # 各平台原价最低的那个
            original_prices = [p.original_price for p in platforms_norm if p.original_price]
            original_lowest = min(original_prices) if original_prices else None

            results.append(
                ProductSearchItem(
                    title=it.get("title", ""),
                    image_url=it.get("image_url", ""),
                    small_images=it.get("small_images") or [],
                    sub_title=it.get("description"),
                    platforms=platforms_norm,
                    lowest_price=lowest_price,
                    original_lowest_price=original_lowest,
                    highest_commission=highest_commission,
                    recommended_platform=recommended,
                    volume=it.get("volume") or 0,
                    annual_vol=it.get("annual_vol"),
                    brand_name=it.get("brand_name"),
                    category_id=it.get("category_id"),
                    category_name=it.get("category_name"),
                    level_one_category_id=it.get("level_one_category_id"),
                    level_one_category_name=it.get("level_one_category_name"),
                )
            )

    # ── 批量保存到数据库 ──────────────────────────────────────────────
    if save and results:
        to_save: List[GuziProductCreate] = []
        for item in results:

            to_save.append(GuziProductCreate(
                title=item.title,
                image_url=item.image_url,
                original_image_url=item.image_url,
                small_images=item.small_images,
                platforms=item.platforms,
                description=item.sub_title,
                ip_tags=[],
                category_tags=[],
                brand_name=item.brand_name,
                category_id=item.category_id,
                category_name=item.category_name,
                level_one_category_id=item.level_one_category_id,
                level_one_category_name=item.level_one_category_name,
            ))
        try:
            guzi_product_dao.create_batch(to_save)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"批量保存失败: {e}")

    # TODO: jd/pdd adapters later
    return ProductSearchResponse(
        items=results,
        total=total_results,
        page_no=page_no,
        page_size=page_size,
    )


# ──────────────────────────────────────────────
#  CRUD 路由
# ──────────────────────────────────────────────

@router.get("", response_model=GuziProductListResponse)
async def list_guzi_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(40, ge=1, le=100),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    ip_tag: Optional[str] = Query(None, description="IP标签ID筛选"),
    category_tag: Optional[str] = Query(None, description="类别标签ID筛选"),
    h5_filter: bool = Query(True, description="是否过滤H5隐藏的商品"),
):
    """获取谷子商品列表（分页）"""
    # 获取总数
    total = guzi_product_dao.count(
        is_active=is_active,
        search=search,
        ip_tag=ip_tag,
        category_tag=category_tag,
        h5_filter=h5_filter,
    )
    # 获取列表
    items = guzi_product_dao.find_all(
        skip=skip,
        limit=limit,
        is_active=is_active,
        search=search,
        ip_tag=ip_tag,
        category_tag=category_tag,
        h5_filter=h5_filter,
    )
    return GuziProductListResponse(items=items, total=total)


@router.get("/count")
async def count_guzi_products(
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    ip_tag: Optional[str] = Query(None, description="IP标签ID筛选"),
    category_tag: Optional[str] = Query(None, description="类别标签ID筛选"),
    h5_filter: bool = Query(True, description="是否过滤H5隐藏的商品"),
):
    """获取谷子商品总数"""
    return {"total": guzi_product_dao.count(
        is_active=is_active,
        search=search,
        ip_tag=ip_tag,
        category_tag=category_tag,
        h5_filter=h5_filter,
    )}


@router.get("/{product_id}", response_model=GuziProduct)
async def get_guzi_product(product_id: str):
    """根据ID获取单个商品"""
    product = guzi_product_dao.find_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    return product


@router.post("", response_model=GuziProduct, status_code=201)
async def create_guzi_product(product: GuziProductCreate):
    """创建单个谷子商品"""
    return guzi_product_dao.create(product)


@router.post("/batch", response_model=List[GuziProduct], status_code=201)
async def batch_create_guzi_products(products: List[GuziProductCreate]):
    """批量创建谷子商品"""
    if not products:
        raise HTTPException(status_code=400, detail="商品列表不能为空")
    return guzi_product_dao.create_batch(products)


@router.put("/{product_id}", response_model=GuziProduct)
async def update_guzi_product(product_id: str, update: GuziProductUpdate):
    """更新谷子商品"""
    existing = guzi_product_dao.find_by_id(product_id)
    if not existing:
        raise HTTPException(status_code=404, detail="商品不存在")
    updated = guzi_product_dao.update(product_id, update)
    return updated


@router.delete("/{product_id}")
async def delete_guzi_product(product_id: str):
    """删除谷子商品"""
    deleted = guzi_product_dao.delete(product_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="商品不存在")
    return {"message": "删除成功"}


@router.patch("/{product_id}/toggle", response_model=GuziProduct)
async def toggle_guzi_product_active(product_id: str):
    """切换商品上下架状态"""
    product = guzi_product_dao.toggle_active(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    return product


@router.patch("/batch-toggle")
async def batch_toggle_guzi_products(
    ids: List[str] = Query(...),
    is_active: bool = Query(...),
):
    """批量切换商品上下架状态"""
    modified = guzi_product_dao.batch_toggle_active(ids, is_active)
    return {"modified": modified}


# ──────────────────────────────────────────────
#  推广链接管理
# ──────────────────────────────────────────────

@router.post("/generate-links")
async def generate_links_for_products(
    product_ids: Optional[List[str]] = Query(None, description="指定商品ID列表，不传则更新全部"),
    regenerate: bool = Query(False, description="是否强制重新生成（覆盖已有链接）"),
) -> dict:
    """
    为商品批量生成/更新推广链接（短链接 + 淘口令）。

    支持场景：
      - 新增商品后批量生成推广链接
      - 定时任务更新推广链接（短链接有效期30天）
      - 强制重新生成（regenerate=True）

    对每个商品：
      1. 提取其 platforms 中的原始 click_url
      2. 调用 link_gen.py 生成短链接 + 淘口令
      3. 更新 MongoDB 中对应商品的 platforms 字段
    """
    cfg = platform_config_dao.find_by_platform_id("alimama")
    if not cfg:
        raise HTTPException(status_code=404, detail="未找到阿里妈妈平台配置")
    if not cfg.app_key or not cfg.app_secret:
        raise HTTPException(status_code=400, detail="阿里妈妈 AppKey/AppSecret 未配置")
    if not cfg.is_active:
        raise HTTPException(status_code=400, detail="阿里妈妈平台未启用")

    resolved_adzone_id = None
    if cfg.pid:
        resolved_adzone_id = _parse_adzone_id_from_pid(cfg.pid)
    if not resolved_adzone_id:
        raise HTTPException(status_code=400, detail="未找到有效的推广位ID，请检查PID配置")

    client = TopClient(
        app_key=cfg.app_key,
        app_secret=cfg.app_secret,
        adzone_id=resolved_adzone_id,
    )

    # 查询目标商品
    if product_ids:
        products = []
        for pid in product_ids:
            p = guzi_product_dao.find_by_id(pid)
            if p:
                products.append(p)
    else:
        # 全量更新（只更新活跃商品）
        products = guzi_product_dao.find_all(skip=0, limit=10000, is_active=True)

    updated_count = 0
    skipped_count = 0
    failed_count = 0
    errors: List[dict] = []

    for product in products:
        # 构建每个 platform 的 link 生成请求
        items_to_generate: List[dict] = []
        platform_indices: List[int] = []

        for idx, platform in enumerate(product.platforms):
            if platform.platform_id != "alimama":
                continue
            if not regenerate:
                # 已有有效链接则跳过
                if platform.tkl:
                    skipped_count += 1
                    continue

            url = platform.url or ""
            if not url:
                failed_count += 1
                errors.append({"product_id": product.id, "platform_id": platform.platform_id, "reason": "url为空"})
                continue

            items_to_generate.append({
                "click_url": url,
                "title": product.title,
                "pict_url": product.image_url,
            })
            platform_indices.append(idx)

        if not items_to_generate:
            continue

        # 批量生成链接
        link_result = generate_promotion_links(client, items_to_generate)

        # 更新 platforms
        updated_platforms = list(product.platforms)
        for link_res, p_idx in zip(link_result.results, platform_indices):
            p = updated_platforms[p_idx]
            p.tkl = link_res.tkl
            p.link_generated_at = link_res.generated_at

        from app.models.guzi_product import GuziProductUpdate
        guzi_product_dao.update(product.id, GuziProductUpdate(platforms=updated_platforms))
        updated_count += 1

    return {
        "updated": updated_count,
        "skipped": skipped_count,
        "failed": failed_count,
        "errors": errors if errors else None,
    }


# ──────────────────────────────────────────────
#  淘口令生成（前端触发，实时生成）
# ──────────────────────────────────────────────

@router.post("/generate-tkl/{product_id}", response_model=PlatformProduct)
async def generate_tkl_for_platform(
    product_id: str,
    platform_index: int = Query(..., description="平台在 platforms 数组中的索引"),
):
    """
    为指定商品的指定平台生成淘口令（完整文案）。

    调用淘宝 taobao.tbk.tpwd.create 接口，返回的 model 字段即为完整淘口令文案。
    同时提取短码（₤xxx₤）存入 tkl 字段。

    生成的淘口令会同步更新到数据库并返回给前端。
    前端存储 tkl_text 后，后续推广文案直接使用，无需重复请求。
    """
    cfg = platform_config_dao.find_by_platform_id("alimama")
    if not cfg:
        raise HTTPException(status_code=404, detail="未找到阿里妈妈平台配置")
    if not cfg.app_key or not cfg.app_secret:
        raise HTTPException(status_code=400, detail="阿里妈妈 AppKey/AppSecret 未配置")
    if not cfg.is_active:
        raise HTTPException(status_code=400, detail="阿里妈妈平台未启用")

    product = guzi_product_dao.find_by_id(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")

    if platform_index < 0 or platform_index >= len(product.platforms):
        raise HTTPException(status_code=400, detail=f"platform_index 无效，范围 0~{len(product.platforms) - 1}")

    platform = product.platforms[platform_index]
    if platform.platform_id != "alimama":
        raise HTTPException(status_code=400, detail="目前仅支持 alimama 平台的淘口令生成")

    click_url = platform.url
    if not click_url:
        raise HTTPException(status_code=400, detail="该平台无推广链接，无法生成淘口令")

    # 标准化 URL（补全协议头）
    url = click_url
    if url.startswith("//"):
        url = "https:" + url

    # 调淘宝 API 生成淘口令
    client = TopClient(
        app_key=cfg.app_key,
        app_secret=cfg.app_secret,
        adzone_id=_parse_adzone_id_from_pid(cfg.pid) if cfg.pid else None,
    )

    params: Dict[str, Any] = {
        "url": url,
        "text": product.title[:50],  # 口令文案最多50字
    }
    if platform.shop_title:
        # 附上店铺名增强可信度
        params["text"] = f"{product.title} | {platform.shop_title}"[:50]

    try:
        data = client.request("taobao.tbk.tpwd.create", biz_params=params)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"淘宝淘口令接口调用失败: {e}")

    # 解析响应
    resp = data.get("tbk_tpwd_create_response") or {}
    tpwd_data = resp.get("data") or {}
    model = tpwd_data.get("model")
    password_simple = tpwd_data.get("password_simple")

    if not model:
        err = data.get("error_response", {})
        raise HTTPException(status_code=502, detail=f"淘口令生成失败: {err.get('msg', '未知错误')}")

    # 更新数据库中的 platforms（保留所有字段，只更新淘口令相关）
    from datetime import datetime, timezone
    updated_platforms = list(product.platforms)
    updated_pp = platform.model_dump()
    updated_pp["tkl"] = password_simple
    updated_pp["tkl_text"] = password_simple
    updated_pp["link_generated_at"] = datetime.now(timezone.utc)
    updated_platforms[platform_index] = PlatformProduct(**updated_pp)

    from app.models.guzi_product import GuziProductUpdate
    guzi_product_dao.update(product_id, GuziProductUpdate(platforms=updated_platforms))

    return updated_platforms[platform_index]


# ──────────────────────────────────────────────
#  商品详情获取 & 字段填充
# ──────────────────────────────────────────────

from pydantic import BaseModel as PydanticBaseModel


class FetchItemDetailRequest(PydanticBaseModel):
    """获取商品详情的请求参数"""
    item_id: str = Field(..., description="淘宝商品ID（num_iid），支持原始数字ID或加密后的字符串ID")
    product_id: Optional[str] = Field(None, description="已有谷子商品ID（可选）。不传则创建新商品；传入则向该商品的 platforms 字段中填充/追加 alimama 平台数据")
    generate_links: bool = Field(True, description="是否生成淘口令")


class BatchFetchDetailRequest(PydanticBaseModel):
    """批量获取商品详情的请求参数"""
    product_ids: List[str] = Field(..., description="谷子商品ID列表", min_length=1)
    generate_links: bool = Field(True, description="是否生成淘口令")


class BatchFetchDetailResponse(PydanticBaseModel):
    """批量获取商品详情的响应"""
    total: int = Field(..., description="请求的商品总数")
    success_count: int = Field(..., description="成功数量")
    skipped_count: int = Field(..., description="跳过数量（无alimama平台数据）")
    failed_count: int = Field(..., description="失败数量")
    results: List[dict] = Field(default_factory=list, description="每个商品的处理结果")


class FetchItemDetailResponse(PydanticBaseModel):
    """获取商品详情的响应"""
    product_id: str = Field(..., description="谷子商品ID（新增或已有）")
    is_new: bool = Field(..., description="是否为新创建的商品")
    platform_updated: bool = Field(..., description="platforms 是否被更新（仅 is_new=False 时有意义）")
    detail_filled: Optional[dict] = Field(None, description="填充的字段摘要")


@router.post("/fetch-detail", response_model=FetchItemDetailResponse)
async def fetch_item_detail_and_fill(
    body: FetchItemDetailRequest,
):
    """
    根据淘宝商品ID获取详细信息，并填充到 guzi_products 集合中。

    两种工作模式：
    1. **product_id 不传**：创建新的谷子商品（title、image_url、small_images、platforms）
    2. **product_id 传入**：向已有商品的 platforms 字段中追加或更新 alimama 平台数据
       - 若该商品已有 alimama 平台记录，则覆盖更新
       - 若没有，则追加新的 alimama 平台记录

    字段填充逻辑：
      - platforms.alimama.price             = final_promotion_price（券后价）
      - platforms.alimama.original_price     = reserve_price（划线价）
      - platforms.alimama.zk_final_price    = zk_final_price（折扣价）
      - platforms.alimama.commission_rate    = income_rate / 100（佣金率）
      - platforms.alimama.commission_amount  = commission_amount（预估佣金）
      - platforms.alimama.volume              = volume（销量）
      - platforms.alimama.shop_title         = shop_title（店铺名）
      - platforms.alimama.provcity           = provcity（发货地）
      - platforms.alimama.free_shipment      = free_shipment（是否包邮）
      - platforms.alimama.is_prepay          = is_prepay（是否花呗）
      - platforms.alimama.promotion_tags     = promotion_tags（推广标签）
      - 商品维度: title、image_url、small_images、category/brand 字段（仅新建时生效）
    """
    from app.integrations.alimama.item_detail import get_item_detail
    from app.integrations.alimama.link_gen import generate_promotion_links
    from app.models.guzi_product import GuziProductCreate, GuziProductUpdate

    # ── 1. 初始化阿里妈妈 client ───────────────────────────────────────
    cfg = platform_config_dao.find_by_platform_id("alimama")
    if not cfg:
        raise HTTPException(status_code=404, detail="未找到阿里妈妈平台配置")
    if not cfg.app_key or not cfg.app_secret:
        raise HTTPException(status_code=400, detail="阿里妈妈 AppKey/AppSecret 未配置")
    if not cfg.is_active:
        raise HTTPException(status_code=400, detail="阿里妈妈平台未启用")

    resolved_adzone_id = _parse_adzone_id_from_pid(cfg.pid) if cfg.pid else None
    if not resolved_adzone_id:
        raise HTTPException(status_code=400, detail="未找到有效的推广位ID，请检查PID配置")

    client = TopClient(
        app_key=cfg.app_key,
        app_secret=cfg.app_secret,
        adzone_id=resolved_adzone_id,
    )

    # ── 2. 调用淘宝客商品详情接口 ──────────────────────────────────────
    detail_result = get_item_detail(client, body.item_id)
    if detail_result.get("error"):
        raise HTTPException(status_code=502, detail=f"淘宝客商品详情接口失败: {detail_result['error']}")

    detail = detail_result["item"]
    if not detail:
        raise HTTPException(status_code=404, detail=f"未找到商品 {body.item_id} 的详情")

    item_id_str = detail.get("item_id") or body.item_id
    title = detail.get("title") or ""
    pict_url = detail.get("pict_url") or ""
    small_images = detail.get("small_images") or []

    # ── 3. 获取商品的推广链接（用于生成淘口令） ────────────────────────
    alimama_platform = None
    if body.product_id:
        product = guzi_product_dao.find_by_id(body.product_id)
        if product:
            for platform in product.platforms:
                if platform.platform_id == "alimama":
                    alimama_platform = platform
                    break

    # ── 4. 生成淘口令 ────────────────────────────────────────────────
    tkl_value: Optional[str] = None
    link_generated_at_value: Optional[datetime] = None

    if body.generate_links and alimama_platform:
        # 淘口令生成必须使用推广链接（包含 adzone_id 的 s.click.taobao.com/xxx）
        # 不能用 item_url（商品详情页链接）或 uland.taobao.com 普通链接
        click_url = alimama_platform.url or ""
        if not click_url:
            logger.warning(f"[fetch-detail] 商品 {item_id_str} 没有推广链接，跳过淘口令生成")
        else:
            # 标准化 URL
            if click_url.startswith("//"):
                click_url = "https:" + click_url

            link_gen_result = generate_promotion_links(
                client,
                items=[{"click_url": click_url, "title": title, "pict_url": pict_url}],
            )
            if link_gen_result.results:
                link_res = link_gen_result.results[0]
                tkl_value = link_res.tkl
                link_generated_at_value = link_res.generated_at

    # ── 4. 构建 PlatformProduct（alimama） ────────────────────────────
    # 价格优先级: final_promotion_price > zk_final_price > reserve_price
    price = (
        detail.get("final_promotion_price")
        or detail.get("zk_final_price")
        or detail.get("reserve_price")
        or 0.0
    )

    pp_dict: Dict[str, Any] = {
        "platform_id": "alimama",
        "platform_name": "淘宝",
        "platform_product_id": item_id_str,
        "url": detail.get("item_url") or "",
        "price": float(price),
        "original_price": detail.get("reserve_price"),
        "zk_final_price": detail.get("zk_final_price"),
        "commission_rate": float(detail.get("commission_rate") or 0.0),
        "commission_amount": float(detail.get("commission_amount") or 0.0),
        "commission_type": None,
        "coupon_amount": detail.get("coupon_amount"),
        "coupon_url": detail.get("coupon_url"),
        "coupon_share_url": detail.get("coupon_share_url"),
        "shop_title": detail.get("shop_title"),
        "seller_id": detail.get("seller_id"),
        "user_type": detail.get("user_type"),
        "provcity": detail.get("provcity"),
        "real_post_fee": None,
        "item_url": detail.get("item_url"),
        "free_shipment": detail.get("free_shipment"),
        "is_prepay": detail.get("is_prepay"),
        "volume": detail.get("volume") or 0,
        "annual_vol": detail.get("annual_vol"),
        "tk_total_sales": detail.get("tk_total_sales"),
        "promotion_tags": detail.get("promotion_tags") or [],
        "description": detail.get("short_title"),
        "tkl": tkl_value,
        "tkl_text": tkl_value,
        "link_generated_at": link_generated_at_value,
    }

    new_pp = PlatformProduct(**pp_dict)

    # ── 5. 写入数据库 ───────────────────────────────────────────────
    is_new = False
    platform_updated = False
    target_product_id = body.product_id

    if body.product_id:
        # 追加/更新模式
        product = guzi_product_dao.find_by_id(body.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"商品 {body.product_id} 不存在")

        updated_platforms = list(product.platforms)
        existing_idx = None
        for idx, p in enumerate(updated_platforms):
            if p.platform_id == "alimama":
                existing_idx = idx
                break

        if existing_idx is not None:
            # 智能合并：保留 url/link 等关键字段，只用详情填充有意义的字段
            existing = updated_platforms[existing_idx].model_dump()
            merged = _smart_merge_platform(existing, pp_dict)
            updated_platforms[existing_idx] = PlatformProduct(**merged)
            platform_updated = True
        else:
            # 追加新平台
            updated_platforms.append(new_pp)
            platform_updated = True

        guzi_product_dao.update(body.product_id, GuziProductUpdate(platforms=updated_platforms, detail_fetched=True))
        target_product_id = body.product_id

    else:
        # 新建商品模式
        is_new = True
        product_create = GuziProductCreate(
            title=title,
            image_url=pict_url,
            original_image_url=pict_url,
            small_images=small_images,
            platforms=[new_pp],
            description=detail.get("short_title"),
            ip_tags=[],
            category_tags=[],
            brand_name=detail.get("brand_name"),
            category_id=detail.get("category_id"),
            category_name=detail.get("category_name"),
            level_one_category_id=detail.get("level_one_category_id"),
            level_one_category_name=detail.get("level_one_category_name"),
        )
        created = guzi_product_dao.create(product_create)
        target_product_id = created.id
        # 新建模式下同样标记为已抓取详情
        guzi_product_dao.update(target_product_id, GuziProductUpdate(detail_fetched=True))

    return FetchItemDetailResponse(
        product_id=target_product_id,
        is_new=is_new,
        platform_updated=platform_updated,
        detail_filled={
            "title": title,
            "price": price,
            "commission_rate": detail.get("commission_rate"),
            "commission_amount": detail.get("commission_amount"),
            "volume": detail.get("volume"),
            "shop_title": detail.get("shop_title"),
            "free_shipment": detail.get("free_shipment"),
            "is_prepay": detail.get("is_prepay"),
            "promotion_tags": detail.get("promotion_tags"),
            "small_images_count": len(small_images),
        },
    )


# ──────────────────────────────────────────────
#  批量商品详情获取 & 字段填充
# ──────────────────────────────────────────────

@router.post("/batch-fetch-detail", response_model=BatchFetchDetailResponse)
async def batch_fetch_item_detail_and_fill(
    body: BatchFetchDetailRequest,
):
    """
    批量获取商品详情并填充到 guzi_products 集合中。

    工作流程（与 /fetch-detail 单条接口保持一致）：
      1. 初始化阿里妈妈 client
      2. 遍历每个 product_id，提取 alimama platform_product_id
      3. 调用 get_item_detail 获取详情
      4. 生成淘口令（如 generate_links=True）
      5. 使用 _smart_merge_platform 智能合并平台数据
      6. 保存到数据库并标记 detail_fetched=True

    批量处理优势：
      - 一次API调用获取多个商品详情（阿里妈妈接口支持批量）
      - 减少网络开销，提高效率
      - 统一状态标记，便于后期维护
    """
    from app.integrations.alimama.item_detail import get_item_detail
    from app.integrations.alimama.link_gen import generate_promotion_links
    from app.models.guzi_product import GuziProductUpdate

    # ── 1. 初始化阿里妈妈 client ───────────────────────────────────────
    cfg = platform_config_dao.find_by_platform_id("alimama")
    if not cfg:
        raise HTTPException(status_code=404, detail="未找到阿里妈妈平台配置")
    if not cfg.app_key or not cfg.app_secret:
        raise HTTPException(status_code=400, detail="阿里妈妈 AppKey/AppSecret 未配置")
    if not cfg.is_active:
        raise HTTPException(status_code=400, detail="阿里妈妈平台未启用")

    resolved_adzone_id = _parse_adzone_id_from_pid(cfg.pid) if cfg.pid else None
    if not resolved_adzone_id:
        raise HTTPException(status_code=400, detail="未找到有效的推广位ID，请检查PID配置")

    client = TopClient(
        app_key=cfg.app_key,
        app_secret=cfg.app_secret,
        adzone_id=resolved_adzone_id,
    )

    # ── 2. 准备批量处理 ───────────────────────────────────────────────
    success_count = 0
    skipped_count = 0
    failed_count = 0
    results: List[dict] = []

    # 遍历每个商品
    for product_id in body.product_ids:
        try:
            # 获取商品
            product = guzi_product_dao.find_by_id(product_id)
            if not product:
                failed_count += 1
                results.append({
                    "product_id": product_id,
                    "status": "failed",
                    "message": "商品不存在",
                })
                continue

            # 提取 alimama 平台的 platform_product_id
            alimama_platform = None
            alimama_platform_index = None
            for idx, platform in enumerate(product.platforms):
                if platform.platform_id == "alimama":
                    alimama_platform = platform
                    alimama_platform_index = idx
                    break

            if not alimama_platform or not alimama_platform.platform_product_id:
                skipped_count += 1
                results.append({
                    "product_id": product_id,
                    "status": "skipped",
                    "message": "该商品没有淘宝平台数据或 platform_product_id 为空",
                })
                continue

            item_id = alimama_platform.platform_product_id

            # ── 3. 调用淘宝客商品详情接口 ──────────────────────────────
            detail_result = get_item_detail(client, item_id)
            if detail_result.get("error"):
                failed_count += 1
                results.append({
                    "product_id": product_id,
                    "status": "failed",
                    "message": f"详情接口失败: {detail_result['error']}",
                })
                continue

            detail = detail_result["item"]
            if not detail:
                failed_count += 1
                results.append({
                    "product_id": product_id,
                    "status": "failed",
                    "message": f"未找到商品 {item_id} 的详情",
                })
                continue

            item_id_str = detail.get("item_id") or item_id
            title = detail.get("title") or ""

            # ── 4. 生成淘口令 ────────────────────────────────────────────
            tkl_value: Optional[str] = None
            link_generated_at_value: Optional[datetime] = None

            if body.generate_links:
                # 淘口令生成必须使用推广链接（包含 adzone_id 的 s.click.taobao.com/xxx）
                # 不能用 item_url（商品详情页链接）或 uland.taobao.com 普通链接
                click_url = alimama_platform.url or ""
                if not click_url:
                    # 没有推广链接则跳过淘口令生成
                    logger.warning(f"[batch-fetch-detail] 商品 {item_id_str} 没有推广链接，跳过淘口令生成")
                else:
                    # 标准化 URL
                    if click_url.startswith("//"):
                        click_url = "https:" + click_url

                    link_gen_result = generate_promotion_links(
                        client,
                        items=[{"click_url": click_url, "title": title, "pict_url": detail.get("pict_url", "")}],
                    )
                    if link_gen_result.results:
                        link_res = link_gen_result.results[0]
                        tkl_value = link_res.tkl
                        link_generated_at_value = link_res.generated_at

            # ── 5. 构建 PlatformProduct ───────────────────────────────────
            price = (
                detail.get("final_promotion_price")
                or detail.get("zk_final_price")
                or detail.get("reserve_price")
                or 0.0
            )

            pp_dict: Dict[str, Any] = {
                "platform_id": "alimama",
                "platform_name": "淘宝",
                "platform_product_id": item_id_str,
                "url": detail.get("item_url") or "",
                "price": float(price),
                "original_price": detail.get("reserve_price"),
                "zk_final_price": detail.get("zk_final_price"),
                "commission_rate": float(detail.get("commission_rate") or 0.0),
                "commission_amount": float(detail.get("commission_amount") or 0.0),
                "commission_type": None,
                "coupon_amount": detail.get("coupon_amount"),
                "coupon_url": detail.get("coupon_url"),
                "coupon_share_url": detail.get("coupon_share_url"),
                "shop_title": detail.get("shop_title"),
                "seller_id": detail.get("seller_id"),
                "user_type": detail.get("user_type"),
                "provcity": detail.get("provcity"),
                "real_post_fee": None,
                "item_url": detail.get("item_url"),
                "free_shipment": detail.get("free_shipment"),
                "is_prepay": detail.get("is_prepay"),
                "volume": detail.get("volume") or 0,
                "annual_vol": detail.get("annual_vol"),
                "tk_total_sales": detail.get("tk_total_sales"),
                "promotion_tags": detail.get("promotion_tags") or [],
                "description": detail.get("short_title"),
                "tkl": tkl_value,
                "tkl_text": tkl_value,
                "link_generated_at": link_generated_at_value,
            }

            new_pp = PlatformProduct(**pp_dict)

            # ── 6. 智能合并并保存 ─────────────────────────────────────────
            updated_platforms = list(product.platforms)
            platform_updated = False

            if alimama_platform_index is not None:
                # 智能合并：保留 url/link 等关键字段
                existing = updated_platforms[alimama_platform_index].model_dump()
                merged = _smart_merge_platform(existing, pp_dict)
                updated_platforms[alimama_platform_index] = PlatformProduct(**merged)
                platform_updated = True
            else:
                # 追加新平台
                updated_platforms.append(new_pp)
                platform_updated = True

            guzi_product_dao.update(product_id, GuziProductUpdate(platforms=updated_platforms, detail_fetched=True))

            success_count += 1
            results.append({
                "product_id": product_id,
                "status": "success",
                "platform_updated": platform_updated,
                "detail": {
                    "title": title,
                    "price": price,
                    "commission_rate": detail.get("commission_rate"),
                    "commission_amount": detail.get("commission_amount"),
                    "volume": detail.get("volume"),
                    "shop_title": detail.get("shop_title"),
                    "free_shipment": detail.get("free_shipment"),
                    "is_prepay": detail.get("is_prepay"),
                    "promotion_tags": detail.get("promotion_tags"),
                    "small_images_count": len(detail.get("small_images") or []),
                },
            })

        except Exception as e:
            failed_count += 1
            results.append({
                "product_id": product_id,
                "status": "failed",
                "message": str(e),
            })

    return BatchFetchDetailResponse(
        total=len(body.product_ids),
        success_count=success_count,
        skipped_count=skipped_count,
        failed_count=failed_count,
        results=results,
    )
