"""API package."""
from app.api.routes import router as routes_router
from app.api.weibo_users import router as weibo_users_router
from app.api.categories import router as categories_router
from app.api.guzi_terms import router as guzi_terms_router
from app.api.coser_terms import router as coser_terms_router
from app.api.convention_terms import router as convention_terms_router
from app.api.game_terms import router as game_terms_router
from app.api.platform_configs import router as platform_configs_router
from app.api.guzi_products import router as guzi_products_router
from app.api.guzi_tags import router as guzi_tags_router
from app.api.weibo_crawler_task import router as weibo_crawler_task_router
from app.api.llm import router as llm_router
from app.api.h5_glossary import router as h5_glossary_router
from app.api.weibo_intel import router as weibo_intel_router
from app.api.want_guzi import router as want_guzi_router
from app.api.features import router as features_router
from app.api.guzi_categories import router as guzi_categories_router
from app.api.publish_channels import router as publish_channels_router
from app.api.schedule_items import router as schedule_items_router
from app.api.track_events import router as track_events_router

__all__ = [
    "routes_router",
    "weibo_users_router",
    "categories_router",
    "guzi_terms_router",
    "coser_terms_router",
    "convention_terms_router",
    "game_terms_router",
    "platform_configs_router",
    "guzi_products_router",
    "guzi_tags_router",
    "weibo_crawler_task_router",
    "llm_router",
    "h5_glossary_router",
    "weibo_intel_router",
    "want_guzi_router",
    "features_router",
    "guzi_categories_router",
    "publish_channels_router",
    "schedule_items_router",
    "track_events_router",
]
