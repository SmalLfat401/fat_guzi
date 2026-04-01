import { apiClient } from './config';
import type { WeiboUser, WeiboUserCreate, WeiboUserUpdate, WeiboPost } from '../types/weibo';

export const weiboUserApi = {
  // 获取所有微博用户
  getUsers: async (skip: number = 0, limit: number = 100, isActive?: boolean, nickname?: string, categoryIds?: string[]) => {
    const params: Record<string, any> = { skip, limit };
    if (isActive !== undefined) {
      params.is_active = isActive;
    }
    if (nickname) {
      params.nickname = nickname;
    }
    if (categoryIds && categoryIds.length > 0) {
      params.category_ids = categoryIds.join(",");
    }
    const response = await apiClient.get<{
      items: WeiboUser[];
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    }>('/weibo-users', { params });
    return response.data;
  },

  // 获取单个微博用户
  getUser: async (uid: string) => {
    const response = await apiClient.get<WeiboUser>(`/weibo-users/${uid}`);
    return response.data;
  },

  // 创建微博用户
  createUser: async (user: WeiboUserCreate) => {
    const response = await apiClient.post<WeiboUser>('/weibo-users', user);
    return response.data;
  },

  // 更新微博用户
  updateUser: async (uid: string, user: WeiboUserUpdate) => {
    const response = await apiClient.put<WeiboUser>(`/weibo-users/${uid}`, user);
    return response.data;
  },

  // 删除微博用户
  deleteUser: async (uid: string) => {
    const response = await apiClient.delete(`/weibo-users/${uid}`);
    return response.data;
  },

  // 获取用户总数
  getUserCount: async (isActive?: boolean) => {
    const params = isActive !== undefined ? { is_active: isActive } : {};
    const response = await apiClient.get<{ total: number }>('/weibo-users/count', { params });
    return response.data.total;
  },

  // 获取用户统计
  getUserStats: async () => {
    const response = await apiClient.get<{
      total: number;
      active: number;
      inactive: number;
    }>('/weibo-users/stats');
    return response.data;
  },

  // 获取用户的微博帖子列表
  getPosts: async (userIdstr: string, page: number = 1, pageSize: number = 20) => {
    const response = await apiClient.get<{
      success: boolean;
      data: WeiboPost[];
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    }>('/weibo/posts', { params: { user_idstr: userIdstr, page, page_size: pageSize } });
    return response.data;
  },

  // 获取用户的微博帖子数量
  getPostsCount: async (userIdstr: string) => {
    const response = await apiClient.get<{ success: boolean; total: number }>('/weibo/posts/count', {
      params: { user_idstr: userIdstr },
    });
    return response.data.total;
  },

  // 爬取长文本
  fetchLongText: async (mblogid: string) => {
    const response = await apiClient.post<{ success: boolean; longTextContent?: string; error?: string }>(
      '/weibo/longtext',
      {},
      { params: { mblogid } }
    );
    return response.data;
  },

  // 保存长文本到数据库
  saveLongText: async (mblogid: string) => {
    const response = await apiClient.post<{ success: boolean; matched_count?: number; modified_count?: number; error?: string }>(
      '/weibo/longtext/save',
      {},
      { params: { mblogid } }
    );
    return response.data;
  },
};
