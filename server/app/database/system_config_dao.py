"""
系统配置 DAO - 数据访问层
集合名称: system_config
"""
from typing import Optional, Dict, Any
from datetime import datetime
import logging

from app.database.mongo_pool import mongo_pool
from app.models.system_config import SystemConfig, IntelFeatureConfig, IntelConfigUpdate

logger = logging.getLogger(__name__)

COLLECTION_NAME = "system_config"


class SystemConfigDAO:
    """系统配置数据访问对象"""

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
            if "config_key_1" not in existing:
                self.collection.create_index("config_key", unique=True)
            logger.info(f"系统配置索引检查完成: {COLLECTION_NAME}")
        except Exception as e:
            logger.warning(f"系统配置索引创建警告: {e}")

    def get_config(self) -> SystemConfig:
        """获取全局配置（单文档模式）"""
        doc = self.collection.find_one({"config_key": "global"})
        if doc:
            doc.pop("_id", None)
            return SystemConfig(**doc)
        # 默认配置
        default_config = SystemConfig()
        self._save_config(default_config)
        return default_config

    def _save_config(self, config: SystemConfig):
        """保存配置"""
        data = config.model_dump()
        self.collection.update_one(
            {"config_key": "global"},
            {"$set": data},
            upsert=True
        )

    def update_intel_config(self, update: IntelConfigUpdate) -> SystemConfig:
        """更新情报系统配置"""
        config = self.get_config()
        intel_config_dict = config.intel_config.model_dump()

        update_dict = update.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            intel_config_dict[key] = value

        config.intel_config = IntelFeatureConfig(**intel_config_dict)
        config.updated_at = datetime.utcnow()
        self._save_config(config)
        return config

    def is_keyword_library_enabled(self) -> bool:
        """判断关键词库是否启用"""
        config = self.get_config()
        return config.intel_config.keyword_library_enabled

    def has_any_keywords(self) -> bool:
        """判断关键词库是否有数据（任一类别有关键词即为有数据）"""
        from app.database.category_keywords_dao import category_keywords_dao
        all_keywords = category_keywords_dao.find_all()
        return any(len(kw.keywords) > 0 for kw in all_keywords)


# 全局实例
system_config_dao = SystemConfigDAO()