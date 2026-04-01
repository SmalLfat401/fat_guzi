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
