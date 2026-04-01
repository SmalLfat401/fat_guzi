"""
API routes for crawler operations.
"""
from fastapi import APIRouter
from typing import Dict, Any

import app.app_state as app_state
import app.browser_state as browser_state_module
from app.models.schemas import (
    OpenBrowserRequest,
    OpenBrowserResponse,
    StartChromeRequest,
    StartChromeResponse
)


router = APIRouter()


# ====================
# 浏览器控制接口
# ====================

@router.post("/browser/open", response_model=OpenBrowserResponse)
async def open_browser(request: OpenBrowserRequest) -> Dict[str, Any]:
    """
    打开浏览器并访问指定URL
    
    - **url**: 要打开的URL地址 (必填)
    - **headless**: 是否以无头模式运行 (默认False, 显示浏览器界面)
    - **viewport**: 浏览器视口大小 (默认1920x1080)
    - **wait_time**: 等待时间秒数，让页面数据加载完成 (默认10秒)
    - **use_existing**: 是否优先使用已打开的Chrome浏览器 (默认True)
    
    返回:
    - success: 是否成功
    - url: 打开的URL
    - title: 页面标题
    - error: 错误信息
    """
    from playwright.async_api import async_playwright
    import asyncio
    
    CDP_URL = "http://127.0.0.1:9222"
    wait_time = 10  # 默认等待10秒
    use_existing = getattr(request, 'use_existing', True)  # 默认为True，优先使用已有浏览器
    
    try:
        async with async_playwright() as p:
            browser = None
            
            # 优先尝试连接到用户已有的Chrome浏览器
            if use_existing:
                try:
                    print(f"[OpenBrowser] 尝试连接到已有Chrome: {CDP_URL}")
                    browser = await p.chromium.connect_over_cdp(CDP_URL)
                    print(f"[OpenBrowser] 连接已有Chrome成功!")
                except Exception as e:
                    print(f"[OpenBrowser] 无法连接到已有Chrome: {e}")
            
            # 如果没有连接到已有浏览器，则启动新的
            if not browser:
                print(f"[OpenBrowser] 启动新的Chrome浏览器 (headless={request.headless})")
                browser = await p.chromium.launch(headless=request.headless)
            
            # 检查是否已有全局浏览器页面
            existing_browser, existing_context, existing_page = app_state.get_global_browser()
            
            if existing_browser and existing_page and existing_browser == browser:
                # 已有打开的页面，导航到新URL
                print(f"[OpenBrowser] 使用已有页面，打开新URL: {request.url}")
                page = existing_page
                await page.goto(request.url, wait_until="networkidle", timeout=60000)
            else:
                # 检查是否是通过CDP连接到已有Chrome
                is_cdp_connected = use_existing and browser.is_connected()
                
                if is_cdp_connected:
                    # CDP方式连接：获取Chrome已有的页面
                    contexts = browser.contexts
                    if contexts:
                        # 使用第一个已有的context
                        context = contexts[0]
                        pages = context.pages
                        if pages:
                            # 使用第一个已有页面
                            page = pages[0]
                            print(f"[OpenBrowser] 使用Chrome已有页面，打开新URL: {request.url}")
                            await page.goto(request.url, wait_until="networkidle", timeout=60000)
                        else:
                            # 没有页面，创建新页面
                            page = await context.new_page()
                            await page.goto(request.url, wait_until="networkidle", timeout=60000)
                    else:
                        # 没有context，创建新的
                        context = await browser.new_context(
                            viewport=request.viewport or {"width": 1920, "height": 1080}
                        )
                        page = await context.new_page()
                        await page.goto(request.url, wait_until="networkidle", timeout=60000)
                else:
                    # 新启动的浏览器，创建新页面
                    context = await browser.new_context(
                        viewport=request.viewport or {"width": 1920, "height": 1080}
                    )
                    page = await context.new_page()
                    
                    # 打开URL
                    print(f"[OpenBrowser] 打开URL: {request.url}")
                    await page.goto(request.url, wait_until="networkidle", timeout=60000)
                    print(f"[OpenBrowser] 页面加载完成")
                
                # 保存到全局状态
                app_state.set_global_browser(browser, context, page)
            
            # 获取页面标题
            title = await page.title()
            print(f"[OpenBrowser] 页面标题: {title}")
            
            # 等待额外时间让动态内容加载
            print(f"[OpenBrowser] 等待 {wait_time} 秒让数据加载完成...")
            await asyncio.sleep(wait_time)
            
            # 滚动页面以触发懒加载内容（模拟用户行为）
            print(f"[OpenBrowser] 滚动页面加载更多内容...")
            import random
            for i in range(5):
                # 每次滚动距离随机，200px到485px之间
                scroll_distance = random.randint(800, 2000)
                await page.evaluate(f"window.scrollBy(0, {scroll_distance})")
                print(f"[OpenBrowser] 第 {i+1} 次滚动，滚动距离: {scroll_distance}px")
                
                # 模拟用户行为，滚动间隔 800ms-1300ms
                scroll_interval = random.randint(800, 1300) / 1000
                await asyncio.sleep(scroll_interval)
                
                # 滚动后等待1.5s，确保页面DOM动态加载完毕
                await asyncio.sleep(1.5)
            
            # 获取 div.vue-recycle-scroller__item-view 的数据
            print(f"[OpenBrowser] 提取 div.vue-recycle-scroller__item-view 的数据...")
            
            # 用 Playwright 获取页面 HTML，然后用 BeautifulSoup 解析
            html_content = await page.content()
            
            # 用 BeautifulSoup 解析
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # 查找所有 div.vue-recycle-scroller__item-view 的元素
            feed_contents = soup.find_all('div', class_='vue-recycle-scroller__item-view')
            
            if not feed_contents:
                scroller_content = {"found": False, "message": "未找到 div.vue-recycle-scroller__item-view 的元素"}
            else:
                items = []
                for feed in feed_contents:
                    text = feed.get_text(strip=True)
                    if text:
                        items.append(text)
                
                scroller_content = {
                    "found": True,
                    "message": f"找到 {len(items)} 个 vue-recycle-scroller__item-view 元素",
                    "itemsCount": len(items),
                    "items": items
                }
            
            print(f"[OpenBrowser] 提取完成, items数量: {scroller_content.get('itemsCount', 0)}")
            print(scroller_content)

            # 更新浏览器状态
            browser_state_module.browser_state.set_chrome_running(True)
            browser_state_module.browser_state.set_page_open(True)

            return {
                "success": True,
                "url": request.url,
                "title": title,
                "data": scroller_content,
                "message": f"浏览器已打开并保持运行，页面已加载，等待了 {wait_time} 秒让数据加载完成"
            }

    except Exception as e:
        import traceback
        return {
            "success": False,
            "url": request.url,
            "error": str(e),
            "traceback": traceback.format_exc()
        }


