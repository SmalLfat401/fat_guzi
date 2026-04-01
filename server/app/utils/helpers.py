"""
Utility functions for the crawler.
"""
from typing import Optional
from urllib.parse import urlparse, urljoin
import re


def is_valid_url(url: str) -> bool:
    """Check if a URL is valid."""
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except Exception:
        return False


def normalize_url(url: str, base_url: Optional[str] = None) -> str:
    """Normalize a URL, optionally joining with a base URL."""
    if base_url:
        return urljoin(base_url, url)
    return url


def extract_domain(url: str) -> Optional[str]:
    """Extract domain from URL."""
    try:
        parsed = urlparse(url)
        return parsed.netloc
    except Exception:
        return None


def sanitize_filename(filename: str) -> str:
    """Sanitize a string for use as a filename."""
    # Remove invalid characters
    return re.sub(r'[<>:"/\\|?*]', '_', filename)
