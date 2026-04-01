"""
Guzi products API (multi-platform search scaffold).

Currently implements:
  - GET /guzi-products/search (alimama only for now)
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from typing import Any, Dict, List, Optional

from app.database.platform_config_dao import platform_config_dao
from app.database.guzi_product_dao import guzi_product_dao
from app.integrations.alimama.top_client import TopClient
from app.integrations.alimama.search import search_products as alimama_search
from app.integrations.alimama.link_gen import generate_promotion_links, LinkGenOptions
from app.models.guzi_product import (
    GuziProduct,
    GuziProductCreate,
    GuziProductUpdate,
    ProductSearchItem,
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


@router.get("/search", response_model=List[ProductSearchItem])
async def search_guzi_products(
    keyword: str = Query(..., min_length=1),
    platforms: Optional[str] = Query(None, description="comma separated, e.g. alimama,jd,pdd"),
    page_no: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    adzone_id: Optional[int] = Query(None, description="阿里妈妈推广位 adzone_id（可选，不填则自动从PID解析）"),
    material_id: Optional[int] = Query(None, description="物料ID（可选，默认为2836-通用物料）"),
):
    platform_list = [p.strip() for p in (platforms or "alimama").split(",") if p.strip()]

    results: List[ProductSearchItem] = []

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
            )
            items = search_result.get("items") or []
        except Exception as e:
            # API调用失败时使用模拟数据
            if MOCK_MODE:
                print(f"[Gu zi] API调用失败，使用模拟数据: {e}")
                items = _get_mock_products(keyword)
            else:
                raise HTTPException(status_code=502, detail=f"阿里妈妈搜索失败: {e}")

        # ── 为每个结果生成短链接 + 淘口令 ─────────────────────────────────
        link_gen_result = generate_promotion_links(client, items)

        # ── 组装返回结果 ─────────────────────────────────────────────────
        for it, link_res in zip(items, link_gen_result.results):
            platforms_norm = [
                PlatformProduct(
                    platform_id="alimama",
                    platform_name="淘宝",
                    platform_product_id=it.get("platform_product_id", ""),
                    url=it.get("url", ""),
                    short_link=link_res.short_link,
                    tkl=link_res.tkl,
                    link_generated_at=link_res.generated_at,
                    link_expires_at=link_res.short_link_expires_at,
                    price=float(it.get("price") or 0.0),
                    commission_rate=float(it.get("commission_rate") or 0.0),
                    commission_amount=float(it.get("commission_amount") or 0.0),
                    coupon_amount=it.get("coupon_amount"),
                    coupon_url=it.get("coupon_url"),
                    shop_title=it.get("shop_title"),
                    description=it.get("description"),
                )
            ]
            lowest_price, highest_commission, recommended = _calc_recommendation(platforms_norm)
            results.append(
                ProductSearchItem(
                    title=it.get("title", ""),
                    image_url=it.get("image_url", ""),
                    platforms=platforms_norm,
                    lowest_price=lowest_price,
                    highest_commission=highest_commission,
                    recommended_platform=recommended,
                )
            )

    # TODO: jd/pdd adapters later
    return results


# ──────────────────────────────────────────────
#  CRUD 路由
# ──────────────────────────────────────────────

@router.get("", response_model=List[GuziProduct])
async def list_guzi_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    ip_tag: Optional[str] = Query(None, description="IP标签ID筛选"),
    category_tag: Optional[str] = Query(None, description="类别标签ID筛选"),
):
    """获取谷子商品列表（分页）"""
    return guzi_product_dao.find_all(
        skip=skip,
        limit=limit,
        is_active=is_active,
        search=search,
        ip_tag=ip_tag,
        category_tag=category_tag,
    )


@router.get("/count")
async def count_guzi_products(
    is_active: Optional[bool] = Query(None),
    ip_tag: Optional[str] = Query(None, description="IP标签ID筛选"),
    category_tag: Optional[str] = Query(None, description="类别标签ID筛选"),
):
    """获取谷子商品总数"""
    return {"total": guzi_product_dao.count(is_active=is_active, ip_tag=ip_tag, category_tag=category_tag)}


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
                if platform.short_link and platform.tkl:
                    if platform.link_expires_at:
                        from datetime import datetime, timezone
                        if platform.link_expires_at > datetime.now(timezone.utc):
                            skipped_count += 1
                            continue
                    else:
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
            p.short_link = link_res.short_link
            p.tkl = link_res.tkl
            p.link_generated_at = link_res.generated_at
            p.link_expires_at = link_res.short_link_expires_at

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

    # 更新数据库中的 platforms
    from datetime import datetime, timezone
    updated_platforms = list(product.platforms)
    updated_platforms[platform_index] = PlatformProduct(
        platform_id=platform.platform_id,
        platform_name=platform.platform_name,
        platform_product_id=platform.platform_product_id,
        url=platform.url,
        short_link=platform.short_link,
        tkl=password_simple,  # 短码 ₤xxx₤
        tkl_text=password_simple,  # 淘口令码（₤xxx₤），用于拼接推广文案
        link_generated_at=datetime.now(timezone.utc),
        link_expires_at=None,
        price=platform.price,
        commission_rate=platform.commission_rate,
        commission_amount=platform.commission_amount,
        coupon_amount=platform.coupon_amount,
        coupon_url=platform.coupon_url,
        shop_title=platform.shop_title,
        description=platform.description,
    )

    from app.models.guzi_product import GuziProductUpdate
    guzi_product_dao.update(product_id, GuziProductUpdate(platforms=updated_platforms))

    return updated_platforms[platform_index]
