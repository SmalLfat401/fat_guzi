"""
求谷表单 DAO - 数据访问层
"""
from typing import Optional, List
from datetime import datetime
from pymongo import DESCENDING
import logging

from app.database.mongo_pool import mongo_pool
from app.models.want_guzi import WantGuzi, WantGuziCreate, WantGuziUpdate, WantGuziStatus

logger = logging.getLogger(__name__)

COLLECTION_NAME = "want_guzi"


def _convert_doc(doc: dict) -> dict:
    """将 MongoDB 文档转换为 WantGuzi 模型格式"""
    if doc is None:
        return doc
    # MongoDB 的 _id 转换为 id
    if "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    # 确保 id 字段存在
    if "id" not in doc or not doc["id"]:
        doc["id"] = str(doc.get("_id", ""))
    return doc


class WantGuziDAO:
    """求谷表单数据访问对象"""

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
            if "status_created_at" not in existing_indexes:
                self.collection.create_index(
                    [("status", 1), ("created_at", DESCENDING)],
                    name="status_created_at"
                )
            if "created_at_-1" not in existing_indexes:
                self.collection.create_index(
                    [("created_at", DESCENDING)],
                    name="created_at_-1"
                )
            if "ip_name_text" not in existing_indexes:
                self.collection.create_index(
                    [("ip_name", "text")],
                    name="ip_name_text"
                )
            logger.info(f"MongoDB索引检查完成: {COLLECTION_NAME}")
        except Exception as e:
            logger.warning(f"索引创建警告: {e}")

    def create(self, form: WantGuziCreate) -> WantGuzi:
        """创建求谷表单"""
        now = datetime.utcnow()
        data = {
            "ip_name": form.ip_name,
            "category_tags": form.category_tags,
            "remark": form.remark,
            "status": WantGuziStatus.PENDING.value,
            "reply": None,
            "admin_remark": None,
            "created_at": now,
            "updated_at": now,
        }
        result = self.collection.insert_one(data)
        data["id"] = str(result.inserted_id)
        return WantGuzi(**_convert_doc(data))

    def find_by_id(self, form_id: str) -> Optional[WantGuzi]:
        """根据ID查询表单"""
        from bson import ObjectId, InvalidBSON
        try:
            doc = self.collection.find_one({"_id": ObjectId(form_id)})
        except InvalidBSON:
            doc = self.collection.find_one({"id": form_id})
        if doc:
            return WantGuzi(**_convert_doc(doc))
        return None

    def find_all(
        self,
        skip: int = 0,
        limit: int = 20,
        status: Optional[WantGuziStatus] = None,
        search: Optional[str] = None,
    ) -> List[WantGuzi]:
        """查询所有表单，支持筛选和分页"""
        query = {}
        if status is not None:
            query["status"] = status.value
        if search:
            # 使用正则表达式进行模糊匹配
            query["ip_name"] = {"$regex": search, "$options": "i"}

        cursor = (
            self.collection.find(query)
            .skip(skip)
            .limit(limit)
            .sort("created_at", DESCENDING)
        )
        forms = []
        for doc in cursor:
            forms.append(WantGuzi(**_convert_doc(doc)))
        return forms

    def count(
        self,
        status: Optional[WantGuziStatus] = None,
        search: Optional[str] = None,
    ) -> int:
        """统计表单数量"""
        query = {}
        if status is not None:
            query["status"] = status.value
        if search:
            query["ip_name"] = {"$regex": search, "$options": "i"}
        return self.collection.count_documents(query)

    def update(self, form_id: str, form_update: WantGuziUpdate) -> Optional[WantGuzi]:
        """更新表单信息"""
        from bson import ObjectId, InvalidBSON
        try:
            query = {"_id": ObjectId(form_id)}
        except InvalidBSON:
            query = {"id": form_id}

        update_data = form_update.model_dump(exclude_unset=True)
        if update_data:
            # 处理 status 枚举值
            if "status" in update_data and update_data["status"]:
                update_data["status"] = update_data["status"].value
            update_data["updated_at"] = datetime.utcnow()
            result = self.collection.update_one(query, {"$set": update_data})
            if result.modified_count > 0 or result.matched_count > 0:
                return self.find_by_id(form_id)
        return self.find_by_id(form_id)

    def delete(self, form_id: str) -> bool:
        """删除表单"""
        from bson import ObjectId, InvalidBSON
        try:
            query = {"_id": ObjectId(form_id)}
        except InvalidBSON:
            query = {"id": form_id}
        result = self.collection.delete_one(query)
        return result.deleted_count > 0


# 全局 DAO 实例
want_guzi_dao = WantGuziDAO()
