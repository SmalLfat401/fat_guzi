"""
Crawler service module.
"""
from typing import Optional, Dict, Any

from playwright.async_api import Page
from app.crawler.playwright_client import PlaywrightClient
from app.models.schemas import CrawlRequest, CrawlResponse, ScreenshotResponse, ScriptResponse


class CrawlerService:
    """Service for web crawling operations."""
    
    def __init__(self, playwright_client: PlaywrightClient):
        self.client = playwright_client
    
    async def crawl(self, request: CrawlRequest) -> CrawlResponse:
        """Execute crawl request."""
        page = None
        
        try:
            # Navigate to URL
            page = await self.client.navigate(
                url=request.url,
                wait_for=request.wait_for,
                wait_timeout=request.wait_timeout,
                user_agent=request.user_agent
            )
            
            # Get page content
            page_info = await self.client.get_page_content(page)
            
            # Extract data using selectors if provided
            extracted_data = None
            if request.selectors:
                extracted_data = await self.client.extract_by_selectors(
                    page, request.selectors
                )
            
            # Take screenshot if requested
            screenshot_base64 = None
            if request.screenshot:
                screenshot_base64 = await self.client.take_screenshot(page)
            
            # Build response
            return CrawlResponse(
                success=True,
                url=request.url,
                title=page_info.get("title"),
                content=page_info.get("content")[:10000] if page_info.get("content") else None,
                html=page_info.get("content"),
                data=extracted_data,
                screenshot=screenshot_base64,
                cookies=page_info.get("cookies")
            )
            
        except Exception as e:
            return CrawlResponse(
                success=False,
                url=request.url,
                error=str(e)
            )
        finally:
            if page:
                await self.client.close_page(page)
    
    async def take_screenshot(
        self,
        url: str,
        full_page: bool = False,
        viewport: Optional[Dict[str, int]] = None
    ) -> ScreenshotResponse:
        """Take a screenshot of a URL."""
        page = None
        
        try:
            page = await self.client.navigate(url=url)
            screenshot_base64 = await self.client.take_screenshot(page, full_page)
            
            return ScreenshotResponse(
                success=True,
                url=url,
                screenshot=screenshot_base64
            )
        except Exception as e:
            return ScreenshotResponse(
                success=False,
                url=url,
                error=str(e)
            )
        finally:
            if page:
                await self.client.close_page(page)
    
    async def evaluate_script(
        self,
        url: str,
        script: str,
        wait_for: Optional[str] = None
    ) -> ScriptResponse:
        """Evaluate JavaScript on a URL."""
        page = None
        
        try:
            page = await self.client.navigate(
                url=url,
                wait_for=wait_for
            )
            
            result = await self.client.evaluate_script(page, script)
            
            return ScriptResponse(
                success=True,
                url=url,
                result=result
            )
        except Exception as e:
            return ScriptResponse(
                success=False,
                url=url,
                error=str(e)
            )
        finally:
            if page:
                await self.client.close_page(page)
