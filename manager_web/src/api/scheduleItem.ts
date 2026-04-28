import { apiClient } from './config';
import type {
  ScheduleItem,
  ScheduleItemCreate,
  ScheduleItemUpdate,
  UpdateStatusRequest,
  BatchConfirmRequest,
  WeekInfo,
  ChannelMap,
} from '../types/scheduleItem';

export const scheduleApi = {
  // 获取当前周信息
  getCurrentWeek: async (): Promise<WeekInfo> => {
    const response = await apiClient.get<WeekInfo>('/schedule-items/week-current');
    return response.data;
  },

  // 获取周视图数据
  getWeekSchedule: async (weekYear: string): Promise<ScheduleItem[]> => {
    const response = await apiClient.get<ScheduleItem[]>(`/schedule-items/week/${encodeURIComponent(weekYear)}`);
    return response.data;
  },

  // 获取已配置的渠道映射
  getChannels: async (): Promise<ChannelMap[]> => {
    const response = await apiClient.get<ChannelMap[]>('/schedule-items/channels');
    return response.data;
  },

  // 获取元信息（内容类型标签、黑话分类标签）
  getMeta: async (): Promise<{ content_types: Record<string, string>; slang_categories: Record<string, string> }> => {
    const response = await apiClient.get('/schedule-items/meta');
    return response.data;
  },

  // 列表查询
  listItems: async (params?: {
    skip?: number;
    limit?: number;
    content_type?: string;
    week_year?: string;
  }) => {
    const response = await apiClient.get<{ items: ScheduleItem[]; total: number }>('/schedule-items', { params });
    return response.data;
  },

  // 获取单个
  getItem: async (id: string): Promise<ScheduleItem> => {
    const response = await apiClient.get<ScheduleItem>(`/schedule-items/${id}`);
    return response.data;
  },

  // 创建
  createItem: async (data: ScheduleItemCreate): Promise<ScheduleItem> => {
    const response = await apiClient.post<ScheduleItem>('/schedule-items', data);
    return response.data;
  },

  // 更新
  updateItem: async (id: string, data: ScheduleItemUpdate): Promise<ScheduleItem> => {
    const response = await apiClient.put<ScheduleItem>(`/schedule-items/${id}`, data);
    return response.data;
  },

  // 删除
  deleteItem: async (id: string) => {
    const response = await apiClient.delete(`/schedule-items/${id}`);
    return response.data;
  },

  // 更新平台发布状态
  updateStatus: async (id: string, data: UpdateStatusRequest): Promise<ScheduleItem> => {
    const response = await apiClient.patch<ScheduleItem>(`/schedule-items/${id}/status`, data);
    return response.data;
  },

  // 切换锚定状态
  togglePinned: async (id: string): Promise<ScheduleItem> => {
    const response = await apiClient.patch<ScheduleItem>(`/schedule-items/${id}/pinned`);
    return response.data;
  },

  // 批量确认（补发历史日期）
  batchConfirm: async (data: BatchConfirmRequest) => {
    const response = await apiClient.post('/schedule-items/batch-confirm', data);
    return response.data;
  },
};
