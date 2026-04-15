"""
FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api import (
    routes,
    weibo_users_router,
    categories_router,
    guzi_terms_router,
    coser_terms_router,
    convention_terms_router,
    game_terms_router,
    platform_configs_router,
    guzi_products_router,
    guzi_tags_router,
    weibo_crawler_task,
    llm_router,
    weibo_intel as weibo_intel_router,
    h5_glossary_router,
    h5_intel,
)
from app.crawler.playwright_client import PlaywrightClient
from app.config.settings import settings
from app.database.mongo_pool import mongo_pool
from app import app_state


# Global playwright client instance
playwright_client: PlaywrightClient = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    from app.crawler.playwright_client import PlaywrightClient
    from app import browser_state as bs

    # Startup: Initialize MongoDB connection pool
    try:
        mongo_pool.initialize()
    except Exception as e:
        print(f"Warning: MongoDB connection failed: {e}")

    # Startup: Initialize Playwright
    client = PlaywrightClient(
        browser_type=settings.playwright_browser_type,
        headless=settings.playwright_headless,
        timeout=settings.playwright_timeout
    )
    await client.initialize()
    app_state.set_playwright_client(client)

    # Startup: Reset browser state (service just started, chrome is not running)
    bs.browser_state.reset()
    print("Browser state reset to not running")

    # Startup: 从数据库恢复爬虫任务状态（如果有未完成的任务）
    task_service = app_state.get_crawler_task_service()
    task_service.restore_from_db()

    yield

    # Shutdown: Cleanup Playwright
    if app_state.playwright_client:
        await app_state.playwright_client.cleanup()

    # Shutdown: Close MongoDB connection pool
    mongo_pool.close()


# Create FastAPI app
app = FastAPI(
    title="Fat OpenClaw Crawler API",
    description="Playwright + FastAPI data collection service for OpenClaw",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(routes.router, prefix="/api/v1", tags=["crawler"])
app.include_router(weibo_users_router, prefix="/api/v1", tags=["微博用户管理"])
app.include_router(categories_router, prefix="/api/v1", tags=["类别管理"])
app.include_router(guzi_terms_router, prefix="/api/v1", tags=["谷子黑话管理"])
app.include_router(coser_terms_router, prefix="/api/v1", tags=["Coser圈黑话管理"])
app.include_router(convention_terms_router, prefix="/api/v1", tags=["漫展圈黑话管理"])
app.include_router(game_terms_router, prefix="/api/v1", tags=["游戏圈/二游黑话管理"])
app.include_router(platform_configs_router, prefix="/api/v1", tags=["平台配置管理"])
app.include_router(guzi_products_router, prefix="/api/v1", tags=["谷子商品管理"])
app.include_router(guzi_tags_router, prefix="/api/v1", tags=["谷子标签管理"])
app.include_router(weibo_crawler_task.router, prefix="/api/v1", tags=["微博爬虫任务"])
app.include_router(llm_router, prefix="/api/v1", tags=["LLM 对接"])
app.include_router(weibo_intel_router.router, prefix="/api/v1", tags=["微博情报管理"])
app.include_router(h5_glossary_router, prefix="/api/v1", tags=["H5 术语百科"])
app.include_router(h5_intel.router, prefix="/api/v1", tags=["H5 情报"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Fat OpenClaw Crawler API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    mongo_status = mongo_pool.get_pool_status() if hasattr(mongo_pool, 'get_pool_status') else {"status": "unknown"}

    return {
        "status": "healthy",
        "mongodb": mongo_status
    }


# Export playwright client getter
def get_playwright_client() -> PlaywrightClient:
    """Get the global Playwright client instance."""
    return app_state.get_playwright_client()
