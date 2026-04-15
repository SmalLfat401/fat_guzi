"""
微博情报服务 - 核心业务逻辑层
负责 AI 批次提取、去重合并、审核流转、同步日历
"""
import json
import logging
import time
import asyncio
import re
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
from enum import Enum

from app.database.weibo_intel_dao import weibo_intel_dao, normalize_text, generate_dedup_hash
from app.database.system_config_dao import system_config_dao
from app.database.weibo_post_dao import weibo_post_dao
from app.database.category_keywords_dao import category_keywords_dao
from app.database.expo_event_dao import expo_event_dao, generate_event_id
from app.models.weibo_intel import (
    WeiboIntel,
    WeiboIntelCreate,
    IntelStatus,
    IntelCategory,
    IntelChange,
    SourcePostRef,
    ExtractMethod,
    AlertType,
)
from app.models.expo_event import ExpoEvent, EventStatus, UpdateType
from app.services.llm_service import llm_service
import threading
import queue

logger = logging.getLogger(__name__)

# ============== 实时事件总线（供 SSE 订阅） ==============

_log_queue: queue.Queue = queue.Queue(maxsize=500)


def _emit(level: str, step: str, message: str, data: Optional[Dict[str, Any]] = None):
    """往事件队列推送一条日志，所有 SSE 订阅者都会收到"""
    entry = {
        "ts": datetime.utcnow().isoformat(),
        "level": level,
        "step": step,
        "message": message,
        "data": data or {},
    }
    try:
        _log_queue.put_nowait(entry)
    except queue.Full:
        # 队列满了，丢弃最旧的
        try:
            _log_queue.get_nowait()
            _log_queue.put_nowait(entry)
        except queue.Empty:
            pass


# ============== AI Prompt 模板 ==============

# 单帖分析 Prompt（用于单帖提取）
CATEGORY_SYSTEM_PROMPT = """你是一个二次元领域情报分析专家。你的任务是从微博帖子中判断是否包含用户需要的情报信息，并提取结构化的活动信息。

【应该提取的情报类型】
1. convention（漫展）：同人祭、动漫展、游戏展、嘉年华等线下大型展会
2. book_signing（签售）：作家签售、Coser签售、声优见面会等签售活动
3. pre_order（预售）：周边/谷子预售、限定商品预约
4. product_launch（新谷开团）：新品发布、周边首发、现货开售
5. offline_activity（线下活动）：快闪店，品牌联动、线下聚会、见面会
6. online_activity（线上活动）：直播、线上联动、线上活动
7. other（其他）：不属于以上但有标记价值的活动（如游戏联动、限定皮肤等）

【不应该提取的内容 - 必须标记为不相关(is_valid=false)】
- 游戏/APP停服维护公告
- 版本更新、bug修复公告
- 日常游戏活动（签到、每日任务等常规活动）
- 官方水贴、节日祝福、抽奖公告
- 仅讨论剧情、角色但无活动信息
- 二手交易、个人出谷
- 粉丝日常闲聊、碎碎念
- 没有具体活动信息的转发、讨论
- 攻略、同人创作分享（除非有官方活动信息）

【判断标准】
只有帖子中明确包含"即将发生"的展会/签售/预售/团购/线下活动等情报时，才应该标记为有效。

【必须提取的字段】
- is_valid: 是否有效情报（true/false）
- reason: 判断理由（简单说明为什么有效或无效）
- category: 活动类型（7种之一，is_valid=false时填null）
- title: 活动/商品标题（is_valid=false时填null）
- event_start_date: 开始日期（YYYY-MM-DD格式，不知道则填null）
- event_end_date: 结束日期（不知道则填null）
- event_location: 详细地点（不知道则填null）
- event_city: 城市（不知道则填null）
- price_info: 价格或票务信息（不知道则填null）
- purchase_url: 购买/预约链接（没有则填null）
- participants: 嘉宾/参与者列表（没有则填空数组[]）
- related_ips: 涉及的IP列表（没有则填空数组[]）
- tags: 推荐标签（最多5个，没有则填空数组[]）
- description: 一句话描述（50字以内，没有则填null）
- confidence: 置信度 0.0-1.0

请以JSON格式返回，不要有其他内容。"""

BATCH_CATEGORY_SYSTEM_PROMPT = """你是一个二次元领域情报分析专家。判断微博帖子是否包含用户需要的情报信息。

【应该提取的情报类型】
1. convention（漫展）：同人祭、动漫展、游戏展、嘉年华等
2. book_signing（签售）：作家签售、Coser签售、声优见面会
3. pre_order（预售）：周边/谷子预售、限定商品预约
4. product_launch（新谷开团）：新品发布、周边首发、现货开售
5. offline_activity（线下活动）：快闪店，品牌联动、线下聚会、见面会
6. online_activity（线上活动）：直播、线上联动、线上活动
7. other（其他）：游戏联动、限定皮肤等有标记价值的活动

【不应该提取的内容 - 标记is_valid=false】
- 游戏/APP停服维护公告
- 版本更新、bug修复公告
- 日常游戏活动（签到、每日任务等）
- 官方水贴、节日祝福、抽奖公告
- 没有具体活动信息的转发讨论
- 二手交易、个人出谷
- 粉丝日常闲聊
- 攻略、同人创作分享（除非有官方活动信息）

【必须返回的字段】
每条帖子必须返回：idx、is_valid、reason、category、title、event_start_date、event_end_date、event_location、event_city、price_info、purchase_url、participants、related_ips、tags、description、confidence、learned_keywords。
is_valid=false时，category和title填null。

【关键词学习】
请分析每个帖子中出现的、能帮助识别同类情报的新关键词（如活动名称、IP简称、品牌/系列名称等），将 1-5 个最有价值的放入 learned_keywords 数组。
不要复制已有的 tags，learned_keywords 应该是更精准的活动名称或品牌词。
没有适合的关键词则返回空数组 []。

请以JSON数组格式返回，不要有其他内容。"""


