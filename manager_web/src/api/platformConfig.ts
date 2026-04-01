import { apiClient } from './config';

// 类型定义
export interface PlatformConfig {
  _id: string;
  platform_id: string;
  platform_name: string;
  app_key: string;
  app_secret: string;
  pid: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlatformConfigCreate {
  platform_id: string;
  platform_name: string;
  app_key?: string;
  app_secret?: string;
  pid?: string;
  is_active?: boolean;
}

export interface PlatformConfigUpdate {
  app_key?: string;
  app_secret?: string;
  pid?: string;
  is_active?: boolean;
}

export interface SupportedPlatform {
  platform_id: string;
  platform_name: string;
  icon: string;
  description: string;
  doc_url: string;
}

// API 方法
export const platformConfigApi = {
  // 获取平台配置（不传platform_id返回所有，传则返回单个）
  getConfigs: async (platformId?: string): Promise<PlatformConfig[]> => {
    const params = platformId ? { platform_id: platformId } : {};
    const response = await apiClient.get<PlatformConfig[]>('/platform-configs', { params });
    return response.data;
  },

  // 获取支持的平台列表
  getSupportedPlatforms: async (): Promise<SupportedPlatform[]> => {
    const response = await apiClient.get<SupportedPlatform[]>('/platform-configs/supported-platforms');
    return response.data;
  },

  // 获取已启用的平台
  getActiveConfigs: async (): Promise<PlatformConfig[]> => {
    const response = await apiClient.get<PlatformConfig[]>('/platform-configs/active');
    return response.data;
  },

  // 获取已配置的平台
  getConfiguredConfigs: async (): Promise<PlatformConfig[]> => {
    const response = await apiClient.get<PlatformConfig[]>('/platform-configs/configured');
    return response.data;
  },

  // 创建平台配置
  createConfig: async (data: PlatformConfigCreate): Promise<PlatformConfig> => {
    const response = await apiClient.post<PlatformConfig>('/platform-configs', data);
    return response.data;
  },

  // 更新平台配置
  updateConfig: async (platformId: string, data: PlatformConfigUpdate): Promise<PlatformConfig> => {
    const response = await apiClient.put<PlatformConfig>(`/platform-configs?platform_id=${platformId}`, data);
    return response.data;
  },

  // 切换平台启用状态
  toggleActive: async (platformId: string, isActive: boolean): Promise<PlatformConfig> => {
    const response = await apiClient.patch<PlatformConfig>(`/platform-configs/active?platform_id=${platformId}&is_active=${isActive}`);
    return response.data;
  },

  // 删除/清空平台配置
  deleteConfig: async (platformId: string): Promise<{ message: string; success: boolean }> => {
    const response = await apiClient.delete(`/platform-configs?platform_id=${platformId}`);
    return response.data;
  },
};