# 浏览器状态查询接口
@router.get("/browser/status")
async def get_browser_status() -> Dict[str, Any]:
    """获取浏览器状态"""
    state = browser_state_module.browser_state.get_state()
    return {
        "chrome_running": state.get("chrome_running", False),
        "page_open": state.get("page_open", False),
        "updated_at": state.get("updated_at")
    }


# 浏览器状态更新接口
@router.post("/browser/status")
async def update_browser_status(
    chrome_running: bool = None,
    page_open: bool = None
) -> Dict[str, Any]:
    """更新浏览器状态"""
    if chrome_running is not None:
        browser_state_module.browser_state.set_chrome_running(chrome_running)
    if page_open is not None:
        browser_state_module.browser_state.set_page_open(page_open)
    return {"success": True}@router.post("/browser/close")
async def close_browser() -> Dict[str, Any]:
    """
    关闭由 /browser/start-chrome 接口启动的Chrome浏览器
    
    此接口只能关闭由 /browser/start-chrome 启动的Chrome进程，
    不会影响用户手动打开的Chrome浏览器。
    
    返回:
    - success: 是否成功关闭
    - message: 关闭信息
    """
    import signal
    import os
    import subprocess
    
    # 首先检查是否有由 start-chrome 启动的 Chrome 进程
    from app.app_state import get_chrome_process, clear_chrome_process
    pid, port = get_chrome_process()
    
    if pid:
        try:
            # 方法1: 尝试通过 lsof 查找并关闭关联的 Chrome 进程
            try:
                # 使用 lsof 查找监听指定端口的进程
                result = subprocess.run(
                    ['lsof', '-ti', f':{port or 9222}'],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if result.stdout.strip():
                    # 找到监听该端口的进程，尝试优雅关闭
                    pids = result.stdout.strip().split('\n')
                    for p in pids:
                        try:
                            os.kill(int(p), signal.SIGTERM)
                        except (OSError, ValueError):
                            pass
            except Exception as e:
                print(f"[Close] lsof close failed: {e}")
            
            # 方法2: 直接 kill 启动的进程
            try:
                # 先尝试 SIGTERM（优雅退出）
                os.kill(pid, signal.SIGTERM)
                
                # 等待进程退出
                import time
                for _ in range(5):
                    time.sleep(0.5)
                    try:
                        os.kill(pid, 0)  # 检查进程是否还存在
                    except OSError:
                        # 进程已退出
                        clear_chrome_process()
                        return {
                            "success": True,
                            "message": f"Chrome进程 (PID: {pid}) 已关闭"
                        }
                
                # 进程还在，强制 kill
                os.kill(pid, signal.SIGKILL)
                clear_chrome_process()
                return {
                    "success": True,
                    "message": f"Chrome进程 (PID: {pid}) 已强制关闭"
                }
                    
            except OSError as e:
                # 进程可能已经退出
                clear_chrome_process()
                return {
                    "success": True,
                    "message": f"Chrome进程 (PID: {pid}) 已退出"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"关闭Chrome失败: {str(e)}"
            }
    
    # 如果没有 start-chrome 启动的进程，尝试关闭 Playwright 管理的浏览器
    try:
        browser, context, page = app_state.get_global_browser()
        
        if page:
            await page.close()
        if context:
            await context.close()
        if browser:
            await browser.close()
        
        app_state.clear_global_browser()
        browser_state_module.browser_state.set_chrome_running(False)
        browser_state_module.browser_state.set_page_open(False)
        
        return {
            "success": True,
            "message": "Playwright浏览器已关闭"
        }
    except Exception as e:
        browser_state_module.browser_state.set_chrome_running(False)
        browser_state_module.browser_state.set_page_open(False)
        return {
            "success": False,
            "error": str(e)
        }


@router.post("/browser/start-chrome", response_model=StartChromeResponse)
async def start_chrome(request: StartChromeRequest) -> Dict[str, Any]:
    """
    启动调试模式Chrome浏览器
    
    使用此接口启动Chrome后，登录状态会被保存，
    之后可以用 /browser/open 接口打开其他网页（保持登录状态）
    
    参数:
    - profile_dir: Chrome配置目录名称，默认 "Default"（常用），
                   如果你用 "Profile 1" 登录微博，就填 "Profile 1"
    - port: 调试端口号，默认 9222
    
    返回:
    - success: 是否成功启动
    - message: 成功信息
    - error: 错误信息
    """
    import subprocess
    import os
    import time
    
    profile_dir = request.profile_dir or "Default"
    port = request.port or 9222
    
    # Chrome路径
    chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    
    # 用户配置目录
    user_data_dir = os.path.join(
        os.path.expanduser("~/Library/Application Support/Google/Chrome"),
        profile_dir
    )
    
    # 构建命令
    # 添加微博首页URL，这样启动Chrome时会自动打开微博
    weibo_url = "https://weibo.com/"
    cmd = [
        chrome_path,
        f"--remote-debugging-port={port}",
        f"--user-data-dir={user_data_dir}",
        "--no-first-run",
        "--no-default-browser-check",
        weibo_url  # 自动打开微博首页
    ]
    
    try:
        # 检查Chrome是否已经在运行
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('127.0.0.1', port))
        sock.close()
        
        if result == 0:
            # 端口已被占用，Chrome可能已经在运行
            # 更新浏览器状态
            browser_state_module.browser_state.set_chrome_running(True)
            return {
                "success": True,
                "message": f"Chrome调试模式已在运行 (端口 {port})，可以直接使用 /browser/open 接口"
            }
        
        # 启动Chrome
        proc = subprocess.Popen(cmd)
        pid = proc.pid
        
        # 保存进程信息到全局状态
        from app.app_state import set_chrome_process
        set_chrome_process(pid, port)
        
        # 等待Chrome启动
        time.sleep(2)
        
        # 验证是否启动成功
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('127.0.0.1', port))
        sock.close()
        
        if result == 0:
            # 更新浏览器状态
            browser_state_module.browser_state.set_chrome_running(True)
            return {
                "success": True,
                "message": f"Chrome调试模式已启动 (端口 {port}, 配置目录: {profile_dir})，请在打开的Chrome中手动登录一次，之后登录状态会自动保存"
            }
        else:
            return {
                "success": False,
                "error": "Chrome启动失败"
            }
            
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }


