import { apiClient } from './config';
import type { PublishChannel, PublishChannelCreate, PublishChannelUpdate } from '../types/publishChannel';

export const publishChannelApi = {
  getChannels: async (is_active?: boolean) => {
    const params = is_active !== undefined ? { is_active } : {};
    const response = await apiClient.get<PublishChannel[]>('/publish-channels', { params });
    return response.data;
  },

  getChannel: async (id: string) => {
    const response = await apiClient.get<PublishChannel>(`/publish-channels/${id}`);
    return response.data;
  },

  createChannel: async (data: PublishChannelCreate) => {
    const response = await apiClient.post<PublishChannel>('/publish-channels', data);
    return response.data;
  },

  updateChannel: async (id: string, data: PublishChannelUpdate) => {
    const response = await apiClient.put<PublishChannel>(`/publish-channels/${id}`, data);
    return response.data;
  },

  deleteChannel: async (id: string) => {
    const response = await apiClient.delete(`/publish-channels/${id}`);
    return response.data;
  },
};
