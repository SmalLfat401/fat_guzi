"""
Pydantic schemas for request/response models.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ====================
# Request Models
# ====================

class CrawlRequest(BaseModel):
    """Request model for crawling a URL."""
    url: str = Field(..., description="URL to crawl")
    selectors: Optional[Dict[str, str]] = Field(
        default=None,
        description="CSS selectors for extracting specific elements"
    )
    wait_for: Optional[str] = Field(
        default=None,
        description="CSS selector to wait for before extracting content"
    )
    wait_timeout: Optional[int] = Field(
        default=5000,
        description="Timeout for wait_for in milliseconds"
    )
    screenshot: Optional[bool] = Field(
        default=False,
        description="Whether to take a screenshot"
    )
    user_agent: Optional[str] = Field(
        default=None,
        description="Custom user agent string"
    )
    cookies: Optional[List[Dict[str, str]]] = Field(
        default=None,
        description="Cookies to set before navigation"
    )


class ScreenshotRequest(BaseModel):
    """Request model for taking a screenshot."""
    url: str = Field(..., description="URL to take screenshot of")
    full_page: Optional[bool] = Field(
        default=False,
        description="Whether to capture full page"
    )
    viewport: Optional[Dict[str, int]] = Field(
        default={"width": 1920, "height": 1080},
        description="Viewport dimensions"
    )


class EvaluateScriptRequest(BaseModel):
    """Request model for executing JavaScript."""
    url: str = Field(..., description="URL to navigate to")
    script: str = Field(..., description="JavaScript code to execute")
    wait_for: Optional[str] = Field(
        default=None,
        description="CSS selector to wait for"
    )


# ====================
# Response Models
# ====================

class CrawlResponse(BaseModel):
    """Response model for crawl operations."""
    success: bool = Field(..., description="Whether the operation was successful")
    url: str = Field(..., description="The crawled URL")
    title: Optional[str] = Field(default=None, description="Page title")
    content: Optional[str] = Field(default=None, description="Extracted text content")
    html: Optional[str] = Field(default=None, description="Full HTML content")
    data: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Extracted data using selectors"
    )
    screenshot: Optional[str] = Field(
        default=None,
        description="Base64 encoded screenshot"
    )
    cookies: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Page cookies"
    )
    error: Optional[str] = Field(default=None, description="Error message if failed")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp of the crawl"
    )


class ScreenshotResponse(BaseModel):
    """Response model for screenshot operations."""
    success: bool = Field(..., description="Whether the operation was successful")
    url: str = Field(..., description="The URL that was captured")
    screenshot: Optional[str] = Field(
        default=None,
        description="Base64 encoded screenshot"
    )
    error: Optional[str] = Field(default=None, description="Error message if failed")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp of the screenshot"
    )


class ScriptResponse(BaseModel):
    """Response model for script evaluation."""
    success: bool = Field(..., description="Whether the operation was successful")
    url: str = Field(..., description="The URL that was executed on")
    result: Optional[Any] = Field(
        default=None,
        description="Result of the script execution"
    )
    error: Optional[str] = Field(default=None, description="Error message if failed")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp of the execution"
    )


class OpenBrowserRequest(BaseModel):
    """打开浏览器请求模型"""
    url: str = Field(..., description="要打开的URL地址")
    headless: Optional[bool] = Field(
        default=False,
        description="是否以无头模式运行 (默认False, 显示浏览器界面)"
    )
    viewport: Optional[Dict[str, int]] = Field(
        default={"width": 1920, "height": 1080},
        description="浏览器视口大小"
    )
    use_existing: Optional[bool] = Field(
        default=True,
        description="是否优先使用已打开的Chrome浏览器 (默认True，需要先启动Chrome --remote-debugging-port=9222)"
    )


class StartChromeRequest(BaseModel):
    """启动调试模式Chrome请求模型"""
    profile_dir: Optional[str] = Field(
        default="Default",
        description="Chrome配置目录名称，如 Default, Profile 1, Profile 2 等"
    )
    port: Optional[int] = Field(
        default=9222,
        description="调试端口号"
    )


class StartChromeResponse(BaseModel):
    """启动调试模式Chrome响应模型"""
    success: bool = Field(..., description="是否成功启动Chrome")
    message: Optional[str] = Field(default=None, description="附加信息")
    error: Optional[str] = Field(default=None, description="错误信息")


class OpenBrowserResponse(BaseModel):
    """打开浏览器响应模型"""
    success: bool = Field(..., description="是否成功打开浏览器")
    url: str = Field(..., description="打开的URL")
    title: Optional[str] = Field(default=None, description="页面标题")
    message: Optional[str] = Field(default=None, description="附加信息")
    error: Optional[str] = Field(default=None, description="错误信息")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="打开时间"
    )


# ====================
# Weibo Models (微博数据模型)
# ====================

class WeiboUserInfo(BaseModel):
    """微博用户信息模型"""
    user_id: Optional[str] = Field(default=None, description="用户ID")
    nickname: Optional[str] = Field(default=None, description="用户昵称")
    avatar: Optional[str] = Field(default=None, description="头像URL")
    description: Optional[str] = Field(default=None, description="个人简介")
    followers_count: Optional[int] = Field(default=None, description="粉丝数")
    following_count: Optional[int] = Field(default=None, description="关注数")
    weibo_count: Optional[int] = Field(default=None, description="微博数")


class WeiboPost(BaseModel):
    """单条微博模型"""
    post_id: Optional[str] = Field(default=None, description="微博ID")
    content: Optional[str] = Field(default=None, description="微博内容")
    author: Optional[str] = Field(default=None, description="发布者昵称")
    author_id: Optional[str] = Field(default=None, description="发布者ID")
    publish_time: Optional[str] = Field(default=None, description="发布时间")
    likes: Optional[int] = Field(default=None, description="点赞数")
    comments: Optional[int] = Field(default=None, description="评论数")
    reposts: Optional[int] = Field(default=None, description="转发数")
    source: Optional[str] = Field(default=None, description="发布来源")
    images: Optional[List[str]] = Field(default=None, description="图片列表")


class WeiboCrawlRequest(BaseModel):
    """微博抓取请求 - 极简版
    
    只需要传入URL即可自动抓取
    """
    url: str = Field(..., description="微博URL (如: https://weibo.com/u/xxx)")


class WeiboCrawlResponse(BaseModel):
    """微博抓取响应模型"""
    success: bool = Field(..., description="是否成功")
    url: str = Field(..., description="抓取的URL")
    
    # 用户信息 (如果抓取用户主页)
    user_info: Optional[WeiboUserInfo] = Field(
        default=None,
        description="用户信息"
    )
    
    # 微博列表
    posts: Optional[List[WeiboPost]] = Field(
        default=None,
        description="微博列表"
    )
    
    # 页面HTML (完整HTML)
    html: Optional[str] = Field(
        default=None,
        description="页面HTML"
    )
    
    # 截图
    screenshot: Optional[str] = Field(
        default=None,
        description="Base64编码的截图"
    )
    
    # Cookies
    cookies: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="当前页面Cookies"
    )
    
    # 错误信息
    error: Optional[str] = Field(default=None, description="错误信息")
    
    # 时间戳
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="抓取时间"
    )
