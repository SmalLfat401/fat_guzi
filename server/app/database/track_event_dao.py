"""
埋点 DAO - 数据访问层
集合名称: track_events（原始事件）
"""
from typing import Optional, List, Dict, Any, Set
from datetime import datetime, timedelta
from pymongo import DESCENDING, ASCENDING, IndexModel
from pymongo.errors import PyMongoError
import logging

from app.database.mongo_pool import mongo_pool
from app.models.track_event import (
    TrackEvent,
)

logger = logging.getLogger(__name__)

COLLECTION_EVENTS = "track_events"
TTL_DAYS = 30  # 原始事件保留 30 天


class TrackEventDAO:
    """埋点事件数据访问对象"""

    def __init__(self):
        self._events_collection = None

    @property
    def events(self):
        if self._events_collection is None:
            self._events_collection = mongo_pool.get_collection(COLLECTION_EVENTS)
            self._ensure_event_indexes()
        return self._events_collection

    def _ensure_event_indexes(self):
        try:
            existing = self.events.index_information()
            if "fid_1_timestamp_-1" not in existing:
                self.events.create_index([("fid", ASCENDING), ("timestamp", DESCENDING)])
            if "page_1_date_-1" not in existing:
                self.events.create_index([("page", ASCENDING), ("date", ASCENDING)])
            if "item_id_1_date_-1" not in existing:
                self.events.create_index([("item_id", ASCENDING), ("date", ASCENDING)])
            if "date_-1_timestamp_-1" not in existing:
                self.events.create_index([("date", DESCENDING), ("timestamp", DESCENDING)])
            # TTL 索引：30 天后自动删除原始事件
            if "created_at_1" not in existing:
                self.events.create_index(
                    [("created_at", ASCENDING)],
                    expireAfterSeconds=TTL_DAYS * 24 * 3600,
                    name="ttl_created_at"
                )
            logger.info("TrackEvent 索引检查完成")
        except Exception as e:
            logger.warning(f"TrackEvent 索引创建警告: {e}")

    # ──────────────────────────────────────────────
    # 事件写入
    # ──────────────────────────────────────────────

    def insert_event(self, event: TrackEvent) -> bool:
        """写入单条事件"""
        try:
            data = event.model_dump()
            self.events.insert_one(data)
            return True
        except PyMongoError as e:
            logger.error(f"写入埋点事件失败: {e}")
            return False

    def insert_events_batch(self, events: List[TrackEvent]) -> int:
        """批量写入事件，返回成功写入数量"""
        if not events:
            return 0
        try:
            docs = [e.model_dump() for e in events]
            result = self.events.insert_many(docs)
            return len(result.inserted_ids)
        except PyMongoError as e:
            logger.error(f"批量写入埋点事件失败: {e}")
            return 0

    # ──────────────────────────────────────────────
    # 聚合统计查询
    # ──────────────────────────────────────────────

    def get_overview(self, date: str) -> Dict[str, Any]:
        """获取指定日期概览：PV（只统计 pv 事件）/ UV"""
        try:
            pipeline = [
                {"$match": {"date": date, "event": "pv"}},
                {
                    "$group": {
                        "_id": None,
                        "pv": {"$sum": 1},
                        "uv": {"$addToSet": "$fid"}
                    }
                }
            ]
            result = list(self.events.aggregate(pipeline))
            if result:
                return {"pv": result[0]["pv"], "uv": len(result[0]["uv"])}
            return {"pv": 0, "uv": 0}
        except Exception as e:
            logger.error(f"获取概览失败: {e}")
            return {"pv": 0, "uv": 0}

    def get_page_stats(self, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        """
        获取各页面 PV/UV/点击/提交统计（仅一级页面路径）
        - 过滤掉带参数的路径（如 /product/xxx），只保留一级路径（如 /products、/calendar）
        - PV：页面浏览量（event=pv）
        - UV：该页面独立访客数（按 fid 去重，只统计 pv 事件）
        - click/expose/submit：对应事件的数量
        """
        # 一级页面路径映射：把 /product/xxx 归类为 /product
        BASE_PAGES = {
            '/products': '/products',      # 商品列表
            '/product': '/product',        # 商品详情（所有 /product/xxx 都归入此）
            '/want-guzi': '/want-guzi',   # 求谷表单
            '/calendar': '/calendar',      # 活动日历
            '/glossary': '/glossary',     # 术语百科
            '/': '/',                      # 首页
        }

        def normalize_page(page: str) -> str:
            """将具体路径归一化到一级路径"""
            for base, normalized in BASE_PAGES.items():
                if page == base or page.startswith(base + '/'):
                    return normalized
            # 其他页面保留原样（可能需要手动归类）
            return page

        try:
            # 分别统计各类事件
            event_pipeline = [
                {"$match": {"date": {"$gte": start_date, "$lte": end_date}}},
                {
                    "$group": {
                        "_id": {
                            "page": "$page",
                            "event": "$event"
                        },
                        "count": {"$sum": 1}
                    }
                },
            ]
            event_result = list(self.events.aggregate(event_pipeline))

            # 按页面聚合事件数量，并归一化页面路径
            page_map: Dict[str, Dict[str, Any]] = {}
            for r in event_result:
                original_page = r["_id"]["page"]
                normalized_page = normalize_page(original_page)
                event_type = r["_id"]["event"]

                if normalized_page not in page_map:
                    page_map[normalized_page] = {
                        "page": normalized_page,
                        "original_pages": [],  # 记录原始页面路径（调试用）
                        "pv": 0, "uv": 0,
                        "click": 0, "expose": 0, "submit": 0, "action": 0
                    }
                if original_page not in page_map[normalized_page]["original_pages"]:
                    page_map[normalized_page]["original_pages"].append(original_page)
                if event_type in page_map[normalized_page]:
                    page_map[normalized_page][event_type] += r["count"]

            # 单独计算每个页面的 UV（只统计 pv 事件，按 fid 去重）
            uv_pipeline = [
                {"$match": {
                    "date": {"$gte": start_date, "$lte": end_date},
                    "event": "pv"  # 只统计页面浏览事件
                }},
                {"$group": {"_id": {"page": "$page", "fid": "$fid"}}},
            ]
            uv_raw = list(self.events.aggregate(uv_pipeline))

            # 按归一化后的页面聚合 UV
            page_uvs: Dict[str, Set[str]] = {}
            for r in uv_raw:
                original_page = r["_id"]["page"]
                normalized_page = normalize_page(original_page)
                fid = r["_id"]["fid"]
                if normalized_page not in page_uvs:
                    page_uvs[normalized_page] = set()
                page_uvs[normalized_page].add(fid)

            for page in page_map:
                page_map[page]["uv"] = len(page_uvs.get(page, set()))

            # 移除 original_pages（不返回给前端）
            result = []
            for page, data in page_map.items():
                data.pop("original_pages", None)
                result.append(data)

            return result
        except Exception as e:
            logger.error(f"获取页面统计失败: {e}")
            return []

    def get_product_detail_stats(
        self,
        start_date: str,
        end_date: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        获取商品详情页统计（按 PV 排序）
        - 筛选 page 路径为 /product 开头的 PV 事件
        - 按商品维度聚合：item_id、商品名称、IP标签、分类标签、PV、UV
        - 可用于分析：商品热度、IP热度、分类热度
        """
        try:
            # 筛选商品详情页的 PV 事件
            pv_pipeline = [
                {
                    "$match": {
                        "date": {"$gte": start_date, "$lte": end_date},
                        "page": {"$regex": "^/product"},
                        "event": "pv",
                        # 只匹配字符串类型，排除 null 和空字符串
                        "item_id": {"$type": "string", "$ne": ""}
                    }
                },
                {
                    "$group": {
                        "_id": {
                            "item_id": "$item_id",
                        },
                        "pv": {"$sum": 1},
                        "uv_set": {"$addToSet": "$fid"},
                        # 取最新的非空名称和标签
                        "item_name": {"$last": "$item_name"},
                        "ip_tag": {"$last": "$ip_tag"},
                        "category_tag": {"$last": "$category_tag"},
                    }
                },
                {
                    "$project": {
                        "_id": "$_id.item_id",
                        "pv": 1,
                        "uv": {"$size": "$uv_set"},
                        "item_name": 1,
                        "ip_tag": 1,
                        "category_tag": 1,
                    }
                },
                {"$sort": {"pv": -1}},
                {"$limit": limit}
            ]
            pv_result = list(self.events.aggregate(pv_pipeline))

            # 补充缺失的 item_name（查询最近一条带名称的记录）
            for item in pv_result:
                if not item.get("item_name"):
                    recent = self.events.find_one(
                        {"item_id": item["_id"], "item_name": {"$type": "string", "$ne": ""}},
                        {"item_name": 1, "ip_tag": 1, "category_tag": 1},
                        sort=[("timestamp", -1)]
                    )
                    if recent:
                        item["item_name"] = recent.get("item_name", "")
                        item["ip_tag"] = recent.get("ip_tag", "")
                        item["category_tag"] = recent.get("category_tag", "")

            return pv_result
        except Exception as e:
            logger.error(f"获取商品详情统计失败: {e}")
            return []

    def get_category_stats(
        self,
        start_date: str,
        end_date: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        获取商品类别统计（按 PV 排序）
        - 筛选 page 路径为 /product 开头的 PV 事件
        - 按 category_tag 聚合：类别名称、PV、UV
        - 过滤掉 category_tag 为 null 或空字符串的记录
        """
        try:
            pipeline = [
                {
                    "$match": {
                        "date": {"$gte": start_date, "$lte": end_date},
                        "page": {"$regex": "^/product"},
                        "event": "pv",
                        # 只匹配字符串类型，排除 null 和空字符串
                        "category_tag": {"$type": "string", "$ne": ""}
                    }
                },
                {
                    "$group": {
                        "_id": "$category_tag",
                        "pv": {"$sum": 1},
                        "uv_set": {"$addToSet": "$fid"}
                    }
                },
                {
                    "$project": {
                        "_id": 0,
                        "category_tag": "$_id",
                        "pv": 1,
                        "uv": {"$size": "$uv_set"}
                    }
                },
                {"$sort": {"pv": -1}},
                {"$limit": limit}
            ]
            return list(self.events.aggregate(pipeline))
        except Exception as e:
            logger.error(f"获取商品类别统计失败: {e}")
            return []

    def get_hot_ips(
        self,
        start_date: str,
        end_date: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        按 IP 聚合统计：进入详情页次数（带 ip_tag 的 PV）+ 点击量。
        用于「热门 IP 排行榜」：展示用户最关注哪些 IP。
        """
        try:
            pipeline = [
                {
                    "$match": {
                        "date": {"$gte": start_date, "$lte": end_date},
                        # 只匹配字符串类型，排除 null 和空字符串
                        "ip_tag": {"$type": "string", "$ne": ""}
                    }
                },
                {
                    "$group": {
                        "_id": "$ip_tag",
                        "detail_count": {
                            "$sum": {"$cond": [{"$eq": ["$event", "pv"]}, 1, 0]}
                        },
                        "click": {
                            "$sum": {"$cond": [{"$eq": ["$event", "click"]}, 1, 0]}
                        },
                    }
                },
                {"$sort": {"detail_count": -1}},
                {"$limit": limit}
            ]
            return list(self.events.aggregate(pipeline))
        except Exception as e:
            logger.error(f"获取热门 IP 失败: {e}")
            return []

    def get_hot_searches(
        self,
        start_date: str,
        end_date: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """获取热门搜索词"""
        try:
            pipeline = [
                {
                    "$match": {
                        "date": {"$gte": start_date, "$lte": end_date},
                        "event": "action",
                        "action": "search"
                    }
                },
                {
                    "$group": {
                        "_id": "$extra.keyword",
                        "count": {"$sum": 1}
                    }
                },
                {"$match": {"_id": {"$ne": None, "$ne": ""}}},
                {"$sort": {"count": -1}},
                {"$limit": limit}
            ]
            result = list(self.events.aggregate(pipeline))
            return [{"keyword": r["_id"], "count": r["count"]} for r in result]
        except Exception as e:
            logger.error(f"获取热门搜索词失败: {e}")
            return []

    def get_conversion_funnel(
        self,
        start_date: str,
        end_date: str
    ) -> List[Dict[str, Any]]:
        """
        获取转化漏斗数据

        漏斗定义（商品列表 → 商品详情 → 获取淘口令）：
        1. /products PV
        2. /product/:id 点击（进入详情）
        3. get_tkl 点击（获取/复制淘口令，含生成+复制、直接复制已有两种场景）
        """
        try:
            pipeline = [
                {"$match": {"date": {"$gte": start_date, "$lte": end_date}}},
                {
                    "$group": {
                        "_id": "$event",
                        "count": {"$sum": 1},
                        "uv": {"$addToSet": "$fid"}
                    }
                },
                {
                    "$project": {
                        "event": "$_id",
                        "count": 1,
                        "uv": {"$size": "$uv"}
                    }
                }
            ]
            all_events = {r["event"]: {"count": r["count"], "uv": r["uv"]}
                          for r in self.events.aggregate(pipeline)}

            products_pv = all_events.get("pv", {}).get("count", 0)

            # 商品详情浏览：点击商品卡片
            detail_click = all_events.get("click", {}).get("count", 0)

            # 生成淘口令：event=action 且 action=get_tkl
            tkl_pipeline = [
                {"$match": {"date": {"$gte": start_date, "$lte": end_date}, "event": "action", "action": "get_tkl"}},
                {"$group": {"_id": None, "count": {"$sum": 1}}}
            ]
            tkl_result = list(self.events.aggregate(tkl_pipeline))
            tkl_action = tkl_result[0]["count"] if tkl_result else 0

            return [
                {"step": "商品列表浏览", "count": products_pv},
                {"step": "商品详情浏览", "count": detail_click},
                {"step": "获取淘口令", "count": tkl_action},
            ]
        except Exception as e:
            logger.error(f"获取转化漏斗失败: {e}")
            return []

    def get_retention(
        self,
        end_date: str,
        days: int = 7
    ) -> List[Dict[str, Any]]:
        """
        计算留存率（简化版：按日期统计首次访问用户的后续访问）

        留存定义：N 日留存 = 第 N 天回访的 UV / 当日新 UV
        """
        try:
            result = []
            for i in range(days):
                date = (datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=i)).strftime("%Y-%m-%d")
                prev_date = (datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=i+1)).strftime("%Y-%m-%d")

                # 当日所有 UV
                pipeline_uv = [
                    {"$match": {"date": date}},
                    {"$group": {"_id": "$fid"}}
                ]
                day_uvs = set(doc["_id"] for doc in self.events.aggregate(pipeline_uv))
                total = len(day_uvs)

                if total == 0:
                    result.append({
                        "date": date,
                        "new_users": 0,
                        "retained_1d": 0,
                        "retained_7d": 0
                    })
                    continue

                # 前一天 UV（用于次日留存）
                prev_pipeline = [
                    {"$match": {"date": prev_date}},
                    {"$group": {"_id": "$fid"}}
                ]
                prev_uvs = set(doc["_id"] for doc in self.events.aggregate(prev_pipeline))

                retained_1d = len(day_uvs & prev_uvs)

                # 7 天前 UV（用于 7 日留存）
                week_ago = (datetime.strptime(date, "%Y-%m-%d") - timedelta(days=7)).strftime("%Y-%m-%d")
                week_pipeline = [
                    {"$match": {"date": week_ago}},
                    {"$group": {"_id": "$fid"}}
                ]
                week_uvs = set(doc["_id"] for doc in self.events.aggregate(week_pipeline))
                retained_7d = len(day_uvs & week_uvs)

                result.append({
                    "date": date,
                    "new_users": total,
                    "retained_1d": round(retained_1d / total * 100, 1) if total > 0 else 0,
                    "retained_7d": round(retained_7d / total * 100, 1) if total > 0 else 0
                })

            return list(reversed(result))
        except Exception as e:
            logger.error(f"获取留存数据失败: {e}")
            return []


# 全局实例
track_event_dao = TrackEventDAO()
