import { apiClient } from './config';

export interface WantGuzi {
  id: string;
  ip_name: string;
  category_tags: string[];
  remark: string | null;
  status: 'pending' | 'processing' | 'completed' | 'closed';
  reply: string | null;
  admin_remark: string | null;
  created_at: string;
  updated_at: string;
}

export interface WantGuziStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  closed: number;
}

export interface WantGuziListResponse {
  items: WantGuzi[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const wantGuziApi = {
  // 获取求谷列表（支持分页和筛选）
  getList: async (params?: {
    page?: number;
    page_size?: number;
    status?: 'pending' | 'processing' | 'completed' | 'closed';
    search?: string;
  }) => {
    const response = await apiClient.get<WantGuziListResponse>('/want-guzi', {
      params,
    });
    return response.data;
  },

  // 获取统计信息
  getStats: async (): Promise<WantGuziStats> => {
    const response = await apiClient.get<WantGuziStats>('/want-guzi/stats');
    return response.data;
  },

  // 获取单个求谷详情
  getById: async (id: string): Promise<WantGuzi> => {
    const response = await apiClient.get<WantGuzi>(`/want-guzi/${id}`);
    return response.data;
  },

  // 更新求谷状态和处理信息
  update: async (id: string, data: {
    status?: 'pending' | 'processing' | 'completed' | 'closed';
    reply?: string;
    admin_remark?: string;
  }): Promise<WantGuzi> => {
    const response = await apiClient.patch<WantGuzi>(`/want-guzi/${id}`, data);
    return response.data;
  },

  // 删除求谷记录
  delete: async (id: string) => {
    const response = await apiClient.delete(`/want-guzi/${id}`);
    return response.data;
  },
};
