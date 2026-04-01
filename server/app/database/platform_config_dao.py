"""
平台配置DAO - 数据访问层
"""
from typing import Optional, List
from datetime import datetime
from pymongo import ASCENDING
import logging

from app.database.mongo_pool import mongo_pool
from app.models.platform_config import PlatformConfig, PlatformConfigCreate, PlatformConfigUpdate, SUPPORTED_PLATFORMS

logger = logging.getLogger(__name__)

COLLECTION_NAME = "platform_configs"


class PlatformConfigDAO:
    """平台配置数据访问对象"""

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

            if "platform_id_1" not in existing_indexes:
                self.collection.create_index("platform_id", unique=True)
            if "is_active_1" not in existing_indexes:
                self.collection.create_index("is_active")

            logger.info(f"MongoDB索引检查完成: {COLLECTION_NAME}")
        except Exception as e:
            logger.warning(f"索引创建警告: {e}")

    def _init_default_platforms(self):
        """初始化默认平台配置"""
        for platform in SUPPORTED_PLATFORMS:
            existing = self.find_by_platform_id(platform["platform_id"])
            if not existing:
                default_config = PlatformConfigCreate(
                    platform_id=platform["platform_id"],
                    platform_name=platform["platform_name"],
                    app_key="",
                    app_secret="",
                    pid="",
                    is_active=False
                )
                self.create(default_config)
                logger.info(f"已创建默认平台配置: {platform['platform_name']}")

    def create(self, config: PlatformConfigCreate) -> PlatformConfig:
        """创建平台配置"""
        config_data = {
            "platform_id": config.platform_id,
            "platform_name": config.platform_name,
            "app_key": config.app_key,
            "app_secret": config.app_secret,
            "pid": config.pid,
            "is_active": config.is_active,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        result = self.collection.insert_one(config_data)
        config_data["_id"] = str(result.inserted_id)

        return PlatformConfig(**config_data)

    def find_by_id(self, config_id: str) -> Optional[PlatformConfig]:
        """根据ID查询配置"""
        from bson import ObjectId
        try:
            doc = self.collection.find_one({"_id": ObjectId(config_id)})
        except Exception:
            doc = self.collection.find_one({"_id": config_id})

        if doc:
            doc["_id"] = str(doc["_id"])
            return PlatformConfig(**doc)
        return None

    def find_by_platform_id(self, platform_id: str) -> Optional[PlatformConfig]:
        """根据平台ID查询配置"""
        doc = self.collection.find_one({"platform_id": platform_id})
        if doc:
            doc["_id"] = str(doc["_id"])
            return PlatformConfig(**doc)
        return None

    def find_all(self) -> List[PlatformConfig]:
        """查询所有平台配置"""
        # 确保默认平台存在
        self._init_default_platforms()

        cursor = self.collection.find().sort("platform_id", ASCENDING)
        configs = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            configs.append(PlatformConfig(**doc))
        return configs

    def find_active(self) -> List[PlatformConfig]:
        """查询已启用的平台配置"""
        cursor = self.collection.find({"is_active": True}).sort("platform_id", ASCENDING)
        configs = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            configs.append(PlatformConfig(**doc))
        return configs

    def find_configured(self) -> List[PlatformConfig]:
        """查询已配置AppKey的平台"""
        cursor = self.collection.find({
            "app_key": {"$ne": ""},
            "app_secret": {"$ne": ""}
        }).sort("platform_id", ASCENDING)
        configs = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            configs.append(PlatformConfig(**doc))
        return configs

    def count(self) -> int:
        """统计平台配置数量"""
        return self.collection.count_documents({})

    def update(self, platform_id: str, config_update: PlatformConfigUpdate) -> Optional[PlatformConfig]:
        """更新平台配置"""
        update_data = config_update.model_dump(exclude_unset=True)
        if update_data:
            update_data["updated_at"] = datetime.utcnow()

            result = self.collection.update_one(
                {"platform_id": platform_id},
                {"$set": update_data}
            )

            if result.modified_count > 0 or result.matched_count > 0:
                return self.find_by_platform_id(platform_id)

        return self.find_by_platform_id(platform_id)

    def delete(self, platform_id: str) -> bool:
        """删除配置（实际上是清空配置）"""
        result = self.collection.update_one(
            {"platform_id": platform_id},
            {
                "$set": {
                    "app_key": "",
                    "app_secret": "",
                    "pid": "",
                    "is_active": False,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0


# 全局DAO实例
platform_config_dao = PlatformConfigDAO()
