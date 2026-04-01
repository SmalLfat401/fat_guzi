import { apiClient } from './config';
import type {
  GuziProduct,
  GuziProductCreate,
  GuziProductUpdate,
  ProductSearchItem,
  PlatformProduct,
} from '../types/guziProduct';

export const guziProductApi = {
  // 获取所有谷子商品
  getProducts: async (params?: {
    skip?: number;
    limit?: number;
    is_active?: boolean;
    search?: string;
    ip_tag?: string;
    category_tag?: string;
  }) => {
    const response = await apiClient.get<GuziProduct[]>('/guzi-products', { params });
    return response.data;
  },

  // 获取单个谷子商品
  getProduct: async (id: string) => {
    const response = await apiClient.get<GuziProduct>(`/guzi-products/${id}`);
    return response.data;
  },

  // 创建谷子商品
  createProduct: async (product: GuziProductCreate) => {
    const response = await apiClient.post<GuziProduct>('/guzi-products', product);
    return response.data;
  },

  // 批量创建谷子商品
  createProducts: async (products: GuziProductCreate[]) => {
    const response = await apiClient.post<GuziProduct[]>('/guzi-products/batch', products);
    return response.data;
  },

  // 更新谷子商品
  updateProduct: async (id: string, product: GuziProductUpdate) => {
    const response = await apiClient.put<GuziProduct>(`/guzi-products/${id}`, product);
    return response.data;
  },

  // 删除谷子商品
  deleteProduct: async (id: string) => {
    const response = await apiClient.delete(`/guzi-products/${id}`);
    return response.data;
  },

  // 上下架商品
  toggleActive: async (id: string) => {
    const response = await apiClient.patch<GuziProduct>(`/guzi-products/${id}/toggle`);
    return response.data;
  },

  // 批量上下架
  toggleProductsActive: async (ids: string[], is_active: boolean) => {
    const response = await apiClient.patch<GuziProduct[]>('/guzi-products/batch-toggle', { ids, is_active });
    return response.data;
  },

  // 获取商品总数
  getProductCount: async (params?: {
    is_active?: boolean;
    ip_tag?: string;
    category_tag?: string;
  }) => {
    const response = await apiClient.get<{ total: number }>('/guzi-products/count', { params });
    return response.data.total;
  },

  // 多平台搜索商品
  searchProducts: async (keyword: string, platforms?: string[]) => {
    const response = await apiClient.get<ProductSearchItem[]>('/guzi-products/search', { 
      params: { keyword, platforms: platforms?.join(',') } 
    });
    return response.data;
  },

  // 阿里妈妈搜索商品（兼容旧版）
  searchAlimama: async (keyword: string) => {
    const response = await apiClient.get<ProductSearchItem[]>('/guzi-products/search', { 
      params: { keyword, platforms: 'alimama' } 
    });
    return response.data;
  },

  // 为指定商品的指定平台生成淘口令
  generateTkl: async (productId: string, platformIndex: number) => {
    const response = await apiClient.post<PlatformProduct>(
      `/guzi-products/generate-tkl/${productId}`,
      null,
      { params: { platform_index: platformIndex } }
    );
    return response.data;
  },
};
