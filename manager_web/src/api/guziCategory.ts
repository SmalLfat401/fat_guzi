import { apiClient } from './config';
import type {
  GuziCategory,
  GuziCategoryCreate,
  GuziCategoryUpdate,
  GuziCategoryListResponse,
  GuziSubCategory,
  GuziSubCategoryCreate,
  GuziSubCategoryUpdate,
  GuziSubCategoryListResponse,
  GuziCategoryWithSubsListResponse,
  GuziCategoryStats,
} from '../types/guziCategory';

export const guziCategoryApi = {
  // ── 一级分类 ──

  /** 获取一级分类列表 */
  getCategories: async (params?: {
    skip?: number;
    limit?: number;
    is_active?: boolean;
    search?: string;
  }) => {
    const response = await apiClient.get<GuziCategoryListResponse>('/guzi-categories', { params });
    return response.data;
  },

  /** 获取单个一级分类 */
  getCategory: async (id: string) => {
    const response = await apiClient.get<GuziCategory>(`/guzi-categories/${id}`);
    return response.data;
  },

  /** 创建一级分类 */
  createCategory: async (data: GuziCategoryCreate) => {
    const response = await apiClient.post<GuziCategory>('/guzi-categories', data);
    return response.data;
  },

  /** 更新一级分类 */
  updateCategory: async (id: string, data: GuziCategoryUpdate) => {
    const response = await apiClient.put<GuziCategory>(`/guzi-categories/${id}`, data);
    return response.data;
  },

  /** 删除一级分类（同时删除其下所有二级分类） */
  deleteCategory: async (id: string) => {
    const response = await apiClient.delete(`/guzi-categories/${id}`);
    return response.data;
  },

  /** 获取分类统计数据 */
  getStats: async () => {
    const response = await apiClient.get<GuziCategoryStats>('/guzi-categories/stats');
    return response.data;
  },

  // ── 二级分类 ──

  /** 获取二级分类列表 */
  getSubCategories: async (params?: {
    skip?: number;
    limit?: number;
    parent_id?: string;
    is_active?: boolean;
    search?: string;
  }) => {
    const response = await apiClient.get<GuziSubCategoryListResponse>('/guzi-categories/subs', { params });
    return response.data;
  },

  /** 获取单个二级分类 */
  getSubCategory: async (id: string) => {
    const response = await apiClient.get<GuziSubCategory>(`/guzi-categories/subs/${id}`);
    return response.data;
  },

  /** 创建二级分类 */
  createSubCategory: async (data: GuziSubCategoryCreate) => {
    const response = await apiClient.post<GuziSubCategory>('/guzi-categories/subs', data);
    return response.data;
  },

  /** 更新二级分类 */
  updateSubCategory: async (id: string, data: GuziSubCategoryUpdate) => {
    const response = await apiClient.put<GuziSubCategory>(`/guzi-categories/subs/${id}`, data);
    return response.data;
  },

  /** 删除二级分类 */
  deleteSubCategory: async (id: string) => {
    const response = await apiClient.delete(`/guzi-categories/subs/${id}`);
    return response.data;
  },

  // ── 组合接口 ──

  /** 获取所有一级分类（含二级分类列表），用于级联选择器 */
  getCategoriesWithSubs: async (is_active?: boolean) => {
    const response = await apiClient.get<GuziCategoryWithSubsListResponse>('/guzi-categories/with-subs', {
      params: is_active !== undefined ? { is_active } : undefined,
    });
    return response.data;
  },
};
