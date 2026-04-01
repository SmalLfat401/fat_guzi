import { apiClient } from './config';

// ====================
// 类型定义
// ====================

export interface Viewport {
  width: number;
  height: number;
}

export interface OpenBrowserRequest {
  url: string;
  headless?: boolean;
  viewport?: Viewport;
  use_existing?: boolean;
}

export interface OpenBrowserResponse {
  success: boolean;
  url: string;
  title?: string;
  message?: string;
  error?: string;
  data?: {
    found: boolean;
    message: string;
    itemsCount?: number;
    items?: string[];
  };
}

export interface BrowserStatus {
  chrome_running: boolean;
  page_open: boolean;
  updated_at?: string;
}

export interface StartChromeRequest {
  profile_dir?: string;
  port?: number;
}

export interface StartChromeResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface CloseBrowserResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface WeiboApiResponse {
  success: boolean;
  saved_count?: number;
  error?: string;
  need_login?: boolean;
}

export interface WeiboLongTextResponse {
  success: boolean;
  longTextContent?: string;
  url_struct?: any[];
  error?: string;
}

export interface WeiboPostsResponse {
  success: boolean;
  data?: any[];
  total?: number;
  page?: number;
  page_size?: number;
  total_pages?: number;
  error?: string;
}

export interface WeiboPostsCountResponse {
  success: boolean;
  total?: number;
  error?: string;
}

// ====================
// 微博爬虫任务类型
// ====================

export type TaskStatus = 'idle' | 'running' | 'paused' | 'stopping' | 'completed' | 'failed';

export interface CrawlerLogEntry {
  timestamp: string;
  uid: string;
  nickname: string;
  action: string;
  message: string;
  success: boolean;
}

export interface CrawlerTaskStatus {
  task_id?: string;
  status: TaskStatus;
  mode?: string;
  max_posts?: number;
  total_users?: number;
  processed_users?: number;
  failed_users?: number;
  total_blogs?: number;
  saved_blogs?: number;
  total_longtext?: number;
  saved_longtext?: number;
  failed_longtext?: number;
  progress?: number;
  current_uid?: string;
  category_id?: string;
  category_name?: string;
  target_uids?: string[];
  paused_after_uid?: string;
  logs?: CrawlerLogEntry[];
  log_count?: number;
  started_at?: string;
  completed_at?: string;
  browser_connected?: boolean;
  chrome_pid?: number;
}

export interface CategoryUser {
  uid: string;
  nickname: string;
}

export interface CategoryWithUsers {
  category_id: string;
  category_name: string;
  category_description: string;
  user_count: number;
  users: CategoryUser[];
}

export interface StartCrawlerRequest {
  mode?: 'full' | 'limited' | 'specific';
  max_posts?: number;
  target_uids?: string[];
}

// ====================
// API 方法
// ====================

