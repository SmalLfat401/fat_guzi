"""
漫展活动提取服务 - 热点追踪系统的核心引擎
采用两层提取策略：
1. 规则匹配（快速提取确定性信息）
2. AI 辅助（智能判断 + 字段扩充）
"""
import re
import json
import logging
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime

from app.models.weibo_post import WeiboPost
from app.models.expo_event import ExpoEvent, ExpoEventCreate, UpdateType
from app.database.expo_event_dao import expo_event_dao, generate_event_id
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)


# ============== 规则匹配模式 ==============

# 活动关键词（用于识别漫展相关帖子）
EXPO_KEYWORDS = [
    # 常见漫展名称
    r"CP\d*", r"漫展", r"同人祭", r"动漫展", r"嘉年华",
    # 城市+漫展
    r"上海\s*漫展", r"北京\s*漫展", r"广州\s*漫展", r"深圳\s*漫展", r"成都\s*漫展",
    r"杭州\s*漫展", r"武汉\s*漫展", r"南京\s*漫展", r"西安\s*漫展",
    # 展会类型
    r"动漫游戏嘉年华", r"次元汇", r"幻梦祭", r"梦乡漫展",
    # IP联动展会
    r"原神\s*展", r"崩坏\s*展", r"明日方舟\s*展", r"蔚蓝档案\s*展",
    # 通用
    r"展会", r"会展中心", r"博览中心"
]

# 变动关键词（用于标记重要更新）
CHANGE_KEYWORDS = [
    r"变动", r"调整", r"变更", r"更改", r"变化",
    r"取消", r"中止", r"暂停",
    r"延期", r"推迟", r"提前",
    r"时间有变", r"时间调整", r"最新通知",
    r"紧急", r"重要提醒", r"重要通知",
    r"时间更改", r"地点更改", r"地点调整"
]

# 时间模式
DATE_PATTERNS = [
    # 完整日期：2026年5月1日、2026.5.1、2026-05-01
    r"(\d{4})[年./-](\d{1,2})[月./-](\d{1,2})[日]?",
    # 范围：2026年5月1日-5月3日、5.1~5.3
    r"(\d{4})[年]*(\d{1,2})[月]*(\d{1,2})[日]*[~-~](\d{1,2})[日]?",
    r"(\d{1,2})[月]*(\d{1,2})[日]*[~-~](\d{1,2})[日]*",
    # 月份+日期
    r"(0?[1-9]|1[0-2])月(0?[1-9]|[1-3]\d)日",
    # 简写
    r"(0?[1-9]|1[0-2])\.(0?[1-9]|[1-3]\d)"
]

# 地点关键词
LOCATION_KEYWORDS = [
    r"地点", r"地址", r"场馆", r"场地", r"位置",
    r"在", r"于", r"位于"
]

# 票务关键词
TICKET_KEYWORDS = [
    r"票", r"购票", r"售票", r"票价", r"门票",
    r"大麦网", r"猫眼", r"票星球", r"摩天轮",
    r"早鸟票", r"预售票", r"普通票", r"VIP票"
]

# 嘉宾关键词
GUEST_KEYWORDS = [
    r"嘉宾", r"嘉宾阵容", r"嘉宾名单", r"特邀嘉宾",
    r"嘉宾签售", r"签售嘉宾",
    r"嘉宾阵容", r"嘉宾官宣", r"嘉宾阵容公开"
]

# 参展IP关键词
IP_KEYWORDS = [
    r"参展IP", r"参展作品", r"联动IP", r"参展商IP",
    r"参展阵容", r"参展名单", r"参展企业"
]