# ====================
# 微博数据接口
# ====================

@router.post("/weibo/api")
async def get_weibo_api(
    uid: str = "5028982111",
    page: int = 1,
    feature: int = 0,
    save_to_db: bool = True
) -> Dict[str, Any]:
    """
    使用当前浏览器的cookies请求微博API

    使用此接口前，需要先通过 /browser/open 或 /browser/start-chrome 打开微博并登录

    参数:
    - uid: 微博用户ID (默认: 5028982111)
    - page: 页码 (默认: 1)
    - feature: 过滤类型 (默认: 0, 0=全部, 1=原创)
    - save_to_db: 是否保存到数据库 (默认: True)

    返回:
    - success: 是否成功
    - data: API返回的JSON数据
    - saved_count: 保存的帖子数量
    - error: 错误信息
    """
    from playwright.async_api import async_playwright
    import asyncio
    import json

    CDP_URL = "http://127.0.0.1:9222"
    api_url = f"https://weibo.com/ajax/statuses/mymblog?uid={uid}&page={page}&feature={feature}"

    saved_count = 0

    try:
        async with async_playwright() as p:
            # 连接到已有的Chrome浏览器
            print(f"[WeiboAPI] 尝试连接到已有Chrome: {CDP_URL}")
            browser = await p.chromium.connect_over_cdp(CDP_URL)
            print(f"[WeiboAPI] 连接成功!")

            # 获取浏览器已有context
            contexts = browser.contexts
            if not contexts or not contexts[0].pages:
                return {
                    "success": False,
                    "error": "没有打开的页面，请先使用 /browser/open 打开微博"
                }

            # 使用第一个context的cookies
            context = contexts[0]
            cookies = await context.cookies()

            # 将cookies转换为请求头
            cookie_str = "; ".join([f"{c['name']}={c['value']}" for c in cookies])

            print(f"[WeiboAPI] 获取到 {len(cookies)} 个cookies")
            print(f"[WeiboAPI] 请求URL: {api_url}")

            # 使用requests发送API请求
            import requests
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Cookie": cookie_str,
                "Referer": "https://weibo.com/",
                "Accept": "application/json, text/plain, */*"
            }

            response = requests.get(api_url, headers=headers, timeout=30)
            print(f"[WeiboAPI] 响应状态码: {response.status_code}")

            # 解析JSON响应
            data = response.json()

            # 打印返回数据结构用于调试
            print(f"[WeiboAPI] 返回数据keys: {data.keys()}")
            if "data" in data:
                print(f"[WeiboAPI] data keys: {data['data'].keys() if isinstance(data['data'], dict) else 'not dict'}")

            # 异常情况：打印完整返回数据用于调试
            if data.get("ok") != 1:
                print(f"[WeiboAPI] ⚠️ API返回错误! ok={data.get('ok')}, msg={data.get('msg', 'N/A')}")
                print(f"[WeiboAPI] ⚠️ 完整返回数据: {json.dumps(data, ensure_ascii=False)[:2000]}")
            elif "data" in data and isinstance(data.get("data"), dict):
                mblog_list = data.get("data", {}).get("list", [])
                if not mblog_list:
                    print(f"[WeiboAPI] ⚠️ 未获取到帖子列表! data内容: {json.dumps(data.get('data', {}), ensure_ascii=False)[:2000]}")

            # 保存到数据库
            if save_to_db and data.get("ok") == 1:
                try:
                    from app.database.weibo_post_dao import weibo_post_dao, create_weibo_post_from_api_data

                    # 获取帖子列表 - 实际路径是 data.data.list
                    mblog_list = data.get("data", {}).get("list", [])
                    print(f"[WeiboAPI] 获取到 {len(mblog_list)} 条帖子")

                    # 转换为WeiboPost对象并保存
                    posts = []
                    for mblog in mblog_list:
                        try:
                            # 过滤：只保存与请求uid匹配的帖子
                            mblog_user_id = str(mblog.get("user", {}).get("id", ""))
                            if mblog_user_id != str(uid):
                                continue

                            post = create_weibo_post_from_api_data(mblog, uid)
                            posts.append(post)
                        except Exception as e:
                            print(f"[WeiboAPI] 解析帖子失败: {e}")

                    if posts:
                        saved_count = weibo_post_dao.create_many(posts)
                        print(f"[WeiboAPI] 成功保存 {saved_count} 条帖子到 weibo_userNew 集合")

                except Exception as e:
                            print(f"[WeiboAPI] 保存到数据库失败: {e}")

            # 检测登录状态
            if data.get("ok") == -100 and data.get("url", "").find("login.php") >= 0:
                return {
                    "success": False,
                    "error": "登录已过期，请重新在浏览器中登录微博",
                    "need_login": True
                }

            return {
                "success": True,
                "saved_count": saved_count
            }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


