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
from app.database.guzi_tag_dao import guzi_tag_dao
from app.models.guzi_product import (
    GuziProduct,
    GuziProductCreate,
    GuziProductUpdate,
    PlatformProduct,
)
from app.models.guzi_tag import TagType

logger = logging.getLogger(__name__)

COLLECTION_NAME = "guzi_products"


def _build_search_query(search: str) -> Optional[dict]:
    """
    构建多关键词分词搜索查询。
    
    支持空格分隔的多关键词模糊匹配：
    - "火影 吧唧" → 同时包含"火影"和"吧唧"的商品
    - 每个词分别匹配：标题、描述、IP标签名、类别标签名
    
    返回 MongoDB 查询表达式，或 None（无有效关键词时）
    """
    if not search or not search.strip():
        return None
    
    # 分词：按空格分割，过滤空字符串
    keywords = [kw.strip() for kw in search.split() if kw.strip()]
    if not keywords:
        return None
    
    # 单关键词：直接匹配
    if len(keywords) == 1:
        keyword = keywords[0]
        return _single_keyword_query(keyword)
    
    # 多关键词：每个关键词都要匹配（AND 关系）
    return _multi_keywords_query(keywords)


def _single_keyword_query(keyword: str) -> dict:
    """构建单个关键词的搜索查询"""
    # 1. 先找匹配的标签
    matching_ip_tag_ids = _search_tag_ids_by_name(keyword, TagType.IP)
    matching_category_tag_ids = _search_tag_ids_by_name(keyword, TagType.CATEGORY)
    
    # 2. 构建标题/描述的正则匹配
    title_desc_query = {
        "$or": [
            {"title": {"$regex": keyword, "$options": "i"}},
            {"description": {"$regex": keyword, "$options": "i"}},
        ]
    }
    
    # 3. 组合所有匹配条件（OR 关系）
    tag_query_parts: List[dict] = []
    if matching_ip_tag_ids:
        tag_query_parts.append({"ip_tags": {"$in": matching_ip_tag_ids}})
    if matching_category_tag_ids:
        tag_query_parts.append({"category_tags": {"$in": matching_category_tag_ids}})
    
    if tag_query_parts:
        return {"$or": [title_desc_query, {"$or": tag_query_parts}]}
    return title_desc_query


def _multi_keywords_query(keywords: List[str]) -> dict:
    """
    构建多个关键词的搜索查询。
    要求商品必须同时匹配所有关键词（AND 关系）。
    """
    keyword_queries: List[dict] = []
    
    for keyword in keywords:
        # 每个关键词的匹配条件
        single_query = _single_keyword_query(keyword)
        keyword_queries.append(single_query)
    
    # 所有关键词都要匹配
    return {"$and": keyword_queries}


def _search_tag_ids_by_name(keyword: str, tag_type: TagType) -> List[str]:
    """根据关键词搜索指定类型的标签ID"""
    try:
        tags = guzi_tag_dao.find_all(
            tag_type=tag_type,
            is_active=True,
            search=keyword,
            limit=100,
        )
        return [tag.id for tag in tags]
    except Exception as e:
        logger.warning(f"搜索标签失败 ({tag_type.value}): {e}")
        return []


def _get_hidden_tag_ids(tag_type: TagType) -> List[str]:
    """获取指定类型中 show_on_h5=false 的标签ID列表"""
    try:
        tags = guzi_tag_dao.find_all(
            tag_type=tag_type,
            show_on_h5=False,
            limit=1000,
        )
        return [tag.id for tag in tags]
    except Exception:
        return []


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
                "detail_fetched": False,
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
        h5_filter: bool = True,
    ) -> List[GuziProduct]:
        """分页查询商品列表

        Args:
            h5_filter: 是否过滤H5隐藏的商品（默认True）
            search: 支持多关键词分词匹配，按空格分隔
        """
        query: dict = {}
        if is_active is not None:
            query["is_active"] = is_active
        if search:
            search_query = _build_search_query(search)
            if search_query:
                query["$and"] = [search_query]
                
        if ip_tag:
            query["ip_tags"] = ip_tag
        if category_tag:
            query["category_tags"] = category_tag

        # H5端过滤：如果某个标签被设为不在H5显示，则过滤掉包含该标签的商品
        if h5_filter:
            from app.models.guzi_tag import TagType
            hidden_ip_tag_ids = _get_hidden_tag_ids(TagType.IP)
            hidden_category_tag_ids = _get_hidden_tag_ids(TagType.CATEGORY)

            exclude_query: Dict[str, Any] = {"$or": []}
            if hidden_ip_tag_ids:
                exclude_query["$or"].append({"ip_tags": {"$in": hidden_ip_tag_ids}})
            if hidden_category_tag_ids:
                exclude_query["$or"].append({"category_tags": {"$in": hidden_category_tag_ids}})

            if exclude_query["$or"]:
                query = {"$and": [query, {"$nor": [exclude_query]}]} if query else {"$nor": [exclude_query]}

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
        search: Optional[str] = None,
        ip_tag: Optional[str] = None,
        category_tag: Optional[str] = None,
        h5_filter: bool = True,
    ) -> int:
        """统计商品总数
        
        search 支持多关键词分词匹配，按空格分隔
        """
        query: dict = {}
        if is_active is not None:
            query["is_active"] = is_active
        if search:
            search_query = _build_search_query(search)
            if search_query:
                query["$and"] = [search_query]
                
        if ip_tag:
            query["ip_tags"] = ip_tag
        if category_tag:
            query["category_tags"] = category_tag

        # H5端过滤
        if h5_filter:
            from app.models.guzi_tag import TagType
            hidden_ip_tag_ids = _get_hidden_tag_ids(TagType.IP)
            hidden_category_tag_ids = _get_hidden_tag_ids(TagType.CATEGORY)

            exclude_query: Dict[str, Any] = {"$or": []}
            if hidden_ip_tag_ids:
                exclude_query["$or"].append({"ip_tags": {"$in": hidden_ip_tag_ids}})
            if hidden_category_tag_ids:
                exclude_query["$or"].append({"category_tags": {"$in": hidden_category_tag_ids}})

            if exclude_query["$or"]:
                query = {"$and": [query, {"$nor": [exclude_query]}]} if query else {"$nor": [exclude_query]}

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