class ExpoExtractor:
    """
    漫展活动提取器

    核心功能：
    1. 判断帖子是否与漫展相关
    2. 提取活动基础信息（名称、时间、地点等）
    3. 标记更新类型和重要性
    4. 生成活动摘要
    """

    def __init__(self):
        self._compiled_expo_keywords = None
        self._compiled_change_keywords = None

    @property
    def expo_keywords(self) -> List[re.Pattern]:
        """编译后的活动关键词"""
        if self._compiled_expo_keywords is None:
            self._compiled_expo_keywords = [
                re.compile(p, re.IGNORECASE) for p in EXPO_KEYWORDS
            ]
        return self._compiled_expo_keywords

    @property
    def change_keywords(self) -> List[re.Pattern]:
        """编译后的变动关键词"""
        if self._compiled_change_keywords is None:
            self._compiled_change_keywords = [
                re.compile(p, re.IGNORECASE) for p in CHANGE_KEYWORDS
            ]
        return self._compiled_change_keywords

    def extract(self, post: WeiboPost) -> Dict[str, Any]:
        """
        主提取方法 - 从帖子中提取漫展相关信息

        Args:
            post: 微博帖子对象

        Returns:
            提取结果字典
        """
        text = self._get_text_content(post)
        if not text:
            return {"is_expo_related": False, "reason": "内容为空"}

        result = {
            "is_expo_related": False,
            "event_name": None,
            "dates": None,
            "location": None,
            "ticket_info": None,
            "ips": [],
            "guests": [],
            "is_important_update": False,
            "update_type": None,
            "update_summary": None,
            "confidence": 0.0,
            "needs_ai": False
        }

        # ========== Step 1: 规则匹配 ==========
        rule_result = self._rule_match(text, post.user_nickname)

        # 判断是否与漫展相关
        if rule_result["is_potential_expo"]:
            result["is_expo_related"] = True
            result["event_name"] = rule_result["event_name"]
            result["dates"] = rule_result["dates"]
            result["location"] = rule_result["location"]
            result["ticket_info"] = rule_result["ticket_info"]
            result["ips"] = rule_result["ips"]
            result["guests"] = rule_result["guests"]
            result["confidence"] = rule_result["confidence"]

            # 检查是否有变动
            if rule_result["has_change"]:
                result["is_important_update"] = True
                result["update_type"] = UpdateType.CHANGE
                result["update_summary"] = rule_result["change_summary"]
            else:
                result["update_type"] = rule_result["update_type"]

            result["update_summary"] = rule_result["summary"]

        # 置信度低于 0.5 时，标记需要AI介入（由阶段二处理）
        # 置信度 >= 0.5 时直接走阶段一流程
        if result["is_expo_related"] and result["confidence"] < 0.5:
            result["needs_ai"] = True

        return result

    async def extract_with_ai(
        self,
        post: WeiboPost,
        rule_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        【阶段二】AI 辅助提取（异步）
        对规则匹配不确定的内容进行智能判断

        Args:
            post: 微博帖子对象
            rule_result: 规则匹配结果

        Returns:
            增强后的提取结果
        """
        text = self._get_text_content(post)

        prompt = self._build_ai_prompt(text, rule_result)

        try:
            response = await llm_service.chat(prompt, temperature=0.3, max_tokens=500)
            ai_result = json.loads(response)

            # 合并规则和 AI 结果
            if ai_result.get("is_expo_related"):
                return {
                    **rule_result,
                    "is_expo_related": True,
                    "event_name": rule_result["event_name"] or ai_result.get("event_name"),
                    "dates": rule_result["dates"] or ai_result.get("dates"),
                    "location": rule_result["location"] or ai_result.get("location"),
                    "ticket_info": rule_result["ticket_info"] or ai_result.get("ticket_info"),
                    "ips": rule_result["ips"] or ai_result.get("ips", []),
                    "guests": rule_result["guests"] or ai_result.get("guests", []),
                    "is_important_update": rule_result["is_important_update"] or ai_result.get("is_important_update", False),
                    "update_type": rule_result["update_type"] or ai_result.get("update_type"),
                    "update_summary": rule_result["update_summary"] or ai_result.get("summary"),
                    "confidence": max(rule_result.get("confidence", 0), ai_result.get("confidence", 0)),
                    "needs_ai": False
                }
        except Exception as e:
            logger.error(f"AI 提取失败: {e}")

        # AI 失败时返回规则结果
        return rule_result

    def extract_with_ai_sync(
        self,
        post: WeiboPost,
        rule_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        【同步封装】供 intel_monitor 后台线程调用
        在子线程中运行事件循环执行 async 方法
        """
        import asyncio
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            # 没有正在运行的事件循环，直接创建
            return asyncio.run(self.extract_with_ai(post, rule_result))

        # 已有运行中的事件循环（理论上 intel_monitor 是同步线程，不会有）
        future = loop.create_task(self.extract_with_ai(post, rule_result))
        return asyncio.run(future)

    def _get_text_content(self, post: WeiboPost) -> str:
        """获取帖子的文本内容（优先使用长文本）"""
        return post.long_text or post.text_raw or post.text or ""

    def _rule_match(self, text: str, author: str) -> Dict[str, Any]:
        """
        规则匹配 - 快速提取确定性信息

        Returns:
            {
                "is_potential_expo": bool,
                "event_name": str,
                "dates": dict,
                "location": str,
                "ticket_info": str,
                "ips": list,
                "guests": list,
                "has_change": bool,
                "change_summary": str,
                "update_type": str,
                "summary": str,
                "confidence": float
            }
        """
        result = {
            "is_potential_expo": False,
            "event_name": None,
            "dates": None,
            "location": None,
            "ticket_info": None,
            "ips": [],
            "guests": [],
            "has_change": False,
            "change_summary": None,
            "update_type": UpdateType.OTHER,
            "summary": None,
            "confidence": 0.0
        }

        # 1. 检查活动关键词
        matched_keywords = []
        for pattern in self.expo_keywords:
            if pattern.search(text):
                matched_keywords.append(pattern.pattern)

        if not matched_keywords:
            # 检查作者名是否包含活动关键词
            if any(p.search(author) for p in self.expo_keywords):
                matched_keywords.append("author_match")
            else:
                return result

        # 2. 提取活动名称（尝试从文本中提取或推断）
        result["event_name"] = self._extract_event_name(text, author, matched_keywords)

        # 3. 提取时间
        result["dates"] = self._extract_dates(text)

        # 4. 提取地点
        result["location"] = self._extract_location(text)

        # 5. 提取票务信息
        result["ticket_info"] = self._extract_ticket_info(text)

        # 6. 提取嘉宾
        result["guests"] = self._extract_guests(text)

        # 7. 检查变动关键词
        change_result = self._check_changes(text)
        result["has_change"] = change_result["has_change"]
        result["change_summary"] = change_result["summary"]
        result["is_important_update"] = change_result["has_change"]

        # 8. 判断更新类型
        result["update_type"] = self._determine_update_type(text)

        # 9. 生成摘要
        result["summary"] = self._generate_summary(text, result)

        # 10. 计算置信度
        result["confidence"] = self._calculate_confidence(result, matched_keywords)
        result["is_potential_expo"] = result["confidence"] >= 0.4

        return result

    def _extract_event_name(self, text: str, author: str, keywords: List[str]) -> Optional[str]:
        """提取活动名称"""
        # 尝试从 @用户名 中提取（很多漫展官方号会用自己的名字）
        mentions = re.findall(r"@([^@\s]+)", text)
        if mentions:
            # 取最长的 mention 作为活动名
            for mention in sorted(mentions, key=len, reverse=True):
                if any(kw in mention for kw in ["漫展", "同人", "动漫", "嘉年华", "CP", "FUN"]):
                    return mention

        # 尝试从作者名提取
        if any(kw in author for kw in ["漫展", "同人", "动漫", "嘉年华"]):
            return author

        # 尝试匹配常见活动名称模式
        event_patterns = [
            r"(CP\d+(?:\.\d+)?(?:春季|夏季|秋季|冬季)?(?:展|祭)?)",
            r"((?:20)?\d{2}(?:春季|夏季|秋季|冬季)?(?:漫展|动漫展|同人祭))",
            r"(\w+动漫游戏嘉年华)",
        ]

        for pattern in event_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1)

        # 如果有关键词但无法提取名称，返回文本前50字
        if keywords:
            return text[:50].strip()

        return None

    def _extract_dates(self, text: str) -> Optional[Dict[str, str]]:
        """提取活动时间"""
        # 匹配日期范围
        range_pattern = r"(\d{4})[年./-](\d{1,2})[月./-](\d{1,2})[日]?\s*[~-至]\s*(\d{1,2})[日]?"
        range_match = re.search(range_pattern, text)
        if range_match:
            year = range_match.group(1)
            start_month = range_match.group(2)
            start_day = range_match.group(3)
            end_day = range_match.group(4)
            return {
                "start": f"{year}-{start_month.zfill(2)}-{start_day.zfill(2)}",
                "end": f"{year}-{start_month.zfill(2)}-{end_day.zfill(2)}"
            }

        # 匹配单日或跨月日期
        single_pattern = r"(\d{4})[年./-](\d{1,2})[月./-](\d{1,2})[日]?"
        single_match = re.search(single_pattern, text)
        if single_match:
            return {
                "start": f"{single_match.group(1)}-{single_match.group(2).zfill(2)}-{single_match.group(3).zfill(2)}",
                "end": f"{single_match.group(1)}-{single_match.group(2).zfill(2)}-{single_match.group(3).zfill(2)}"
            }

        # 匹配相对日期（如"5月1日"）
        relative_pattern = r"(0?[1-9]|1[0-2])月(0?[1-9]|[1-3]\d)日"
        relative_match = re.search(relative_pattern, text)
        if relative_match:
            # 使用当前年份作为默认值
            current_year = datetime.now().year
            return {
                "start": f"{current_year}-{relative_match.group(1).zfill(2)}-{relative_match.group(2).zfill(2)}",
                "end": f"{current_year}-{relative_match.group(1).zfill(2)}-{relative_match.group(2).zfill(2)}"
            }

        return None

    def _extract_location(self, text: str) -> Optional[str]:
        """提取活动地点"""
        # 常见展馆模式
        venue_patterns = [
            r"((?:国际)?[博览展览]?[中心馆会])",
            r"((?:万达|来福士|万象城|天街).*(?:广场|中心))",
            r"(\w+会展中心)",
            r"(\w+国际博览中心)",
            r"(\w+新国际博览中心)",
        ]

        # 城市+地点模式
        city_pattern = r"(上海|北京|广州|深圳|成都|杭州|武汉|南京|西安|重庆|苏州|天津)\s*((?:国际)?[博览展览]?[中心馆])"

        city_match = re.search(city_pattern, text)
        if city_match:
            return f"{city_match.group(1)} {city_match.group(2)}"

        for pattern in venue_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1)

        return None

    def _extract_ticket_info(self, text: str) -> Optional[str]:
        """提取票务信息"""
        # 购票渠道
        channel_pattern = r"(?:购票|售票|票务|门票)(?:通道|链接|地址|网站)?[:：]?\s*(https?://[^\s]+|[^\s]+(?:大麦网|猫眼|票星球|摩天轮|淘宝|闲鱼)[^\s]*)"
        match = re.search(channel_pattern, text, re.IGNORECASE)
        if match:
            return match.group(0)

        # 票价信息
        price_pattern = r"(?:票价|门票|早鸟票?|普通票?|VIP)[：:]?\s*[\u4e00-\u9fa5]?\s*(\d+)"
        price_match = re.search(price_pattern, text)
        if price_match:
            return f"票价 {price_match.group(1)} 元"

        # 简单标记
        if any(re.search(p, text, re.IGNORECASE) for p in TICKET_KEYWORDS):
            return "票务信息请关注官方公告"

        return None

    def _extract_guests(self, text: str) -> List[str]:
        """提取嘉宾列表"""
        guests = []

        # @提及的嘉宾
        mentions = re.findall(r"@([^@\s,，]+)", text)
        guests.extend([m for m in mentions if len(m) < 20])

        # 特定格式：嘉宾 XXX
        guest_pattern = r"嘉宾[:：]\s*([^\n,，]+)"
        matches = re.findall(guest_pattern, text)
        guests.extend(matches)

        # 去重
        return list(set(guests))[:10]  # 最多10个

    def _check_changes(self, text: str) -> Dict[str, Any]:
        """检查是否有重要变动"""
        result = {"has_change": False, "summary": None}

        for pattern in self.change_keywords:
            match = pattern.search(text)
            if match:
                result["has_change"] = True
                # 提取变动上下文
                start = max(0, match.start() - 10)
                end = min(len(text), match.end() + 30)
                context = text[start:end].strip()
                result["summary"] = context
                break

        return result

    def _determine_update_type(self, text: str) -> UpdateType:
        """判断更新类型"""
        text_lower = text.lower()

        if any(k in text_lower for k in ["嘉宾", "嘉宾阵容", "嘉宾官宣", "签售"]):
            return UpdateType.GUEST
        if any(k in text_lower for k in ["参展商", "参展名单", "参展企业", "摊位"]):
            return UpdateType.EXHIBITOR
        if any(k in text_lower for k in ["票", "票价", "购票", "售票"]):
            return UpdateType.TICKET
        if any(k in text_lower for k in ["日程", "行程", "时间表", "活动安排"]):
            return UpdateType.SCHEDULE
        if any(k in text_lower for k in ["公告", "通知", "声明"]):
            return UpdateType.ANNOUNCEMENT
        if any(k in text_lower for k in ["进度", "最新", "更新"]):
            return UpdateType.PROGRESS

        return UpdateType.OTHER

    def _generate_summary(self, text: str, result: Dict[str, Any]) -> str:
        """生成更新摘要"""
        summary_parts = []

        if result["event_name"]:
            summary_parts.append(f"活动：{result['event_name']}")

        if result["dates"]:
            dates = result["dates"]
            if dates.get("start") == dates.get("end"):
                summary_parts.append(f"时间：{dates['start']}")
            else:
                summary_parts.append(f"时间：{dates['start']} ~ {dates.get('end', '')}")

        if result["location"]:
            summary_parts.append(f"地点：{result['location']}")

        if result["has_change"]:
            summary_parts.append(f"【重要变动】{result['change_summary']}")

        if not summary_parts:
            # 取文本前50字
            return text[:50].strip()

        return " | ".join(summary_parts)

    def _calculate_confidence(
        self,
        result: Dict[str, Any],
        matched_keywords: List[str]
    ) -> float:
        """计算匹配置信度"""
        confidence = 0.0

        # 基础分数
        if result["event_name"]:
            confidence += 0.3
        if result["dates"]:
            confidence += 0.2
        if result["location"]:
            confidence += 0.2
        if result["ticket_info"]:
            confidence += 0.1
        if result["guests"]:
            confidence += 0.1
        if result["ips"]:
            confidence += 0.1

        # 关键词加分
        confidence += min(len(matched_keywords) * 0.05, 0.2)

        # 变动标记加分
        if result["has_change"]:
            confidence += 0.1

        return min(confidence, 1.0)

    def _build_ai_prompt(self, text: str, rule_result: Dict[str, Any]) -> str:
        """构建 AI 提取提示词"""
        return f"""你是一个漫展活动信息提取专家。请分析以下微博内容，判断是否与漫展/动漫展会相关，并提取关键信息。

【微博内容】
{text}

【规则匹配结果】（仅供参考）
- 活动名称候选：{rule_result.get('event_name')}
- 时间信息：{rule_result.get('dates')}
- 地点信息：{rule_result.get('location')}
- 票务信息：{rule_result.get('ticket_info')}
- 规则置信度：{rule_result.get('confidence')}

【任务要求】
1. 判断这条微博是否与漫展/动漫展会相关（返回 is_expo_related）
2. 如果相关，提取或确认以下信息：
   - 活动名称（event_name）
   - 活动时间（dates，格式如 {"start": "2026-05-01", "end": "2026-05-03"}）
   - 活动地点（location）
   - 票务信息（ticket_info）
   - 参展IP列表（ips）
   - 嘉宾列表（guests）
3. 判断是否有重要变动（is_important_update）：如时间变动、地点变动、活动取消等
4. 生成一句话摘要（summary）

请以 JSON 格式返回结果：
{{
    "is_expo_related": true/false,
    "event_name": "...",
    "dates": {{"start": "...", "end": "..."}},
    "location": "...",
    "ticket_info": "...",
    "ips": ["...", "..."],
    "guests": ["...", "..."],
    "is_important_update": true/false,
    "summary": "...",
    "confidence": 0.0-1.0
}}

只返回 JSON，不要有其他内容。"""


# 全局提取器实例
expo_extractor = ExpoExtractor()
