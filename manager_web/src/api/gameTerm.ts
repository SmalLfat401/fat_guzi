import type { GameTerm, GameTermCreate, GameTermUpdate } from '../types/game';
import { apiClient } from './config';

export const gameTermApi = {
  // 获取所有游戏圈术语
  getTerms: async (params?: {
    skip?: number;
    limit?: number;
    is_active?: boolean;
    category?: string;
    search?: string;
  }) => {
    const response = await apiClient.get<{
      items: GameTerm[];
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    }>('/game-terms', { params });
    return response.data;
  },

  // 获取单个游戏圈术语
  getTerm: async (id: string) => {
    const response = await apiClient.get<GameTerm>(`/game-terms/${id}`);
    return response.data;
  },

  // 创建游戏圈术语
  createTerm: async (term: GameTermCreate) => {
    const response = await apiClient.post<GameTerm>('/game-terms', term);
    return response.data;
  },

  // 更新游戏圈术语
  updateTerm: async (id: string, term: GameTermUpdate) => {
    const response = await apiClient.put<GameTerm>(`/game-terms/${id}`, term);
    return response.data;
  },

  // 删除游戏圈术语
  deleteTerm: async (id: string) => {
    const response = await apiClient.delete(`/game-terms/${id}`);
    return response.data;
  },

  // 获取术语总数
  getTermCount: async (params?: {
    is_active?: boolean;
    category?: string;
  }) => {
    const response = await apiClient.get<{ total: number }>('/game-terms/count', { params });
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
    }>('/game-terms/stats', { params });
    return response.data;
  },

  // 更新 AI 生成内容（口播文案 / 镜头脚本）
  updateAiContent: async (id: string, data: { ai_copywriting?: string; ai_script?: string }) => {
    const response = await apiClient.patch<GameTerm>(`/game-terms/${id}/ai-content`, data);
    return response.data;
  },

  // 切换视频生成状态
  toggleVideoGenerated: async (id: string) => {
    const response = await apiClient.patch<GameTerm>(`/game-terms/${id}/toggle-video-generated`);
    return response.data;
  },

  // 切换视频发布状态
  toggleVideoPublished: async (id: string) => {
    const response = await apiClient.patch<GameTerm>(`/game-terms/${id}/toggle-video-published`);
    return response.data;
  },
};
