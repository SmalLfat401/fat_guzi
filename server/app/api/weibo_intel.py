"""
微博情报管理 API
管理端接口：Intel CRUD、审核、告警处理、AI批次、关键词库
"""
from fastapi import APIRouter, HTTPException, Query, Request
from typing import Optional, List
from datetime import datetime
import json

from app.database.weibo_intel_dao import weibo_intel_dao
from app.database.category_keywords_dao import category_keywords_dao
from app.database.expo_event_dao import expo_event_dao
from app.database.weibo_post_dao import weibo_post_dao
from app.models.weibo_post import WeiboPost
from app.models.weibo_intel import (
    WeiboIntel,
    WeiboIntelCreate,
    WeiboIntelUpdate,
    WeiboIntelResponse,
    WeiboIntelDetailResponse,
    IntelCategory,
    IntelStatus,
    IntelChange,
    SingleExtractResult,
    CreateFromExtract,
)
from app.models.category_keywords import (
    CategoryKeywords,
    CategoryKeywordsCreate,
    CategoryKeywordsUpdate,
    CategoryKeywordsResponse,
    KeywordCandidateResponse,
    KeywordCandidate,
)
from app.services.weibo_intel_service import weibo_intel_service
from app.database.system_config_dao import system_config_dao
from app.models.system_config import IntelConfigUpdate
from pydantic import BaseModel

router = APIRouter(prefix="/weibo-intel", tags=["微博情报管理"])


class IntelConfigResponse(BaseModel):
    """情报系统配置响应"""
    keyword_library_enabled: bool
    rule_confidence_threshold: float
    batch_size: int
    has_keywords: bool
    updated_at: Optional[str] = None


# ==================== 情报系统配置接口 ====================

@router.get("/intel-config", response_model=IntelConfigResponse)
async def get_intel_config():
    """获取情报系统配置（含关键词库状态）"""
    config = system_config_dao.get_config()
    intel_cfg = config.intel_config
    has_keywords = system_config_dao.has_any_keywords()
    return IntelConfigResponse(
        keyword_library_enabled=intel_cfg.keyword_library_enabled,
        rule_confidence_threshold=intel_cfg.rule_confidence_threshold,
        batch_size=intel_cfg.batch_size,
        has_keywords=has_keywords,
        updated_at=config.updated_at.isoformat() if config.updated_at else None,
    )


@router.put("/intel-config", response_model=IntelConfigResponse)
async def put_intel_config(update: IntelConfigUpdate):
    """更新情报系统配置"""
    config = system_config_dao.update_intel_config(update)
    intel_cfg = config.intel_config
    has_keywords = system_config_dao.has_any_keywords()
    return IntelConfigResponse(
        keyword_library_enabled=intel_cfg.keyword_library_enabled,
        rule_confidence_threshold=intel_cfg.rule_confidence_threshold,
        batch_size=intel_cfg.batch_size,
        has_keywords=has_keywords,
        updated_at=config.updated_at.isoformat() if config.updated_at else None,
    )


# ==================== 工具函数 ====================

def _to_response(intel: WeiboIntel) -> WeiboIntelResponse:
    return WeiboIntelResponse(
        id=intel.id,
        category=intel.category,
        category_display=IntelCategory.display_name(intel.category),
        title=intel.title,
        description=intel.description,
        event_start_date=intel.event_start_date,
        event_end_date=intel.event_end_date,
        event_start_time=intel.event_start_time,
        event_location=intel.event_location,
        event_city=intel.event_city,
        price_info=intel.price_info,
        purchase_url=intel.purchase_url,
        participants=intel.participants,
        related_ips=intel.related_ips,
        tags=intel.tags,
        cover_image=intel.cover_image,
        status=intel.status,
        alert_type=intel.alert_type,
        alert_message=intel.alert_message,
        alert_resolved=intel.alert_resolved,
        version=intel.version,
        is_latest=intel.is_latest,
        merged_from_ids=intel.merged_from_ids,
        source_posts_count=len(intel.source_posts),
        first_post_author=intel.author_nickname,
        first_post_time=intel.source_posts[0].posted_at.isoformat() if intel.source_posts else None,
        extract_method=intel.extract_method,
        confidence=intel.confidence,
        ai_model=intel.ai_model,
        synced_to_calendar=intel.synced_to_calendar,
        calendar_event_id=intel.calendar_event_id,
        is_published=intel.is_published,
        has_alert=bool(intel.alert_type) and not intel.alert_resolved,
        change_history_count=len(intel.change_history),
        created_at=intel.created_at.isoformat(),
        updated_at=intel.updated_at.isoformat(),
        approved_at=intel.approved_at.isoformat() if intel.approved_at else None,
    )


