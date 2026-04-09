"""
微博自动爬虫任务 API - 使用数据库任务状态
"""
import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

import app.app_state as app_state
from app.crawler.weibo_auto_crawler import run_weibo_crawler_task
from app.models.crawler_task import TaskStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/weibo-crawler", tags=["微博爬虫任务"])


def _check_browser_running() -> str | None:
    """检查 Chrome 是否在运行，返回错误消息或 None"""
    from app.app_state import get_chrome_process, get_global_browser
    pid, port = get_chrome_process()
    browser, _, _ = get_global_browser()
    if not browser or not browser.is_connected():
        # 尝试 socket 检查
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(("127.0.0.1", port or 9222))
        sock.close()
        if result != 0:
            return "Chrome 未启动，请先在「浏览器控制」中启动 Chrome"
    return None


@router.get("/status")
async def get_crawler_status() -> Dict[str, Any]:
    """获取爬虫任务状态"""
    task_service = app_state.get_crawler_task_service()
    state = task_service.get_status()

    # 额外附加浏览器状态
    from app.app_state import get_chrome_process, get_global_browser
    pid, port = get_chrome_process()
    browser, _, _ = get_global_browser()
    browser_connected = browser is not None and browser.is_connected()
    state["browser_connected"] = browser_connected
    state["chrome_pid"] = pid
    return state


