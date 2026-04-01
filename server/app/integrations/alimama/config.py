"""
淘宝联盟（阿里妈妈）基础配置

所有阿里巴巴系列接口调用的通用配置参数。
参考: https://open.taobao.com/
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


# ──────────────────────────────────────────────
#  TOP API 全局常量
# ──────────────────────────────────────────────

TOP_API_URL = "https://eco.taobao.com/router/rest"
DEFAULT_TIMEOUT = 30  # 秒


# ──────────────────────────────────────────────
#  基础认证参数
# ──────────────────────────────────────────────

# 淘宝联盟 PID 格式: mm_{partner_id}_{推广位id}
# mm_9978487574_3398800058_116236300303
PID = "mm_9978487574_3398800058_116236300303"

# PID 拆分
PID_PARTNER_ID = "9978487574"      # 联盟partner ID
PID_ADZONE_ID = "116236300303"     # 广告位ID (adzone_id)
PID_ADZONE_ID_INT = 116236300303  # int 类型，用于API调用


@dataclass(frozen=True)
class TopConfig:
    """TOP API 完整配置"""

    # 应用凭证
    app_key: str = "35293033"
    app_secret: str = "25e8f9486051b52c68dd93dffd3c6b6e"

    # PID 配置
    pid: str = PID
    partner_id: str = PID_PARTNER_ID
    adzone_id: int = PID_ADZONE_ID_INT

    # API 地址
    base_url: str = TOP_API_URL
    timeout: int = DEFAULT_TIMEOUT

    # 渠道信息（可选）
    site_id: Optional[int] = None  # 媒体ID


# 全局默认配置实例
DEFAULT_CONFIG = TopConfig()