def _to_detail_response(intel: WeiboIntel) -> WeiboIntelDetailResponse:
    base = _to_response(intel)
    # 为每个源帖子补全正文内容
    posts_with_content = []
    for p in intel.source_posts:
        post = weibo_post_dao.find_by_mid(p.mid)
        posts_with_content.append({
            "mid": p.mid,
            "author_nickname": p.author_nickname,
            "author_uid": p.author_uid,
            "posted_at": p.posted_at.isoformat() if p.posted_at else None,
            "linked_at": p.linked_at.isoformat(),
            "update_type": p.update_type,
            "is_trigger_post": p.is_trigger_post,
            # 补全正文（如果有）
            "text": post.text if post else None,
            "text_raw": post.text_raw if post else None,
            "created_at": post.created_at_dt.isoformat() if post and post.created_at_dt else None,
            "reposts_count": post.reposts_count if post else 0,
            "comments_count": post.comments_count if post else 0,
            "attitudes_count": post.attitudes_count if post else 0,
        })
    return WeiboIntelDetailResponse(
        **base.model_dump(),
        source_posts=posts_with_content,
        change_history=[
            {
                "changed_at": c.changed_at.isoformat() if isinstance(c.changed_at, datetime) else c.changed_at,
                "changed_by": c.changed_by,
                "field": c.field,
                "old_value": c.old_value,
                "new_value": c.new_value,
                "source_post_mid": c.source_post_mid,
                "change_type": c.change_type,
                "change_reason": c.change_reason,
            }
            for c in intel.change_history
        ],
        learned_keywords=intel.learned_keywords,
        ai_raw_response=intel.ai_raw_response,
    )


# ==================== 帖子列表（提取用） ====================

