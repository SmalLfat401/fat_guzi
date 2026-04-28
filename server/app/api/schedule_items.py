"""
排期内容条目API路由
用于管理每周的内容发布计划、状态和平台发布记录
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime

from app.models.schedule_item import (
    ScheduleItemCreate, ScheduleItemUpdate,
    ScheduleItemResponse, ScheduleItemListResponse,
    UpdateStatusRequest, BatchConfirmRequest,
    CONTENT_TYPE_LABELS, SLANG_CATEGORY_LABELS,
    PublishStatus,
)
from app.database.schedule_item_dao import schedule_item_dao

router = APIRouter(prefix="/schedule-items", tags=["排期内容管理"])


def _to_response(item):
    # ScheduleItem 使用 id=Field(..., alias="_id")，model_dump 返回 {"id": "...", ...}
    d = item.model_dump()
    return ScheduleItemResponse(**d)


# ---- 渠道管理 ----
@router.get("/channels", response_model=List)
async def get_channels():
    """获取已配置的发布渠道列表（ID→名称映射）"""
    from app.database.publish_channel_dao import publish_channel_dao
    channels = publish_channel_dao.find_active()
    return [{"id": c.id, "name": c.name, "icon": c.icon} for c in channels]


# ---- 内容类型元信息 ----
@router.get("/meta", response_model=dict)
async def get_meta():
    """获取内容类型和黑话分类的元信息"""
    return {
        "content_types": CONTENT_TYPE_LABELS,
        "slang_categories": SLANG_CATEGORY_LABELS,
    }


# ---- 周视图 ----
@router.get("/week/{week_year}", response_model=List[ScheduleItemResponse])
async def get_week_schedule(week_year: str):
    """
    获取指定周的所有排期条目

    - week_year: 格式 2026-W17
    """
    items = schedule_item_dao.find_by_week(week_year)
    return [_to_response(i) for i in items]


# ---- 周视图快捷接口：当前周 / 上一周 / 下一周 ----
@router.get("/week-current", response_model=dict)
async def get_current_week():
    """获取当前周的 week_year 和日期范围"""
    today = datetime.utcnow()
    # ISO 周码
    week_number = today.isocalendar()[1]
    year = today.isocalendar()[0]
    week_year = f"{year}-W{week_number:02d}"

    # 计算本周一和周日
    monday = today - datetime.timedelta(days=today.weekday())
    sunday = monday + datetime.timedelta(days=6)
    return {
        "week_year": week_year,
        "week_number": week_number,
        "year": year,
        "monday": monday.strftime("%Y-%m-%d"),
        "sunday": sunday.strftime("%Y-%m-%d"),
    }


# ---- 列表查询 ----
@router.get("", response_model=ScheduleItemListResponse)
async def list_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    content_type: Optional[str] = Query(None),
    week_year: Optional[str] = Query(None),
):
    """分页查询排期条目"""
    items = schedule_item_dao.find_all(
        skip=skip, limit=limit,
        content_type=content_type, week_year=week_year
    )
    total = schedule_item_dao.count(content_type=content_type)
    return ScheduleItemListResponse(
        items=[_to_response(i) for i in items],
        total=total,
    )


# ---- 单条 CRUD ----
@router.get("/{item_id}", response_model=ScheduleItemResponse)
async def get_item(item_id: str):
    item = schedule_item_dao.find_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"条目 ID {item_id} 不存在")
    return _to_response(item)


@router.post("", response_model=ScheduleItemResponse, status_code=201)
async def create_item(item: ScheduleItemCreate):
    """创建排期条目"""
    created = schedule_item_dao.create(item)
    return _to_response(created)


@router.put("/{item_id}", response_model=ScheduleItemResponse)
async def update_item(item_id: str, update: ScheduleItemUpdate):
    """更新排期条目内容"""
    existing = schedule_item_dao.find_by_id(item_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"条目 ID {item_id} 不存在")
    updated = schedule_item_dao.update(item_id, update)
    return _to_response(updated)


@router.delete("/{item_id}")
async def delete_item(item_id: str):
    """删除排期条目"""
    existing = schedule_item_dao.find_by_id(item_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"条目 ID {item_id} 不存在")
    success = schedule_item_dao.delete(item_id)
    if success:
        return {"message": f"条目已删除", "success": True}
    raise HTTPException(status_code=500, detail="删除失败")


# ---- 状态流转 ----
@router.patch("/{item_id}/status", response_model=ScheduleItemResponse)
async def update_item_status(item_id: str, req: UpdateStatusRequest):
    """
    更新条目在指定平台的发布状态

    - pending   → 待审核
    - confirmed → 已确认
    - published → 已发布
    """
    valid_statuses = [PublishStatus.PENDING, PublishStatus.CONFIRMED, PublishStatus.PUBLISHED]
    if req.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"无效状态 '{req.status}'，必须是 {valid_statuses}")

    updated = schedule_item_dao.update_platform_status(
        item_id, req.platform_id, req.status, note=req.note
    )
    if not updated:
        raise HTTPException(status_code=404, detail=f"条目 ID {item_id} 不存在")
    return _to_response(updated)


# ---- 锚定（置顶） ----
@router.patch("/{item_id}/pinned", response_model=ScheduleItemResponse)
async def toggle_pinned(item_id: str):
    """切换锚定状态"""
    updated = schedule_item_dao.toggle_pinned(item_id)
    if not updated:
        raise HTTPException(status_code=404, detail=f"条目 ID {item_id} 不存在")
    return _to_response(updated)


# ---- 批量确认（补发历史日期时的确认窗口） ----
@router.post("/batch-confirm", response_model=dict)
async def batch_confirm(req: BatchConfirmRequest):
    """
    批量确认多个条目（主要用于补发历史日期内容时的确认窗口）
    将所有指定条目在所有平台上标记为 confirmed
    """
    from app.database.publish_channel_dao import publish_channel_dao
    items = schedule_item_dao.find_by_ids(req.item_ids)
    if not items:
        raise HTTPException(status_code=404, detail="未找到任何指定条目")

    confirmed_count = 0
    channels = publish_channel_dao.find_active()
    for item in items:
        for ch in channels:
            schedule_item_dao.update_platform_status(
                item.id, ch.id, PublishStatus.CONFIRMED, note=req.reason
            )
        confirmed_count += 1

    return {
        "message": f"已确认 {confirmed_count} 条记录，原因：{req.reason}",
        "confirmed_count": confirmed_count,
    }
