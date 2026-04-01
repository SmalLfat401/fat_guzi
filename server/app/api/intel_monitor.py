"""
热点追踪系统 API - Intel Monitor 管理接口
"""
from fastapi import APIRouter, HTTPException
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from app.services.intel_monitor import intel_monitor, IntelMonitor, MonitorStatus
from app.database.expo_event_dao import expo_event_dao
from app.database.weibo_post_dao import weibo_post_dao
from app.models.expo_event import ExpoEventResponse, EventStatus
from app.models.weibo_post import IntelStatus

router = APIRouter(prefix="/intel", tags=["热点追踪系统"])


# ==================== 请求/响应模型 ====================

class IntelMonitorConfig(BaseModel):
    """监控配置"""
    rule_interval_minutes: int = 10
    ai_interval_minutes: int = 30
    rule_batch_size: int = 50
    ai_batch_size: int = 20
    use_ai: bool = True
    target_uids: Optional[List[str]] = None


class IntelMonitorResponse(BaseModel):
    """监控状态响应"""
    status: str
    rule_interval_seconds: int
    ai_interval_seconds: int
    rule_batch_size: int
    ai_batch_size: int
    ai_enabled: bool
    # 规则提取统计
    rule_runs: int
    total_rule_processed: int
    total_rule_success: int      # status=1
    total_ai_pending: int         # status=2
    total_not_related: int       # status=3
    total_failed: int             # status=4
    # AI批次统计
    ai_runs: int
    total_ai_processed: int
    total_ai_success: int
    total_ai_failed: int
    # 活动统计
    total_events_created: int
    total_events_updated: int
    last_rule_run_at: Optional[str] = None
    last_rule_run_duration: float = 0.0
    last_ai_run_at: Optional[str] = None
    last_ai_run_duration: float = 0.0
    # 待处理数量
    pending_rule_posts: int = 0
    pending_ai_posts: int = 0


# ==================== 监控管理接口 ====================

@router.get("/monitor/status", response_model=IntelMonitorResponse)
async def get_monitor_status():
    """获取监控器状态（含两阶段统计）"""
    stats = intel_monitor.stats
    pending = intel_monitor.get_pending_count()

    return IntelMonitorResponse(
        status=stats["status"],
        rule_interval_seconds=stats["rule_interval_seconds"],
        ai_interval_seconds=stats["ai_interval_seconds"],
        rule_batch_size=stats["rule_batch_size"],
        ai_batch_size=stats["ai_batch_size"],
        ai_enabled=stats["ai_enabled"],
        # 规则提取统计
        rule_runs=stats["rule_runs"],
        total_rule_processed=stats["total_rule_processed"],
        total_rule_success=stats["total_rule_success"],
        total_ai_pending=stats["total_ai_pending"],
        total_not_related=stats["total_not_related"],
        total_failed=stats["total_failed"],
        # AI批次统计
        ai_runs=stats["ai_runs"],
        total_ai_processed=stats["total_ai_processed"],
        total_ai_success=stats["total_ai_success"],
        total_ai_failed=stats["total_ai_failed"],
        # 活动统计
        total_events_created=stats["total_events_created"],
        total_events_updated=stats["total_events_updated"],
        # 上次运行时间
        last_rule_run_at=stats["last_rule_run_at"].isoformat() if stats["last_rule_run_at"] else None,
        last_rule_run_duration=stats["last_rule_run_duration"],
        last_ai_run_at=stats["last_ai_run_at"].isoformat() if stats["last_ai_run_at"] else None,
        last_ai_run_duration=stats["last_ai_run_duration"],
        # 待处理数量
        pending_rule_posts=pending["rule_pending"],
        pending_ai_posts=pending["ai_pending"],
    )


@router.post("/monitor/run-once")
async def run_rule_once():
    """阶段一：手动执行一次规则提取（处理 intel_status=0 的帖子）"""
    result = intel_monitor.run_once()
    return {
        "success": True,
        "stage": "rule",
        "result": result
    }


