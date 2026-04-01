import { apiClient } from './config';

export interface Category {
  _id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryCreate {
  name: string;
  description?: string;
}

export interface CategoryUpdate {
  name?: string;
  description?: string;
  is_active?: boolean;
}

export const categoryApi = {
  // 获取分类列表
  getCategories: async (skip: number = 0, limit: number = 100, isActive?: boolean): Promise<Category[]> => {
    const params = new URLSearchParams();
    params.append('skip', String(skip));
    params.append('limit', String(limit));
    if (isActive !== undefined) {
      params.append('is_active', String(isActive));
    }
    const response = await apiClient.get<Category[]>(`/categories?${params.toString()}`);
    return response.data;
  },

  // 获取单个分类
  getCategory: async (id: string): Promise<Category> => {
    const response = await apiClient.get<Category>(`/categories/${id}`);
    return response.data;
  },

  // 创建分类
  createCategory: async (data: CategoryCreate): Promise<Category> => {
    const response = await apiClient.post<Category>('/categories', data);
    return response.data;
  },

  // 更新分类
  updateCategory: async (id: string, data: CategoryUpdate): Promise<Category> => {
    const response = await apiClient.put<Category>(`/categories/${id}`, data);
    return response.data;
  },

  // 删除分类
  deleteCategory: async (id: string): Promise<{ message: string; success: boolean }> => {
    const response = await apiClient.delete(`/categories/${id}`);
    return response.data;
  },

  // 获取分类数量
  getCategoryCount: async (isActive?: boolean): Promise<number> => {
    const params = isActive !== undefined ? `?is_active=${isActive}` : '';
    const response = await apiClient.get<{ total: number }>(`/categories/count${params}`);
    return response.data.total;
  },
};
