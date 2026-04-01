import axios, { AxiosError } from 'axios';

export const API_BASE_URL = 'http://127.0.0.1:8879/api/v1/';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
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