@router.post("/monitor/run-ai-batch")
async def run_ai_batch():
    """阶段二：手动触发一次AI批次处理（处理 intel_status=2 的帖子）"""
    result = intel_monitor.run_ai_batch()
    return {
        "success": True,
        "stage": "ai",
        "result": result
    }


@router.post("/monitor/start")
async def start_monitor():
    """启动监控"""
    if intel_monitor.status == MonitorStatus.RUNNING:
        return {"success": True, "message": "监控已在运行中"}

    intel_monitor.start()
    return {"success": True, "message": "监控已启动"}


@router.post("/monitor/stop")
async def stop_monitor():
    """停止监控"""
    if intel_monitor.status == MonitorStatus.STOPPED:
        return {"success": True, "message": "监控已停止"}

    intel_monitor.stop()
    return {"success": True, "message": "监控已停止"}


@router.post("/monitor/pause")
async def pause_monitor():
    """暂停监控"""
    if intel_monitor.status != MonitorStatus.RUNNING:
        raise HTTPException(status_code=400, detail="监控未在运行")

    intel_monitor.pause()
    return {"success": True, "message": "监控已暂停"}


@router.post("/monitor/resume")
async def resume_monitor():
    """恢复监控"""
    if intel_monitor.status != MonitorStatus.PAUSED:
        raise HTTPException(status_code=400, detail="监控未暂停")

    intel_monitor.resume()
    return {"success": True, "message": "监控已恢复"}


@router.post("/monitor/config")
async def configure_monitor(config: IntelMonitorConfig):
    """配置监控参数（运行时修改无需重启监控）"""
    old_rule_interval = intel_monitor.rule_interval_seconds
    old_ai_interval = intel_monitor.ai_interval_seconds
    old_rule_batch = intel_monitor.rule_batch_size
    old_ai_batch = intel_monitor.ai_batch_size
    old_ai = intel_monitor.use_ai

    intel_monitor.rule_interval_seconds = config.rule_interval_minutes * 60
    intel_monitor.ai_interval_seconds = config.ai_interval_minutes * 60
    intel_monitor.rule_batch_size = config.rule_batch_size
    intel_monitor.ai_batch_size = config.ai_batch_size
    intel_monitor.use_ai = config.use_ai
    intel_monitor.target_uids = config.target_uids

    return {
        "success": True,
        "message": (
            f"规则提取：间隔 {old_rule_interval}s→{intel_monitor.rule_interval_seconds}s，"
            f"批次 {old_rule_batch}→{config.rule_batch_size} | "
            f"AI批次：间隔 {old_ai_interval}s→{intel_monitor.ai_interval_seconds}s，"
            f"批次 {old_ai_batch}→{config.ai_batch_size} | "
            f"AI {old_ai}→{config.use_ai}"
        )
    }


# ==================== 活动查询接口 ====================

@router.get("/events", response_model=List[ExpoEventResponse])
async def list_events(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None
):
    """查询漫展活动列表"""
    event_status = None
    if status:
        try:
            event_status = EventStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"无效的状态值: {status}")

    events = expo_event_dao.find_all(
        skip=skip,
        limit=limit,
        status=event_status
    )

    return [
        ExpoEventResponse(
            event_id=e.event_id,
            name=e.name,
            year=e.year,
            session=e.session,
            dates=e.dates,
            location=e.location,
            venue=e.venue,
            city=e.city,
            ticket_info=e.ticket_info,
            ips=e.ips,
            guests=e.guests,
            status=e.status.value if isinstance(e.status, EventStatus) else e.status,
            post_count=e.post_count,
            latest_post_at=e.latest_post_at,
            latest_update_type=e.latest_update_type.value if e.latest_update_type else None,
            has_important_update=e.has_important_update,
            key_info=e.key_info,
            update_history=e.update_history
        )
        for e in events
    ]


