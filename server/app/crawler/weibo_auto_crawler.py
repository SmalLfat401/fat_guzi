"""
微博自动爬虫核心逻辑 - 使用数据库任务状态
"""
import asyncio
import logging
import time
import requests
from datetime import datetime, timedelta
from typing import Optional

from app.database.weibo_user_dao import weibo_user_dao
from app.database.weibo_post_dao import weibo_post_dao, create_weibo_post_from_api_data
from app.models.crawler_task import TaskStatus
import app.app_state as app_state

logger = logging.getLogger(__name__)

CDP_URL = "http://127.0.0.1:9222"

USER_INTERVAL_SECONDS = 4.0   # 每个用户间隔 > 4s
LONGTEXT_INTERVAL_SECONDS = 3.0  # 每条全文请求间隔 > 3s

# 增量更新配置
POST_UPDATE_WINDOW_DAYS = 3  # 只对 N 天内发布的微博爬取全文
MAX_POSTS_PER_USER_DAILY = 50  # 每个用户每日最多爬取条数


async def _fetch_weibo_api(uid: str, page: int = 1) -> dict:
    """
    通过 Chrome CDP 连接，使用已有登录态请求微博 API。
    返回 API JSON 数据。
    """
    from playwright.async_api import async_playwright

    api_url = f"https://weibo.com/ajax/statuses/mymblog?uid={uid}&page={page}&feature=0"

    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        contexts = browser.contexts
        if not contexts or not contexts[0].pages:
            await browser.close()
            raise RuntimeError("浏览器没有打开任何页面")

        context = contexts[0]
        cookies = await context.cookies()
        cookie_str = "; ".join([f"{c['name']}={c['value']}" for c in cookies])
        await browser.close()

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Cookie": cookie_str,
        "Referer": "https://weibo.com/",
        "Accept": "application/json, text/plain, */*"
    }

    response = requests.get(api_url, headers=headers, timeout=30)
    return response.json()


async def _fetch_longtext(mblogid: str) -> Optional[str]:
    """
    通过 Chrome CDP 请求长文本 API，返回全文内容，失败返回 None。
    """
    from playwright.async_api import async_playwright

    api_url = f"https://weibo.com/ajax/statuses/longtext?id={mblogid}"

    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(CDP_URL)
        contexts = browser.contexts
        if not contexts or not contexts[0].pages:
            await browser.close()
            return None

        page = contexts[0].pages[0]
        headers = {
            "Referer": "https://weibo.com/",
            "Accept": "application/json, text/plain, */*"
        }

        response = await page.request.get(api_url, headers=headers)
        if response.status != 200:
            await browser.close()
            return None

        data = await response.json()
        await browser.close()

        if data.get("ok") == 1:
            return data.get("data", {}).get("longTextContent", "")
        return None


async def _sleep_until(target_time: float):
    """等待直到达到目标时间"""
    remaining = target_time - time.time()
    if remaining > 0:
        await asyncio.sleep(remaining)


