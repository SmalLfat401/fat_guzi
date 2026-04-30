"""
埋点 API 路由
"""
from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, timedelta

from app.database.track_event_dao import track_event_dao
from app.models.track_event import (
    TrackEvent,
    TrackEventBatch,
    TrackEventResponse,
    OverviewStats,
    PageStatsItem,
    ProductDetailStatsItem,
    CategoryStatsItem,
    HotIpItem,
    ConversionFunnel,
    ConversionStep,
    RetentionItem,
    TrackStatsResponse,
)

router = APIRouter()


# ──────────────────────────────────────────────
# H5 上报接口
# ──────────────────────────────────────────────

@router.post("/track/events", response_model=TrackEventResponse, tags=["H5 埋点"])
async def track_events(batch: TrackEventBatch):
    """
    H5 端上报埋点事件（支持批量）

    建议 H5 端使用 sendBeacon 上报，确保页面跳转时不丢失。
    """
    saved = track_event_dao.insert_events_batch(batch.events)
    return TrackEventResponse(success=saved > 0, saved=saved)


# ──────────────────────────────────────────────
# 管理端统计接口
# ──────────────────────────────────────────────

def _calc_change(today: int, yesterday: int) -> float:
    """计算环比增长率"""
    if yesterday == 0:
        return 100.0 if today > 0 else 0.0
    return round((today - yesterday) / yesterday * 100, 1)


@router.get("/track/stats", response_model=TrackStatsResponse, tags=["H5 埋点"])
async def get_track_stats(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    获取埋点统计数据（管理端看板用）

    - 默认查询最近 7 天数据
    - start_date / end_date 格式：YYYY-MM-DD
    """
    today = datetime.utcnow()
    end = end_date or today.strftime("%Y-%m-%d")
    start = start_date or (today - timedelta(days=6)).strftime("%Y-%m-%d")

    # 概览：今日 vs 昨日
    today_str = today.strftime("%Y-%m-%d")
    yesterday_str = (today - timedelta(days=1)).strftime("%Y-%m-%d")

    today_overview = track_event_dao.get_overview(today_str)
    yesterday_overview = track_event_dao.get_overview(yesterday_str)

    overview = OverviewStats(
        today_pv=today_overview.get("pv", 0),
        today_uv=today_overview.get("uv", 0),
        yesterday_pv=yesterday_overview.get("pv", 0),
        yesterday_uv=yesterday_overview.get("uv", 0),
        pv_change=_calc_change(today_overview.get("pv", 0), yesterday_overview.get("pv", 0)),
        uv_change=_calc_change(today_overview.get("uv", 0), yesterday_overview.get("uv", 0)),
    )

    # 各页面统计
    page_stats_raw = track_event_dao.get_page_stats(start, end)
    page_stats = [
        PageStatsItem(
            page=p.get("page", ""),
            pv=p.get("pv", 0),
            uv=p.get("uv", 0),
            click=p.get("click", 0),
            expose=p.get("expose", 0),
            submit=p.get("submit", 0),
            action=p.get("action", 0),
        )
        for p in page_stats_raw
        if p.get("page")
    ]

    # 商品详情页统计（按 PV 排序）
    product_detail_stats_raw = track_event_dao.get_product_detail_stats(start, end, limit=10)
    product_detail_stats = [
        ProductDetailStatsItem(
            item_id=item.get("_id") or "",
            item_name=item.get("item_name") or "",
            ip_tag=item.get("ip_tag") or "",
            category_tag=item.get("category_tag") or "",
            pv=item.get("pv", 0),
            uv=item.get("uv", 0),
        )
        for item in product_detail_stats_raw
    ]

    # 商品类别统计（按 PV 排序）
    category_stats_raw = track_event_dao.get_category_stats(start, end, limit=20)
    category_stats = [
        CategoryStatsItem(
            category_tag=item.get("category_tag") or "",
            pv=item.get("pv", 0),
            uv=item.get("uv", 0),
        )
        for item in category_stats_raw
    ]

    # 热门 IP 排行
    hot_ips_raw = track_event_dao.get_hot_ips(start, end, limit=10)
    hot_ips = [
        HotIpItem(
            ip_tag=item.get("_id") or "",
            detail_count=item.get("detail_count", 0),
            click=item.get("click", 0),
        )
        for item in hot_ips_raw
    ]

    # 热门搜索词
    hot_searches = track_event_dao.get_hot_searches(start, end, limit=20)

    # 转化漏斗
    funnel_raw = track_event_dao.get_conversion_funnel(start, end)
    conversion = ConversionFunnel(
        steps=[ConversionStep(step=s["step"], count=s["count"]) for s in funnel_raw]
    )

    # 留存数据（最近 7 天）
    retention_raw = track_event_dao.get_retention(end, days=7)
    retention = [
        RetentionItem(
            date=r["date"],
            new_users=r.get("new_users", 0),
            retained_1d=r.get("retained_1d", 0),
            retained_7d=r.get("retained_7d", 0),
        )
        for r in retention_raw
    ]

    return TrackStatsResponse(
        overview=overview,
        page_stats=page_stats,
        product_detail_stats=product_detail_stats,
        category_stats=category_stats,
        hot_ips=hot_ips,
        hot_searches=hot_searches,
        conversion=conversion,
        retention=retention,
    )


@router.get("/track/overview", tags=["H5 埋点"])
async def get_track_overview(date: Optional[str] = None):
    """
    获取指定日期的概览数据（轻量接口，适合轮询）

    date 格式：YYYY-MM-DD，默认今天
    """
    target = date or datetime.utcnow().strftime("%Y-%m-%d")
    overview = track_event_dao.get_overview(target)
    return {"date": target, "pv": overview.get("pv", 0), "uv": overview.get("uv", 0)}


@router.get("/track/pages", tags=["H5 埋点"])
async def get_track_pages(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """
    获取各页面统计（PV/UV 排行）

    默认最近 7 天
    """
    today = datetime.utcnow()
    end = end_date or today.strftime("%Y-%m-%d")
    start = start_date or (today - timedelta(days=6)).strftime("%Y-%m-%d")

    page_stats_raw = track_event_dao.get_page_stats(start, end)
    return {
        "start_date": start,
        "end_date": end,
        "pages": [
            {
                "page": p.get("page", ""),
                "pv": p.get("pv", 0),
                "uv": p.get("uv", 0),
                "click": p.get("click", 0),
                "submit": p.get("submit", 0),
                "action": p.get("action", 0),
            }
            for p in page_stats_raw
            if p.get("page")
        ]
    }
