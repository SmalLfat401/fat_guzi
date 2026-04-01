"""
漫展活动DAO - 数据访问层
对应集合: expo_events
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import PyMongoError
import logging
import hashlib

from app.database.mongo_pool import mongo_pool
from app.models.expo_event import ExpoEvent, EventStatus, UpdateType

logger = logging.getLogger(__name__)

COLLECTION_NAME = "expo_events"


def generate_event_id(name: str, year: Optional[int] = None) -> str:
    """
    生成活动唯一ID
    使用名称+年份的MD5
    """
    key = f"{name}:{year}" if year else name
    return hashlib.md5(key.encode()).hexdigest()[:16]


class ExpoEventDAO:
    """漫展活动数据访问对象"""

    def __init__(self):
        self._collection = None

    @property
    def collection(self):
        """获取集合，自动初始化"""
        if self._collection is None:
            self._collection = mongo_pool.get_collection(COLLECTION_NAME)
            self._ensure_indexes()
        return self._collection

    def _ensure_indexes(self):
        """确保索引创建"""
        try:
            existing_indexes = self.collection.index_information()

            # event_id唯一索引
            if "event_id_1" not in existing_indexes:
                self.collection.create_index("event_id", unique=True)

            # 名称索引（支持模糊查询）
            if "name_text" not in existing_indexes:
                self.collection.create_index([("name", "text")])

            # 状态索引
            if "status_1" not in existing_indexes:
                self.collection.create_index("status")

            # 时间索引
            if "dates.start_1" not in existing_indexes:
                self.collection.create_index("dates.start")

            # 最新更新时间索引
            if "latest_update_at_1" not in existing_indexes:
                self.collection.create_index("latest_update_at", DESCENDING)

            # 创建时间索引
            if "created_at_1" not in existing_indexes:
                self.collection.create_index("created_at", DESCENDING)

            logger.info(f"MongoDB索引检查完成: {COLLECTION_NAME}")
        except Exception as e:
            logger.warning(f"索引创建警告: {e}")

    def create(self, event: ExpoEvent) -> ExpoEvent:
        """创建漫展活动"""
        event_data = event.model_dump()

        try:
            result = self.collection.insert_one(event_data)
            event_data["_id"] = result.inserted_id
            logger.info(f"创建漫展活动成功: event_id={event.event_id}, name={event.name}")
        except Exception as e:
            if "duplicate key" in str(e).lower():
                logger.info(f"漫展活动已存在: event_id={event.event_id}")
            else:
                raise e

        return event

    def find_by_event_id(self, event_id: str) -> Optional[ExpoEvent]:
        """根据event_id查询活动"""
        doc = self.collection.find_one({"event_id": event_id})
        if doc:
            doc.pop("_id", None)
            return ExpoEvent(**doc)
        return None

    def find_by_name(self, name: str) -> Optional[ExpoEvent]:
        """根据活动名称查询（模糊匹配，返回最新）"""
        doc = self.collection.find_one(
            {"name": {"$regex": name, "$options": "i"}}
        ).sort("created_at", DESCENDING)
        if doc:
            doc.pop("_id", None)
            return ExpoEvent(**doc)
        return None

    def find_all(
        self,
        skip: int = 0,
        limit: int = 20,
        status: Optional[EventStatus] = None,
        sort_by: str = "latest_update_at"
    ) -> List[ExpoEvent]:
        """
        查询所有活动

        Args:
            skip: 跳过数量
            limit: 返回数量
            status: 按状态筛选
            sort_by: 排序字段（latest_update_at / created_at / dates.start）
        """
        query = {}
        if status:
            query["status"] = status.value if isinstance(status, EventStatus) else status

        sort_field = sort_by
        if sort_by == "dates.start":
            sort_field = "dates.start"

        cursor = self.collection.find(query).skip(skip).limit(limit).sort(sort_field, DESCENDING)

        events = []
        for doc in cursor:
            doc.pop("_id", None)
            events.append(ExpoEvent(**doc))
        return events

    def count(self, status: Optional[EventStatus] = None) -> int:
        """统计活动数量"""
        query = {}
        if status:
            query["status"] = status.value if isinstance(status, EventStatus) else status
        return self.collection.count_documents(query)

    def update(self, event_id: str, update_data: Dict[str, Any]) -> bool:
        """
        更新活动信息

        Args:
            event_id: 活动ID
            update_data: 更新字段

        Returns:
            是否更新成功
        """
        try:
            update_data["updated_at"] = datetime.utcnow()
            result = self.collection.update_one(
                {"event_id": event_id},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except PyMongoError as e:
            logger.error(f"更新活动失败: event_id={event_id}, error: {e}")
            return False

    def add_post_to_event(
        self,
        event_id: str,
        post_id: str,
        update_type: Optional[str] = None,
        summary: str = "",
        is_important: bool = False,
        new_ips: Optional[List[str]] = None,
        new_guests: Optional[List[str]] = None
    ) -> bool:
        """
        将帖子关联到活动，追加更新历史

        Args:
            event_id: 活动ID
            post_id: 帖子MID
            update_type: 更新类型
            summary: 更新摘要
            is_important: 是否重要更新
            new_ips: 新增IP列表（去重合并）
            new_guests: 新增嘉宾列表（去重合并）

        Returns:
            是否更新成功
        """
        try:
            update_record = {
                "post_id": post_id,
                "posted_at": datetime.utcnow().isoformat(),
                "update_type": update_type,
                "summary": summary,
                "has_important_update": is_important
            }

            # 构建更新操作（MongoDB 不允许同一操作符出现两次，合并处理）
            final_update = {
                "$set": {
                    "latest_update_at": datetime.utcnow(),
                    "latest_post_at": datetime.utcnow(),
                },
                "$addToSet": {"source_posts": post_id},
                "$inc": {"post_count": 1}
            }

            # 重要标记
            if is_important:
                final_update["$set"]["has_important_update"] = True
                final_update["$set"]["key_info"] = summary

            # 更新历史
            final_update["$push"] = {"update_history": update_record}

            # IP 和嘉宾合并（$addToSet 自动去重）
            if new_ips:
                final_update["$addToSet"]["ips"] = {"$each": new_ips}
            if new_guests:
                final_update["$addToSet"]["guests"] = {"$each": new_guests}

            result = self.collection.update_one(
                {"event_id": event_id},
                final_update
            )

            if result.matched_count == 0:
                logger.warning(f"活动不存在: event_id={event_id}")
                return False

            return result.modified_count > 0
        except PyMongoError as e:
            logger.error(f"追加帖子到活动失败: event_id={event_id}, error={e}")
            return False

    def merge_post_info(
        self,
        event_id: str,
        new_ips: List[str] = None,
        new_guests: List[str] = None,
        new_exhibitors: List[str] = None,
        ticket_info: str = None,
        dates: Dict[str, str] = None,
        location: str = None
    ) -> bool:
        """
        合并帖子中的信息到活动（去重）

        Args:
            event_id: 活动ID
            new_ips: 新增IP列表
            new_guests: 新增嘉宾列表
            new_exhibitors: 新增参展商列表
            ticket_info: 票务信息
            dates: 日期信息
            location: 地点信息

        Returns:
            是否更新成功
        """
        try:
            update_data = {"updated_at": datetime.utcnow()}

            # 使用 $addToSet 进行去重合并
            set_operations = {}
            if new_ips:
                set_operations["ips"] = {"$each": new_ips}
            if new_guests:
                set_operations["guests"] = {"$each": new_guests}
            if new_exhibitors:
                set_operations["exhibitors"] = {"$each": new_exhibitors}

            # 基础更新
            mongo_update = {"$set": update_data}

            if ticket_info:
                update_data["ticket_info"] = ticket_info
            if dates:
                update_data["dates"] = dates
            if location:
                update_data["location"] = location

            # IP/嘉宾/参展商合并（$addToSet 自动去重）
            if set_operations:
                mongo_update["$addToSet"] = set_operations

            result = self.collection.update_one(
                {"event_id": event_id},
                mongo_update
            )

            return result.modified_count > 0
        except PyMongoError as e:
            logger.error(f"合并帖子信息失败: event_id={event_id}, error={e}")
            return False

    def delete(self, event_id: str) -> bool:
        """删除活动"""
        try:
            result = self.collection.delete_one({"event_id": event_id})
            return result.deleted_count > 0
        except PyMongoError as e:
            logger.error(f"删除活动失败: event_id={event_id}, error={e}")
            return False

    def find_upcoming(self, limit: int = 20) -> List[ExpoEvent]:
        """查询即将举办的活动"""
        events = self.find_all(limit=limit, status=EventStatus.UPCOMING)
        return events

    def find_with_important_updates(self, limit: int = 20) -> List[ExpoEvent]:
        """查询有重要更新的活动"""
        cursor = self.collection.find(
            {"has_important_update": True}
        ).limit(limit).sort("latest_update_at", DESCENDING)

        events = []
        for doc in cursor:
            doc.pop("_id", None)
            events.append(ExpoEvent(**doc))
        return events


# 全局DAO实例
expo_event_dao = ExpoEventDAO()