async def run_weibo_crawler_task(
    mode: str = "full",
    max_posts: int = 0,
    target_uids: list = None,
    category_id: str = None,
    category_name: str = None,
):
    """
    执行微博爬虫任务（异步，在后台任务中调用）。
    使用数据库存储任务状态。

    参数:
        mode: 爬虫模式
        max_posts: 限量模式下每个用户最多抓取微博数
        target_uids: 指定模式下需要处理的 uid 列表
        category_id: 分类ID（可选）
        category_name: 分类名称（可选）
    """
    # 使用新的任务服务
    task_service = app_state.get_crawler_task_service()

    logger.info(f"[WeiboCrawler] 任务开始，mode={mode}，max_posts={max_posts}，target_uids={target_uids}")

    # 根据模式确定用户列表
    if mode in ("specific", "limited") and target_uids:
        users = []
        for uid in target_uids:
            user = weibo_user_dao.find_by_uid(uid)
            if user:
                users.append(user)
        if not users:
            task_service.add_log(
                uid="", nickname="系统",
                action="start", message="指定模式: 未找到任何匹配的 uid", success=False
            )
            return
    else:
        users = weibo_user_dao.find_all(is_active=True, limit=1000)
        if not users:
            task_service.add_log(
                uid="", nickname="系统",
                action="start", message="没有找到 is_active=True 的用户", success=False
            )
            return

    # 限量测试模式：限制用户数量（取前 N 个）
    if mode == "limited" and max_posts > 0 and len(users) > max_posts:
        users = users[:max_posts]

    # 创建数据库任务
    task_service.create_task(
        category_id=category_id,
        category_name=category_name,
        mode=mode,
        max_posts=max_posts,
        target_uids=target_uids or [],
    )

    # 启动任务
    task_service.start_task()

    mode_label = {"full": "全量", "limited": f"限量(每用户{max_posts}条)", "specific": "指定"}.get(mode, mode)
    logger.info(f"[WeiboCrawler] 开始爬虫任务，模式={mode_label}，共 {len(users)} 个用户")

    task_service.add_log(
        uid="", nickname="系统",
        action="start",
        message=f"任务开始，模式={mode_label}，共 {len(users)} 个用户，"
                f"用户间隔 {USER_INTERVAL_SECONDS}s，全文间隔 {LONGTEXT_INTERVAL_SECONDS}s",
        success=True
    )

    last_user_time = 0.0  # 上一个用户完成时间
    last_longtext_time = 0.0  # 上一次全文请求时间

    try:
        for idx, user in enumerate(users):
            # —— 检查停止/暂停 ——
            status = task_service.status
            if status == TaskStatus.STOPPING:
                task_service.add_log(
                    uid=user.uid, nickname=user.nickname,
                    action="stopped",
                    message=f"任务被停止（处理到第 {idx + 1}/{len(users)} 个用户）",
                    success=False
                )
                task_service.on_task_stopped(user.uid, user.nickname)
                return

            while task_service.status == TaskStatus.PAUSED:
                await asyncio.sleep(0.5)
                if task_service.status == TaskStatus.STOPPING:
                    return

            # —— 用户间隔 ——
            target_time = last_user_time + USER_INTERVAL_SECONDS
            await _sleep_until(target_time)
            last_user_time = time.time()

            # 再次检查（睡眠后可能被停止/暂停）
            status = task_service.status
            if status == TaskStatus.STOPPING:
                return
            if status == TaskStatus.PAUSED:
                task_service.set_paused_uid(user.uid)
                task_service.add_log(
                    uid=user.uid, nickname=user.nickname,
                    action="paused",
                    message=f"任务暂停于用户 {idx + 1}/{len(users)}",
                    success=True
                )
                return

            # —— 抓取微博列表 ——
            try:
                data = await _fetch_weibo_api(user.uid, page=1)
            except Exception as e:
                logger.warning(f"[WeiboCrawler] 抓取用户 {user.uid} 失败: {e}")
                task_service.add_log(
                    uid=user.uid, nickname=user.nickname,
                    action="user_failed",
                    message=f"抓取失败: {str(e)}", success=False
                )
                task_service.on_user_failed(user.uid, user.nickname, str(e))
                continue

            if data.get("ok") != 1:
                msg = data.get("msg", "未知错误")
                if data.get("ok") == -100:
                    msg = "登录已过期"
                    task_service.add_log(
                        uid="", nickname="系统",
                        action="stopped",
                        message="检测到登录已过期，任务中止",
                        success=False
                    )
                    task_service.on_user_failed(user.uid, user.nickname, msg)
                    task_service.on_task_error("登录已过期")
                    return

                task_service.add_log(
                    uid=user.uid, nickname=user.nickname,
                    action="user_failed",
                    message=f"抓取失败: {msg}", success=False
                )
                task_service.on_user_failed(user.uid, user.nickname, msg)
                continue

            # —— 保存帖子（增量模式）——
            mblog_list = data.get("data", {}).get("list", [])
            # 限量模式：只取前 max_posts 条
            if mode == "limited" and max_posts > 0:
                mblog_list = mblog_list[:max_posts]

            # 查询已存在的 mblogid（用于增量对比）
            existing_mids = weibo_post_dao.find_mids_by_source_uid(user.uid)

            # 3日窗口判断（统一使用 UTC 时间戳比较，避免时区问题）
            update_window_ts = datetime.utcnow().timestamp() - POST_UPDATE_WINDOW_DAYS * 86400

            longtext_mblogids = []
            posts_saved = 0
            posts_updated = 0
            user_blogs_count = 0

            for mblog in mblog_list:
                try:
                    mblog_user_id = str(mblog.get("user", {}).get("id", ""))
                    if mblog_user_id != str(user.uid):
                        continue

                    user_blogs_count += 1
                    mblogid = mblog.get("mblogid")
                    if not mblogid:
                        continue

                    post = create_weibo_post_from_api_data(mblog, user.uid)

                    # 增量判断：不存在则新增
                    if mblogid not in existing_mids:
                        weibo_post_dao.create(post)
                        posts_saved += 1

                    # 记录需要全文的（3日内 + 有 continue_tag）
                    def _is_recent(post_dt):
                        if not post_dt:
                            return False
                        return post_dt.timestamp() > update_window_ts

                    if post.continue_tag and _is_recent(post.created_at_dt):
                        longtext_mblogids.append(post.mblogid)
                    else:
                        # 已存在，检查是否需要更新全文
                        existing_post = weibo_post_dao.find_by_mblogid(mblogid)
                        if (existing_post and existing_post.long_text is None
                            and post.continue_tag
                            and _is_recent(post.created_at_dt)):
                            longtext_mblogids.append(post.mblogid)
                            posts_updated += 1

                except Exception as e:
                    logger.warning(f"[WeiboCrawler] 处理帖子失败: {e}")

            # 用户处理完成，更新统计
            task_service.on_user_completed(
                uid=user.uid,
                nickname=user.nickname,
                blogs_count=user_blogs_count,
                saved_count=posts_saved,
                longtext_count=len(longtext_mblogids)
            )

            logger.info(f"[WeiboCrawler] 用户完成: {user.nickname}, blogs={user_blogs_count}, "
                       f"saved={posts_saved}, longtext={len(longtext_mblogids)}")

            # —— 请求全文 ——
            for mblogid in longtext_mblogids:
                # 全文章间隔
                target_time = last_longtext_time + LONGTEXT_INTERVAL_SECONDS
                await _sleep_until(target_time)
                last_longtext_time = time.time()

                # 检查停止/暂停
                if task_service.status in (TaskStatus.STOPPING, TaskStatus.PAUSED):
                    break

                try:
                    long_text = await _fetch_longtext(mblogid)
                    if long_text:
                        weibo_post_dao.update_longtext(mblogid, long_text)
                        task_service.on_longtext_saved(user.uid)
                    else:
                        task_service.on_longtext_failed(user.uid)
                except Exception:
                    task_service.on_longtext_failed(user.uid)

            # 更新用户进度的全文统计
            # 注意：on_longtext_saved 和 on_longtext_failed 已经在循环中调用了

            # 记录用户完成日志
            stats = task_service.current_task
            if stats:
                current_lt_saved = stats.user_progress.get(user.uid, {}).longtext_saved if hasattr(stats.user_progress.get(user.uid, {}), 'longtext_saved') else 0
                current_lt_failed = stats.user_progress.get(user.uid, {}).longtext_failed if hasattr(stats.user_progress.get(user.uid, {}), 'longtext_failed') else 0

            if len(longtext_mblogids) > 0:
                msg = f"完成，新增 {posts_saved} 条，更新 {posts_updated} 条，全文 {len([x for x in longtext_mblogids if x])}/{len(longtext_mblogids)}"
            else:
                msg = f"完成，新增 {posts_saved} 条"

            task_service.add_log(
                uid=user.uid, nickname=user.nickname,
                action="user_completed",
                message=msg,
                success=True
            )

            # 如果在全文处理中被暂停/停止
            if task_service.status == TaskStatus.PAUSED:
                task_service.set_paused_uid(user.uid)
                task_service.add_log(
                    uid=user.uid, nickname=user.nickname,
                    action="paused",
                    message=f"任务暂停于用户 {idx + 1}/{len(users)}（处理全文时）",
                    success=True
                )
                return

    except Exception as e:
        logger.exception(f"[WeiboCrawler] 任务异常: {e}")
        task_service.add_log(
            uid="", nickname="系统",
            action="error",
            message=f"任务异常: {str(e)}",
            success=False
        )
        task_service.on_task_error(str(e))
        return

    # 任务正常完成
    stats = task_service.current_task
    if stats:
        task_service.add_log(
            uid="", nickname="系统",
            action="completed",
            message=f"任务完成，已处理 {stats.processed_users}/{stats.total_users} 个用户，"
                    f"获取全文 {stats.saved_longtext}/{stats.total_longtext} 条",
            success=True
        )
        task_service.save_final()
    else:
        task_service.set_idle()

    logger.info(f"[WeiboCrawler] 任务完成")
