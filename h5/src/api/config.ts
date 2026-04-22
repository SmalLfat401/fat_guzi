import axios, { AxiosError } from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8879/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError) => {
    const message =
      (error.response?.data as any)?.detail ||
      (error.response?.data as any)?.message ||
      '网络请求失败';
    console.error('API Error:', message);
    return Promise.reject(new Error(message));
  }
);
