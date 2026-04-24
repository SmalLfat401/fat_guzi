import { apiClient } from './config';
import type {
  GuziProduct,
  GuziProductCreate,
  GuziProductUpdate,
  ProductSearchResponse,
  PlatformProduct,
  FetchItemDetailRequest,
  FetchItemDetailResponse,
} from '../types/guziProduct';

export const guziProductApi = {
  // 获取所有谷子商品（管理端不过滤H5隐藏标签）
  getProducts: async (params?: {
    skip?: number;
    limit?: number;
    is_active?: boolean;
    search?: string;
    ip_tag?: string;
    category_tag?: string;
  }) => {
    // 管理端默认不过滤 H5 隐藏标签，否则无法管理包含隐藏标签的商品
    const response = await apiClient.get<{ items: GuziProduct[]; total: number }>('/guzi-products', {
      params: { ...params, h5_filter: false },
    });
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

  // 获取商品总数（管理端不过滤H5隐藏标签）
  getProductCount: async (params?: {
    is_active?: boolean;
    ip_tag?: string;
    category_tag?: string;
  }) => {
    const response = await apiClient.get<{ total: number }>('/guzi-products/count', {
      params: { ...params, h5_filter: false },
    });
    return response.data.total;
  },

  // 多平台搜索商品（支持分页和排序）
  searchProducts: async (params: {
    keyword: string;
    platforms?: string[];
    page_no?: number;
    page_size?: number;
    sort?: string;
  }) => {
    const response = await apiClient.get<ProductSearchResponse>('/guzi-products/search', { 
      params: { 
        keyword: params.keyword, 
        platforms: params.platforms?.join(','),
        page_no: params.page_no || 1,
        page_size: params.page_size || 20,
        sort: params.sort || 'tk_rate_des',
      } 
    });
    return response.data;
  },

  // 阿里妈妈搜索商品（支持分页和排序）
  searchAlimama: async (keyword: string, pageNo: number = 1, pageSize: number = 20, sort: string = 'tk_rate_des'): Promise<ProductSearchResponse> => {
    const response = await apiClient.get<ProductSearchResponse>('/guzi-products/search', {
      params: {
        keyword,
        platforms: 'alimama',
        page_no: pageNo,
        page_size: pageSize,
        sort,
      }
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

  // 根据淘宝商品ID获取详情并填充到谷子商品
  fetchItemDetail: async (params: FetchItemDetailRequest) => {
    const response = await apiClient.post<FetchItemDetailResponse>(
      '/guzi-products/fetch-detail',
      params
    );
    return response.data;
  },

  // 批量获取商品详情并填充到谷子商品
  batchFetchItemDetail: async (productIds: string[], generateLinks: boolean = true) => {
    const response = await apiClient.post<any>(
      '/guzi-products/batch-fetch-detail',
      { product_ids: productIds, generate_links: generateLinks }
    );
    return response.data;
  },
};
