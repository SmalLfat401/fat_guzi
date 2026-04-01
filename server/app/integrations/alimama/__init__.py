"""Alimama (淘宝客 / Taobao Affiliate) integration."""

from app.integrations.alimama.config import (
    DEFAULT_CONFIG,
    PID,
    PID_ADZONE_ID,
    PID_ADZONE_ID_INT,
    PID_PARTNER_ID,
    TopConfig,
    TOP_API_URL,
)
from app.integrations.alimama.top_client import TopClient
from app.integrations.alimama.search import (
    NormalizedProduct,
    SearchResult,
    SortType,
    search_products,
)

__all__ = [
    # config
    "TopConfig",
    "DEFAULT_CONFIG",
    "TOP_API_URL",
    "PID",
    "PID_PARTNER_ID",
    "PID_ADZONE_ID",
    "PID_ADZONE_ID_INT",
    # client
    "TopClient",
    # search
    "search_products",
    "NormalizedProduct",
    "SearchResult",
    "SortType",
]
