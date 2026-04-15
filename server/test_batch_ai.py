"""
批量 AI 分析测试脚本
测试 _build_batch_ai_messages 和 _batch_ai_extract 功能
不保存数据，只输出到控制台
"""
import asyncio
import json
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def test_batch_ai():
    """测试批量 AI 分析"""
    # 初始化数据库连接
    from app.database.mongo_pool import mongo_pool

    print("初始化数据库连接...")
    mongo_pool.initialize()
    print(f"数据库: {mongo_pool._db_name if hasattr(mongo_pool, '_db_name') else '已连接'}")

    print("=" * 60)
    print("批量 AI 分析测试")
    print("=" * 60)

    # 获取待处理的帖子
    from app.database.weibo_post_dao import weibo_post_dao

    print("\n[1] 获取待处理帖子...")
    posts = weibo_post_dao.find_unanalyzed(limit=10)  # 取10条测试

    if not posts:
        print("没有待处理的帖子")
        return

    print(f"获取到 {len(posts)} 条帖子")

    # 显示帖子内容
    print("\n[2] 帖子内容预览:")
    for i, post in enumerate(posts):
        text = post.long_text or post.text_raw or post.text or ""
        print(f"\n--- 帖子 {i} (mid={post.mid}) ---")
        print(text[:200] + "..." if len(text) > 200 else text)

    # 导入服务进行测试
    print("\n[3] 构建批量 AI 消息...")
    from app.services.weibo_intel_service import WeiboIntelService

    service = WeiboIntelService(batch_size=10)
    messages = service._build_batch_ai_messages(posts)

    print(f"消息数量: {len(messages)}")
    print(f"System prompt 长度: {len(messages[0]['content'])}")
    print(f"User content 长度: {len(messages[1]['content'])}")

    print("\n[4] 显示发送给 AI 的内容:")
    print("-" * 60)
    print(messages[1]['content'])
    print("-" * 60)

    # 调用 AI 分析
    print("\n[5] 调用 AI 进行批量分析...")
    try:
        from app.services.llm_service import llm_service

        response = await llm_service.chat(
            messages,
            temperature=0.3,
            max_tokens=8192
        )

        print(f"\nAI 返回内容长度: {len(response)}")
        print("\nAI 返回内容:")
        print("-" * 60)
        print(response)
        print("-" * 60)

        # 解析 JSON
        print("\n[6] 解析 AI 返回的 JSON...")
        try:
            results = json.loads(response)
            print(f"解析成功，共 {len(results)} 条结果")

            for i, result in enumerate(results):
                print(f"\n--- 结果 {i} ---")
                print(f"idx: {result.get('idx')}")
                print(f"is_valid: {result.get('is_valid')}")
                print(f"reason: {result.get('reason')}")
                print(f"category: {result.get('category')}")
                print(f"title: {result.get('title')}")
                print(f"confidence: {result.get('confidence')}")
                if not result.get('is_valid'):
                    print(f"  (标记为无效，不创建情报)")
                else:
                    print(f"  (有效，将创建情报)")

        except json.JSONDecodeError as e:
            print(f"JSON 解析失败: {e}")

    except Exception as e:
        print(f"AI 调用失败: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_batch_ai())