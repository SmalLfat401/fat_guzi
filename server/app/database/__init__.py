"""
Database package - MongoDB connection pool
"""
from app.database.mongo_pool import mongo_pool, MongoPool

__all__ = ["mongo_pool", "MongoPool"]
