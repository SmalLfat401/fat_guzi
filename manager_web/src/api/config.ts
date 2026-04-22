import axios, { AxiosError } from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8879/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000,  // 5分钟超时，批次处理可能需要较长时间
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const message = (error.response?.data as any)?.detail || error.message || '请求失败';
    return Promise.reject(new Error(message));
  }
);
