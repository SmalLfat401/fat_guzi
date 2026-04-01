"""
LLM 服务模块
提供流式和非流式两种调用方式，兼容 OpenAI 协议的服务商
（如 DeepSeek、OpenAI、硅基流动等）
"""
import json
import httpx
from typing import AsyncGenerator, Optional
from app.config.settings import settings


class LLMService:
    """LLM API 调用封装（兼容 OpenAI 协议的服务商）"""

    BASE_URL = settings.llm_base_url

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.llm_api_key
        self.model = model or settings.llm_model
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.BASE_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                timeout=httpx.Timeout(60.0, connect=10.0),
            )
        return self._client

    async def close(self):
        """关闭 HTTP 客户端"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def chat(
        self,
        messages: list,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        """
        非流式调用，返回完整响应内容

        Args:
            messages: OpenAI 格式的消息列表
            temperature: 温度参数，控制随机性
            max_tokens: 最大 token 数

        Returns:
            模型生成的完整文本
        """
        client = self._get_client()
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }

        response = await client.post("/chat/completions", json=payload)
        response.raise_for_status()
        data = response.json()

        return data["choices"][0]["message"]["content"]

    async def stream_chat(
        self,
        messages: list,
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> AsyncGenerator[str, None]:
        """
        流式调用，实时 yield 每个 token

        Args:
            messages: OpenAI 格式的消息列表
            temperature: 温度参数
            max_tokens: 最大 token 数

        Yields:
            每个 token 的增量文本
        """
        client = self._get_client()
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        async with client.stream("POST", "/chat/completions", json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line or line == "data: [DONE]":
                    continue
                if line.startswith("data: "):
                    line = line[6:]
                try:
                    data = json.loads(line)
                    delta = data.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield content
                except json.JSONDecodeError:
                    continue


# 全局单例
llm_service = LLMService()