@router.get("/posts")
async def list_posts_for_extract(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    intel_status: Optional[int] = Query(None, description="情报状态: 0未处理/1已提取/2提取中/3不相关/4失败"),
    search: Optional[str] = Query(None, description="搜索内容/作者"),
    sort_by: str = "created_at_dt",
):
    """
    获取帖子列表（用于情报提取页面）
    """
    if intel_status is not None:
        posts = weibo_post_dao.find_by_intel_status(
            status=intel_status,
            limit=limit,
            source_uids=None,
        )
        total = weibo_post_dao.count_by_status(intel_status)
        # 跳过前 skip 条
        posts = posts[skip:skip + limit] if skip > 0 else posts
        posts = posts[:limit]
    elif search:
        # 搜索模式
        posts = weibo_post_dao.find_all(skip=0, limit=500)
        keyword = search.lower()
        filtered = [p for p in posts if (
            (p.text_raw or p.text or "").lower().find(keyword) >= 0 or
            (p.user_nickname or "").lower().find(keyword) >= 0
        )]
        total = len(filtered)
        posts = filtered[skip:skip + limit]
    else:
        posts = weibo_post_dao.find_all(skip=skip, limit=limit)
        total = weibo_post_dao.count()

    def _post_to_dict(p: WeiboPost) -> dict:
        return {
            "mid": p.mid,
            "mblogid": p.mblogid,
            "user_idstr": p.user_idstr,
            "user_nickname": p.user_nickname,
            "text": p.text,
            "text_raw": p.text_raw,
            "long_text": p.long_text,
            "created_at": p.created_at,
            "created_at_dt": p.created_at_dt.isoformat() if p.created_at_dt else None,
            "reposts_count": p.reposts_count,
            "comments_count": p.comments_count,
            "attitudes_count": p.attitudes_count,
            "source": p.source,
            "region_name": p.region_name,
            "is_top": p.is_top,
            "intel_status": p.intel_status or 0,
            "intel_confidence": p.intel_confidence,
            "crawled_at": p.crawled_at.isoformat() if p.crawled_at else None,
        }

    return {
        "items": [_post_to_dict(p) for p in posts],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/posts/count")
async def count_posts_by_status():
    """按情报状态统计帖子数量"""
    result = {}
    for s in [0, 1, 2, 3, 4]:
        result[str(s)] = weibo_post_dao.count_by_status(s)
    result["total"] = sum(result.values())
    return result


# ==================== Intel 列表与查询 ====================

@router.get("")
async def list_intel(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    category: Optional[str] = None,
    has_alert: Optional[bool] = None,
    search: Optional[str] = None,
    start_date_from: Optional[str] = None,
    start_date_to: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    is_published: Optional[bool] = Query(None, description="按发布状态筛选"),
):
    """获取情报列表（支持分页、筛选、搜索）"""
    if status and status not in [s.value for s in IntelStatus]:
        raise HTTPException(status_code=400, detail=f"无效的 status: {status}")
    if category and category not in [c.value for c in IntelCategory]:
        raise HTTPException(status_code=400, detail=f"无效的 category: {category}")

    intel_list, total = weibo_intel_dao.find_all(
        skip=skip, limit=limit,
        status=status, category=category,
        has_alert=has_alert, search=search,
        start_date_from=start_date_from,
        start_date_to=start_date_to,
        sort_by=sort_by, sort_order=sort_order,
        is_published=is_published,
    )

    return {"items": [_to_response(i) for i in intel_list], "total": total}


@router.get("/pending")
async def list_pending_intel(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """获取待审核情报列表"""
    intel_list, total = weibo_intel_dao.find_pending(skip=skip, limit=limit)
    return {"items": [_to_response(i) for i in intel_list], "total": total}


# ==================== 告警相关 ====================

@router.get("/alerts")
async def list_alert_intel(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """获取告警情报列表"""
    intel_list, total = weibo_intel_dao.find_with_alerts(skip=skip, limit=limit)
    return {"items": [_to_response(i) for i in intel_list], "total": total}


@router.get("/detail/{intel_id}", response_model=WeiboIntelDetailResponse)
async def get_intel_detail(intel_id: str):
    """获取情报详情（含变更历史和帖子列表）"""
    intel = weibo_intel_dao.find_by_id(intel_id)
    if not intel:
        raise HTTPException(status_code=404, detail=f"情报不存在: {intel_id}")
    return _to_detail_response(intel)


# ==================== Intel 增删改 ====================

@router.post("", response_model=WeiboIntelResponse)
async def create_intel(data: WeiboIntelCreate):
    """手动创建情报"""
    intel_data = data.model_dump()
    intel_data["status"] = IntelStatus.PENDING.value
    intel_data["extract_method"] = "manual"
    intel_data["dedup_hash"] = None  # 手动创建不计算 dedup_hash
    intel_data["source_posts"] = [{
        "mid": data.source_post_mid or "",
        "author_nickname": data.author_nickname or "manual",
        "author_uid": data.author_uid or "manual",
        "posted_at": None,
        "linked_at": datetime.utcnow().isoformat(),
        "update_type": None,
        "is_trigger_post": True,
    }] if data.source_post_mid else []
    intel_data["change_history"] = [{
        "changed_at": datetime.utcnow().isoformat(),
        "changed_by": "manual",
        "field": None,
        "old_value": None,
        "new_value": None,
        "source_post_mid": data.source_post_mid,
        "change_type": "created",
        "change_reason": "手动创建"
    }]
    intel = WeiboIntel(**intel_data)
    weibo_intel_dao.create(intel)
    return _to_response(intel)


@router.put("/{intel_id}", response_model=WeiboIntelResponse)
async def update_intel(intel_id: str, data: WeiboIntelUpdate):
    """更新情报"""
    intel = weibo_intel_dao.find_by_id(intel_id)
    if not intel:
        raise HTTPException(status_code=404, detail=f"情报不存在: {intel_id}")

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}

    if not update_data:
        return _to_response(intel)

    # 添加变更记录
    for field, new_val in update_data.items():
        old_val = getattr(intel, field, None)
        if old_val != new_val:
            change = IntelChange(
                changed_at=datetime.utcnow(),
                changed_by="manual",
                field=field,
                old_value=old_val,
                new_value=new_val,
                change_type="updated"
            )
            weibo_intel_dao.add_change_record(intel_id, change)

    weibo_intel_dao.update(intel_id, update_data)
    updated = weibo_intel_dao.find_by_id(intel_id)
    return _to_response(updated)


@router.delete("/{intel_id}")
async def delete_intel(intel_id: str):
    """删除情报"""
    if not weibo_intel_dao.find_by_id(intel_id):
        raise HTTPException(status_code=404, detail=f"情报不存在: {intel_id}")
    weibo_intel_dao.delete(intel_id)
    return {"success": True, "message": "删除成功"}


# ==================== 审核操作 ====================

@router.post("/{intel_id}/approve", response_model=WeiboIntelResponse)
async def approve_intel(
    intel_id: str,
    approved_by: str = Query("admin"),
):
    """批准情报（同步到日历）"""
    intel = weibo_intel_service.approve_intel(intel_id, approved_by)
    if not intel:
        raise HTTPException(status_code=404, detail=f"情报不存在: {intel_id}")
    return _to_response(intel)


@router.post("/{intel_id}/reject", response_model=WeiboIntelResponse)
async def reject_intel(
    intel_id: str,
    rejected_by: str = Query("admin"),
    reason: Optional[str] = Query(None),
):
    """拒绝情报"""
    intel = weibo_intel_service.reject_intel(intel_id, rejected_by, reason)
    if not intel:
        raise HTTPException(status_code=404, detail=f"情报不存在: {intel_id}")
    return _to_response(intel)


# ==================== 发布控制 ====================

@router.post("/{intel_id}/publish", response_model=WeiboIntelResponse)
async def publish_intel(intel_id: str):
    """发布情报到 H5"""
    intel = weibo_intel_dao.find_by_id(intel_id)
    if not intel:
        raise HTTPException(status_code=404, detail=f"情报不存在: {intel_id}")
    if intel.status != IntelStatus.APPROVED.value:
        raise HTTPException(status_code=400, detail="仅支持发布已批准的情报")
    weibo_intel_dao.set_published(intel_id, True)
    updated = weibo_intel_dao.find_by_id(intel_id)
    return _to_response(updated)


@router.post("/{intel_id}/unpublish", response_model=WeiboIntelResponse)
async def unpublish_intel(intel_id: str):
    """取消发布（从 H5 下线）"""
    intel = weibo_intel_dao.find_by_id(intel_id)
    if not intel:
        raise HTTPException(status_code=404, detail=f"情报不存在: {intel_id}")
    weibo_intel_dao.set_published(intel_id, False)
    updated = weibo_intel_dao.find_by_id(intel_id)
    return _to_response(updated)


@router.post("/batch-publish")
async def batch_publish(intel_ids: List[str]):
    """批量发布"""
    if not intel_ids:
        raise HTTPException(status_code=400, detail="intel_ids 不能为空")
    count = weibo_intel_dao.batch_set_published(intel_ids, True)
    return {"success": True, "message": f"已发布 {count} 条"}


@router.post("/batch-unpublish")
async def batch_unpublish(intel_ids: List[str]):
    """批量取消发布"""
    if not intel_ids:
        raise HTTPException(status_code=400, detail="intel_ids 不能为空")
    count = weibo_intel_dao.batch_set_published(intel_ids, False)
    return {"success": True, "message": f"已下线 {count} 条"}


@router.post("/batch-approve")
async def batch_approve(
    intel_ids: List[str],
    approved_by: str = Query("admin"),
):
    """批量批准"""
    if not intel_ids:
        raise HTTPException(status_code=400, detail="intel_ids 不能为空")
    count = weibo_intel_service.batch_approve(intel_ids, approved_by)
    return {"success": True, "message": f"已批准 {count} 条"}


@router.post("/batch-reject")
async def batch_reject(
    intel_ids: List[str],
    rejected_by: str = Query("admin"),
):
    """批量拒绝"""
    if not intel_ids:
        raise HTTPException(status_code=400, detail="intel_ids 不能为空")
    count = weibo_intel_service.batch_reject(intel_ids, rejected_by)
    return {"success": True, "message": f"已拒绝 {count} 条"}


# ==================== 告警处理 ====================

@router.post("/{intel_id}/resolve-alert", response_model=WeiboIntelResponse)
async def resolve_alert(
    intel_id: str,
    resolved_by: str = Query("admin"),
    reason: Optional[str] = Query(None),
):
    """处理告警"""
    intel = weibo_intel_dao.find_by_id(intel_id)
    if not intel:
        raise HTTPException(status_code=404, detail=f"情报不存在: {intel_id}")

    weibo_intel_dao.resolve_alert(intel_id, resolved_by, reason)
    updated = weibo_intel_dao.find_by_id(intel_id)
    return _to_response(updated)


# ==================== AI 批次 & 调度器 ====================

@router.post("/scheduler/start")
async def start_scheduler(
    interval: int = Query(60, ge=10, le=300, description="调度间隔（秒）"),
):
    """启动后台调度器"""
    result = weibo_intel_service.start_scheduler(interval=interval)
    return result


@router.post("/scheduler/stop")
async def stop_scheduler():
    """停止后台调度器"""
    result = weibo_intel_service.stop_scheduler()
    return result


@router.get("/scheduler/status")
async def get_scheduler_status():
    """获取调度器状态"""
    stats = weibo_intel_service.get_stats()
    post_count = weibo_intel_service.get_post_count_by_status()
    return {
        "scheduler_enabled": stats.get("scheduler_enabled", False),
        "scheduler_interval": stats.get("scheduler_interval", 60),
        "batch_status": stats["batch_status"],
        "last_batch_result": stats.get("last_batch_result"),
        "post_stats": post_count,
    }


@router.post("/trigger-batch")
async def trigger_ai_batch(
    batch_size: int = Query(20, ge=1, le=50),
):
    """手动触发单个批次提取"""
    result = await weibo_intel_service.run_ai_batch(batch_size=batch_size, max_batches=1)
    return {"success": True, "result": result}


@router.post("/cancel-batch")
async def cancel_batch():
    """取消正在执行的批次"""
    result = weibo_intel_service.cancel_batch()
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.get("/batch-status")
async def get_batch_status():
    """获取批次状态（轮询用，合并了统计信息）"""
    stats = weibo_intel_service.get_stats()
    post_count = weibo_intel_service.get_post_count_by_status()
    return {
        "scheduler_enabled": stats.get("scheduler_enabled", False),
        "scheduler_interval": stats.get("scheduler_interval", 60),
        "batch_status": stats["batch_status"],
        "last_batch_result": stats.get("last_batch_result"),
        "post_stats": post_count,
    }


@router.get("/logs/stream")
async def stream_logs(request: Request):
    """
    SSE 接口：实时推送调度器和批次执行日志
    前端 EventSource 订阅此接口即可实时看到日志输出
    """
    from app.services.weibo_intel_service import _log_queue
    import asyncio

    async def event_generator():
        last_idx = 0  # 队列中的消息是流式的，用下标跟踪新消息
        while True:
            if await request.is_disconnected():
                break

            # 读取队列中所有新消息
            new_entries = []
            while True:
                try:
                    entry = _log_queue.get_nowait()
                    new_entries.append(entry)
                except Exception:
                    break

            for entry in new_entries:
                yield f"data: {json.dumps(entry)}\n\n"

            if not new_entries:
                # 无新消息时发送一个心跳
                yield f": heartbeat\n\n"
                await asyncio.sleep(1)

    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


# ==================== 统计 ====================

@router.get("/stats")
async def get_stats():
    """获取情报统计"""
    return weibo_intel_service.get_stats()


# ==================== 关键词库 ====================

@router.get("/keywords", response_model=List[CategoryKeywordsResponse])
async def list_keywords():
    """获取关键词库（按 category 分组）"""
    keywords_list = category_keywords_dao.find_all()
    return [
        CategoryKeywordsResponse(
            id=k.id,
            category=k.category,
            category_display=IntelCategory.display_name(k.category),
            keywords=k.keywords,
            exclude_keywords=k.exclude_keywords,
            usage_count=k.usage_count,
            hit_count_today=k.hit_count_today,
            ai_confidence_override=k.ai_confidence_override,
            source=k.source,
            is_active=k.is_active,
            created_at=k.created_at.isoformat(),
            updated_at=k.updated_at.isoformat(),
        )
        for k in keywords_list
    ]


@router.post("/keywords")
async def create_or_update_keywords(data: CategoryKeywordsCreate):
    """创建或更新关键词组"""
    keywords = CategoryKeywords(
        category=data.category,
        keywords=data.keywords,
        exclude_keywords=data.exclude_keywords,
        ai_confidence_override=data.ai_confidence_override,
        source=data.source,
    )
    category_keywords_dao.upsert(keywords)
    return {"success": True, "message": f"关键词组 {data.category} 已保存"}


@router.put("/keywords/{category}")
async def update_keywords(category: str, data: CategoryKeywordsUpdate):
    """更新指定 category 的关键词"""
    if category not in [c.value for c in IntelCategory]:
        raise HTTPException(status_code=400, detail=f"无效的 category: {category}")

    existing = category_keywords_dao.find_by_category(category)
    if not existing:
        raise HTTPException(status_code=404, detail=f"关键词组不存在: {category}")

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        category_keywords_dao.update(category, update_data)

    return {"success": True, "message": f"关键词组 {category} 已更新"}


@router.get("/keyword-candidates", response_model=List[KeywordCandidateResponse])
async def list_keyword_candidates(
    status: Optional[str] = None,
    category: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """获取候选关键词列表"""
    candidates = category_keywords_dao.find_candidates(
        status=status, category=category, skip=skip, limit=limit
    )
    return [
        KeywordCandidateResponse(
            id=c.id,
            category=c.category,
            category_display=IntelCategory.display_name(c.category),
            keyword=c.keyword,
            source_intel_id=c.source_intel_id,
            source_text_snippet=c.source_text_snippet,
            confidence=c.confidence,
            status=c.status,
            reviewed_by=c.reviewed_by,
            reviewed_at=c.reviewed_at.isoformat() if c.reviewed_at else None,
            created_at=c.created_at.isoformat(),
        )
        for c in candidates
    ]


@router.post("/keyword-candidates/{candidate_id}/approve")
async def approve_keyword_candidate(
    candidate_id: str,
    approved_by: str = Query("admin"),
):
    """批准候选关键词（添加到关键词库）"""
    candidate = category_keywords_dao.find_candidates(
        status=None, skip=0, limit=1000
    )
    # 简化：直接 approve
    success = category_keywords_dao.approve_candidate(candidate_id, approved_by)
    if not success:
        raise HTTPException(status_code=404, detail="候选关键词不存在")
    return {"success": True, "message": "已批准并添加到关键词库"}


@router.post("/keyword-candidates/{candidate_id}/reject")
async def reject_keyword_candidate(
    candidate_id: str,
    rejected_by: str = Query("admin"),
):
    """拒绝候选关键词"""
    success = category_keywords_dao.reject_candidate(candidate_id, rejected_by)
    if not success:
        raise HTTPException(status_code=404, detail="候选关键词不存在")
    return {"success": True, "message": "已拒绝"}


@router.post("/keyword-candidates/batch-approve")
async def batch_approve_candidates(
    candidate_ids: List[str],
    approved_by: str = Query("admin"),
):
    """批量批准候选关键词"""
    count = category_keywords_dao.approve_candidates_batch(candidate_ids, approved_by)
    return {"success": True, "message": f"已批准 {count} 条"}


# ==================== 帖子详情（审核用） ====================

class PostDetailResponse(BaseModel):
    """帖子原文详情"""
    mid: str
    author_nickname: str
    author_uid: str
    text: Optional[str] = None
    text_raw: Optional[str] = None
    created_at: Optional[str] = None
    reposts_count: int = 0
    comments_count: int = 0
    attitudes_count: int = 0


@router.get("/post/{mid}", response_model=PostDetailResponse)
async def get_post_detail(mid: str):
    """获取帖子原文（用于审核弹窗）"""
    post = weibo_post_dao.find_by_mid(mid)
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
    return PostDetailResponse(
        mid=post.mid,
        author_nickname=post.user_nickname or "",
        author_uid=post.user_idstr or "",
        text=post.text,
        text_raw=post.text_raw,
        created_at=post.created_at_dt.isoformat() if post.created_at_dt else None,
        reposts_count=post.reposts_count,
        comments_count=post.comments_count,
        attitudes_count=post.attitudes_count,
    )


# ==================== 单帖提取（管理端手动） ====================

@router.post("/extract-single", response_model=SingleExtractResult)
async def extract_single_post(mid: str = Query(..., description="帖子MID")):
    """对单个帖子触发 AI 提取，返回提取结果（不创建情报）"""
    result = await weibo_intel_service.extract_single(mid)
    return result


@router.post("/create-from-extract", response_model=WeiboIntelResponse)
async def create_from_extract(data: CreateFromExtract):
    """确认提取结果，创建情报记录，标记帖子 intel_status=1"""
    data_dict = data.model_dump()
    mid = data_dict.pop("mid")
    confidence = data_dict.pop("confidence", 0.5)
    # 去掉 category（单独处理）
    category = data_dict.pop("category")
    data_dict["category"] = category

    intel = weibo_intel_service.create_from_extract(mid, data_dict, confidence)
    if not intel:
        raise HTTPException(status_code=400, detail="创建失败，帖子可能不存在或已被处理")
    return _to_response(intel)


@router.post("/mark-not-related")
async def mark_not_related(mid: str = Query(..., description="帖子MID")):
    """标记帖子为不相关，intel_status=3"""
    success = weibo_intel_service.mark_not_related(mid)
    if not success:
        raise HTTPException(status_code=404, detail="帖子不存在")
    return {"success": True, "message": "已标记为不相关"}


@router.get("/extract-result/{mid}", response_model=SingleExtractResult)
async def get_extract_result(mid: str):
    """获取帖子的最新提取结果缓存（暂无缓存实现，直接返回当前状态）"""
    post = weibo_post_dao.find_by_mid(mid)
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")

    # 如果有缓存的提取结果，返回；否则提示需要先触发提取
    if post.intel_extracted_info:
        # 有历史提取结果，返回基本信息
        return SingleExtractResult(
            mid=mid,
            is_valid=post.intel_status == 1,
            reason=None if post.intel_status == 1 else str(post.intel_extracted_info.get("reason", "")),
        ).model_dump()

    return SingleExtractResult(
        mid=mid,
        is_valid=False,
        reason="尚未触发提取",
    ).model_dump()


# ==================== 帖子状态管理 ====================

@router.post("/posts/reset-status")
async def reset_posts_status(
    from_status: int = Query(2, description="原状态: 0未提取/1已提取/2提取中/3不相关/4失败"),
    to_status: int = Query(0, description="目标状态: 通常为0未提取"),
):
    """
    批量重置帖子情报状态
    用于处理卡在"提取中"状态的帖子（如服务异常中断导致）
    """
    if from_status == to_status:
        raise HTTPException(status_code=400, detail="原状态和目标状态不能相同")

    count = weibo_post_dao.reset_status_by_status(from_status, to_status)
    return {
        "success": True,
        "message": f"已将 {count} 条状态={from_status} 的帖子重置为状态={to_status}",
        "count": count,
    }