@router.get("/events/upcoming", response_model=List[ExpoEventResponse])
async def list_upcoming_events(limit: int = 20):
    """查询即将举办的漫展活动"""
    events = expo_event_dao.find_upcoming(limit=limit)

    return [
        ExpoEventResponse(
            event_id=e.event_id,
            name=e.name,
            year=e.year,
            session=e.session,
            dates=e.dates,
            location=e.location,
            venue=e.venue,
            city=e.city,
            ticket_info=e.ticket_info,
            ips=e.ips,
            guests=e.guests,
            status=e.status.value if isinstance(e.status, EventStatus) else e.status,
            post_count=e.post_count,
            latest_post_at=e.latest_post_at,
            latest_update_type=e.latest_update_type.value if e.latest_update_type else None,
            has_important_update=e.has_important_update,
            key_info=e.key_info,
            update_history=e.update_history
        )
        for e in events
    ]


@router.get("/events/important", response_model=List[ExpoEventResponse])
async def list_events_with_important_updates(limit: int = 20):
    """查询有重要更新的漫展活动"""
    events = expo_event_dao.find_with_important_updates(limit=limit)

    return [
        ExpoEventResponse(
            event_id=e.event_id,
            name=e.name,
            year=e.year,
            session=e.session,
            dates=e.dates,
            location=e.location,
            venue=e.venue,
            city=e.city,
            ticket_info=e.ticket_info,
            ips=e.ips,
            guests=e.guests,
            status=e.status.value if isinstance(e.status, EventStatus) else e.status,
            post_count=e.post_count,
            latest_post_at=e.latest_post_at,
            latest_update_type=e.latest_update_type.value if e.latest_update_type else None,
            has_important_update=e.has_important_update,
            key_info=e.key_info,
            update_history=e.update_history
        )
        for e in events
    ]


@router.get("/events/{event_id}", response_model=ExpoEventResponse)
async def get_event(event_id: str):
    """查询单个活动详情"""
    event = expo_event_dao.find_by_event_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail=f"活动不存在: {event_id}")

    return ExpoEventResponse(
        event_id=event.event_id,
        name=event.name,
        year=event.year,
        session=event.session,
        dates=event.dates,
        location=event.location,
        venue=event.venue,
        city=event.city,
        ticket_info=event.ticket_info,
        ips=event.ips,
        guests=event.guests,
        status=event.status.value if isinstance(event.status, EventStatus) else event.status,
        post_count=event.post_count,
        latest_post_at=event.latest_post_at,
        latest_update_type=event.latest_update_type.value if event.latest_update_type else None,
        has_important_update=event.has_important_update,
        key_info=event.key_info,
        update_history=event.update_history
    )


# ==================== 统计接口 ====================

@router.get("/stats")
async def get_stats():
    """获取热点追踪系统统计信息（含各状态分布）"""
    from app.models.weibo_post import IntelStatus

    pending_rule = weibo_post_dao.count_unanalyzed()
    pending_ai = weibo_post_dao.count_ai_pending()
    count_failed = weibo_post_dao.count_by_status(IntelStatus.FAILED)
    count_success = weibo_post_dao.count_by_status(IntelStatus.SUCCESS)
    count_not_related = weibo_post_dao.count_by_status(IntelStatus.NOT_RELATED)
    total_events = expo_event_dao.count()
    upcoming_events = expo_event_dao.count(EventStatus.UPCOMING)
    important_events = len(expo_event_dao.find_with_important_updates(limit=100))

    return {
        "posts_by_status": {
            "total_rule_pending": pending_rule,       # 待规则提取
            "total_ai_pending": pending_ai,           # 待AI处理
            "total_success": count_success,            # 提取成功
            "total_not_related": count_not_related,   # 确认不相关
            "total_failed": count_failed,              # 处理异常
        },
        "events": {
            "total": total_events,
            "upcoming": upcoming_events,
            "with_important_updates": important_events,
        },
        "monitor": intel_monitor.stats
    }
