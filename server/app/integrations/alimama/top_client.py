"""
Taobao TOP (阿里开放平台) API client with signature.

Ref: https://open.taobao.com/
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
import hashlib
import logging
from typing import Any, Dict, Optional

import requests

from app.integrations.alimama.config import (
    DEFAULT_CONFIG,
    TopConfig,
    TOP_API_URL,
)

logger = logging.getLogger(__name__)


def _sign_top_request(secret: str, params: Dict[str, Any]) -> str:
    """
    TOP signature algorithm (md5):

        sign = md5(secret + concat(sorted(k+v)) + secret).upper()

    Parameters are sorted alphabetically, concatenated as key+value pairs,
    wrapped with secret on both sides, then MD5-hashed and uppercased.
    """
    items = []
    for k in sorted(params.keys()):
        v = params[k]
        # Skip None values and empty strings
        if v is None or v == "":
            continue
        items.append(f"{k}{v}")
    raw = f"{secret}{''.join(items)}{secret}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest().upper()


@dataclass
class TopClient:
    """
    TOP API client with signature generation and request handling.

    Can be instantiated with a TopConfig or with individual credentials.
    """

    app_key: str = field(default_factory=lambda: DEFAULT_CONFIG.app_key)
    app_secret: str = field(default_factory=lambda: DEFAULT_CONFIG.app_secret)
    adzone_id: int = field(default_factory=lambda: DEFAULT_CONFIG.adzone_id)
    partner_id: str = field(default_factory=lambda: DEFAULT_CONFIG.partner_id)
    session: Optional[str] = None  # optional OAuth access_token
    base_url: str = TOP_API_URL
    timeout: int = 30

    @classmethod
    def from_config(cls, config: TopConfig, session: Optional[str] = None) -> "TopClient":
        """从 TopConfig 创建 TopClient 实例"""
        return cls(
            app_key=config.app_key,
            app_secret=config.app_secret,
            adzone_id=config.adzone_id,
            partner_id=config.partner_id,
            session=session,
            base_url=config.base_url,
            timeout=config.timeout,
        )

    def request(
        self,
        method: str,
        *,
        biz_params: Optional[Dict[str, Any]] = None,
        extra_sys_params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Make a signed TOP API request.

        Args:
            method:    TOP API method name, e.g. "taobao.tbk.dg.material.optional.upgrade"
            biz_params: Business parameters specific to the API method
            extra_sys_params: Extra system-level parameters (sign_method, format, etc.)

        Returns:
            Parsed JSON response as a dict
        """
        biz_params = biz_params or {}
        extra_sys_params = extra_sys_params or {}

        sys_params: Dict[str, Any] = {
            "method": method,
            "app_key": self.app_key,
            "format": "json",
            "v": "2.0",
            "sign_method": "md5",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            **extra_sys_params,
        }
        if self.session:
            sys_params["session"] = self.session

        # Build full params: sys_params -> biz_params -> sign
        all_params: Dict[str, Any] = {**sys_params, **biz_params}
        all_params["sign"] = _sign_top_request(self.app_secret, all_params)

        logger.debug(f"[TopClient] Request: {method} | params={biz_params}")

        resp = requests.post(
            self.base_url,
            data=all_params,
            timeout=self.timeout,
        )
        resp.raise_for_status()
        result = resp.json()
        logger.debug(f"[TopClient] Response: {method} -> {str(result)[:200]}")

        return result

    def request_with_pid(
        self,
        method: str,
        *,
        biz_params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Convenience wrapper that auto-injects adzone_id into biz_params.
        """
        params = {**(biz_params or {})}
        # adzone_id must be included in biz_params for material search APIs
        if "adzone_id" not in params:
            params["adzone_id"] = self.adzone_id
        return self.request(method, biz_params=params)