@router.get("/category-users")
async def get_category_users() -> Dict[str, Any]:
    """
    一次性获取所有类别及其下的微博用户列表。
    用于前端按类别分组爬取，避免多次请求。
    """
    from app.database.category_dao import category_dao
    from app.database.weibo_user_dao import weibo_user_dao

    try:
        categories = category_dao.find_all(is_active=True)
        result = []
        for cat in categories:
            users = weibo_user_dao.find_all(is_active=True, category_ids=[cat.id])
            result.append({
                "category_id": cat.id,
                "category_name": cat.name,
                "category_description": cat.description,
                "user_count": len(users),
                "users": [{"uid": u.uid, "nickname": u.nickname} for u in users],
            })
        return {"success": True, "categories": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/start-by-category")
async def start_crawler_by_category(
    background_tasks: BackgroundTasks,
    category_id: str,
    mode: str = "full",
    max_posts: int = 0,
) -> Dict[str, Any]:
    """
    按类别启动爬虫任务，直接传 category_id，由后端查找该类别下的所有用户。
    """
    from app.database.category_dao import category_dao
    from app.database.weibo_user_dao import weibo_user_dao

    # 查找类别
    cat = category_dao.find_by_id(category_id)
    if not cat:
        return {"success": False, "error": f"未找到类别: {category_id}"}

    # 查找该类别下所有 is_active=True 的用户
    users = weibo_user_dao.find_all(is_active=True, category_ids=[category_id])
    if not users:
        return {"success": False, "error": f"类别「{cat.name}」下没有启用的用户"}

    target_uids = [u.uid for u in users]
    task_service = app_state.get_crawler_task_service()

    logger.info(f"[WeiboCrawler] 按类别启动，类别={cat.name}，用户数={len(target_uids)}，mode={mode}，max_posts={max_posts}")

    # 状态检查（IDLE/COMPLETED/FAILED/PAUSED/STOPPING 状态下允许启动新任务）
    if task_service.status not in (TaskStatus.IDLE, TaskStatus.STOPPING, TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.PAUSED):
        running_mode = task_service.current_task.mode if task_service.current_task else ""
        running_cat = task_service.current_task.category_name if task_service.current_task and task_service.current_task.category_name else "全局"
        hint = f"请先「停止」当前{running_cat}任务后再试" if task_service.status == TaskStatus.RUNNING else f"请先「停止」或「恢复」当前任务后再试"
        return {
            "success": False,
            "error": f"当前有{running_cat}{running_mode}任务正在运行，无法启动新任务。{hint}",
        }

    browser_error = _check_browser_running()
    if browser_error:
        return {"success": False, "error": browser_error}

    # 按类别启动时强制用 specific 模式，以确保只用 target_uids 而非加载全部用户
    background_tasks.add_task(
        run_weibo_crawler_task,
        mode="specific",
        max_posts=max_posts,
        target_uids=target_uids,
        category_id=category_id,
        category_name=cat.name,
    )
    logger.info(f"[WeiboCrawler] 按类别启动，类别={cat.name}，用户数={len(target_uids)}")

    return {
        "success": True,
        "message": f"爬虫任务已启动，类别「{cat.name}」，共 {len(target_uids)} 个用户（{mode}模式）",
        "category_name": cat.name,
        "user_count": len(target_uids),
    }


class StartCrawlerRequest(BaseModel):
    """启动爬虫任务参数"""
    mode: str = "full"           # full / limited / specific
    max_posts: int = 0            # 限量模式下每个用户最多抓取条数
    target_uids: Optional[List[str]] = None  # 指定模式下的 uid 列表


@router.post("/start")
async def start_crawler(
    background_tasks: BackgroundTasks,
    request: StartCrawlerRequest = None,
) -> Dict[str, Any]:
    """
    启动爬虫任务

    - 任务在后台异步执行，不会阻塞请求
    - 支持三种模式：full（全量）、limited（限量测试）、specific（指定用户）

    参数:
        mode: 爬虫模式
            - full: 全量模式，更新所有 is_active=True 的微博用户
            - limited: 限量测试模式，同全量但限制每用户微博数量
            - specific: 指定模式，只处理 target_uids 中指定的 uid
        max_posts: 限量模式下每个用户最多抓取微博数
        target_uids: 指定模式下需要处理的 uid 列表
    """
    task_service = app_state.get_crawler_task_service()

    # 解析参数
    mode = "full"
    max_posts = 0
    target_uids = None
    if request:
        mode = request.mode or "full"
        max_posts = request.max_posts or 0
        target_uids = request.target_uids or None

    # 验证参数
    if mode not in ("full", "limited", "specific"):
        return {"success": False, "error": f"不支持的爬虫模式: {mode}，支持: full / limited / specific"}

    if mode == "specific" and not target_uids:
        return {"success": False, "error": "指定模式需要提供 target_uids 参数"}

    if mode == "limited" and max_posts <= 0:
        return {"success": False, "error": "限量模式需要设置 max_posts > 0"}

    # 状态检查（COMPLETED/FAILED/PAUSED/STOPPING 状态下允许启动新任务）
    if task_service.status not in (TaskStatus.IDLE, TaskStatus.STOPPING, TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.PAUSED):
        running_mode = task_service.current_task.mode if task_service.current_task else ""
        running_cat = task_service.current_task.category_name if task_service.current_task and task_service.current_task.category_name else "全局"
        hint = f"请先「停止」当前{running_cat}任务后再试" if task_service.status == TaskStatus.RUNNING else f"请先「停止」或「恢复」当前任务后再试"
        return {
            "success": False,
            "error": f"当前有{running_cat}{running_mode}任务正在运行，无法启动新任务。{hint}",
        }

    # 浏览器检查
    browser_error = _check_browser_running()
    if browser_error:
        return {
            "success": False,
            "error": browser_error,
        }

    # 启动后台任务
    background_tasks.add_task(
        run_weibo_crawler_task,
        mode=mode,
        max_posts=max_posts,
        target_uids=target_uids,
    )
    logger.info(f"[WeiboCrawler] 后台任务已提交，模式={mode}，max_posts={max_posts}，target_uids={target_uids}")

    return {
        "success": True,
        "message": f"爬虫任务已在后台启动（{_MODE_LABELS.get(mode, mode)}）",
    }


_MODE_LABELS = {
    "full": "全量模式",
    "limited": "限量测试模式",
    "specific": "指定模式",
}


@router.post("/pause")
async def pause_crawler() -> Dict[str, Any]:
    """暂停爬虫任务（发送暂停信号，下次用户切换点生效）"""
    task_service = app_state.get_crawler_task_service()

    if task_service.status != TaskStatus.RUNNING:
        return {
            "success": False,
            "error": f"当前状态为 {task_service.status.value}，无法暂停",
        }

    # 直接修改数据库状态
    from app.database.crawler_task_dao import crawler_task_dao
    crawler_task_dao.update_status(task_service.task_id, TaskStatus.PAUSED)

    return {
        "success": True,
        "message": "已发送暂停信号，任务将在当前用户处理完成后暂停",
    }


@router.post("/resume")
async def resume_crawler(
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    """恢复爬虫任务"""
    task_service = app_state.get_crawler_task_service()

    if task_service.status != TaskStatus.PAUSED:
        return {
            "success": False,
            "error": f"当前状态为 {task_service.status.value}，无法恢复",
        }

    current_task = task_service.current_task
    if not current_task:
        return {"success": False, "error": "没有找到任务"}

    # 恢复状态
    from app.database.crawler_task_dao import crawler_task_dao
    crawler_task_dao.update_status(current_task.task_id, TaskStatus.RUNNING)

    # 重新启动任务
    background_tasks.add_task(
        run_weibo_crawler_task,
        mode=current_task.mode,
        max_posts=current_task.max_posts,
        target_uids=current_task.target_uids,
        category_id=current_task.category_id,
        category_name=current_task.category_name,
    )

    return {
        "success": True,
        "message": "爬虫任务已在后台恢复",
    }


@router.post("/stop")
async def stop_crawler() -> Dict[str, Any]:
    """停止爬虫任务（发送停止信号）"""
    task_service = app_state.get_crawler_task_service()

    if task_service.status not in (TaskStatus.RUNNING, TaskStatus.PAUSED):
        return {
            "success": False,
            "error": f"当前状态为 {task_service.status.value}，无需停止",
        }

    # 写入数据库
    from app.database.crawler_task_dao import crawler_task_dao
    crawler_task_dao.update_status(task_service.task_id, TaskStatus.STOPPING)

    # 同时更新内存状态，确保后台协程能立即检测到 STOPPING
    task_service.set_stopping()

    return {
        "success": True,
        "message": "已发送停止信号，任务将在当前操作完成后停止",
    }


@router.post("/force-stop")
async def force_stop_crawler() -> Dict[str, Any]:
    """强制停止爬虫任务（无论当前状态，直接重置为 idle）"""
    from app.database.crawler_task_dao import crawler_task_dao
    task_service = app_state.get_crawler_task_service()

    # 重置数据库中所有 STOPPING 状态的任务
    try:
        from app.database.mongo_pool import mongo_pool
        client = mongo_pool._client
        db = client.get_default_database()
        collection = db["crawler_tasks"]

        result = collection.update_many(
            {"status": "stopping"},
            {"$set": {"status": "idle"}}
        )
        logger.info(f"[ForceStop] 重置了 {result.modified_count} 个卡在 stopping 状态的任务")

        # 同时重置内存中的任务状态
        if task_service.current_task and task_service.status == TaskStatus.STOPPING:
            task_service.current_task.status = TaskStatus.IDLE
            task_service.current_task.completed_at = datetime.utcnow()

        return {
            "success": True,
            "message": f"已强制停止，重置了 {result.modified_count} 个任务",
        }
    except Exception as e:
        logger.error(f"[ForceStop] 强制停止失败: {e}")
        return {
            "success": False,
            "error": f"强制停止失败: {str(e)}",
        }