# ====================
# 微博长文本接口
# ====================

@router.post("/weibo/longtext")
async def get_weibo_longtext(
    mblogid: str
) -> Dict[str, Any]:
    """
    获取微博长文本内容

    参数:
    - mblogid: 微博的mblogid

    返回:
    - success: 是否成功
    - longTextContent: 长文本内容
    - url_struct: URL结构信息
    - error: 错误信息
    """
    from playwright.async_api import async_playwright

    CDP_URL = "http://127.0.0.1:9222"
    api_url = f"https://weibo.com/ajax/statuses/longtext?id={mblogid}"

    try:
        async with async_playwright() as p:
            print(f"[WeiboLongText] 尝试连接到已有Chrome: {CDP_URL}")
            browser = await p.chromium.connect_over_cdp(CDP_URL)
            print(f"[WeiboLongText] 连接成功!")

            contexts = browser.contexts
            if not contexts or not contexts[0].pages:
                return {
                    "success": False,
                    "error": "浏览器没有打开任何页面，请先通过 /browser/open 打开微博"
                }

            page = contexts[0].pages[0]

            # 设置额外的headers
            headers = {
                "Referer": "https://weibo.com/",
                "Accept": "application/json, text/plain, */*"
            }

            # 请求API
            print(f"[WeiboLongText] 请求API: {api_url}")
            response = await page.request.get(api_url, headers=headers)
            data = await response.json()
            print(f"[WeiboLongText] 响应: {data.get('ok')}")

            # 关闭连接
            await browser.close()

            if data.get("ok") == 1:
                return {
                    "success": True,
                    "longTextContent": data.get("data", {}).get("longTextContent", ""),
                    "url_struct": data.get("data", {}).get("url_struct", [])
                }
            else:
                return {
                    "success": False,
                    "error": data.get("msg", "获取长文本失败")
                }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


