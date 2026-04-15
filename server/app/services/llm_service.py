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

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None, timeout: float = 120.0):
        self.api_key = api_key or settings.llm_api_key
        self.model = model or settings.llm_model
        self.timeout = timeout  # 默认120秒超时
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.BASE_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                timeout=httpx.Timeout(self.timeout, connect=10.0),
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

        Raises:
            Exception: API 返回非 200 状态码或响应体为空时抛出，带明确原因
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

        # 检查响应体是否为空
        text = response.text.strip()
        if not text:
            raise Exception(f"API返回空响应（状态码={response.status_code}），请检查 API Key、模型名称或是否触发限流")

        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            raise Exception(f"API返回非JSON格式（状态码={response.status_code}）：{text[:200]}")

        # 检查 OpenAI 协议标准错误格式
        if "error" in data:
            err = data["error"]
            err_msg = err.get("message", "") or str(err)
            raise Exception(f"API返回错误：{err_msg}")

        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not content:
            raise Exception("API返回内容为空")

        return content

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