export const crawlerApi = {
  // ====================
  // 浏览器控制接口
  // ====================

  /**
   * 打开浏览器并访问指定URL
   * 需要先启动 Chrome 调试模式 (/browser/start-chrome)
   */
  openBrowser: async (data: OpenBrowserRequest): Promise<OpenBrowserResponse> => {
    const response = await apiClient.post<OpenBrowserResponse>('/browser/open', data);
    return response.data;
  },

  /**
   * 获取浏览器状态
   */
  getBrowserStatus: async (): Promise<BrowserStatus> => {
    const response = await apiClient.get<BrowserStatus>('/browser/status');
    return response.data;
  },

  /**
   * 更新浏览器状态
   */
  updateBrowserStatus: async (chromeRunning?: boolean, pageOpen?: boolean): Promise<{ success: boolean }> => {
    const params: Record<string, boolean> = {};
    if (chromeRunning !== undefined) params.chrome_running = chromeRunning;
    if (pageOpen !== undefined) params.page_open = pageOpen;
    const response = await apiClient.post('/browser/status', null, { params });
    return response.data;
  },

  /**
   * 关闭浏览器
   * 此接口只能关闭由 /browser/start-chrome 启动的Chrome进程
   */
  closeBrowser: async (): Promise<CloseBrowserResponse> => {
    const response = await apiClient.post<CloseBrowserResponse>('/browser/close');
    return response.data;
  },

  /**
   * 启动调试模式Chrome浏览器
   * 登录状态会被保存，之后可以用 /browser/open 接口打开其他网页
   */
  startChrome: async (data?: StartChromeRequest): Promise<StartChromeResponse> => {
    const response = await apiClient.post<StartChromeResponse>('/browser/start-chrome', data || {});
    return response.data;
  },

  // ====================
  // 微博数据接口
  // ====================

  /**
   * 使用当前浏览器的cookies请求微博API
   * 需要先通过 /browser/open 或 /browser/start-chrome 打开微博并登录
   */
  getWeiboApi: async (
    uid: string = '5028982111',
    page: number = 1,
    feature: number = 0,
    saveToDb: boolean = true
  ): Promise<WeiboApiResponse> => {
    const response = await apiClient.post<WeiboApiResponse>('/weibo/api', null, {
      params: { uid, page, feature, save_to_db: saveToDb },
    });
    return response.data;
  },

  /**
   * 获取微博长文本内容
   */
  getWeiboLongText: async (mblogid: string): Promise<WeiboLongTextResponse> => {
    const response = await apiClient.post<WeiboLongTextResponse>('/weibo/longtext', null, {
      params: { mblogid },
    });
    return response.data;
  },

  /**
   * 获取微博长文本并保存到数据库
   */
  saveWeiboLongText: async (mblogid: string): Promise<{ success: boolean; matched_count: number; modified_count: number; error?: string }> => {
    const response = await apiClient.post('/weibo/longtext/save', null, { params: { mblogid } });
    return response.data;
  },

  /**
   * 获取指定用户的微博帖子列表
   */
  getWeiboPosts: async (
    userId?: string,
    userIdstr?: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<WeiboPostsResponse> => {
    const params: Record<string, any> = { page, page_size: pageSize };
    if (userId) params.user_id = userId;
    if (userIdstr) params.user_idstr = userIdstr;
    const response = await apiClient.get<WeiboPostsResponse>('/weibo/posts', { params });
    return response.data;
  },

  /**
   * 获取指定用户的微博帖子数量
   */
  getWeiboPostsCount: async (userId?: string, userIdstr?: string): Promise<WeiboPostsCountResponse> => {
    const params: Record<string, string> = {};
    if (userId) params.user_id = userId;
    if (userIdstr) params.user_idstr = userIdstr;
    const response = await apiClient.get<WeiboPostsCountResponse>('/weibo/posts/count', { params });
    return response.data;
  },

  // ====================
  // 微博爬虫任务接口
  // ====================

  /**
   * 获取爬虫任务状态
   */
  getCrawlerTaskStatus: async (): Promise<CrawlerTaskStatus> => {
    const response = await apiClient.get<CrawlerTaskStatus>('/weibo-crawler/status');
    return response.data;
  },

  /**
   * 获取所有类别及其下的微博用户列表
   */
  getCategoryUsers: async (): Promise<{ success: boolean; categories: CategoryWithUsers[]; error?: string }> => {
    const response = await apiClient.get('/weibo-crawler/category-users');
    return response.data;
  },

  /**
   * 按类别启动爬虫任务
   */
  startCrawlerByCategory: async (params: {
    category_id: string;
    mode?: 'full' | 'limited';
    max_posts?: number;
  }): Promise<{ success: boolean; message?: string; category_name?: string; user_count?: number; error?: string }> => {
    const response = await apiClient.post('/weibo-crawler/start-by-category', null, {
      params: { category_id: params.category_id, mode: params.mode || 'full', max_posts: params.max_posts || 0 },
    });
    return response.data;
  },

  /**
   * 启动爬虫任务
   */
  startCrawlerTask: async (request?: StartCrawlerRequest): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await apiClient.post('/weibo-crawler/start', request || {});
    return response.data;
  },

  /**
   * 暂停爬虫任务
   */
  pauseCrawlerTask: async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await apiClient.post('/weibo-crawler/pause');
    return response.data;
  },

  /**
   * 恢复爬虫任务
   */
  resumeCrawlerTask: async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await apiClient.post('/weibo-crawler/resume');
    return response.data;
  },

  /**
   * 停止爬虫任务
   */
  stopCrawlerTask: async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await apiClient.post('/weibo-crawler/stop');
    return response.data;
  },
};
