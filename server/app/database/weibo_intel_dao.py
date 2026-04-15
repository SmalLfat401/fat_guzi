"""
微博情报 DAO - 数据访问层
集合名称: weibo_intel
"""
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import PyMongoError
import logging
import hashlib
import re

from app.database.mongo_pool import mongo_pool
from app.models.weibo_intel import (
    WeiboIntel,
    WeiboIntelCreate,
    WeiboIntelUpdate,
    IntelStatus,
    IntelCategory,
    IntelChange,
    SourcePostRef,
    AlertType,
    ExtractMethod,
)

logger = logging.getLogger(__name__)

COLLECTION_NAME = "weibo_intel"


def normalize_text(text: str) -> str:
    """文本归一化：去除特殊符号、全角转半角、去除空格，用于生成 dedup_hash"""
    if not text:
        return ""
    # 全角转半角
    result = []
    for char in text:
        code = ord(char)
        if 0xFF01 <= code <= 0xFF5E:
            code -= 0xFEE0
        elif code == 0x3000:
            code = 0x0020
        result.append(chr(code))
    text = "".join(result)
    # 去除特殊符号，保留中文、英文、数字
    text = re.sub(r"[^\u4e00-\u9fa5a-zA-Z0-9]", "", text)
    return text.lower()


def generate_dedup_hash(title: str, city: str, year: int) -> str:
    """生成去重 hash（对 title 做归一化后再计算 hash）"""
    # 关键：对 title 也做归一化，避免相似标题生成不同 hash
    normalized = normalize_text(title)
    key = f"{normalized}#{city or ''}#{year}"
    return hashlib.md5(key.encode()).hexdigest()[:16]


