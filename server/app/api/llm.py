"""
LLM 对接接口
提供 AI 助写相关功能，兼容所有支持 OpenAI Chat Completion 协议的服务商
"""
import json
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.llm_service import llm_service


router = APIRouter(prefix="/llm", tags=["LLM 对接"])


class AIAssistRequest(BaseModel):
    """AI 助写请求模型"""
    prompt: str
    temperature: float = 0.7
    max_tokens: int = 2000


class AIAssistResponse(BaseModel):
    """AI 助写非流式响应模型"""
    content: str


@router.post("/assist-stream")
async def ai_assist_stream(req: AIAssistRequest):
    """
    AI 助写 - 流式输出（用于前端实时展示打字效果）

    - **prompt**: 合并后的完整提示词
    - **temperature**: 温度参数（默认 0.7）
    - **max_tokens**: 最大 token 数（默认 2000）
    """
    messages = [{"role": "user", "content": req.prompt}]

    async def stream_generator():
        try:
            full_content = ""
            async for token in llm_service.stream_chat(
                messages=messages,
                temperature=req.temperature,
                max_tokens=req.max_tokens,
            ):
                full_content += token
                yield f"data: {json.dumps({'token': token})}\n\n"
            yield f"data: {json.dumps({'done': True, 'content': full_content})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/assist", response_model=AIAssistResponse)
async def ai_assist(req: AIAssistRequest):
    """
    AI 助写 - 非流式（一次性返回完整结果）

    - **prompt**: 合并后的完整提示词
    - **temperature**: 温度参数（默认 0.7）
    - **max_tokens**: 最大 token 数（默认 2000）
    """
    messages = [{"role": "user", "content": req.prompt}]
    content = await llm_service.chat(
        messages=messages,
        temperature=req.temperature,
        max_tokens=req.max_tokens,
    )
    return AIAssistResponse(content=content)


@router.get("/health")
async def llm_health():
    """
    LLM 服务健康检查
    """
    try:
        # 用一个简单的问题快速验证连通性
        messages = [{"role": "user", "content": "Hi"}]
        await llm_service.chat(messages=messages, max_tokens=1)
        return {"status": "ok", "model": llm_service.model}
    except Exception as e:
        return {"status": "error", "error": str(e)}


class WeiboUserAnalyzeRequest(BaseModel):
    """微博用户分析请求模型"""
    nickname: str
    profile_url: str = ""
    available_categories: list[str] = []


class WeiboUserAnalyzeResponse(BaseModel):
    """微博用户分析响应模型"""
    notes: str
    categories: list[str]


@router.post("/analyze-weibo-user", response_model=WeiboUserAnalyzeResponse)
async def analyze_weibo_user(req: WeiboUserAnalyzeRequest):
    """
    AI 分析微博用户 - 先抓取主页内容，再进行分析

    - **nickname**: 微博用户昵称
    - **profile_url**: 微博用户主页链接（可选，优先使用）
    - **available_categories**: 可选的标签列表，AI会从这些标签中选择最合适的

    返回:
    - notes: AI 分析生成的备注
    - categories: 从可用标签中匹配到的标签列表
    """
    from playwright.async_api import async_playwright
    import asyncio

    CDP_URL = "http://127.0.0.1:9222"

    # 构建提示词
    available_tags_text = "、".join(req.available_categories) if req.available_categories else "无可用标签，请根据用户特征新建合适的标签名称"

    base_info = f"""微博用户信息：
- 昵称：{req.nickname}
- 主页链接：{req.profile_url if req.profile_url else '未提供'}"""

    prompt = f"""{base_info}

【主页内容】
{{content}}

请分析这个微博账号：
1. 根据昵称和主页内容判断账号类型、定位、主要受众
2. 生成一段简短的备注说明（20-50字）

可选标签列表：{available_tags_text}
请从可选标签中选择最合适的1-3个标签名称返回。

只返回JSON，不要其他内容：
{{"notes":"...","categories":["标签1","标签2"]}}"""

    content = ""

    # 如果提供了主页链接，尝试抓取内容
    if req.profile_url:
        try:
            async with async_playwright() as p:
                try:
                    browser = await p.chromium.connect_over_cdp(CDP_URL)
                    contexts = browser.contexts
                    if contexts and contexts[0].pages:
                        page = contexts[0].pages[0]
                        await page.goto(req.profile_url, wait_until="networkidle", timeout=30000)
                        await asyncio.sleep(3)

                        # 滚动加载更多内容
                        for _ in range(3):
                            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                            await asyncio.sleep(1.5)

                        # 提取页面文本内容
                        content = await page.evaluate("""
                            () => {
                                const userInfo = document.querySelector('.pf_username, .nick-name, [node-type="nickname"], .WB_nickname')?.textContent || '';
                                const desc = document.querySelector('.user_text, .pf_intro, [node-type="desc"]')?.textContent || '';
                                const tags = Array.from(document.querySelectorAll('.W_btn_b, .layer_tag_list a, [node-type="tag"]'))
                                    .map(tag => tag.textContent?.trim())
                                    .filter(Boolean);
                                const posts = Array.from(document.querySelectorAll('.WB_text, .feed_content'))
                                    .slice(0, 10)
                                    .map(el => el.textContent?.trim())
                                    .filter(t => t && t.length > 10);
                                return JSON.stringify({
                                    userInfo: userInfo,
                                    description: desc,
                                    tags: tags,
                                    recentPosts: posts
                                });
                            }
                        """)
                        print(f"[WeiboUserAnalyze] 抓取到内容长度: {len(content)}")
                except Exception as e:
                    print(f"[WeiboUserAnalyze] 抓取失败: {e}")
                    content = ""
        except Exception as e:
            print(f"[WeiboUserAnalyze] Playwright连接失败: {e}")
            content = ""

    # 如果没有抓取到内容，只用昵称分析
    if not content:
        content = json.dumps({
            "userInfo": req.nickname,
            "description": "无法获取主页内容",
            "tags": [],
            "recentPosts": []
        })
        print(f"[WeiboUserAnalyze] 使用昵称分析: {req.nickname}")

    # 调用 LLM 分析
    final_prompt = prompt.format(content=content)
    messages = [{"role": "user", "content": final_prompt}]

    try:
        result = await llm_service.chat(
            messages=messages,
            temperature=0.3,
            max_tokens=500,
        )
        parsed = json.loads(result)
        return WeiboUserAnalyzeResponse(
            notes=parsed.get("notes", ""),
            categories=parsed.get("categories", [])
        )
    except json.JSONDecodeError as e:
        print(f"[WeiboUserAnalyze] JSON解析失败: {e}, result={result}")
        return WeiboUserAnalyzeResponse(notes="", categories=[])
    except Exception as e:
        print(f"[WeiboUserAnalyze] LLM调用失败: {e}")
        return WeiboUserAnalyzeResponse(notes="", categories=[])
