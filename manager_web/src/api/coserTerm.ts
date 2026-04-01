import { apiClient } from './config';
import type { CoserTerm, CoserTermCreate, CoserTermUpdate } from '../types/coser';

export const coserTermApi = {
  // 获取所有Coser术语
  getTerms: async (params?: {
    skip?: number;
    limit?: number;
    is_active?: boolean;
    category?: string;
    search?: string;
  }) => {
    const response = await apiClient.get<{
      items: CoserTerm[];
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    }>('/coser-terms', { params });
    return response.data;
  },

  // 获取单个Coser术语
  getTerm: async (id: string) => {
    const response = await apiClient.get<CoserTerm>(`/coser-terms/${id}`);
    return response.data;
  },

  // 创建Coser术语
  createTerm: async (term: CoserTermCreate) => {
    const response = await apiClient.post<CoserTerm>('/coser-terms', term);
    return response.data;
  },

  // 更新Coser术语
  updateTerm: async (id: string, term: CoserTermUpdate) => {
    const response = await apiClient.put<CoserTerm>(`/coser-terms/${id}`, term);
    return response.data;
  },

  // 删除Coser术语
  deleteTerm: async (id: string) => {
    const response = await apiClient.delete(`/coser-terms/${id}`);
    return response.data;
  },

  // 获取术语总数
  getTermCount: async (params?: {
    is_active?: boolean;
    category?: string;
  }) => {
    const response = await apiClient.get<{ total: number }>('/coser-terms/count', { params });
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
    }>('/coser-terms/stats', { params });
    return response.data;
  },

  // 更新 AI 生成内容（口播文案 / 镜头脚本）
  updateAiContent: async (id: string, data: { ai_copywriting?: string; ai_script?: string }) => {
    const response = await apiClient.patch<CoserTerm>(`/coser-terms/${id}/ai-content`, data);
    return response.data;
  },

  // 切换视频生成状态
  toggleVideoGenerated: async (id: string) => {
    const response = await apiClient.patch<CoserTerm>(`/coser-terms/${id}/toggle-video-generated`);
    return response.data;
  },

  // 切换视频发布状态
  toggleVideoPublished: async (id: string) => {
    const response = await apiClient.patch<CoserTerm>(`/coser-terms/${id}/toggle-video-published`);
    return response.data;
  },
};
