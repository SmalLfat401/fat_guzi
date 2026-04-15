"""
H5 端情报 API - 只返回已发布的情报供 H5 日历展示
"""
from fastapi import APIRouter, Query
from typing import Optional, List, Tuple, Dict, Any
from datetime import datetime

from app.database.weibo_intel_dao import weibo_intel_dao
from app.models.weibo_intel import IntelCategory, IntelStatus, WeiboIntel

router = APIRouter(prefix="/h5/intel", tags=["H5 情报"])


def _intel_to_event(intel: WeiboIntel) -> dict:
    """将 WeiboIntel 转换为 H5 日历事件格式"""
    category_icons = {
        "convention": "🎭",
        "book_signing": "📖",
        "pre_order": "📦",
        "product_launch": "🎁",
        "offline_activity": "🎪",
        "online_activity": "📺",
        "other": "📌",
    }
    # price_info 格式如 "¥80-120" 或 "80-120"，统一去掉 ¥ 前缀，前端统一渲染 ¥
    raw_price = intel.price_info or ""
    if raw_price.startswith("¥"):
        raw_price = raw_price[1:]
    return {
        "id": f"intel_{intel.id}",
        "date": intel.event_start_date or "",
        "time": intel.event_start_time,
        "type": intel.category,  # 管理端识别的情报类别，如 convention, book_signing 等
        "icon": category_icons.get(intel.category, "📌"),
        "name": intel.title,
        "venue": intel.event_location or intel.event_city or "",
        "badge": IntelCategory.display_name(intel.category),
        "cover": intel.cover_image,
        "price": raw_price or None,
    }


@router.get("/events")
async def list_intel_events(
    mode: str = Query("calendar", description="视图模式: calendar=日历视图, list=列表视图"),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD，筛选开始日期（包含）"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD，筛选结束日期（包含）"),
    category: Optional[str] = Query(None, description="情报类别过滤，如 convention, book_signing 等"),
):
    """
    获取已发布的情报事件列表（供 H5 日历使用）

    视图模式:
    - calendar（日历视图）: 返回指定月份范围的所有事件，用于日历格子圆点显示
    - list（列表视图）: 返回从今天起的未来所有活动，支持分页

    筛选条件:
    - start_date / end_date: 日期范围（主要用于日历视图定位当月）
    - category: 按情报类别过滤（与 H5 过滤栏联动）

    统一过滤: status=approved 且 is_published=True
    """
    # 日历视图: 从月初到月末，预设足够大的 limit 获取当月所有事件
    if mode == "calendar":
        if not end_date:
            end_date = "2099-12-31"
        limit = 500  # 日历视图一次性获取当月（或范围）所有事件

    # 列表视图: 从今天开始，按分页返回
    if mode == "list":
        from datetime import date
        if not start_date:
            start_date = date.today().isoformat()

    intel_list, total = weibo_intel_dao.find_published_for_h5(
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        category=category,
    )
    return {
        "items": [_intel_to_event(i) for i in intel_list],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/events/{intel_id}")
async def get_intel_event_detail(intel_id: str):
    """
    获取单条情报详情（供 H5 情报详情页使用）

    intel_id: 原始情报 UUID（不含 intel_ 前缀）
    校验: 仅返回 status=approved 且 is_published=True 的情报
    """
    if intel_id.startswith("intel_"):
        intel_id = intel_id[6:]

    intel = weibo_intel_dao.find_by_id(intel_id)
    if not intel:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="情报不存在")

    if intel.status != IntelStatus.APPROVED or not intel.is_published:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="该情报暂不可查看")

    return {
        "id": f"intel_{intel.id}",
        "uuid": intel.id,
        "date": intel.event_start_date or "",
        "end_date": intel.event_end_date,
        "time": intel.event_start_time,
        "type": intel.category,
        "icon": _intel_to_event(intel)["icon"],
        "name": intel.title,
        "description": intel.description,
        "venue": intel.event_location or intel.event_city or "",
        "city": intel.event_city,
        "badge": IntelCategory.display_name(intel.category),
        "cover": intel.cover_image,
        "price": (intel.price_info.lstrip("¥") if intel.price_info else None),
        "purchase_url": intel.purchase_url,
        "participants": intel.participants,
        "related_ips": intel.related_ips,
        "tags": intel.tags,
        "source_post_url": intel.source_post_url,
        "author_nickname": intel.author_nickname,
        "status": intel.status,
        "created_at": intel.created_at.isoformat() if intel.created_at else None,
        "updated_at": intel.updated_at.isoformat() if intel.updated_at else None,
    }
