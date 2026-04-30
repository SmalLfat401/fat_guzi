"""
临时脚本：查看埋点数据的实际内容
"""
import sys
sys.path.insert(0, '.')

from app.database.mongo_pool import mongo_pool
from pymongo import DESCENDING

# 初始化 MongoDB
mongo_pool.initialize()

# 获取集合
collection = mongo_pool.get_collection("track_events")

# 查询所有不同的 category_tag 值（包括 None 和空字符串）
print("=" * 80)
print("所有 category_tag 的不同值：")
print("=" * 80)

pipeline = [
    {"$match": {"event": "pv", "page": {"$regex": "^/product"}}},
    {"$group": {
        "_id": "$category_tag",
        "count": {"$sum": 1},
        "type": {"$addToSet": {"$type": "$category_tag"}}
    }},
    {"$sort": {"count": -1}},
]

for r in collection.aggregate(pipeline):
    cat = r["_id"]
    print(f"  category_tag='{cat}' (repr: {repr(cat)}) (类型: {type(cat).__name__}, mongo_type: {r['type']}) - 数量: {r['count']}")

print("\n" + "=" * 80)
print("所有 ip_tag 的不同值：")
print("=" * 80)

pipeline = [
    {"$match": {"event": "pv"}},
    {"$group": {
        "_id": "$ip_tag",
        "count": {"$sum": 1},
        "type": {"$addToSet": {"$type": "$ip_tag"}}
    }},
    {"$sort": {"count": -1}},
    {"$limit": 50}
]

for r in collection.aggregate(pipeline):
    ip = r["_id"]
    print(f"  ip_tag='{ip}' (repr: {repr(ip)}) (类型: {type(ip).__name__}, mongo_type: {r['type']}) - 数量: {r['count']}")

print("\n" + "=" * 80)
print("检查是否存在字符串 'None'：")
print("=" * 80)

none_str_events = list(collection.find({
    "$or": [
        {"category_tag": "None"},
        {"ip_tag": "None"},
        {"item_name": "None"},
    ]
}).limit(10))

print(f"找到 {len(none_str_events)} 条包含字符串 'None' 的记录：")
for e in none_str_events:
    print(f"  page: {e.get('page')}, item_id: {e.get('item_id')}")
    print(f"  ip_tag: {repr(e.get('ip_tag'))}, category_tag: {repr(e.get('category_tag'))}")

mongo_pool.close()