# ====================
# 微博长文本入库接口
# ====================

@router.post("/weibo/longtext/save")
async def save_weibo_longtext(
    mblogid: str
) -> Dict[str, Any]:
    """
    获取微博长文本并保存到数据库

    参数:
    - mblogid: 微博的mblogid

    返回:
    - success: 是否成功
    - matched_count: 匹配的文档数量
    - modified_count: 修改的文档数量
    - error: 错误信息
    """
    from playwright.async_api import async_playwright
    from app.database.weibo_post_dao import weibo_post_dao

    CDP_URL = "http://127.0.0.1:9222"
    api_url = f"https://weibo.com/ajax/statuses/longtext?id={mblogid}"

    try:
        async with async_playwright() as p:
            browser = await p.chromium.connect_over_cdp(CDP_URL)
            contexts = browser.contexts

            if not contexts or not contexts[0].pages:
                await browser.close()
                return {
                    "success": False,
                    "error": "浏览器没有打开任何页面"
                }

            page = contexts[0].pages[0]
            headers = {
                "Referer": "https://weibo.com/",
                "Accept": "application/json, text/plain, */*"
            }

            response = await page.request.get(api_url, headers=headers)
            data = await response.json()
            await browser.close()

            if data.get("ok") != 1:
                return {
                    "success": False,
                    "error": data.get("msg", "获取长文本失败")
                }

            long_text = data.get("data", {}).get("longTextContent", "")

            if not long_text:
                return {
                    "success": False,
                    "error": "长文本内容为空"
                }

            # 更新数据库中的文档
            result = weibo_post_dao.update_longtext(mblogid, long_text)

            return {
                "success": True,
                "matched_count": result.matched_count,
                "modified_count": result.modified_count
            }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


