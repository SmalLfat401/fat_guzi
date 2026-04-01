import { apiClient } from './config';
import type { GuziTerm, GuziTermCreate, GuziTermUpdate } from '../types/guzi';

export const guziTermApi = {
  // 获取所有谷子术语
  getTerms: async (params?: {
    skip?: number;
    limit?: number;
    is_active?: boolean;
    category?: string;
    search?: string;
  }) => {
    const response = await apiClient.get<{
      items: GuziTerm[];
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    }>('/guzi-terms', { params });
    return response.data;
  },

  // 获取单个谷子术语
  getTerm: async (id: string) => {
    const response = await apiClient.get<GuziTerm>(`/guzi-terms/${id}`);
    return response.data;
  },

  // 创建谷子术语
  createTerm: async (term: GuziTermCreate) => {
    const response = await apiClient.post<GuziTerm>('/guzi-terms', term);
    return response.data;
  },

  // 更新谷子术语
  updateTerm: async (id: string, term: GuziTermUpdate) => {
    const response = await apiClient.put<GuziTerm>(`/guzi-terms/${id}`, term);
    return response.data;
  },

  // 删除谷子术语
  deleteTerm: async (id: string) => {
    const response = await apiClient.delete(`/guzi-terms/${id}`);
    return response.data;
  },

  // 获取术语总数
  getTermCount: async (params?: {
    is_active?: boolean;
    category?: string;
  }) => {
    const response = await apiClient.get<{ total: number }>('/guzi-terms/count', { params });
    return response.data.total;
  },

  // 获取术语统计
  getTermStats: async (category?: string) => {
    const params = category ? { category } : {};
    const response = await apiClient.get<{
      total: number;
      active: number;
      inactive: number;
      category_stats: Record<string, number>;
    }>('/guzi-terms/stats', { params });
    return response.data;
  },

  // 更新 AI 生成内容（口播文案 / 镜头脚本）
  updateAiContent: async (id: string, data: { ai_copywriting?: string; ai_script?: string }) => {
    const response = await apiClient.patch<GuziTerm>(`/guzi-terms/${id}/ai-content`, data);
    return response.data;
  },

  // 切换视频生成状态
  toggleVideoGenerated: async (id: string) => {
    const response = await apiClient.patch<GuziTerm>(`/guzi-terms/${id}/toggle-video-generated`);
    return response.data;
  },

  // 切换视频发布状态
  toggleVideoPublished: async (id: string) => {
    const response = await apiClient.patch<GuziTerm>(`/guzi-terms/${id}/toggle-video-published`);
    return response.data;
  },

};
