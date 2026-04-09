"""
谷子商品 DAO - 数据访问层

集合名: guzi_products
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Any, Dict
from pymongo import ASCENDING
import logging

from app.database.mongo_pool import mongo_pool
from app.models.guzi_product import (
    GuziProduct,
    GuziProductCreate,
    GuziProductUpdate,
    PlatformProduct,
)

logger = logging.getLogger(__name__)

COLLECTION_NAME = "guzi_products"


def _compute_convenience_fields(
    platforms: List[PlatformProduct],
) -> tuple[Optional[float], Optional[str], Optional[float], Optional[str], int]:
    """从 platforms 计算便捷字段"""
    if not platforms:
        return None, None, None, None, 0

    lowest = min(platforms, key=lambda p: p.price)
    highest = max(platforms, key=lambda p: p.commission_amount)
    total_vol = sum(p.volume or 0 for p in platforms)

    return (
        lowest.price,
        lowest.platform_id,
        highest.commission_amount,
        highest.platform_id,
        total_vol,
    )


class GuziProductDAO:
    """谷子商品数据访问对象"""

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
            if "title_text" not in existing:
                self.collection.create_index([("title", "text")])
            if "is_active_1" not in existing:
                self.collection.create_index("is_active")
            if "created_at_-1" not in existing:
                self.collection.create_index([("created_at", ASCENDING)])
            if "ip_tags_1" not in existing:
                self.collection.create_index("ip_tags")
            if "category_tags_1" not in existing:
                self.collection.create_index("category_tags")
            logger.info(f"MongoDB 索引检查完成: {COLLECTION_NAME}")
        except Exception as e:
            logger.warning(f"索引创建警告: {e}")

    def _doc_to_model(self, doc: dict) -> GuziProduct:
        """将 MongoDB 文档转换为 GuziProduct，同时把 _id 映射到 id"""
        doc["id"] = str(doc.pop("_id"))
        return GuziProduct.model_validate(doc)

    def create(self, product: GuziProductCreate) -> GuziProduct:
        """创建单个商品"""
        lp, lpp, hc, hcp, total_vol = _compute_convenience_fields(product.platforms)

        data = {
            "title": product.title,
            "image_url": product.image_url,
            "original_image_url": product.original_image_url or "",
            "small_images": product.small_images,
            "platforms": [p.model_dump() for p in product.platforms],
            "description": product.description,
            "is_active": True,
            "lowest_price": lp,
            "lowest_price_platform": lpp,
            "highest_commission": hc,
            "highest_commission_platform": hcp,
            "total_volume": total_vol,
            "ip_tags": product.ip_tags,
            "category_tags": product.category_tags,
            "brand_name": product.brand_name,
            "category_id": product.category_id,
            "category_name": product.category_name,
            "level_one_category_id": product.level_one_category_id,
            "level_one_category_name": product.level_one_category_name,
            "detail_fetched": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        result = self.collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return self._doc_to_model(data)

    def create_batch(self, products: List[GuziProductCreate]) -> List[GuziProduct]:
        """批量创建商品"""
        if not products:
            return []

        docs = []
        for product in products:
            lp, lpp, hc, hcp, total_vol = _compute_convenience_fields(product.platforms)
            docs.append({
                "title": product.title,
                "image_url": product.image_url,
                "original_image_url": product.original_image_url or "",
                "small_images": product.small_images,
                "platforms": [p.model_dump() for p in product.platforms],
                "description": product.description,
                "is_active": True,
                "lowest_price": lp,
                "lowest_price_platform": lpp,
                "highest_commission": hc,
                "highest_commission_platform": hcp,
                "total_volume": total_vol,
                "ip_tags": product.ip_tags,
                "category_tags": product.category_tags,
                "brand_name": product.brand_name,
                "category_id": product.category_id,
                "category_name": product.category_name,
                "level_one_category_id": product.level_one_category_id,
                "level_one_category_name": product.level_one_category_name,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            })

        result = self.collection.insert_many(docs)
        created = []
        for inserted_id, doc in zip(result.inserted_ids, docs):
            doc["_id"] = str(inserted_id)
            created.append(self._doc_to_model(doc))
        return created

    def find_by_id(self, product_id: str) -> Optional[GuziProduct]:
        """根据ID查询"""
        from bson import ObjectId
        try:
            doc = self.collection.find_one({"_id": ObjectId(product_id)})
        except Exception:
            doc = self.collection.find_one({"_id": product_id})
        if doc:
            return self._doc_to_model(doc)
        return None

    def find_all(
        self,
        skip: int = 0,
        limit: int = 20,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
        ip_tag: Optional[str] = None,
        category_tag: Optional[str] = None,
    ) -> List[GuziProduct]:
        """分页查询商品列表"""
        query: dict = {}
        if is_active is not None:
            query["is_active"] = is_active
        if search:
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}},
            ]
        if ip_tag:
            query["ip_tags"] = ip_tag
        if category_tag:
            query["category_tags"] = category_tag

        cursor = (
            self.collection
            .find(query)
            .sort("created_at", -1)  # 按创建时间倒序，最新的在前
            .skip(skip)
            .limit(limit)
        )
        return [self._doc_to_model(doc) for doc in cursor]

    def count(
        self,
        is_active: Optional[bool] = None,
        ip_tag: Optional[str] = None,
        category_tag: Optional[str] = None,
    ) -> int:
        """统计商品总数"""
        query: dict = {}
        if is_active is not None:
            query["is_active"] = is_active
        if ip_tag:
            query["ip_tags"] = ip_tag
        if category_tag:
            query["category_tags"] = category_tag
        return self.collection.count_documents(query)

    def update(self, product_id: str, update: GuziProductUpdate) -> Optional[GuziProduct]:
        """更新商品"""
        from bson import ObjectId

        update_data = update.model_dump(exclude_unset=True)
        if not update_data:
            return self.find_by_id(product_id)

        # 如果更新了 platforms，重新计算便捷字段
        if "platforms" in update_data:
            platforms = [PlatformProduct(**p) for p in update_data["platforms"]]
            lp, lpp, hc, hcp, total_vol = _compute_convenience_fields(platforms)
            update_data.update({
                "lowest_price": lp,
                "lowest_price_platform": lpp,
                "highest_commission": hc,
                "highest_commission_platform": hcp,
                "total_volume": total_vol,
            })

        update_data["updated_at"] = datetime.utcnow()

        oid = ObjectId(product_id) if len(product_id) == 24 else product_id
        result = self.collection.update_one(
            {"_id": oid},
            {"$set": update_data}
        )
        if result.matched_count > 0:
            return self.find_by_id(product_id)
        return None

    def delete(self, product_id: str) -> bool:
        """删除商品"""
        from bson import ObjectId
        oid = ObjectId(product_id) if len(product_id) == 24 else product_id
        result = self.collection.delete_one({"_id": oid})
        return result.deleted_count > 0

    def toggle_active(self, product_id: str) -> Optional[GuziProduct]:
        """切换上下架状态"""
        from bson import ObjectId
        oid = ObjectId(product_id) if len(product_id) == 24 else product_id

        doc = self.collection.find_one({"_id": oid})
        if not doc:
            return None

        new_state = not doc.get("is_active", True)
        self.collection.update_one(
            {"_id": oid},
            {"$set": {"is_active": new_state, "updated_at": datetime.utcnow()}}
        )
        return self.find_by_id(product_id)

    def batch_toggle_active(self, product_ids: List[str], is_active: bool) -> int:
        """批量切换上下架状态"""
        from bson import ObjectId
        oids = [ObjectId(pid) if len(pid) == 24 else pid for pid in product_ids]
        result = self.collection.update_many(
            {"_id": {"$in": oids}},
            {"$set": {"is_active": is_active, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count


# 全局实例
guzi_product_dao = GuziProductDAO()