# ====================
# 微博帖子接口
# ====================

@router.get("/weibo/posts")
async def get_weibo_posts(
    user_id: str = None,
    user_idstr: str = None,
    page: int = 1,
    page_size: int = 20
) -> Dict[str, Any]:
    """
    获取指定用户的微博帖子列表
    """
    from app.database.weibo_post_dao import weibo_post_dao
    
    try:
        query = {}
        if user_id:
            query["user_id"] = int(user_id)
        if user_idstr:
            query["user_idstr"] = user_idstr
            
        if not query:
            return {
                "success": False,
                "error": "必须提供 user_id 或 user_idstr 参数"
            }
        
        skip = (page - 1) * page_size
        
        posts = list(weibo_post_dao.collection.find(query)
                    .sort("created_at_dt", -1)
                    .skip(skip)
                    .limit(page_size))
        
        total = weibo_post_dao.collection.count_documents(query)
        
        for post in posts:
            if "_id" in post:
                post["_id"] = str(post["_id"])
        
        return {
            "success": True,
            "data": posts,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@router.get("/weibo/posts/count")
async def get_weibo_posts_count(
    user_id: str = None,
    user_idstr: str = None
) -> Dict[str, Any]:
    """获取指定用户的微博帖子数量"""
    from app.database.weibo_post_dao import weibo_post_dao
    
    try:
        query = {}
        if user_id:
            query["user_id"] = int(user_id)
        if user_idstr:
            query["user_idstr"] = user_idstr
            
        if not query:
            return {"success": False, "error": "必须提供 user_id 或 user_idstr 参数"}
        
        total = weibo_post_dao.collection.count_documents(query)
        return {"success": True, "total": total}
        
    except Exception as e:
        return {"success": False, "error": str(e)}