# ============== 日期解析工具 ==============

def parse_relative_date(date_str: str) -> Optional[str]:
    """尝试解析各种格式的日期为 YYYY-MM-DD"""
    if not date_str:
        return None
    # 完整日期：2026年5月1日、2026.5.1、2026-05-01
    patterns = [
        r"(\d{4})[年./-](\d{1,2})[月./-](\d{1,2})[日]?",
        r"(\d{4})-(\d{2})-(\d{2})",
    ]
    for pattern in patterns:
        match = re.search(pattern, date_str)
        if match:
            year, month, day = match.groups()
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    # 简写：5月1日、5.1（使用当前年份）
    rel_pattern = r"(0?[1-9]|1[0-2])月(0?[1-9]|[1-3]\d)日"
    rel_match = re.search(rel_pattern, date_str)
    if rel_match:
        year = datetime.now().year
        month, day = rel_match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    return None


# ============== Service 类 ==============

class BatchStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLING = "cancelling"


class WeiboIntelService:
    """
    微博情报核心服务

    核心功能：
    1. AI 批次提取（手动触发）
    2. 去重匹配和合并
    3. 审核流程管理
    4. 同步到日历数据库
    """

    def __init__(self, batch_size: int = 20):
        self.batch_size = batch_size
        self._batch_status = BatchStatus.IDLE
        self._last_batch_result: Optional[Dict[str, Any]] = None
        self._batch_start_time: Optional[float] = None
        self._cancel_requested = False

        # 调度器相关
        self._scheduler_enabled = False
        self._scheduler_thread: Optional[threading.Thread] = None
        self._scheduler_lock = threading.Lock()
        self._scheduler_interval = 60  # 默认 60 秒轮询一次

    @property
    def scheduler_enabled(self) -> bool:
        return self._scheduler_enabled

    @property
    def batch_status(self) -> BatchStatus:
        return self._batch_status

    @property
    def last_batch_result(self) -> Optional[Dict[str, Any]]:
        return self._last_batch_result

    def _ensure_list(self, value: Any) -> List:
        """确保值为列表类型，处理字符串、空值等情况"""
        if value is None:
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            # 如果是逗号分隔的字符串，尝试分割
            if "," in value:
                return [v.strip() for v in value.split(",") if v.strip()]
            # 单个字符串
            return [value.strip()] if value.strip() else []
        return []

    def _get_post_text(self, post) -> str:
        """获取帖子文本内容"""
        return post.long_text or post.text_raw or post.text or ""

    def _build_ai_messages(self, text: str) -> List[Dict[str, str]]:
        return [
            {"role": "system", "content": CATEGORY_SYSTEM_PROMPT},
            {"role": "user", "content": f"【微博内容】\n{text}"}
        ]

    # ==================== AI 批次提取 ====================

    async def run_ai_batch(self, batch_size: Optional[int] = None, max_batches: int = 0) -> Dict[str, Any]:
        """
        执行 AI 批次提取，循环处理所有待处理帖子

        Args:
            batch_size: 每批次处理条数
            max_batches: 最大批次限制（0 表示不限制，处理完所有数据）

        流程：
        1. 循环获取待处理帖子（intel_status=0 且未被 intel 关联）
        2. 批量调用 AI 分析
        3. 处理结果：创建/合并 intel
        4. 更新帖子 intel_status
        5. 重复直到没有待处理帖子或达到 max_batches 限制

        Returns:
            批次执行结果统计（累计所有批次）
        """
        if self._batch_status in (BatchStatus.RUNNING, BatchStatus.CANCELLING):
            return {"success": False, "message": "批次任务正在执行中"}

        self._batch_status = BatchStatus.RUNNING
        self._cancel_requested = False
        self._batch_start_time = time.time()
        batch_size = batch_size or self.batch_size

        result = {
            "posts_processed": 0,
            "intel_created": 0,
            "intel_merged": 0,
            "not_related": 0,
            "failed": 0,
            "errors": 0,
            "cancelled": False,
            "duration": 0.0,
            "batches_executed": 0,
            "total_batches": 0,
        }

        try:
            batch_num = 0

            while not self._cancel_requested:
                # 检查最大批次限制
                if max_batches > 0 and batch_num >= max_batches:
                    logger.info(f"已达到最大批次限制 {max_batches}，停止执行")
                    _emit("info", "batch", f"已达到最大批次限制 {max_batches}，停止执行")
                    break

                # Step 1: 获取待处理帖子
                posts = self._get_pending_posts(limit=batch_size)
                if not posts:
                    logger.info(f"[批次{batch_num + 1}] 没有待处理帖子，停止执行")
                    _emit("info", "batch", f"没有待处理帖子，停止执行")
                    break

                batch_num += 1
                result["batches_executed"] = batch_num
                logger.info(f"[批次{batch_num}] 获取到 {len(posts)} 条待处理帖子")
                _emit("info", "batch_start", f"批次 {batch_num} 开始，获取到 {len(posts)} 条待处理帖子")

                # Step 2: 批量 AI 分析
                ai_results = await self._batch_ai_extract(posts)

                # Step 3: 处理每个结果
                for i, (post, ai_result) in enumerate(zip(posts, ai_results)):
                    # 检测取消标志
                    if self._cancel_requested:
                        logger.info(f"检测到取消请求，停止批次 {batch_num}，当前已处理 {result['posts_processed']} 条")
                        _emit("warn", "batch", f"检测到取消请求，停止批次 {batch_num}")
                        result["cancelled"] = True
                        self._batch_status = BatchStatus.IDLE
                        self._cancel_requested = False
                        self._last_batch_result = result
                        return result

                    try:
                        process_result = await self._process_ai_result(post, ai_result)
                        if process_result == "created":
                            result["intel_created"] += 1
                        elif process_result == "merged":
                            result["intel_merged"] += 1
                        elif process_result == "not_related":
                            result["not_related"] += 1
                        else:
                            result["failed"] += 1
                        _emit(
                            "success" if process_result in ("created", "merged") else "skip",
                            "post_processed",
                            f"{post.user_nickname}: {process_result}",
                            {"mid": post.mid, "result": process_result}
                        )
                    except Exception as e:
                        logger.error(f"处理 AI 结果失败: mid={post.mid}, error={e}")
                        result["errors"] += 1
                        _emit("error", "post_error", f"处理失败: mid={post.mid}", {"mid": post.mid, "error": str(e)})
                        # 标记帖子为失败
                        weibo_post_dao.update_intel_status(
                            post.mid, status=4, confidence=0.0,
                            extracted_info={"error": str(e)}
                        )

                    result["posts_processed"] += 1

                logger.info(f"[批次{batch_num}] 完成，已累计处理 {result['posts_processed']} 条")
                _emit("info", "batch_done", f"批次 {batch_num} 完成，累计处理 {result['posts_processed']} 条")

        except Exception as e:
            logger.error(f"AI 批次执行失败: {e}")
            _emit("error", "batch_error", f"批次执行失败: {e}")
            result["error"] = str(e)
            self._batch_status = BatchStatus.FAILED

        result["duration"] = time.time() - self._batch_start_time
        self._batch_status = BatchStatus.COMPLETED
        self._last_batch_result = result

        logger.info(
            f"AI 批次全部完成 | 总批次={result['batches_executed']} | 累计处理={result['posts_processed']} | "
            f"新建={result['intel_created']} | 合并={result['intel_merged']} | "
            f"不相关={result['not_related']} | 失败={result['failed']+result['errors']} | "
            f"耗时={result['duration']:.2f}s"
        )
        _emit(
            "success" if result["failed"] + result["errors"] == 0 else "warn",
            "batch_complete",
            f"批次全部完成，处理 {result['posts_processed']} 条，新建 {result['intel_created']}，合并 {result['intel_merged']}，不相关 {result['not_related']}，失败 {result['failed']+result['errors']}",
            result
        )

        return result

    def _get_pending_posts(self, limit: int) -> List:
        """获取待处理的微博帖子（未被 intel 关联且 intel_status=0）"""
        # 查找 intel_status=0 的帖子
        posts = weibo_post_dao.find_unanalyzed(limit=limit * 2)  # 多取一些，过滤已关联的
        logger.info(f"[_get_pending_posts] 找到 {len(posts)} 条 intel_status=0 帖子")
        result = []
        for post in posts:
            # 过滤掉已经被 intel 关联的帖子
            if not weibo_intel_dao.is_post_processed(post.mid):
                result.append(post)
                if len(result) >= limit:
                    break
        logger.info(f"[_get_pending_posts] 过滤后剩余 {len(result)} 条待处理帖子")
        return result

    def _build_batch_ai_messages(self, posts: List) -> List[Dict[str, str]]:
        """构建批量分析的 AI 消息"""
        # 构建帖子列表内容
        posts_content = []
        for i, post in enumerate(posts):
            text = self._get_post_text(post)
            posts_content.append(f"【帖子{i}】\n{text}")

        user_content = "\n\n".join(posts_content)

        return [
            {"role": "system", "content": BATCH_CATEGORY_SYSTEM_PROMPT},
            {"role": "user", "content": user_content}
        ]

    async def _batch_ai_extract(self, posts: List) -> List[Dict[str, Any]]:
        """
        批量调用 AI 提取（一次性分析所有帖子）

        Args:
            posts: 帖子列表

        Returns:
            每个帖子的 AI 分析结果（按原顺序）
        """
        logger.info(f"[_batch_ai_extract] 准备批量分析 {len(posts)} 条帖子")

        if not posts:
            return []

        # 构建批量消息
        messages = self._build_batch_ai_messages(posts)

        try:
            # 一次性调用 AI 分析所有帖子
            response = await llm_service.chat(
                messages,
                temperature=0.3,
                max_tokens=8192  # 批量需要更多 token
            )

            # 清理 AI 返回的内容（去掉可能的 markdown 代码块）
            cleaned_response = response.strip()
            if cleaned_response.startswith("```"):
                # 去掉 ```json 和最后的 ```
                lines = cleaned_response.split("\n")
                # 去掉第一行（```json）和最后一行（```）
                if lines[0].strip().startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                cleaned_response = "\n".join(lines)

            # 解析返回的 JSON 数组
            ai_results = json.loads(cleaned_response)

            if not isinstance(ai_results, list):
                logger.error(f"AI 返回不是数组格式: {type(ai_results)}")
                return [{"is_valid": False, "reason": "AI返回格式错误"} for _ in posts]

            # 验证结果数量
            if len(ai_results) != len(posts):
                logger.warning(f"AI 返回结果数量({len(ai_results)})与帖子数量({len(posts)})不匹配")

            # 按 idx 匹配结果
            results_dict = {r.get("idx", i): r for i, r in enumerate(ai_results)}

            # 按原顺序返回，确保数量一致
            final_results = []
            for i in range(len(posts)):
                if i in results_dict:
                    final_results.append(results_dict[i])
                else:
                    logger.warning(f"缺少索引 {i} 的结果，使用默认无效结果")
                    final_results.append({"is_valid": False, "reason": "AI返回缺少该条结果"})

            logger.info(f"[_batch_ai_extract] 批量分析完成，返回 {len(final_results)} 条结果")
            return final_results

        except json.JSONDecodeError as e:
            logger.error(f"解析AI返回JSON失败: {e}")
            return [{"is_valid": False, "reason": f"JSON解析失败: {e}"} for _ in posts]
        except Exception as e:
            logger.error(f"批量AI分析失败: {type(e).__name__}: {e}")
            import traceback
            logger.error(f"详细错误: {traceback.format_exc()}")
            return [{"is_valid": False, "reason": f"AI调用失败: {e}"} for _ in posts]

    async def _process_ai_result(self, post, ai_result: Dict[str, Any]) -> str:
        """
        处理单条 AI 提取结果

        Returns:
            "created" | "merged" | "not_related" | "failed"
        """
        if not ai_result.get("is_valid", False):
            weibo_post_dao.update_intel_status(
                post.mid, status=3, confidence=0.0,
                extracted_info={"reason": ai_result.get("reason", "AI判定无效")}
            )
            return "not_related"

        category = ai_result.get("category", "other")
        # 验证 category 合法性
        valid_categories = [c.value for c in IntelCategory]
        if category not in valid_categories:
            category = "other"

        title = ai_result.get("title") or "未命名事件"
        city = ai_result.get("event_city")
        start_date = ai_result.get("event_start_date") or parse_relative_date(
            ai_result.get("event_start_date_raw", "")
        )
        # 兜底：AI 未提取到日期时，用微博发布日
        if not start_date and post.created_at_dt:
            start_date = post.created_at_dt.strftime("%Y-%m-%d")
        year = int(start_date[:4]) if start_date else datetime.now().year

        # 解析日期
        end_date = ai_result.get("event_end_date")
        if not end_date and start_date:
            end_date = start_date

        # 生成 dedup hash
        dedup_hash = generate_dedup_hash(title, city, year)

        # 构建 intel 数据
        intel_data = {
            "source_post_mid": post.mid,
            "source_post_url": f"https://weibo.com/{post.user_idstr}/{post.mid}",
            "author_uid": str(post.user_idstr),
            "author_nickname": post.user_nickname,
            "category": category,
            "title": title,
            "description": ai_result.get("description"),
            "event_start_date": start_date,
            "event_end_date": end_date,
            "event_start_time": ai_result.get("event_start_time"),
            "event_location": ai_result.get("event_location"),
            "event_city": city,
            "price_info": ai_result.get("price_info"),
            "purchase_url": ai_result.get("purchase_url"),
            "publish_time": post.created_at_dt,
            "participants": self._ensure_list(ai_result.get("participants")),
            "related_ips": self._ensure_list(ai_result.get("related_ips")),
            "tags": self._ensure_list(ai_result.get("tags")),
            "cover_image": None,
            "status": IntelStatus.PENDING.value,
            "alert_type": None,
            "alert_message": None,
            "alert_resolved": False,
            "version": 1,
            "is_latest": True,
            "merged_from_ids": [],
            "parent_id": None,
            "source_posts": [{
                "mid": post.mid,
                "author_nickname": post.user_nickname,
                "author_uid": str(post.user_idstr),
                "posted_at": post.created_at_dt.isoformat() if post.created_at_dt else None,
                "linked_at": datetime.utcnow().isoformat(),
                "update_type": None,
                "is_trigger_post": True,
            }],
            "extract_method": ExtractMethod.AI.value,
            "confidence": ai_result.get("confidence", 0.5),
            "ai_model": llm_service.model,
            "ai_raw_response": ai_result,
            "dedup_hash": dedup_hash,
            "change_history": [{
                "changed_at": datetime.utcnow().isoformat(),
                "changed_by": "ai",
                "field": None,
                "old_value": None,
                "new_value": None,
                "source_post_mid": post.mid,
                "change_type": "created",
                "change_reason": "AI批次提取创建"
            }],
            "synced_to_calendar": False,
            "calendar_event_id": None,
            "first_published_at": None,
            "learned_keywords": ai_result.get("learned_keywords") or [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "approved_at": None,
            "approved_by": None,
        }

        # 去重匹配
        existing = self._find_matching_intel(dedup_hash, title, city, year)
        post_ref = SourcePostRef(
            mid=post.mid,
            author_nickname=post.user_nickname,
            author_uid=str(post.user_idstr),
            posted_at=post.created_at_dt,
            linked_at=datetime.utcnow(),
            is_trigger_post=True
        )

        if existing:
            # 合并到已有 intel
            merged = weibo_intel_dao.merge_intel(existing.id, intel_data, post_ref, changed_fields=self._detect_changes(existing, intel_data))
            if merged:
                weibo_post_dao.update_intel_status(
                    post.mid, status=1, confidence=ai_result.get("confidence", 0.5),
                    extracted_info={"intel_id": merged.id, "merged": True}
                )
                return "merged"
            return "failed"
        else:
            # 创建新 intel
            intel = WeiboIntel(**intel_data)
            weibo_intel_dao.create(intel)
            weibo_post_dao.update_intel_status(
                post.mid, status=1, confidence=ai_result.get("confidence", 0.5),
                extracted_info={"intel_id": intel.id, "merged": False}
            )

            # 如果有 learned_keywords，添加到候选关键词库
            if intel_data.get("learned_keywords"):
                self._add_keyword_candidates(intel.id, category, intel_data["learned_keywords"], title)

            return "created"

    def _find_matching_intel(
        self,
        dedup_hash: str,
        title: str,
        city: Optional[str],
        year: int
    ) -> Optional[WeiboIntel]:
        """查找匹配的情报（去重）"""
        # 1. 精确 dedup_hash 匹配
        candidates = weibo_intel_dao.find_by_dedup_hash(dedup_hash)
        if candidates:
            return candidates[0]

        # 2. 模糊匹配（标题相似度）
        similar = weibo_intel_dao.find_similar(title, city, year, limit=20)
        for intel in similar:
            sim_score = self._calculate_similarity(title, intel.title)
            # 降低阈值到 0.7，更容易触发去重合并
            if sim_score > 0.7:
                return intel
            # 部分匹配：相似度 > 0.5 + 城市一致 + 日期重叠
            if sim_score > 0.5 and intel.event_city == city:
                if self._dates_overlap(intel, year):
                    return intel

        return None

    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """简单相似度计算（基于字符集合交集）"""
        if not text1 or not text2:
            return 0.0
        set1 = set(normalize_text(text1))
        set2 = set(normalize_text(text2))
        if not set1 or not set2:
            return 0.0
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        return intersection / union if union > 0 else 0.0

    def _dates_overlap(self, intel: WeiboIntel, year: int) -> bool:
        """检查日期是否重叠（宽松判断：同一年且跨度有交集）"""
        if not intel.event_start_date:
            return False
        # 简单处理：只要年份相同就认为有重叠可能
        return str(year) == intel.event_start_date[:4]

    def _detect_changes(self, existing: WeiboIntel, new_data: Dict[str, Any]) -> List[str]:
        """检测哪些字段发生了变化"""
        changed = []
        fields_to_check = [
            "event_start_date", "event_end_date", "event_location",
            "event_city", "price_info", "participants", "related_ips"
        ]
        for field in fields_to_check:
            old_val = getattr(existing, field, None)
            new_val = new_data.get(field)
            if old_val != new_val and (old_val or new_val):
                changed.append(field)
        return changed

    def _add_keyword_candidates(
        self,
        intel_id: str,
        category: str,
        keywords: List[str],
        title: str
    ):
        """将 AI 学习到的关键词添加到候选库"""
        try:
            for kw in keywords[:5]:  # 最多5个
                candidate_data = {
                    "category": category,
                    "keyword": kw,
                    "source_intel_id": intel_id,
                    "source_text_snippet": f"从「{title}」中学到",
                    "confidence": 0.5,
                    "status": "pending",
                }
                from app.models.category_keywords import KeywordCandidate
                candidate = KeywordCandidate(**candidate_data)
                category_keywords_dao.add_candidate(candidate)
        except Exception as e:
            logger.warning(f"添加候选关键词失败: {e}")

    # ==================== 审核操作 ====================

    def approve_intel(
        self,
        intel_id: str,
        approved_by: str = "admin"
    ) -> Optional[WeiboIntel]:
        """批准情报（审核通过）"""
        intel = weibo_intel_dao.find_by_id(intel_id)
        if not intel:
            return None

        # 更新状态
        weibo_intel_dao.update_status(intel_id, IntelStatus.APPROVED)

        # 添加变更记录
        change = IntelChange(
            changed_at=datetime.utcnow(),
            changed_by=approved_by,
            field="status",
            old_value=IntelStatus.PENDING.value,
            new_value=IntelStatus.APPROVED.value,
            change_type="approved"
        )
        weibo_intel_dao.add_change_record(intel_id, change)

        # WeiboIntel 直接作为 H5 日历数据源，无需同步到 ExpoEvent
        return weibo_intel_dao.find_by_id(intel_id)

    def reject_intel(
        self,
        intel_id: str,
        rejected_by: str = "admin",
        reason: Optional[str] = None
    ) -> Optional[WeiboIntel]:
        """拒绝情报"""
        intel = weibo_intel_dao.find_by_id(intel_id)
        if not intel:
            return None

        weibo_intel_dao.update_status(intel_id, IntelStatus.REJECTED)

        change = IntelChange(
            changed_at=datetime.utcnow(),
            changed_by=rejected_by,
            field="status",
            old_value=IntelStatus.PENDING.value,
            new_value=IntelStatus.REJECTED.value,
            change_type="rejected",
            change_reason=reason
        )
        weibo_intel_dao.add_change_record(intel_id, change)

        return weibo_intel_dao.find_by_id(intel_id)

    def batch_approve(
        self,
        intel_ids: List[str],
        approved_by: str = "admin"
    ) -> int:
        """批量批准"""
        count = weibo_intel_dao.batch_update_status(intel_ids, IntelStatus.APPROVED)
        # WeiboIntel 直接作为 H5 日历数据源，无需同步到 ExpoEvent
        return count

    def batch_reject(
        self,
        intel_ids: List[str],
        rejected_by: str = "admin"
    ) -> int:
        """批量拒绝"""
        return weibo_intel_dao.batch_update_status(intel_ids, IntelStatus.REJECTED)

    # ==================== 日历同步 ====================

    def _sync_to_calendar(self, intel_id: str) -> Optional[str]:
        """
        将情报同步到日历数据库（expo_events）

        Returns:
            calendar_event_id 或 None
        """
        intel = weibo_intel_dao.find_by_id(intel_id)
        if not intel:
            return None

        # 生成 event_id
        year = int(intel.event_start_date[:4]) if intel.event_start_date else datetime.now().year
        event_id = generate_event_id(intel.title, year)

        # 检查是否已存在
        existing_event = expo_event_dao.find_by_event_id(event_id)

        if existing_event:
            # 更新已有活动
            update_data = {
                "dates": {
                    "start": intel.event_start_date,
                    "end": intel.event_end_date or intel.event_start_date
                } if intel.event_start_date else None,
                "location": intel.event_location,
                "city": intel.event_city,
                "latest_update_at": datetime.utcnow(),
                "latest_update_type": UpdateType.ANNOUNCEMENT,
            }
            expo_event_dao.update(event_id, update_data)
            expo_event_dao.add_post_to_event(
                event_id=event_id,
                post_id=intel.source_post_mid,
                update_type=UpdateType.ANNOUNCEMENT,
                summary=f"[情报批准] {intel.title}",
                is_important=False
            )
        else:
            # 创建新活动
            event = ExpoEvent(
                event_id=event_id,
                name=intel.title,
                year=year,
                dates={
                    "start": intel.event_start_date,
                    "end": intel.event_end_date or intel.event_start_date
                } if intel.event_start_date else None,
                location=intel.event_location,
                city=intel.event_city,
                ticket_info=intel.price_info,
                ips=intel.related_ips,
                guests=intel.participants,
                keywords=intel.tags,
                source_posts=[intel.source_post_mid],
                post_count=1,
                latest_update_at=datetime.utcnow(),
                latest_update_type=UpdateType.ANNOUNCEMENT,
                update_history=[{
                    "post_id": intel.source_post_mid,
                    "posted_at": datetime.utcnow().isoformat(),
                    "update_type": UpdateType.ANNOUNCEMENT.value,
                    "summary": f"[情报批准] {intel.title}",
                    "has_important_update": False
                }],
                crawl_source="weibo_intel"
            )
            try:
                expo_event_dao.create(event)
            except Exception as e:
                logger.warning(f"创建日历事件失败: {e}")

        # 标记 intel 已同步
        weibo_intel_dao.mark_synced(intel_id, event_id)
        return event_id

    # ==================== 统计 ====================

    def get_stats(self) -> Dict[str, Any]:
        """获取情报统计"""
        from app.models.weibo_intel import IntelStats

        total = weibo_intel_dao.count()
        pending = weibo_intel_dao.count(status=IntelStatus.PENDING.value)
        approved = weibo_intel_dao.count(status=IntelStatus.APPROVED.value)
        rejected = weibo_intel_dao.count(status=IntelStatus.REJECTED.value)
        has_alert = weibo_intel_dao.count_has_alert()
        synced = weibo_intel_dao.count_synced()
        by_category = weibo_intel_dao.count_by_category()
        today_new = weibo_intel_dao.count_today_new()

        # 待提取帖子数
        pending_posts = weibo_post_dao.count_unanalyzed()

        return {
            "intel": {
                "total": total,
                "pending": pending,
                "approved": approved,
                "rejected": rejected,
                "has_alert": has_alert,
                "synced_to_calendar": synced,
                "by_category": by_category,
                "today_new": today_new,
            },
            "pending_posts": pending_posts,
            "batch_status": self._batch_status.value,
            "last_batch_result": self._last_batch_result,
            "scheduler_enabled": self._scheduler_enabled,
            "scheduler_interval": self._scheduler_interval,
        }

    def get_post_count_by_status(self) -> Dict[str, int]:
        """获取各情报状态的帖子数量统计"""
        return {
            "total": weibo_post_dao.count(),
            "0": weibo_post_dao.count_unanalyzed(),  # 待处理
            "1": weibo_post_dao.count_by_status(status=1),  # 已提取
            "2": weibo_post_dao.count_ai_pending(),  # 不相关
            "3": weibo_post_dao.count_by_status(status=3),  # 待审核
            "4": weibo_post_dao.count_by_status(status=4),  # 失败
        }

    def cancel_batch(self) -> Dict[str, Any]:
        """请求取消正在执行的批次（设置取消标志，批次在下一次循环检测时停止）"""
        if self._batch_status != BatchStatus.RUNNING:
            return {"success": False, "message": "没有正在执行的批次任务"}

        self._batch_status = BatchStatus.CANCELLING
        self._cancel_requested = True
        return {"success": True, "message": "已发送取消请求，批次将在当前帖子处理完成后停止"}

    # ==================== 调度器控制 ====================

    def start_scheduler(self, interval: Optional[int] = None) -> Dict[str, Any]:
        """
        启动后台调度器，自动定时执行批次提取

        Args:
            interval: 调度间隔（秒），默认 60 秒

        Returns:
            启动结果
        """
        with self._scheduler_lock:
            if self._scheduler_enabled:
                return {"success": False, "message": "调度器已经在运行中"}

            if interval:
                self._scheduler_interval = max(10, interval)  # 最小 10 秒

            self._scheduler_enabled = True
            self._scheduler_thread = threading.Thread(
                target=self._scheduler_loop,
                daemon=True,
                name="WeiboIntelScheduler"
            )
            self._scheduler_thread.start()

            logger.info(f"[调度器] 已启动，间隔 {self._scheduler_interval} 秒")
            return {
                "success": True,
                "message": f"调度器已启动，间隔 {self._scheduler_interval} 秒",
                "interval": self._scheduler_interval
            }

    def stop_scheduler(self) -> Dict[str, Any]:
        """
        停止后台调度器

        Returns:
            停止结果
        """
        with self._scheduler_lock:
            if not self._scheduler_enabled:
                return {"success": False, "message": "调度器未在运行"}

            self._scheduler_enabled = False
            # 线程会在下一轮检测到 enabled=False 后退出
            logger.info("[调度器] 已发送停止请求")

            return {"success": True, "message": "调度器已停止"}

    def set_scheduler_interval(self, interval: int) -> Dict[str, Any]:
        """设置调度间隔（秒）"""
        if interval < 10:
            return {"success": False, "message": "间隔不能小于 10 秒"}

        with self._scheduler_lock:
            self._scheduler_interval = interval
            return {"success": True, "message": f"调度间隔已更新为 {interval} 秒", "interval": interval}

    def _scheduler_loop(self):
        """调度器主循环（在独立线程中运行）"""
        logger.info("[调度器] 调度循环开始")
        _emit("info", "scheduler", "调度器启动")

        while self._scheduler_enabled:
            try:
                # 检查是否有待处理帖子
                pending_posts = weibo_post_dao.count_unanalyzed()
                if pending_posts > 0 and self._batch_status == BatchStatus.IDLE:
                    logger.info(f"[调度器] 检测到 {pending_posts} 条待处理帖子，触发批次执行")
                    _emit("info", "scheduler", f"检测到 {pending_posts} 条待处理帖子，触发批次执行")

                    # 在线程中执行异步批次任务
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    try:
                        max_batches = system_config_dao.get_config().intel_config.max_batches_per_run
                        result = loop.run_until_complete(
                            self.run_ai_batch(max_batches=max_batches)
                        )
                        logger.info(f"[调度器] 批次执行完成: {result}")
                    except Exception as e:
                        logger.error(f"[调度器] 批次执行失败: {e}")
                        _emit("error", "scheduler", f"批次执行失败: {e}")
                    finally:
                        loop.close()
                else:
                    logger.debug(f"[调度器] 当前待处理帖子: {pending_posts}, 批次状态: {self._batch_status}")

            except Exception as e:
                logger.error(f"[调度器] 执行出错: {e}")
                _emit("error", "scheduler", f"调度器执行出错: {e}")

            # 分段睡眠，每秒检查一次退出标志
            for _ in range(self._scheduler_interval):
                if not self._scheduler_enabled:
                    break
                time.sleep(1)

        logger.info("[调度器] 调度循环已退出")
        _emit("info", "scheduler", "调度器已停止")


    # ==================== 单帖提取（管理端手动触发） ====================

    async def extract_single(self, mid: str) -> Dict[str, Any]:
        """
        对单个帖子触发 AI 提取，返回提取结果（不创建情报）

        Returns:
            SingleExtractResult 字典
        """
        from app.models.weibo_intel import SingleExtractResult

        post = weibo_post_dao.find_by_mid(mid)
        if not post:
            return SingleExtractResult(
                mid=mid,
                is_valid=False,
                reason="帖子不存在"
            ).model_dump()

        text = self._get_post_text(post)
        if not text or len(text) < 10:
            return SingleExtractResult(
                mid=mid,
                is_valid=False,
                reason="帖子内容过短"
            ).model_dump()

        try:
            messages = self._build_ai_messages(text)
            response = await llm_service.chat(messages, temperature=0.3, max_tokens=1024)
            ai_result = json.loads(response)

            if not ai_result.get("is_valid", False):
                return SingleExtractResult(
                    mid=mid,
                    is_valid=False,
                    reason=ai_result.get("reason", "AI判定无效"),
                ).model_dump()

            # 解析日期
            start_date = ai_result.get("event_start_date") or parse_relative_date(
                ai_result.get("event_start_date_raw", "")
            )
            # 兜底：AI 未提取到日期时，用微博发布日
            if not start_date and post.created_at_dt:
                start_date = post.created_at_dt.strftime("%Y-%m-%d")
            end_date = ai_result.get("event_end_date") or start_date

            return SingleExtractResult(
                mid=mid,
                is_valid=True,
                category=ai_result.get("category", "other"),
                title=ai_result.get("title") or "未命名事件",
                event_start_date=start_date,
                event_end_date=end_date,
                event_start_time=ai_result.get("event_start_time"),
                event_location=ai_result.get("event_location"),
                event_city=ai_result.get("event_city"),
                price_info=ai_result.get("price_info"),
                participants=ai_result.get("participants") or [],
                related_ips=ai_result.get("related_ips") or [],
                tags=ai_result.get("tags") or [],
                description=ai_result.get("description"),
                confidence=ai_result.get("confidence", 0.5),
                learned_keywords=ai_result.get("learned_keywords") or [],
            ).model_dump()

        except json.JSONDecodeError as e:
            return SingleExtractResult(
                mid=mid,
                is_valid=False,
                reason=f"AI返回格式错误: {e}"
            ).model_dump()
        except Exception as e:
            return SingleExtractResult(
                mid=mid,
                is_valid=False,
                reason=f"提取失败: {e}"
            ).model_dump()

    def create_from_extract(self, mid: str, data: Dict[str, Any], confidence: float = 0.5) -> Optional[WeiboIntel]:
        """
        根据提取结果创建情报记录，并标记帖子

        Args:
            mid: 帖子 MID
            data: 提取结果字段（category/title/date/location 等）
            confidence: 置信度

        Returns:
            创建的 WeiboIntel 或 None
        """
        post = weibo_post_dao.find_by_mid(mid)
        if not post:
            logger.warning(f"创建情报失败，帖子不存在: mid={mid}")
            return None

        # 如果已经有关联的 intel，不重复创建
        if weibo_intel_dao.is_post_processed(mid):
            logger.info(f"帖子已被 intel 关联，跳过创建: mid={mid}")
            return weibo_intel_dao.find_by_mid(mid)

        title = data.get("title") or "未命名事件"
        city = data.get("event_city")
        start_date = data.get("event_start_date")
        # 兜底：AI 未提取到日期时，用微博发布日
        if not start_date and post.created_at_dt:
            start_date = post.created_at_dt.strftime("%Y-%m-%d")

        year = int(start_date[:4]) if start_date else datetime.now().year
        dedup_hash = generate_dedup_hash(title, city, year)

        # 检查去重
        existing = self._find_matching_intel(dedup_hash, title, city, year)
        post_ref = SourcePostRef(
            mid=mid,
            author_nickname=post.user_nickname,
            author_uid=str(post.user_idstr),
            posted_at=post.created_at_dt,
            linked_at=datetime.utcnow(),
            is_trigger_post=True
        )

        if existing:
            # 合并到已有 intel
            intel_data = {
                "title": data.get("title"),
                "category": data.get("category"),
                "event_start_date": start_date,
                "event_end_date": data.get("event_end_date") or start_date,
                "event_location": data.get("event_location"),
                "event_city": data.get("event_city"),
                "price_info": data.get("price_info"),
                "participants": data.get("participants") or [],
                "related_ips": data.get("related_ips") or [],
                "tags": data.get("tags") or [],
                "confidence": confidence,
                "extract_method": ExtractMethod.MANUAL.value,
                "ai_raw_response": {"source": "create_from_extract", "original_data": data},
            }
            changed_fields = self._detect_changes(existing, intel_data)
            merged = weibo_intel_dao.merge_intel(existing.id, intel_data, post_ref, changed_fields)
            if merged:
                weibo_post_dao.update_intel_status(
                    mid, status=1, confidence=confidence,
                    extracted_info={"intel_id": merged.id, "merged": True}
                )
            return merged

        # 创建新 intel
        intel_data = {
            "source_post_mid": mid,
            "source_post_url": f"https://weibo.com/{post.user_idstr}/{post.mid}",
            "author_uid": str(post.user_idstr),
            "author_nickname": post.user_nickname,
            "category": data.get("category", "other"),
            "title": title,
            "description": data.get("description"),
            "event_start_date": data.get("event_start_date"),
            "event_end_date": data.get("event_end_date"),
            "event_start_time": data.get("event_start_time"),
            "event_location": data.get("event_location"),
            "event_city": city,
            "price_info": data.get("price_info"),
            "purchase_url": data.get("purchase_url"),
            "publish_time": post.created_at_dt,
            "participants": self._ensure_list(data.get("participants")),
            "related_ips": self._ensure_list(data.get("related_ips")),
            "tags": self._ensure_list(data.get("tags")),
            "cover_image": None,
            "status": IntelStatus.PENDING.value,
            "alert_type": None,
            "alert_message": None,
            "alert_resolved": False,
            "version": 1,
            "is_latest": True,
            "merged_from_ids": [],
            "parent_id": None,
            "source_posts": [{
                "mid": mid,
                "author_nickname": post.user_nickname,
                "author_uid": str(post.user_idstr),
                "posted_at": post.created_at_dt.isoformat() if post.created_at_dt else None,
                "linked_at": datetime.utcnow().isoformat(),
                "update_type": None,
                "is_trigger_post": True,
            }],
            "extract_method": ExtractMethod.MANUAL.value,
            "confidence": confidence,
            "ai_model": None,
            "ai_raw_response": {"source": "create_from_extract", "original_data": data},
            "dedup_hash": dedup_hash,
            "change_history": [{
                "changed_at": datetime.utcnow().isoformat(),
                "changed_by": "manual",
                "field": None,
                "old_value": None,
                "new_value": None,
                "source_post_mid": mid,
                "change_type": "created",
                "change_reason": "手动确认提取结果创建"
            }],
            "synced_to_calendar": False,
            "calendar_event_id": None,
            "first_published_at": None,
            "learned_keywords": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "approved_at": None,
            "approved_by": None,
        }

        intel = WeiboIntel(**intel_data)
        weibo_intel_dao.create(intel)
        weibo_post_dao.update_intel_status(
            mid, status=1, confidence=confidence,
            extracted_info={"intel_id": intel.id, "merged": False}
        )

        # 如果有 learned_keywords，添加到候选关键词库
        if data.get("learned_keywords"):
            self._add_keyword_candidates(intel.id, data.get("category", "other"), data["learned_keywords"], title)

        return intel

    def mark_not_related(self, mid: str) -> bool:
        """标记帖子为不相关"""
        post = weibo_post_dao.find_by_mid(mid)
        if not post:
            return False
        return weibo_post_dao.update_intel_status(
            mid, status=3, confidence=0.0,
            extracted_info={"reason": "人工标记不相关"}
        )

    def mark_extracting(self, mid: str) -> bool:
        """标记帖子正在提取中"""
        return weibo_post_dao.update_intel_status(
            mid, status=2, confidence=0.0,
            extracted_info={"reason": "AI提取中"}
        )


# 全局实例
weibo_intel_service = WeiboIntelService(batch_size=20)
