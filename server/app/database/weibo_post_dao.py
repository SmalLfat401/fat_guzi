"""
微博帖子DAO - 数据访问层
对应集合: weibo_userNew
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import PyMongoError
import logging
import re
from dateutil import parser as date_parser

from app.database.mongo_pool import mongo_pool
from app.models.weibo_post import WeiboPost

logger = logging.getLogger(__name__)

COLLECTION_NAME = "weibo_userNew"


def parse_weibo_date(date_str: str) -> Optional[datetime]:
    """
    解析微博返回的日期字符串
    例如: "Tue Jan 13 12:00:11 +0800 2026"
    """
    try:
        return date_parser.parse(date_str)
    except Exception as e:
        logger.warning(f"日期解析失败: {date_str}, error: {e}")
        return None


class WeiboPostDAO:
    """微博帖子数据访问对象"""

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

            # MID唯一索引
            if "mid_1" not in existing_indexes:
                self.collection.create_index("mid", unique=True)

            # 来源用户UID索引
            if "source_uid_1" not in existing_indexes:
                self.collection.create_index("source_uid")

            # 爬取时间索引
            if "crawled_at_1" not in existing_indexes:
                self.collection.create_index("crawled_at", DESCENDING)

            # 创建时间索引
            if "created_at_dt_1" not in existing_indexes:
                self.collection.create_index("created_at_dt", DESCENDING)

            # 用户ID索引
            if "user_id_1" not in existing_indexes:
                self.collection.create_index("user_id")

            # 情报分析索引（兼容旧字段 intel_analyzed，同时支持新字段 intel_status）
            if "intel_analyzed_1" not in existing_indexes:
                self.collection.create_index("intel_analyzed")
            if "intel_status_1" not in existing_indexes:
                self.collection.create_index("intel_status")

            logger.info(f"MongoDB索引检查完成: {COLLECTION_NAME}")
        except Exception as e:
            logger.warning(f"索引创建警告: {e}")

    def create(self, post: WeiboPost) -> WeiboPost:
        """创建微博帖子"""
        post_data = post.model_dump()
        post_data["crawled_at"] = datetime.utcnow()

        try:
            result = self.collection.insert_one(post_data)
            post_data["_id"] = result.inserted_id
            logger.info(f"创建微博帖子成功: mid={post.mid}")
        except Exception as e:
            # 如果已存在，则更新（排除 _id 字段）
            if "duplicate key" in str(e).lower():
                logger.info(f"微博帖子已存在，更新: mid={post.mid}")
                update_data = {k: v for k, v in post_data.items() if k != "_id"}
                self.collection.update_one(
                    {"mid": post.mid},
                    {"$set": update_data}
                )
            else:
                raise e

        return post

    def create_many(self, posts: List[WeiboPost]) -> int:
        """批量创建微博帖子（去重）"""
        if not posts:
            return 0

        inserted_count = 0
        for post in posts:
            try:
                self.create(post)
                inserted_count += 1
            except Exception as e:
                logger.warning(f"创建帖子失败: mid={post.mid}, error: {e}")

        return inserted_count

    def find_by_mid(self, mid: str) -> Optional[WeiboPost]:
        """根据MID查询帖子"""
        doc = self.collection.find_one({"mid": mid})
        if doc:
            doc.pop("_id", None)
            return WeiboPost(**doc)
        return None

    def find_by_mblogid(self, mblogid: str) -> Optional[WeiboPost]:
        """根据mblogid查询帖子"""
        doc = self.collection.find_one({"mblogid": mblogid})
        if doc:
            doc.pop("_id", None)
            return WeiboPost(**doc)
        return None

    def find_mids_by_source_uid(self, source_uid: str) -> set:
        """查询指定用户的所有mblogid（用于对比增量）"""
        docs = self.collection.find(
            {"source_uid": source_uid},
            {"mblogid": 1}
        )
        return {doc["mblogid"] for doc in docs if doc.get("mblogid")}

    def find_by_source_uid(
        self,
        source_uid: str,
        skip: int = 0,
        limit: int = 20,
        sort_by: str = "created_at_dt"
    ) -> List[WeiboPost]:
        """根据来源用户UID查询帖子"""
        sort_field = "created_at_dt" if sort_by == "created_at_dt" else "crawled_at"

        cursor = self.collection.find(
            {"source_uid": source_uid}
        ).skip(skip).limit(limit).sort(sort_field, DESCENDING)

        posts = []
        for doc in cursor:
            doc.pop("_id", None)
            posts.append(WeiboPost(**doc))
        return posts

    def find_all(self, skip: int = 0, limit: int = 20) -> List[WeiboPost]:
        """查询所有帖子"""
        cursor = self.collection.find().skip(skip).limit(limit).sort("crawled_at", DESCENDING)

        posts = []
        for doc in cursor:
            doc.pop("_id", None)
            posts.append(WeiboPost(**doc))
        return posts

    def count(self, source_uid: Optional[str] = None) -> int:
        """统计帖子数量"""
        query = {}
        if source_uid:
            query["source_uid"] = source_uid
        return self.collection.count_documents(query)

    def delete_by_source_uid(self, source_uid: str) -> int:
        """删除指定来源用户的所有帖子"""
        result = self.collection.delete_many({"source_uid": source_uid})
        return result.deleted_count

    def delete_old_posts(self, source_uid: str, keep_count: int = 100) -> int:
        """
        删除指定来源用户的旧帖子，保留最新的keep_count条
        返回删除的数量
        """
        # 获取需要保留的帖子
        cursor = self.collection.find(
            {"source_uid": source_uid}
        ).sort("created_at_dt", DESCENDING).limit(keep_count)

        keep_mids = [doc["mid"] for doc in cursor]

        if not keep_mids:
            return 0

        # 删除不在保留列表中的帖子
        result = self.collection.delete_many({
            "source_uid": source_uid,
            "mid": {"$nin": keep_mids}
        })

        return result.deleted_count

    def update_longtext(self, mblogid: str, long_text: str) -> Any:
        """
        更新微博的长文本内容

        Args:
            mblogid: 微博的mblogid
            long_text: 长文本内容

        Returns:
            UpdateResult: 更新结果
        """
        try:
            result = self.collection.update_one(
                {"mblogid": mblogid},
                {
                    "$set": {
                        "long_text": long_text,
                        "long_text_updated_at": datetime.utcnow()
                    }
                }
            )
            logger.info(f"更新长文本成功: mblogid={mblogid}, matched={result.matched_count}, modified={result.modified_count}")
            return result
        except PyMongoError as e:
            logger.error(f"更新长文本失败: {e}")
            raise

    def find_unanalyzed(
        self,
        limit: int = 100,
        source_uids: Optional[List[str]] = None
    ) -> List[WeiboPost]:
        """
        查询未完成情报分析的帖子（intel_status = 0）

        Args:
            limit: 返回数量限制
            source_uids: 可选，限定来源用户列表

        Returns:
            未分析帖子列表
        """
        query = {"intel_status": 0}

        if source_uids:
            query["source_uid"] = {"$in": source_uids}

        cursor = self.collection.find(query).limit(limit).sort("created_at_dt", ASCENDING)

        posts = []
        for doc in cursor:
            doc.pop("_id", None)
            posts.append(WeiboPost(**doc))
        return posts

    def find_ai_pending(
        self,
        limit: int = 100,
        source_uids: Optional[List[str]] = None
    ) -> List[WeiboPost]:
        """
        查询等待AI介入的帖子（intel_status = 2）

        Args:
            limit: 返回数量限制
            source_uids: 可选，限定来源用户列表

        Returns:
            AI待处理帖子列表
        """
        query = {"intel_status": 2}

        if source_uids:
            query["source_uid"] = {"$in": source_uids}

        cursor = self.collection.find(query).limit(limit).sort("created_at_dt", DESCENDING)

        posts = []
        for doc in cursor:
            doc.pop("_id", None)
            posts.append(WeiboPost(**doc))
        return posts

    def find_by_intel_status(
        self,
        status: int,
        limit: int = 100,
        source_uids: Optional[List[str]] = None
    ) -> List[WeiboPost]:
        """
        按情报分析状态查询帖子

        Args:
            status: IntelStatus 值
            limit: 返回数量限制
            source_uids: 可选，限定来源用户列表

        Returns:
            符合条件的帖子列表
        """
        query = {"intel_status": status}

        if source_uids:
            query["source_uid"] = {"$in": source_uids}

        cursor = self.collection.find(query).limit(limit).sort("created_at_dt", DESCENDING)

        posts = []
        for doc in cursor:
            doc.pop("_id", None)
            posts.append(WeiboPost(**doc))
        return posts

    def count_by_status(self, status: Optional[int] = None) -> int:
        """
        按情报分析状态统计帖子数量

        Args:
            status: IntelStatus 值，None 时统计所有

        Returns:
            帖子数量
        """
        query = {}
        if status is not None:
            query["intel_status"] = status
        return self.collection.count_documents(query)

    def mark_analyzed(
        self,
        mid: str,
        extracted_info: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        标记帖子已完成情报分析（向后兼容，内部调用 update_intel_status）
        """
        return self.update_intel_status(mid, status=1, confidence=0.0, extracted_info=extracted_info)

    def update_intel_status(
        self,
        mid: str,
        status: int,
        confidence: float = 0.0,
        extracted_info: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        更新帖子情报分析状态

        Args:
            mid: 帖子MID
            status: IntelStatus 枚举值（0-4）
            confidence: 规则匹配置信度 0.0-1.0
            extracted_info: 提取的情报信息

        Returns:
            是否更新成功
        """
        try:
            update_data = {
                "intel_status": status,
                "intel_confidence": confidence,
                "intel_analyzed_at": datetime.utcnow()
            }
            # 兼容旧字段：intel_analyzed = True 表示已处理（非0状态）
            update_data["intel_analyzed"] = (status != 0)
            if extracted_info:
                update_data["intel_extracted_info"] = extracted_info

            result = self.collection.update_one(
                {"mid": mid},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except PyMongoError as e:
            logger.error(f"更新帖子情报状态失败: mid={mid}, error={e}")
            return False

    def count_unanalyzed(self, source_uids: Optional[List[str]] = None) -> int:
        """
        统计未分析的帖子数量（intel_status = 0）

        Args:
            source_uids: 可选，限定来源用户列表

        Returns:
            未分析帖子数量
        """
        query = {"intel_status": 0}
        if source_uids:
            query["source_uid"] = {"$in": source_uids}
        return self.collection.count_documents(query)

    def count_ai_pending(self, source_uids: Optional[List[str]] = None) -> int:
        """
        统计等待AI介入的帖子数量（intel_status = 2）

        Args:
            source_uids: 可选，限定来源用户列表

        Returns:
            AI待处理帖子数量
        """
        query = {"intel_status": 2}
        if source_uids:
            query["source_uid"] = {"$in": source_uids}
        return self.collection.count_documents(query)

    def reset_status_by_status(self, from_status: int, to_status: int) -> int:
        """
        批量重置帖子情报状态

        Args:
            from_status: 原状态
            to_status: 目标状态

        Returns:
            更新的数量
        """
        result = self.collection.update_many(
            {"intel_status": from_status},
            {
                "$set": {
                    "intel_status": to_status,
                    "updated_at": datetime.utcnow(),
                },
                # 清除提取信息，避免残留干扰
                "$unset": {
                    "intel_extracted_info": "",
                }
            }
        )
        return result.modified_count


def create_weibo_post_from_api_data(
    mblog: Dict[str, Any],
    source_uid: str
) -> WeiboPost:
    """
    从API返回的mblog数据创建WeiboPost对象
    """
    user = mblog.get("user", {})

    # 解析时间
    created_at_str = mblog.get("created_at", "")
    created_at_dt = parse_weibo_date(created_at_str)

    return WeiboPost(
        mid=mblog.get("mid", ""),
        mblogid=mblog.get("mblogid"),
        user_id=user.get("id", 0),
        user_idstr=user.get("idstr", ""),
        user_nickname=user.get("screen_name", ""),
        text=mblog.get("text"),
        text_raw=mblog.get("text_raw"),
        created_at=created_at_str,
        created_at_dt=created_at_dt,
        reposts_count=mblog.get("reposts_count", 0),
        comments_count=mblog.get("comments_count", 0),
        attitudes_count=mblog.get("attitudes_count", 0),
        source=mblog.get("source"),
        region_name=mblog.get("region_name"),
        continue_tag=mblog.get("continue_tag"),
        source_uid=source_uid,
        is_top=mblog.get("isTop", 0) == 1,
    )


# 全局DAO实例
weibo_post_dao = WeiboPostDAO()
