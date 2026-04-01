"""
Playwright client for browser automation.
"""
import asyncio
import base64
from typing import Optional, Dict, Any, List

from playwright.async_api import async_playwright, Browser, BrowserContext, Page, Playwright
from app.config.settings import settings


class PlaywrightClient:
    """Async Playwright client for browser automation."""
    
    def __init__(
        self,
        browser_type: str = "chromium",
        headless: bool = True,
        timeout: int = 30000
    ):
        self.browser_type = browser_type
        self.headless = headless
        self.timeout = timeout
        self.playwright: Optional[Playwright] = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
    
    async def initialize(self):
        """Initialize Playwright and launch browser."""
        self.playwright = await async_playwright().start()
        browser_cls = getattr(self.playwright, self.browser_type)
        self.browser = await browser_cls.launch(headless=self.headless)
        
        # Create a default context with common settings
        self.context = await self.browser.new_context(
            user_agent=settings.default_user_agent,
            viewport={"width": 1920, "height": 1080}
        )
    
    async def cleanup(self):
        """Cleanup Playwright resources."""
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
    
    async def create_page(self, cookies: Optional[List[Dict[str, str]]] = None) -> Page:
        """Create a new page with optional cookies."""
        context = await self.browser.new_context(
            user_agent=settings.default_user_agent,
            viewport={"width": 1920, "height": 1080}
        )
        
        if cookies:
            await context.add_cookies(cookies)
        
        page = await context.new_page()
        return page
    
    async def close_page(self, page: Page):
        """Close a page and its context."""
        await page.context.close()
        await page.close()
    
    async def navigate(
        self,
        url: str,
        wait_for: Optional[str] = None,
        wait_timeout: Optional[int] = None,
        user_agent: Optional[str] = None
    ) -> Page:
        """Navigate to a URL and optionally wait for an element."""
        page = await self.create_page()
        
        try:
            if user_agent:
                await page.set_extra_http_headers({"User-Agent": user_agent})
            
            timeout = wait_timeout or self.timeout
            
            if wait_for:
                await page.goto(url, wait_until="domcontentloaded", timeout=timeout)
                await page.wait_for_selector(wait_for, timeout=timeout)
            else:
                await page.goto(url, wait_until="networkidle", timeout=timeout)
            
            return page
        except Exception:
            await self.close_page(page)
            raise
    
    async def get_page_content(self, page: Page) -> Dict[str, Any]:
        """Get page content and metadata."""
        content = await page.content()
        title = await page.title()
        
        # Get cookies
        cookies = await page.context.cookies()
        
        return {
            "content": content,
            "title": title,
            "cookies": cookies
        }
    
    async def extract_by_selectors(
        self,
        page: Page,
        selectors: Dict[str, str]
    ) -> Dict[str, Any]:
        """Extract data using CSS selectors."""
        result = {}
        
        for key, selector in selectors.items():
            try:
                elements = await page.query_selector_all(selector)
                if len(elements) == 1:
                    result[key] = await elements[0].inner_text()
                else:
                    result[key] = await asyncio.gather(
                        *[el.inner_text() for el in elements]
                    )
            except Exception:
                result[key] = None
        
        return result
    
    async def take_screenshot(
        self,
        page: Page,
        full_page: bool = False
    ) -> str:
        """Take a screenshot and return base64 encoded string."""
        screenshot_bytes = await page.screenshot(full_page=full_page)
        return base64.b64encode(screenshot_bytes).decode("utf-8")
    
    async def evaluate_script(
        self,
        page: Page,
        script: str
    ) -> Any:
        """Evaluate JavaScript on the page."""
        return await page.evaluate(script)
