import { apiClient } from './config';
import type { ConventionTerm, ConventionTermCreate, ConventionTermUpdate } from '../types/convention';

export const conventionTermApi = {
  // 获取所有漫展术语
  getTerms: async (params?: {
    skip?: number;
    limit?: number;
    is_active?: boolean;
    category?: string;
    search?: string;
  }) => {
    const response = await apiClient.get<{
      items: ConventionTerm[];
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    }>('/convention-terms', { params });
    return response.data;
  },

  // 获取单个漫展术语
  getTerm: async (id: string) => {
    const response = await apiClient.get<ConventionTerm>(`/convention-terms/${id}`);
    return response.data;
  },

  // 创建漫展术语
  createTerm: async (term: ConventionTermCreate) => {
    const response = await apiClient.post<ConventionTerm>('/convention-terms', term);
    return response.data;
  },

  // 更新漫展术语
  updateTerm: async (id: string, term: ConventionTermUpdate) => {
    const response = await apiClient.put<ConventionTerm>(`/convention-terms/${id}`, term);
    return response.data;
  },

  // 删除漫展术语
  deleteTerm: async (id: string) => {
    const response = await apiClient.delete(`/convention-terms/${id}`);
    return response.data;
  },

  // 获取术语总数
  getTermCount: async (params?: {
    is_active?: boolean;
    category?: string;
  }) => {
    const response = await apiClient.get<{ total: number }>('/convention-terms/count', { params });
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
    }>('/convention-terms/stats', { params });
    return response.data;
  },

  // 更新 AI 生成内容（口播文案 / 镜头脚本）
  updateAiContent: async (id: string, data: { ai_copywriting?: string; ai_script?: string }) => {
    const response = await apiClient.patch<ConventionTerm>(`/convention-terms/${id}/ai-content`, data);
    return response.data;
  },

  // 切换视频生成状态
  toggleVideoGenerated: async (id: string) => {
    const response = await apiClient.patch<ConventionTerm>(`/convention-terms/${id}/toggle-video-generated`);
    return response.data;
  },

  // 切换视频发布状态
  toggleVideoPublished: async (id: string) => {
    const response = await apiClient.patch<ConventionTerm>(`/convention-terms/${id}/toggle-video-published`);
    return response.data;
  },
};
