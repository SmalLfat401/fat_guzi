"""
热点追踪监控服务 - Intel Monitor
后台异步任务，定期扫描未分析的微博帖子，提取漫展活动信息

两阶段提取架构：
  阶段一（定时）：规则提取，轻量快速，将帖子分流为 1/2/3 状态
  阶段二（批次）：AI介入处理，仅处理状态=2的帖子，更新为 1/3/4 状态
"""
import time
import threading
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

from app.database.weibo_post_dao import weibo_post_dao
from app.database.expo_event_dao import expo_event_dao, generate_event_id
from app.models.weibo_post import WeiboPost, IntelStatus
from app.models.expo_event import ExpoEvent, EventStatus, UpdateType
from app.services.expo_extractor import expo_extractor

logger = logging.getLogger(__name__)


class MonitorStatus(str, Enum):
    """监控状态"""
    STOPPED = "stopped"
    RUNNING = "running"
    PAUSED = "paused"


class IntelMonitor:
    """
    热点追踪监控器

    工作流程：
    【阶段一 - 规则提取（定时触发）】
      1. 扫描 intel_status=0 的帖子
      2. 规则匹配，匹配置信度≥0.4 → status=1（提取成功），需AI补充 → status=2（AI待介入），不相关 → status=3
      3. 循环执行

    【阶段二 - AI批次处理（手动/定时触发）】
      4. 扫描 intel_status=2 的帖子
      5. AI辅助提取，更新状态为 1（AI成功）/3（不相关）/4（处理异常）
    """

    def __init__(
        self,
        rule_interval_minutes: int = 10,
        ai_interval_minutes: int = 30,
        rule_batch_size: int = 50,
        ai_batch_size: int = 20,
        use_ai: bool = True,
        target_uids: Optional[List[str]] = None
    ):
        """
        Args:
            rule_interval_minutes: 规则提取间隔（分钟）
            ai_interval_minutes: AI批次处理间隔（分钟）
            rule_batch_size: 规则提取批次大小
            ai_batch_size: AI处理批次大小
            use_ai: 是否启用AI辅助提取
            target_uids: 可选，限定分析特定用户发布的帖子
        """
        self.rule_interval_seconds = rule_interval_minutes * 60
        self.ai_interval_seconds = ai_interval_minutes * 60
        self.rule_batch_size = rule_batch_size
        self.ai_batch_size = ai_batch_size
        self.use_ai = use_ai
        self.target_uids = target_uids

        self._status = MonitorStatus.STOPPED
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

        # 统计信息
        self._stats = {
            "rule_runs": 0,
            "total_rule_processed": 0,
            "total_rule_success": 0,       # status=1
            "total_ai_pending": 0,          # status=2
            "total_not_related": 0,         # status=3
            "total_failed": 0,              # status=4
            "ai_runs": 0,
            "total_ai_processed": 0,
            "total_ai_success": 0,
            "total_ai_failed": 0,
            "total_events_created": 0,
            "total_events_updated": 0,
            "last_rule_run_at": None,
            "last_rule_run_duration": 0.0,
            "last_ai_run_at": None,
            "last_ai_run_duration": 0.0,
        }

    @property
    def status(self) -> MonitorStatus:
        """当前监控状态"""
        return self._status

    @property
    def stats(self) -> Dict[str, Any]:
        """监控统计信息"""
        return {
            **self._stats,
            "status": self._status.value,
            "rule_interval_seconds": self.rule_interval_seconds,
            "ai_interval_seconds": self.ai_interval_seconds,
            "rule_batch_size": self.rule_batch_size,
            "ai_batch_size": self.ai_batch_size,
            "ai_enabled": self.use_ai,
            "pending_rule_posts": weibo_post_dao.count_unanalyzed(self.target_uids),
            "pending_ai_posts": weibo_post_dao.count_ai_pending(self.target_uids),
        }

    def start(self, blocking: bool = False):
        """
        启动监控

        Args:
            blocking: 是否阻塞主线程。如果为 True，会一直运行直到调用 stop()
        """
        if self._status == MonitorStatus.RUNNING:
            logger.warning("IntelMonitor 已经在运行中")
            return

        self._status = MonitorStatus.RUNNING
        self._stop_event.clear()

        if blocking:
            self._run_loop()
        else:
            self._thread = threading.Thread(target=self._run_loop, daemon=True, name="IntelMonitor")
            self._thread.start()

        logger.info(
            f"IntelMonitor 启动成功 | "
            f"规则提取间隔={self.rule_interval_seconds}s | "
            f"AI批次间隔={self.ai_interval_seconds}s | "
            f"规则批次={self.rule_batch_size} | "
            f"AI批次={self.ai_batch_size} | "
            f"AI={'启用' if self.use_ai else '禁用'}"
        )

    def stop(self):
        """停止监控"""
        if self._status == MonitorStatus.STOPPED:
            return

        self._status = MonitorStatus.STOPPED
        self._stop_event.set()

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)

        logger.info("IntelMonitor 已停止")

    def pause(self):
        """暂停监控"""
        if self._status == MonitorStatus.RUNNING:
            self._status = MonitorStatus.PAUSED
            logger.info("IntelMonitor 已暂停")

    def resume(self):
        """恢复监控"""
        if self._status == MonitorStatus.PAUSED:
            self._status = MonitorStatus.RUNNING
            self._stop_event.set()  # 唤醒等待中的循环
            logger.info("IntelMonitor 已恢复")

    def run_once(self) -> Dict[str, Any]:
        """
        阶段一：执行一次规则提取（不依赖定时器）

        Returns:
            本次执行结果统计
        """
        logger.info("【阶段一】开始执行规则提取...")
        start_time = time.time()

        result = {
            "posts_processed": 0,
            "rule_success": 0,      # status=1
            "ai_pending": 0,         # status=2
            "not_related": 0,        # status=3
            "failed": 0,             # status=4
            "errors": 0,
            "duration": 0.0
        }

        try:
            posts = weibo_post_dao.find_unanalyzed(
                limit=self.rule_batch_size,
                source_uids=self.target_uids
            )
            result["posts_processed"] = len(posts)

            logger.info(f"获取到 {len(posts)} 条未分析帖子")

            for post in posts:
                try:
                    status = self._process_post_rule(post)
                    if status == IntelStatus.SUCCESS:
                        result["rule_success"] += 1
                    elif status == IntelStatus.AI_PENDING:
                        result["ai_pending"] += 1
                    elif status == IntelStatus.NOT_RELATED:
                        result["not_related"] += 1
                    elif status == IntelStatus.FAILED:
                        result["failed"] += 1
                except Exception as e:
                    logger.error(f"处理帖子失败: mid={post.mid}, error={e}")
                    result["errors"] += 1

        except Exception as e:
            logger.error(f"执行规则提取任务失败: {e}")

        result["duration"] = time.time() - start_time
        self._stats["rule_runs"] += 1
        self._stats["total_rule_processed"] += result["posts_processed"]
        self._stats["total_rule_success"] += result["rule_success"]
        self._stats["total_ai_pending"] += result["ai_pending"]
        self._stats["total_not_related"] += result["not_related"]
        self._stats["total_failed"] += result["failed"]
        self._stats["last_rule_run_at"] = datetime.utcnow()
        self._stats["last_rule_run_duration"] = result["duration"]

        logger.info(
            f"【阶段一】规则提取完成 | "
            f"处理={result['posts_processed']} | "
            f"成功={result['rule_success']} | "
            f"待AI={result['ai_pending']} | "
            f"不相关={result['not_related']} | "
            f"异常={result['failed']} | "
            f"耗时={result['duration']:.2f}s"
        )

        return result

    def run_ai_batch(self, batch_size: int = None) -> Dict[str, Any]:
        """
        阶段二：执行一次AI批次处理（处理 intel_status=2 的帖子）

        Args:
            batch_size: 本次批次大小，默认使用 self.ai_batch_size

        Returns:
            本次执行结果统计
        """
        if not self.use_ai:
            return {"success": False, "message": "AI辅助已禁用"}

        batch_size = batch_size or self.ai_batch_size
        logger.info(f"【阶段二】开始执行AI批次处理，批次={batch_size}...")
        start_time = time.time()

        result = {
            "posts_processed": 0,
            "ai_success": 0,     # status=1
            "not_related": 0,    # status=3
            "failed": 0,          # status=4
            "errors": 0,
            "duration": 0.0
        }

        try:
            posts = weibo_post_dao.find_ai_pending(
                limit=batch_size,
                source_uids=self.target_uids
            )
            result["posts_processed"] = len(posts)

            logger.info(f"获取到 {len(posts)} 条待AI处理帖子")

            for post in posts:
                try:
                    status = self._process_post_ai(post)
                    if status == IntelStatus.SUCCESS:
                        result["ai_success"] += 1
                    elif status == IntelStatus.NOT_RELATED:
                        result["not_related"] += 1
                    elif status == IntelStatus.FAILED:
                        result["failed"] += 1
                except Exception as e:
                    logger.error(f"AI处理帖子失败: mid={post.mid}, error={e}")
                    result["errors"] += 1

        except Exception as e:
            logger.error(f"执行AI批次处理失败: {e}")

        result["duration"] = time.time() - start_time
        self._stats["ai_runs"] += 1
        self._stats["total_ai_processed"] += result["posts_processed"]
        self._stats["total_ai_success"] += result["ai_success"]
        self._stats["total_ai_failed"] += result["failed"]
        self._stats["last_ai_run_at"] = datetime.utcnow()
        self._stats["last_ai_run_duration"] = result["duration"]

        logger.info(
            f"【阶段二】AI批次处理完成 | "
            f"处理={result['posts_processed']} | "
            f"成功={result['ai_success']} | "
            f"不相关={result['not_related']} | "
            f"失败={result['failed']} | "
            f"耗时={result['duration']:.2f}s"
        )

        return result

    def _run_loop(self):
        """后台运行循环"""
        last_ai_run = 0  # 上次AI批次运行时间

        while not self._stop_event.is_set():
            if self._status == MonitorStatus.RUNNING:
                # 阶段一：规则提取（每次循环都执行）
                self.run_once()

                # 阶段二：AI批次处理（按间隔触发）
                if self.use_ai:
                    now = time.time()
                    if now - last_ai_run >= self.ai_interval_seconds:
                        self.run_ai_batch()
                        last_ai_run = now

            elif self._status == MonitorStatus.PAUSED:
                self._stop_event.wait(timeout=5)
                continue

            # 等待下一个规则提取周期
            self._stop_event.wait(timeout=self.rule_interval_seconds)

    def _process_post_rule(self, post: WeiboPost) -> IntelStatus:
        """
        【阶段一】规则提取

        对帖子进行规则匹配，根据置信度标记状态：
          - 置信度≥0.4，规则直接命中 → status=1（提取成功）
          - 置信度<0.4，需要AI介入 → status=2（AI待介入）
          - 不匹配任何漫展关键词 → status=3（确认不相关）

        Returns:
            IntelStatus: 1/2/3
        """
        # Step 1: 规则提取
        extract_result = expo_extractor.extract(post)

        # 标记不相关
        if not extract_result["is_expo_related"]:
            weibo_post_dao.update_intel_status(
                post.mid,
                status=IntelStatus.NOT_RELATED,
                confidence=extract_result.get("confidence", 0),
                extracted_info={"reason": extract_result.get("reason")}
            )
            return IntelStatus.NOT_RELATED

        confidence = extract_result.get("confidence", 0)
        is_high_confidence = confidence >= 0.4

        # Step 2a: 高置信度 → 直接成功，提取信息写入 expo_events
        if is_high_confidence:
            final_result = self._build_extract_result(post, extract_result)
            event_id = self._find_or_create_event(final_result)
            if event_id:
                self._update_event(event_id, final_result, post)
                self._add_post_to_event(event_id, post, final_result)

            weibo_post_dao.update_intel_status(
                post.mid,
                status=IntelStatus.SUCCESS,
                confidence=confidence,
                extracted_info=final_result
            )
            return IntelStatus.SUCCESS

        # Step 2b: 低置信度 → 标记为AI待介入
        weibo_post_dao.update_intel_status(
            post.mid,
            status=IntelStatus.AI_PENDING,
            confidence=confidence,
            extracted_info=extract_result
        )
        return IntelStatus.AI_PENDING

    def _process_post_ai(self, post: WeiboPost) -> IntelStatus:
        """
        【阶段二】AI批次处理

        处理 intel_status=2 的帖子，调用AI辅助提取，
        更新状态为 1（AI成功）/3（不相关）/4（处理异常）

        Returns:
            IntelStatus: 1/3/4
        """
        # 读取之前规则提取的中间结果
        prev_info = post.intel_extracted_info or {}
        confidence = post.intel_confidence or 0

        try:
            # 调用AI辅助提取（同步封装，兼容后台线程）
            extract_result = expo_extractor.extract_with_ai_sync(post, prev_info)

            # AI判定为不相关
            if not extract_result.get("is_expo_related", False):
                weibo_post_dao.update_intel_status(
                    post.mid,
                    status=IntelStatus.NOT_RELATED,
                    confidence=extract_result.get("confidence", 0),
                    extracted_info=extract_result
                )
                return IntelStatus.NOT_RELATED

            # AI提取成功
            final_result = self._build_extract_result(post, extract_result)
            event_id = self._find_or_create_event(final_result)
            if event_id:
                self._update_event(event_id, final_result, post)
                self._add_post_to_event(event_id, post, final_result)

            new_confidence = extract_result.get("confidence", confidence)
            weibo_post_dao.update_intel_status(
                post.mid,
                status=IntelStatus.SUCCESS,
                confidence=new_confidence,
                extracted_info=final_result
            )
            self._stats["total_events_created"] += 1
            return IntelStatus.SUCCESS

        except Exception as e:
            logger.error(f"AI处理帖子异常: mid={post.mid}, error={e}")
            weibo_post_dao.update_intel_status(
                post.mid,
                status=IntelStatus.FAILED,
                confidence=confidence,
                extracted_info={"error": str(e)}
            )
            return IntelStatus.FAILED

    def _build_extract_result(self, post: WeiboPost, extract_result: Dict[str, Any]) -> Dict[str, Any]:
        """构建标准化的提取结果"""
        return {
            "post_mid": post.mid,
            "event_name": extract_result.get("event_name"),
            "dates": extract_result.get("dates"),
            "location": extract_result.get("location"),
            "ticket_info": extract_result.get("ticket_info"),
            "ips": extract_result.get("ips", []),
            "guests": extract_result.get("guests", []),
            "is_important_update": extract_result.get("is_important_update", False),
            "update_type": extract_result.get("update_type"),
            "update_summary": extract_result.get("update_summary"),
            "confidence": extract_result.get("confidence", 0)
        }

    def _add_post_to_event(self, event_id: str, post: WeiboPost, final_result: Dict[str, Any]):
        """追加帖子到活动（带防护，避免未定义变量bug）"""
        try:
            expo_event_dao.add_post_to_event(
                event_id=event_id,
                post_id=post.mid,
                update_type=final_result.get("update_type"),
                summary=final_result.get("update_summary", ""),
                is_important=final_result.get("is_important_update", False),
                new_ips=final_result.get("ips", []),
                new_guests=final_result.get("guests", [])
            )
        except Exception as e:
            logger.warning(f"追加帖子到活动失败: event_id={event_id}, mid={post.mid}, error={e}")

    def _find_or_create_event(self, data: Dict[str, Any]) -> Optional[str]:
        """查找或创建活动"""
        event_name = data.get("event_name")
        if not event_name:
            return None

        dates = data.get("dates", {})
        year = None
        if dates:
            start_date = dates.get("start", "")
            if start_date:
                year = int(start_date[:4])

        event_id = generate_event_id(event_name, year)

        # 检查是否已存在
        existing = expo_event_dao.find_by_event_id(event_id)
        if existing:
            return event_id

        # 创建新活动
        event = ExpoEvent(
            event_id=event_id,
            name=event_name,
            year=year,
            dates=dates,
            location=data.get("location"),
            ticket_info=data.get("ticket_info"),
            ips=data.get("ips", []),
            guests=data.get("guests", []),
            latest_update_at=datetime.utcnow(),
            latest_post_at=datetime.utcnow(),
            latest_update_type=data.get("update_type"),
            has_important_update=data.get("is_important_update", False),
            key_info=data.get("update_summary") if data.get("is_important_update") else None,
            update_history=[{
                "post_id": data.get("post_mid"),
                "posted_at": datetime.utcnow().isoformat(),
                "update_type": data.get("update_type"),
                "summary": data.get("update_summary"),
                "has_important_update": data.get("is_important_update", False)
            }],
            source_posts=[data.get("post_mid")] if data.get("post_mid") else [],
            post_count=1
        )

        try:
            expo_event_dao.create(event)
            logger.info(f"创建新活动: event_id={event_id}, name={event_name}")
            self._stats["total_events_created"] += 1
        except Exception as e:
            logger.error(f"创建活动失败: {e}")
            return None

        return event_id

    def _update_event(
        self,
        event_id: str,
        data: Dict[str, Any],
        post: WeiboPost
    ) -> bool:
        """更新活动信息"""
        update_data = {}

        # 合并新的 IP、嘉宾、参展商
        new_ips = data.get("ips", [])
        new_guests = data.get("guests", [])

        if new_ips or new_guests:
            try:
                expo_event_dao.merge_post_info(
                    event_id=event_id,
                    new_ips=new_ips,
                    new_guests=new_guests
                )
            except Exception as e:
                logger.warning(f"合并帖子信息失败: {e}")

        # 更新基础信息（只更新为空字段）
        if data.get("dates"):
            update_data["dates"] = data["dates"]
        if data.get("location"):
            update_data["location"] = data["location"]
        if data.get("ticket_info"):
            update_data["ticket_info"] = data["ticket_info"]

        # 更新重要标记
        if data.get("is_important_update"):
            update_data["has_important_update"] = True
            update_data["key_info"] = data.get("update_summary")

        # 更新最新动态类型
        if data.get("update_type"):
            update_data["latest_update_type"] = data["update_type"]

        # 更新时间
        update_data["latest_update_at"] = datetime.utcnow()

        if update_data:
            updated = expo_event_dao.update(event_id, update_data)
            if updated:
                self._stats["total_events_updated"] += 1
            return updated

        return True

    def get_pending_count(self) -> Dict[str, int]:
        """获取各状态待处理数量"""
        return {
            "rule_pending": weibo_post_dao.count_unanalyzed(self.target_uids),
            "ai_pending": weibo_post_dao.count_ai_pending(self.target_uids),
            "failed": weibo_post_dao.count_by_status(IntelStatus.FAILED),
        }


# 全局监控器实例（单例）
intel_monitor = IntelMonitor(
    rule_interval_minutes=10,   # 规则提取：每10分钟一次（轻量，可高频）
    ai_interval_minutes=30,      # AI批次处理：每30分钟一次（昂贵，低频）
    rule_batch_size=50,          # 规则提取批次
    ai_batch_size=20,            # AI处理批次
    use_ai=True
)
