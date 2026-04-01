"""
微博爬虫服务模块 (Weibo Crawler Service)

提供专门针对新浪微博的数据抓取功能:
- 首页时间线抓取
- 用户主页抓取
- 单条微博详情抓取
- 评论区抓取

使用方式:
1. 无需提供Cookies - 直接调用接口，浏览器会打开让你登录
2. 第一次登录后可以保存Cookies，后续自动复用
"""
import asyncio
import json
import os
from typing import Optional, Dict, Any, List

from app.crawler.playwright_client import PlaywrightClient
from app.models.schemas import (
    WeiboCrawlRequest,
    WeiboCrawlResponse,
    WeiboUserInfo,
    WeiboPost
)


class WeiboCrawlerService:
    """微博爬虫服务类
    
    用于抓取微博数据,支持:
    - timeline: 首页时间线
    - user: 用户主页
    - post: 单条微博
    - comments: 评论区
    
    使用方式:
    - headless=False + 第一次: 打开浏览器让你手动登录
    - 登录后自动保存Cookies到文件
    - 后续调用自动从文件加载Cookies
    """
    
    # 默认Cookies保存文件
    DEFAULT_COOKIES_FILE = "weibo_cookies.json"
    
    # 微博相关的CSS选择器 (可能需要根据实际页面调整)
    SELECTORS = {
        # 用户信息选择器
        "user_avatar": ".avatar, .user-avatar img, [node-type='user_avatar'] img",
        "user_nickname": ".username, .nickname, [node-type='nick']",
        "user_description": ".user-info .addr, .user_des, [node-type='desc']",
        "followers_count": ".follower .count, .followers .num",
        "following_count": ".following .count, .following .num",
        "weibo_count": ".weibo .count, .weibo .num",
        
        # 微博内容选择器
        "post_list": ".WB_feed .WB_card, .feed-item, [node-type='feed_list']",
        "post_content": ".WB_text, .feed_content, [node-type='feed_list_content']",
        "post_author": ".WB_info a, .feed_from a, .name",
        "post_time": ".WB_from a, .feed_from a[date]",
        "post_likes": ".pos .pos .S_txt2, .like .num, [node-type='like']",
        "post_comments": ".pos .pos:nth-child(2) .S_txt2, .comment .num",
        "post_reposts": ".pos:nth-child(3) .S_txt2, .repost .num",
        "post_images": ".WB_media_wrap img, .picture img, .upload-img img",
        "post_source": ".WB_from .S_txt2, .feed_from .source",
    }
    
    def __init__(self, playwright_client: PlaywrightClient):
        """初始化微博爬虫服务
        
        Args:
            playwright_client: Playwright客户端实例
        """
        self.client = playwright_client
        self._headless_override = None  # 用于临时覆盖headless模式
    
    def set_headless(self, headless: bool):
        """设置浏览器是否可见
        
        Args:
            headless: True=无头(后台运行), False=可见浏览器
        """
        self._headless_override = headless
    
    def _get_headless(self, request: WeiboCrawlRequest) -> bool:
        """获取headless模式设置
        
        Args:
            request: 请求对象
            
        Returns:
            bool: 是否使用无头模式
        """
        if self._headless_override is not None:
            return self._headless_override
        return request.headless if request.headless is not None else True
    
    async def crawl(self, request: WeiboCrawlRequest) -> WeiboCrawlResponse:
        """执行微博抓取 - 极简版
        
        只需要URL即可自动抓取
        
        Args:
            request: 微博抓取请求
            
        Returns:
            WeiboCrawlResponse: 抓取结果
        """
        page = None
        
        # 默认配置
        cookies_file = self.DEFAULT_COOKIES_FILE
        scroll_count = 3
        scroll_delay = 2000
        
        try:
            # 尝试从文件加载Cookies
            cookies = None
            if os.path.exists(cookies_file):
                with open(cookies_file, 'r', encoding='utf-8') as f:
                    cookies = json.load(f)
            
            # 创建页面
            page = await self._create_page_with_cookies(cookies)
            
            # 导航到目标URL
            await page.goto(request.url, wait_until="networkidle", timeout=30000)
            
            # 滚动页面加载更多内容
            for i in range(scroll_count):
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(scroll_delay / 1000)
            
            # 获取页面HTML
            html = await page.content()
            
            # 获取Cookies
            page_cookies = await page.context.cookies()
            
            return WeiboCrawlResponse(
                success=True,
                url=request.url,
                html=html[:100000] if html else None,  # 限制长度
                cookies=page_cookies
            )
                
        except Exception as e:
            return WeiboCrawlResponse(
                success=False,
                url=request.url,
                error=str(e)
            )
        finally:
            if page:
                await self.client.close_page(page)
    
    async def _create_page_with_cookies(
        self,
        cookies: Optional[List[Dict[str, str]]] = None
    ):
        """创建页面并设置Cookies
        
        Args:
            cookies: 可选的Cookies列表
            
        Returns:
            Page: Playwright页面对象
        """
        page = await self.client.create_page(cookies=cookies)
        return page
    
    async def _check_if_need_login(self, page) -> bool:
        """检查是否需要登录
        
        通过检查页面是否有登录相关的元素来判断
        
        Args:
            page: Playwright页面对象
            
        Returns:
            bool: 是否需要登录
        """
        try:
            # 检查是否有登录弹窗或未登录提示
            # 微博未登录时会有登录框
            js_code = """
            function() {
                // 检查登录相关元素
                const loginBox = document.querySelector('.loginbox, .W_login_box, [node-type="login_box"]');
                const loginBtn = document.querySelector('.W_btn_a, .login_btn, [node-type="login"]');
                const unloginTip = document.querySelector('.gn_login, .login-tip');
                
                // 检查是否有用户信息 (登录后会显示用户名)
                const userInfo = document.querySelector('.username, .WB_nickname, [node-type="nickname"]');
                
                // 如果有登录框或没有用户信息，说明未登录
                return !!(loginBox || loginBtn || !userInfo);
            }
            """
            need_login = await page.evaluate(js_code)
            return need_login
        except Exception:
            return True  # 出错时默认需要登录
    
    async def _navigate_to_weibo(self, page, request: WeiboCrawlRequest):
        """导航到微博页面
        
        Args:
            page: Playwright页面对象
            request: 抓取请求
        """
        # 设置用户代理
        if request.user_agent:
            await page.set_extra_http_headers({"User-Agent": request.user_agent})
        
        timeout = request.wait_timeout or 30000
        
        if request.wait_for:
            # 等待指定选择器
            await page.goto(request.url, wait_until="domcontentloaded", timeout=timeout)
            await page.wait_for_selector(request.wait_for, timeout=timeout)
        else:
            # 等待页面加载完成
            await page.goto(request.url, wait_until="networkidle", timeout=timeout)
    
    async def _scroll_page(
        self,
        page,
        scroll_count: int = 3,
        scroll_delay: int = 2000
    ):
        """滚动页面以加载更多内容
        
        Args:
            page: Playwright页面对象
            scroll_count: 滚动次数
            scroll_delay: 滚动间隔(毫秒)
        """
        for i in range(scroll_count):
            # 滚动到页面底部
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            # 等待内容加载
            await asyncio.sleep(scroll_delay / 1000)
    
    async def _extract_timeline(
        self,
        page,
        request: WeiboCrawlRequest
    ) -> WeiboCrawlResponse:
        """提取微博时间线/列表
        
        Args:
            page: Playwright页面对象
            request: 抓取请求
            
        Returns:
            WeiboCrawlResponse: 抓取结果
        """
        # 获取页面HTML
        html = await page.content()
        
        # 获取页面标题
        title = await page.title()
        
        # 获取当前Cookies
        cookies = await page.context.cookies()
        
        # 截图
        screenshot_base64 = None
        if request.screenshot:
            screenshot_base64 = await self.client.take_screenshot(
                page, 
                request.full_page or False
            )
        
        # 使用JavaScript提取微博数据 (更可靠)
        posts_data = await self._extract_posts_with_js(page, request.max_posts or 20)
        
        return WeiboCrawlResponse(
            success=True,
            url=request.url,
            posts=posts_data,
            html=html[:50000] if html else None,  # 限制HTML长度
            screenshot=screenshot_base64,
            cookies=cookies
        )
    
    async def _extract_user_profile(
        self,
        page,
        request: WeiboCrawlRequest
    ) -> WeiboCrawlResponse:
        """提取用户主页信息
        
        Args:
            page: Playwright页面对象
            request: 抓取请求
            
        Returns:
            WeiboCrawlResponse: 抓取结果
        """
        # 获取页面HTML
        html = await page.content()
        
        # 获取Cookies
        cookies = await page.context.cookies()
        
        # 截图
        screenshot_base64 = None
        if request.screenshot:
            screenshot_base64 = await self.client.take_screenshot(
                page,
                request.full_page or False
            )
        
        # 使用JavaScript提取用户信息
        user_info = await self._extract_user_info_with_js(page)
        
        # 提取微博列表
        posts_data = await self._extract_posts_with_js(page, request.max_posts or 20)
        
        return WeiboCrawlResponse(
            success=True,
            url=request.url,
            user_info=user_info,
            posts=posts_data,
            html=html[:50000] if html else None,
            screenshot=screenshot_base64,
            cookies=cookies
        )
    
    async def _extract_posts_with_js(
        self,
        page,
        max_posts: int = 20
    ) -> List[WeiboPost]:
        """使用JavaScript提取微博数据 (更可靠的方法)
        
        通过执行JavaScript来提取微博数据,这种方法比CSS选择器更可靠,
        因为可以直接访问DOM元素和属性。
        
        Args:
            page: Playwright页面对象
            max_posts: 最大提取数量
            
        Returns:
            List[WeiboPost]: 微博列表
        """
        js_code = f"""
        function() {{
            const posts = [];
            const maxPosts = {max_posts};
            
            // 尝试多种微博容器选择器
            const containers = document.querySelectorAll('.WB_feed .WB_card, .feed-item, [node-type="feed_list"], .WB_feed_type');
            
            containers.forEach((container, index) => {{
                if (index >= maxPosts) return;
                
                try {{
                    // 提取微博ID
                    const postId = container.getAttribute('mid') || 
                                  container.getAttribute('id') || 
                                  '';
                    
                    // 提取微博内容
                    const contentEl = container.querySelector('.WB_text, .feed_content, [node-type="feed_list_content"]');
                    const content = contentEl ? contentEl.innerText.trim() : '';
                    
                    // 提取作者信息
                    const authorEl = container.querySelector('.WB_info a, .feed_from a, .name');
                    const author = authorEl ? authorEl.innerText.trim() : '';
                    const authorId = authorEl ? authorEl.getAttribute('href') : '';
                    
                    // 提取发布时间
                    const timeEl = container.querySelector('.WB_from a[date], [node-type="feed_list_item_date"]');
                    const publishTime = timeEl ? (timeEl.getAttribute('date') || timeEl.innerText.trim()) : '';
                    
                    // 提取互动数据 (点赞、评论、转发)
                    const likeEl = container.querySelector('.pos .pos .S_txt2, .like .num, [node-type="like"]');
                    const commentEl = container.querySelector('.pos .pos:nth-child(2) .S_txt2, .comment .num');
                    const repostEl = container.querySelector('.pos:nth-child(3) .S_txt2, .repost .num');
                    
                    const likes = likeEl ? parseInt(likeEl.innerText.replace(/[^0-9]/g, '')) || 0 : 0;
                    const comments = commentEl ? parseInt(commentEl.innerText.replace(/[^0-9]/g, '')) || 0 : 0;
                    const reposts = repostEl ? parseInt(repostEl.innerText.replace(/[^0-9]/g, '')) || 0 : 0;
                    
                    // 提取发布来源
                    const sourceEl = container.querySelector('.WB_from .S_txt2, .feed_from .source');
                    const source = sourceEl ? sourceEl.innerText.trim() : '';
                    
                    // 提取图片
                    const images = [];
                    const imgEls = container.querySelectorAll('.WB_media_wrap img, .picture img, .upload-img img');
                    imgEls.forEach(img => {{
                        const src = img.getAttribute('src') || img.getAttribute('original');
                        if (src) images.push(src.replace('//', 'https://'));
                    }});
                    
                    if (content || author) {{
                        posts.push({{
                            post_id: postId,
                            content: content,
                            author: author,
                            author_id: authorId,
                            publish_time: publishTime,
                            likes: likes,
                            comments: comments,
                            reposts: reposts,
                            source: source,
                            images: images.length > 0 ? images : null
                        }});
                    }}
                }} catch (e) {{
                    // 跳过解析错误的微博
                }}
            }});
            
            return posts;
        }}
        """
        
        try:
            posts_data = await page.evaluate(js_code)
            
            # 转换为WeiboPost对象列表
            posts = []
            for post_data in posts_data:
                posts.append(WeiboPost(
                    post_id=post_data.get("post_id"),
                    content=post_data.get("content"),
                    author=post_data.get("author"),
                    author_id=post_data.get("author_id"),
                    publish_time=post_data.get("publish_time"),
                    likes=post_data.get("likes"),
                    comments=post_data.get("comments"),
                    reposts=post_data.get("reposts"),
                    source=post_data.get("source"),
                    images=post_data.get("images")
                ))
            
            return posts
        except Exception as e:
            print(f"Error extracting posts with JS: {e}")
            return []
    
    async def _extract_user_info_with_js(self, page) -> Optional[WeiboUserInfo]:
        """使用JavaScript提取用户信息
        
        Args:
            page: Playwright页面对象
            
        Returns:
            Optional[WeiboUserInfo]: 用户信息
        """
        js_code = """
        function() {
            // 用户信息可能存在于多个位置
            const userInfo = {};
            
            // 尝试从个人资料区域获取
            const profileArea = document.querySelector('.profile-cover, .user-info');
            
            if (profileArea) {
                // 获取头像
                const avatarImg = profileArea.querySelector('.avatar img, .user-avatar img, [node-type="user_avatar"] img');
                if (avatarImg) {
                    userInfo.avatar = avatarImg.getAttribute('src') || avatarImg.getAttribute('original');
                }
                
                // 获取昵称
                const nicknameEl = profileArea.querySelector('.username, .nickname, [node-type="nick"]');
                if (nicknameEl) {
                    userInfo.nickname = nicknameEl.innerText.trim();
                }
                
                // 获取简介
                const descEl = profileArea.querySelector('.user-info .addr, .user_des, [node-type="desc"]');
                if (descEl) {
                    userInfo.description = descEl.innerText.trim();
                }
            }
            
            // 获取统计数据
            const statsEls = document.querySelectorAll('.follower .count, .following .count, .weibo .count, .num');
            if (statsEls.length >= 3) {
                userInfo.followers_count = parseInt(statsEls[0].innerText.replace(/[^0-9]/g, '')) || 0;
                userInfo.following_count = parseInt(statsEls[1].innerText.replace(/[^0-9]/g, '')) || 0;
                userInfo.weibo_count = parseInt(statsEls[2].innerText.replace(/[^0-9]/g, '')) || 0;
            }
            
            // 从URL中提取用户ID
            const urlMatch = window.location.href.match(/weibo\\.com\\/(u\\/|\\/)([a-zA-Z0-9_-]+)/);
            if (urlMatch) {
                userInfo.user_id = urlMatch[2];
            }
            
            return Object.keys(userInfo).length > 0 ? userInfo : null;
        }
        """
        
        try:
            user_data = await page.evaluate(js_code)
            
            if user_data:
                return WeiboUserInfo(
                    user_id=user_data.get("user_id"),
                    nickname=user_data.get("nickname"),
                    avatar=user_data.get("avatar"),
                    description=user_data.get("description"),
                    followers_count=user_data.get("followers_count"),
                    following_count=user_data.get("following_count"),
                    weibo_count=user_data.get("weibo_count")
                )
            return None
        except Exception as e:
            print(f"Error extracting user info with JS: {e}")
            return None


async def create_weibo_service(client: PlaywrightClient) -> WeiboCrawlerService:
    """创建微博爬虫服务实例的辅助函数
    
    Args:
        client: Playwright客户端
        
    Returns:
        WeiboCrawlerService: 微博爬虫服务实例
    """
    return WeiboCrawlerService(client)