class WeiboIntelDAO:
    """微博情报数据访问对象"""

    def __init__(self):
        self._collection = None

    @property
    def collection(self):
        if self._collection is None:
            self._collection = mongo_pool.get_collection(COLLECTION_NAME)
            self._ensure_indexes()
        return self._collection

    def _ensure_indexes(self):
        try:
            existing = self.collection.index_information()
            if "id_1" not in existing:
                self.collection.create_index("id", unique=True)
            if "source_post_mid_1" not in existing:
                self.collection.create_index("source_post_mid")
            if "status_1" not in existing:
                self.collection.create_index("status")
            if "category_1" not in existing:
                self.collection.create_index("category")
            if "dedup_hash_1" not in existing:
                self.collection.create_index("dedup_hash")
            if "created_at_-1" not in existing:
                self.collection.create_index([("created_at", DESCENDING)])
            if "event_start_date_1" not in existing:
                self.collection.create_index("event_start_date")
            if "alert_type_1" not in existing:
                self.collection.create_index("alert_type")
            if "alert_resolved_1" not in existing:
                self.collection.create_index("alert_resolved")
            if "synced_to_calendar_1" not in existing:
                self.collection.create_index("synced_to_calendar")
            if "is_latest_1" not in existing:
                self.collection.create_index("is_latest")
            if "is_published_1" not in existing:
                self.collection.create_index("is_published")
            logger.info(f"WeiboIntel 索引检查完成: {COLLECTION_NAME}")
        except Exception as e:
            logger.warning(f"WeiboIntel 索引创建警告: {e}")

    # ==================== 基础 CRUD ====================

    def create(self, intel: WeiboIntel) -> WeiboIntel:
        data = intel.model_dump()
        try:
            self.collection.insert_one(data)
            logger.info(f"创建 WeiboIntel: id={intel.id}, title={intel.title}")
        except PyMongoError as e:
            logger.error(f"创建 WeiboIntel 失败: {e}")
            raise
        return intel

    def find_by_id(self, intel_id: str) -> Optional[WeiboIntel]:
        doc = self.collection.find_one({"id": intel_id})
        if doc:
            doc.pop("_id", None)
            return WeiboIntel(**doc)
        return None

    def find_by_mid(self, mid: str) -> Optional[WeiboIntel]:
        doc = self.collection.find_one({"source_post_mid": mid})
        if doc:
            doc.pop("_id", None)
            return WeiboIntel(**doc)
        return None

    def update(self, intel_id: str, update_data: Dict[str, Any]) -> bool:
        update_data["updated_at"] = datetime.utcnow()
        result = self.collection.update_one(
            {"id": intel_id},
            {"$set": update_data}
        )
        return result.modified_count > 0

    def delete(self, intel_id: str) -> bool:
        result = self.collection.delete_one({"id": intel_id})
        return result.deleted_count > 0

    def update_status(self, intel_id: str, status: IntelStatus) -> bool:
        update_data = {
            "status": status.value,
            "updated_at": datetime.utcnow()
        }
        if status == IntelStatus.APPROVED:
            update_data["approved_at"] = datetime.utcnow()
        return self.update(intel_id, update_data)

    # ==================== 列表查询 ====================

    def find_all(
        self,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
        category: Optional[str] = None,
        has_alert: Optional[bool] = None,
        search: Optional[str] = None,
        start_date_from: Optional[str] = None,
        start_date_to: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        is_published: Optional[bool] = None,
    ) -> Tuple[List[WeiboIntel], int]:
        query: Dict[str, Any] = {"is_latest": True}

        if status:
            query["status"] = status
        if category:
            query["category"] = category
        if has_alert is not None:
            if has_alert:
                query["alert_type"] = {"$ne": None, "$nin": []}
                query["alert_resolved"] = False
            else:
                query["$or"] = [
                    {"alert_type": None},
                    {"alert_resolved": True}
                ]
        if search:
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"author_nickname": {"$regex": search, "$options": "i"}},
                {"source_post_mid": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}},
            ]
        if start_date_from:
            query.setdefault("event_start_date", {})["$gte"] = start_date_from
        if start_date_to:
            query.setdefault("event_start_date", {})["$lte"] = start_date_to
        if is_published is not None:
            query["is_published"] = is_published

        sort_field = sort_by if sort_by in ["created_at", "updated_at", "event_start_date", "confidence"] else "created_at"
        sort_dir = DESCENDING if sort_order == "desc" else ASCENDING

        total = self.collection.count_documents(query)
        cursor = self.collection.find(query).skip(skip).limit(limit).sort(sort_field, sort_dir)

        results = []
        for doc in cursor:
            doc.pop("_id", None)
            results.append(WeiboIntel(**doc))
        return results, total

    def find_pending(self, skip: int = 0, limit: int = 20) -> Tuple[List[WeiboIntel], int]:
        return self.find_all(skip=skip, limit=limit, status=IntelStatus.PENDING.value)

    def find_with_alerts(self, skip: int = 0, limit: int = 20) -> Tuple[List[WeiboIntel], int]:
        query = {
            "alert_type": {"$ne": None},
            "alert_resolved": False,
            "is_latest": True
        }
        total = self.collection.count_documents(query)
        cursor = self.collection.find(query).skip(skip).limit(limit).sort("updated_at", DESCENDING)
        results = []
        for doc in cursor:
            doc.pop("_id", None)
            results.append(WeiboIntel(**doc))
        return results, total

    # ==================== 去重匹配 ====================

    def find_by_dedup_hash(self, dedup_hash: str) -> List[WeiboIntel]:
        """根据 dedup_hash 查找可能重复的 intel"""
        cursor = self.collection.find({
            "dedup_hash": dedup_hash,
            "is_latest": True
        })
        results = []
        for doc in cursor:
            doc.pop("_id", None)
            results.append(WeiboIntel(**doc))
        return results

    def find_similar(
        self,
        title: str,
        city: Optional[str],
        year: int,
        skip: int = 0,
        limit: int = 10
    ) -> List[WeiboIntel]:
        """模糊查找相似 intel（用于去重）"""
        normalized = normalize_text(title)
        # 如果归一化后太短（<2个字符），无法可靠匹配，返回空
        if len(normalized) < 2:
            return []

        # 使用转义后的正则，避免特殊字符问题
        import re as re_module
        escaped = re_module.escape(normalized)

        query = {
            "is_latest": True,
            "$or": [
                {"title": {"$regex": escaped, "$options": "i"}},
            ]
        }

        # 尝试按年份和城市过滤，减少噪音
        if year:
            query["event_start_date"] = {"$regex": str(year)}

        cursor = self.collection.find(query).skip(skip).limit(limit)

        results = []
        for doc in cursor:
            doc.pop("_id", None)
            results.append(WeiboIntel(**doc))
        return results

    # ==================== 合并与更新 ====================

    def merge_intel(
        self,
        existing_id: str,
        new_data: Dict[str, Any],
        new_post_ref: SourcePostRef,
        changed_fields: List[str]
    ) -> Optional[WeiboIntel]:
        """
        合并新情报到已有情报

        Args:
            existing_id: 已有情报 ID
            new_data: 新情报的数据
            new_post_ref: 新关联的帖子引用
            changed_fields: 发生变化的字段列表

        Returns:
            更新后的 intel
        """
        existing = self.find_by_id(existing_id)
        if not existing:
            return None

        change_records = []
        alert_type = None
        alert_message = None

        for field in changed_fields:
            old_val = getattr(existing, field, None)
            new_val = new_data.get(field)
            if old_val != new_val:
                change_records.append(IntelChange(
                    changed_at=datetime.utcnow(),
                    changed_by="ai",
                    field=field,
                    old_value=old_val,
                    new_value=new_val,
                    source_post_mid=new_post_ref.mid,
                    change_type="updated"
                ))

                # 检测告警类型
                if field in ("event_start_date", "event_end_date") and old_val and new_val:
                    alert_type = AlertType.DATE_CHANGED
                    alert_message = f"日期变更: {old_val} → {new_val}"
                elif field == "event_location" and old_val and new_val:
                    alert_type = AlertType.LOCATION_CHANGED
                    alert_message = f"地点变更: {old_val} → {new_val}"
                elif field == "price_info" and old_val and new_val:
                    alert_type = AlertType.PRICE_CHANGED
                    alert_message = f"价格变动: {old_val} → {new_val}"

        # 合并字段（取非空值）
        merged = existing.model_dump()
        for key, value in new_data.items():
            if value and (merged.get(key) is None or merged.get(key) == ""):
                merged[key] = value
            elif key == "participants" and value:
                existing_list = set(merged.get(key, []))
                merged[key] = list(existing_list | set(value))
            elif key == "related_ips" and value:
                existing_list = set(merged.get(key, []))
                merged[key] = list(existing_list | set(value))
            elif key == "tags" and value:
                existing_list = set(merged.get(key, []))
                merged[key] = list(existing_list | set(value))

        # 更新元数据
        merged["version"] = existing.version + 1
        merged["updated_at"] = datetime.utcnow()
        merged["change_history"] = existing.change_history + change_records

        # 添加新帖子引用
        merged_posts = [p.model_dump() for p in existing.source_posts] + [new_post_ref.model_dump()]
        merged["source_posts"] = merged_posts

        # 只有已批准情报才触发告警
        should_alert = existing.status == IntelStatus.APPROVED.value and alert_type

        # 设置告警
        if should_alert:
            merged["alert_type"] = alert_type.value
            merged["alert_message"] = alert_message
            merged["alert_resolved"] = False
        else:
            # 清除告警（如果合并后没有冲突）
            merged["alert_type"] = None
            merged["alert_message"] = None
            merged["alert_resolved"] = True

        # 合并后标记旧版本
        self.collection.update_one(
            {"id": existing_id},
            {"$set": {"is_latest": False}}
        )

        # 插入新版本
        merged.pop("_id", None)
        merged.pop("id", None)
        new_intel = WeiboIntel(**merged)
        self.collection.insert_one(new_intel.model_dump())

        logger.info(f"合并 intel: {existing_id} → new version {new_intel.id}, changed_fields={changed_fields}")
        return new_intel

    def add_source_post(self, intel_id: str, post_ref: SourcePostRef) -> bool:
        """追加关联帖子"""
        result = self.collection.update_one(
            {"id": intel_id},
            {
                "$push": {"source_posts": post_ref.model_dump()},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        return result.modified_count > 0

    def add_change_record(self, intel_id: str, change: IntelChange) -> bool:
        """追加变更记录"""
        result = self.collection.update_one(
            {"id": intel_id},
            {
                "$push": {"change_history": change.model_dump()},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        return result.modified_count > 0

    def resolve_alert(self, intel_id: str, resolved_by: str, reason: Optional[str] = None) -> bool:
        """处理告警"""
        change = IntelChange(
            changed_at=datetime.utcnow(),
            changed_by=resolved_by,
            field="alert_resolved",
            old_value=False,
            new_value=True,
            change_type="alert_resolved",
            change_reason=reason or "手动处理告警"
        )
        result = self.collection.update_one(
            {"id": intel_id, "is_latest": True},
            {
                "$set": {
                    "alert_resolved": True,
                    "updated_at": datetime.utcnow()
                },
                "$push": {"change_history": change.model_dump()}
            }
        )
        return result.modified_count > 0

    # ==================== 统计 ====================

    def count(self, status: Optional[str] = None) -> int:
        query = {"is_latest": True}
        if status:
            query["status"] = status
        return self.collection.count_documents(query)

    def count_by_category(self) -> Dict[str, int]:
        pipeline = [
            {"$match": {"is_latest": True}},
            {"$group": {"_id": "$category", "count": {"$sum": 1}}}
        ]
        result = {}
        for doc in self.collection.aggregate(pipeline):
            result[doc["_id"]] = doc["count"]
        return result

    def count_has_alert(self) -> int:
        return self.collection.count_documents({
            "alert_type": {"$ne": None},
            "alert_resolved": False
        })

    def count_synced(self) -> int:
        return self.collection.count_documents({"synced_to_calendar": True, "is_latest": True})

    def count_today_new(self) -> int:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        return self.collection.count_documents({"created_at": {"$gte": today_start}, "is_latest": True})

    def count_by_status(self) -> Dict[str, int]:
        pipeline = [
            {"$match": {"is_latest": True}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        result = {}
        for doc in self.collection.aggregate(pipeline):
            result[doc["_id"]] = doc["count"]
        return result

    # ==================== 日历同步 ====================

    def mark_synced(self, intel_id: str, calendar_event_id: str) -> bool:
        update_data = {
            "synced_to_calendar": True,
            "calendar_event_id": calendar_event_id,
            "first_published_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        return self.update(intel_id, update_data)

    def unmark_synced(self, intel_id: str) -> bool:
        update_data = {
            "synced_to_calendar": False,
            "calendar_event_id": None,
            "updated_at": datetime.utcnow()
        }
        return self.update(intel_id, update_data)

    def find_published_for_h5(
        self,
        skip: int = 0,
        limit: int = 20,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        category: Optional[str] = None,
    ) -> Tuple[List[WeiboIntel], int]:
        """
        查询已发布到 H5 的情报（status=approved 且 is_published=true）

        支持日期范围过滤和类别过滤。
        - 日历视图: 传入 start_date + end_date 获取当月所有事件，用于显示圆点
        - 列表视图: 传入 start_date=今天，不过滤 end_date，获取未来所有活动
        """
        query: Dict[str, Any] = {
            "status": IntelStatus.APPROVED.value,
            "is_published": True,
        }
        if start_date:
            query["event_start_date"] = {"$gte": start_date}
        if end_date:
            if "event_start_date" in query:
                query["event_start_date"]["$lte"] = end_date
            else:
                query["event_start_date"] = {"$lte": end_date}
        if category:
            query["category"] = category

        total = self.collection.count_documents(query)
        cursor = self.collection.find(query).skip(skip).limit(limit).sort("event_start_date", ASCENDING)
        results = []
        for doc in cursor:
            doc.pop("_id", None)
            results.append(WeiboIntel(**doc))
        return results, total

    def set_published(self, intel_id: str, published: bool) -> bool:
        """设置发布状态"""
        update_data = {
            "is_published": published,
            "updated_at": datetime.utcnow()
        }
        if published:
            update_data["first_published_at"] = datetime.utcnow()
        return self.update(intel_id, update_data)

    def batch_set_published(self, intel_ids: List[str], published: bool) -> int:
        """批量设置发布状态"""
        if not intel_ids:
            return 0
        update_data = {
            "is_published": published,
            "updated_at": datetime.utcnow()
        }
        if published:
            update_data["first_published_at"] = datetime.utcnow()
        result = self.collection.update_many(
            {"id": {"$in": intel_ids}},
            {"$set": update_data}
        )
        return result.modified_count

    # ==================== 帖子关联查询 ====================

    def find_by_source_post_mid(self, mid: str) -> Optional[WeiboIntel]:
        """根据来源帖子 MID 查找关联的 intel"""
        doc = self.collection.find_one({"source_post_mid": mid})
        if doc:
            doc.pop("_id", None)
            return WeiboIntel(**doc)
        return None

    def is_post_processed(self, mid: str) -> bool:
        """检查帖子是否已关联 intel"""
        return self.collection.count_documents({"source_post_mid": mid}) > 0

    # ==================== 批量操作 ====================

    def batch_update_status(self, intel_ids: List[str], status: IntelStatus) -> int:
        if not intel_ids:
            return 0
        update_data = {
            "status": status.value,
            "updated_at": datetime.utcnow()
        }
        if status == IntelStatus.APPROVED:
            update_data["approved_at"] = datetime.utcnow()
        result = self.collection.update_many(
            {"id": {"$in": intel_ids}},
            {"$set": update_data}
        )
        return result.modified_count

    def batch_delete(self, intel_ids: List[str]) -> int:
        if not intel_ids:
            return 0
        result = self.collection.delete_many({"id": {"$in": intel_ids}})
        return result.deleted_count


# 全局实例
weibo_intel_dao = WeiboIntelDAO()
