"""
阿里妈妈短链接 & 淘口令生成适配器

- 短链接: taobao.tbk.link.gen
- 淘口令: taobao.tbk.tpwd.create

这两个接口用于将搜索返回的原始 click_url 转换为：
  1. s.click.taobao.com/xxx 格式的短链接
  2. "【xxx】₤abc123₤" 格式的淘口令

Ref:
  短链接: https://open.taobao.com/doc.htm?docId=118460&docType=1
  淘口令: https://open.taobao.com/doc.htm?docId=1124&docType=1
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import logging

from app.integrations.alimama.top_client import TopClient

logger = logging.getLogger(__name__)

# 短链接默认有效期（天）
DEFAULT_SHORT_LINK_VALIDITY_DAYS = 30


# ──────────────────────────────────────────────
#  数据结构定义
# ──────────────────────────────────────────────

@dataclass
class LinkResult:
    """单条推广链接生成结果"""
    original_url: str              # 原始 click_url
    short_link: Optional[str]      # 短链接（s.click.taobao.com/xxx）
    tkl: Optional[str]             # 淘口令
    short_link_expires_at: Optional[datetime]  # 短链接过期时间
    generated_at: datetime         # 生成时间
    error: Optional[str] = None   # 错误信息


@dataclass
class BatchLinkResult:
    """批量生成结果"""
    results: List[LinkResult]
    success_count: int = 0
    fail_count: int = 0


# ──────────────────────────────────────────────
#  短链接生成
# ──────────────────────────────────────────────

def _generate_short_link(
    client: TopClient,
    click_url: str,
) -> Optional[str]:
    """
    调用 taobao.tbk.link.gen 将长链接转换为短链接。

    Args:
        client:     TopClient 实例
        click_url:  原始推广链接（click_url），支持 http:// 或 // 开头的格式

    Returns:
        短链接字符串，失败返回 None
    """
    # 标准化 URL
    url = click_url
    if url.startswith("//"):
        url = "https:" + url

    params: Dict[str, Any] = {
        "url": url,
        "adzone_id": client.adzone_id,
    }

    try:
        data = client.request("taobao.tbk.link.gen", biz_params=params)
    except Exception as e:
        logger.warning(f"[LinkGen] 短链接生成失败: {e}")
        return None

    # 解析响应
    resp = data.get("tbk_link_gen_response") or {}
    result = resp.get("result") or {}

    short_link = result.get("short_link_url") or result.get("short_link")
    if short_link:
        logger.debug(f"[LinkGen] 短链接生成成功: {short_link}")
        return short_link

    # 备选：检查 error_response
    if "error_response" in data:
        err = data["error_response"]
        logger.warning(f"[LinkGen] 短链接API错误: {err.get('msg')} {err.get('sub_msg')}")
    return None


# ──────────────────────────────────────────────
#  淘口令生成
# ──────────────────────────────────────────────

def _generate_tkl(
    client: TopClient,
    click_url: str,
    title: str,
    image_url: Optional[str] = None,
) -> Optional[str]:
    """
    调用 taobao.tbk.tpwd.create 生成淘口令。

    Args:
        client:     TopClient 实例
        click_url:  推广链接
        title:      商品标题（用于口令文案）
        image_url:  商品图片URL（可选）

    Returns:
        淘口令字符串（如 "【xxx】₤abc123₤"），失败返回 None
    """
    # 标准化 URL
    url = click_url
    if url.startswith("//"):
        url = "https:" + url

    params: Dict[str, Any] = {
        "url": url,
        "text": title[:50],  # 口令文案最多50字
    }
    if image_url:
        params["logo"] = image_url

    try:
        data = client.request("taobao.tbk.tpwd.create", biz_params=params)
    except Exception as e:
        logger.warning(f"[LinkGen] 淘口令生成失败: {e}")
        return None

    # 解析响应
    resp = data.get("tbk_tpwd_create_response") or {}
    tpwd_data = resp.get("data") or {}

    password = tpwd_data.get("password_string")
    if password:
        logger.debug(f"[LinkGen] 淘口令生成成功: {password[:20]}...")
        return password

    if "error_response" in data:
        err = data["error_response"]
        logger.warning(f"[LinkGen] 淘口令API错误: {err.get('msg')} {err.get('sub_msg')}")
    return None


# ──────────────────────────────────────────────
#  批量生成接口
# ──────────────────────────────────────────────

@dataclass
class LinkGenOptions:
    """链接生成选项"""
    generate_short_link: bool = True   # 是否生成短链接
    generate_tkl: bool = True          # 是否生成淘口令
    short_link_validity_days: int = DEFAULT_SHORT_LINK_VALIDITY_DAYS  # 短链接有效期（天）


def generate_promotion_links(
    client: TopClient,
    items: List[Dict[str, Any]],
    options: Optional[LinkGenOptions] = None,
) -> BatchLinkResult:
    """
    批量为商品生成推广链接（短链接 + 淘口令）。

    适用场景：
      - 搜索结果入库前批量生成
      - 定时任务更新商品推广链接
      - 单个商品补生成链接

    Args:
        client:   TopClient 实例（需包含 app_key, app_secret, adzone_id）
        items:    商品列表，每个 item 需包含 click_url 和 title
                 支持的 item 格式：
                   {"click_url": "...", "title": "...", "pict_url": "..."}
                 也兼容 search.py 返回的 NormalizedProduct 格式。
        options:  生成选项，默认同时生成短链接和淘口令

    Returns:
        BatchLinkResult: 包含每条记录的 LinkResult 列表，以及成功/失败计数
    """
    options = options or LinkGenOptions()
    now = datetime.now(timezone.utc)
    results: List[LinkResult] = []

    for item in items:
        click_url = item.get("click_url") or item.get("url") or ""
        title = item.get("title", "")
        image_url = item.get("pict_url") or item.get("image_url") or ""

        short_link: Optional[str] = None
        tkl: Optional[str] = None
        error_parts: List[str] = []

        if not click_url:
            result = LinkResult(
                original_url="",
                short_link=None,
                tkl=None,
                short_link_expires_at=None,
                generated_at=now,
                error="click_url 为空",
            )
            results.append(result)
            continue

        # 生成短链接
        if options.generate_short_link:
            short_link = _generate_short_link(client, click_url)
            if not short_link:
                error_parts.append("短链接")

        # 生成淘口令
        if options.generate_tkl:
            tkl = _generate_tkl(client, click_url, title, image_url or None)
            if not tkl:
                error_parts.append("淘口令")

        # 计算过期时间
        expires_at: Optional[datetime] = None
        if short_link and options.short_link_validity_days > 0:
            from datetime import timedelta
            expires_at = now + timedelta(days=options.short_link_validity_days)

        error = " + ".join(error_parts) if error_parts else None

        results.append(LinkResult(
            original_url=click_url,
            short_link=short_link,
            tkl=tkl,
            short_link_expires_at=expires_at,
            generated_at=now,
            error=error,
        ))

    success_count = sum(1 for r in results if r.short_link or r.tkl)
    fail_count = len(results) - success_count

    return BatchLinkResult(
        results=results,
        success_count=success_count,
        fail_count=fail_count,
    )


# ──────────────────────────────────────────────
#  便捷封装：单个商品
# ──────────────────────────────────────────────

def generate_single_link(
    client: TopClient,
    click_url: str,
    title: str,
    image_url: Optional[str] = None,
) -> LinkResult:
    """
    为单个商品生成推广链接。
    """
    result = generate_promotion_links(
        client,
        items=[{"click_url": click_url, "title": title, "pict_url": image_url}],
    )
    return result.results[0]
