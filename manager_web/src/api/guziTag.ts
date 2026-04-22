import { apiClient } from './config';
import type { GuziTag, GuziTagCreate, GuziTagUpdate, GuziTagStats, TagType, IpCategory } from '../types/guziTag';

export const guziTagApi = {
  // 获取标签列表
  getTags: async (params?: {
    skip?: number;
    limit?: number;
    tag_type?: TagType;
    is_active?: boolean;
    search?: string;
    ip_category?: IpCategory;
  }) => {
    const response = await apiClient.get<{
      items: GuziTag[];
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    }>('/guzi-tags', { params });
    return response.data;
  },

  // 获取单个标签
  getTag: async (id: string) => {
    const response = await apiClient.get<GuziTag>(`/guzi-tags/${id}`);
    return response.data;
  },

  // 创建标签
  createTag: async (tag: GuziTagCreate) => {
    const response = await apiClient.post<GuziTag>('/guzi-tags', tag);
    return response.data;
  },

  // 更新标签
  updateTag: async (id: string, tag: GuziTagUpdate) => {
    const response = await apiClient.put<GuziTag>(`/guzi-tags/${id}`, tag);
    return response.data;
  },

  // 删除标签
  deleteTag: async (id: string) => {
    const response = await apiClient.delete(`/guzi-tags/${id}`);
    return response.data;
  },

  // 获取标签统计
  getTagStats: async () => {
    const response = await apiClient.get<GuziTagStats>('/guzi-tags/stats');
    return response.data;
  },
};
