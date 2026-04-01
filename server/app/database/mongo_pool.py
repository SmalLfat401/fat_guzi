"""
MongoDB连接池
提供MongoDB连接池管理功能，项目启动时初始化
"""
from typing import Optional, Dict, Any
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import time
import logging
from threading import Lock

from app.config.settings import settings

logger = logging.getLogger(__name__)


class MongoPool:
    """MongoDB连接池 - 单例模式，项目启动时初始化"""

    _instance = None
    _lock = Lock()
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(MongoPool, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        with self._lock:
            if self._initialized:
                return

            self._client: Optional[MongoClient] = None
            self._db = None
            self._max_retries = 3
            self._retry_delay = 5

            self._initialized = True
            logger.info("MongoDB连接池实例创建完成（待初始化）")

    def initialize(self) -> None:
        """初始化MongoDB连接 - 由FastAPI启动时调用"""
        if self._initialized and self._client is not None:
            logger.info("MongoDB连接池已经初始化")
            return

        with self._lock:
            if self._initialized and self._client is not None:
                return

            self._initialize_connection()
            logger.info("MongoDB连接池初始化完成")

    def _initialize_connection(self) -> None:
        """初始化MongoDB连接"""
        retry_count = 0

        while retry_count < self._max_retries:
            try:
                connection_url = settings.get_mongodb_connection_string()

                self._client = MongoClient(
                    connection_url,
                    serverSelectionTimeoutMS=30000,
                    connectTimeoutMS=20000,
                    socketTimeoutMS=60000,
                    maxPoolSize=settings.mongodb_max_pool_size,
                    minPoolSize=settings.mongodb_min_pool_size,
                    maxIdleTimeMS=settings.mongodb_max_idle_time_ms,
                    retryWrites=True,
                    retryReads=True
                )

                # 验证连接
                self._client.admin.command('ping')

                # 获取数据库实例
                self._db = self._client[settings.mongodb_db]

                logger.info(f"MongoDB连接成功: {settings.mongodb_db}")
                break

            except (ConnectionFailure, ServerSelectionTimeoutError) as e:
                retry_count += 1
                if retry_count == self._max_retries:
                    logger.error(f"MongoDB连接失败，重试 {self._max_retries} 次后放弃: {str(e)}")
                    raise ConnectionError(f"Failed to connect to MongoDB after {self._max_retries} attempts: {str(e)}")
                logger.warning(f"MongoDB连接失败，第 {retry_count}/{self._max_retries} 次重试: {str(e)}")
                time.sleep(self._retry_delay)

    @property
    def client(self) -> MongoClient:
        """获取MongoDB客户端实例"""
        if self._client is None:
            raise ConnectionError("MongoDB连接池未初始化")
        return self._client

    @property
    def db(self):
        """获取数据库实例"""
        if self._db is None:
            raise ConnectionError("MongoDB数据库未初始化")
        return self._db

    def get_collection(self, collection_name: str):
        """获取指定集合"""
        if self._db is None:
            raise ConnectionError("MongoDB数据库未初始化")
        return self._db[collection_name]

    def get_pool_status(self) -> Dict[str, Any]:
        """获取连接池状态"""
        if not self._client:
            return {
                "status": "not_initialized",
                "message": "连接池未初始化"
            }

        try:
            self._client.admin.command('ping')

            return {
                "status": "healthy",
                "database": settings.mongodb_db,
                "connection_string": settings.get_mongodb_connection_string(),
                "message": "连接池运行正常"
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "message": "连接池连接异常"
            }

    def close(self) -> None:
        """关闭连接池"""
        if self._client:
            self._client.close()
            self._client = None
            self._db = None
            logger.info("MongoDB连接池已关闭")


# 全局连接池实例
mongo_pool = MongoPool()
