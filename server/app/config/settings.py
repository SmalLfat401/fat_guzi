"""
Configuration settings for the crawler application.
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings."""

    # FastAPI Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True

    # Playwright Settings
    playwright_browser_type: str = "chromium"
    playwright_headless: bool = True
    playwright_timeout: int = 30000

    # Crawler Settings
    default_user_agent: str = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    max_concurrent_tasks: int = 5

    # LLM API（用于 AI 助写功能）
    # 支持 DeepSeek / OpenAI 等兼容 OpenAI Chat Completion 协议的模型服务商
    # 申请 DeepSeek: https://platform.deepseek.com/
    # 申请 OpenAI: https://platform.openai.com/
    llm_api_key: str = "sk-eaefde6568f549e98f020c11669aa849"
    llm_model: str = "deepseek-chat"
    llm_base_url: str = "https://api.deepseek.com"

    # OpenClaw API (Optional)
    openclaw_api_url: Optional[str] = None
    openclaw_api_key: Optional[str] = None

    # MongoDB Settings
    mongodb_host: str = "localhost"
    mongodb_port: int = 27017
    mongodb_db: str = "guozi_cai"
    mongodb_user: Optional[str] = None
    mongodb_password: Optional[str] = None
    mongodb_max_pool_size: int = 50
    mongodb_min_pool_size: int = 5
    mongodb_max_idle_time_ms: int = 1800000

    def get_mongodb_connection_string(self) -> str:
        """Get MongoDB connection string."""
        if self.mongodb_user and self.mongodb_password:
            return f"mongodb://{self.mongodb_user}:{self.mongodb_password}@{self.mongodb_host}:{self.mongodb_port}/{self.mongodb_db}"
        else:
            return f"mongodb://{self.mongodb_host}:{self.mongodb_port}/{self.mongodb_db}"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Create a singleton instance
settings = Settings()
