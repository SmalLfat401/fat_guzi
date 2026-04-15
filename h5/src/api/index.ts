/**
 * API 服务层
 * 封装所有后端接口调用
 */
import axios, { AxiosInstance } from 'axios';
import type {
  GuziProductH5,
  ProductFilter,
  GuziTag,
  HomeData,
  PlatformInfo,
  H5GlossaryResponse,
  H5GlossaryStats,
  IntelEventDetail,
} from '@/types';

// 后端原始数据类型（用于转换）
interface BackendGuziProduct {
  id: string;
  title: string;
  image_url: string;
  original_image_url?: string;
  small_images?: string[];
  platforms: any[];
  lowest_price?: number;
  highest_commission?: number;
  total_volume?: number;
  description?: string;
  category_name?: string;
  brand_name?: string;
  level_one_category_name?: string;
  ip_tags?: string[];
  category_tags?: string[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// 创建 axios 实例
const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8879/api/v1',
  // 实际请求路径: baseURL + '/guzi-products' = 'http://localhost:8879/api/v1/guzi-products'
  // 后端 FastAPI 所有路由已在 main.py 中通过 include_router(prefix="/api/v1") 注册
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
  (response) => {
    return response.data;
  },
  (error) => {
    const message = error.response?.data?.detail || error.response?.data?.message || '网络请求失败';
    console.error('API Error:', message);
    return Promise.reject(new Error(message));
  }
);

// ──────────────────────────────────────────────
// 数据转换函数：后端 GuziProduct → H5 GuziProductH5
// ──────────────────────────────────────────────

function transformProduct(
  product: BackendGuziProduct,
  tagIdToName: Map<string, string> = new Map()
): GuziProductH5 {
  // 获取最低价平台信息（用于商品主信息展示）
  const platforms = product.platforms || [];
  const lowestPricePlatform = platforms.reduce(
    (min, p) => (p.price < min.price ? p : min),
    platforms[0] || { price: 0 }
  );

  // 构建图片数组
  const allImages = [
    product.original_image_url || product.image_url,
    ...(product.small_images || []),
  ].filter(Boolean);

  // 原始标签 ID 数组
  const ipTagIds = product.ip_tags || [];
  const categoryTagIds = product.category_tags || [];
  const allTagIds = [...ipTagIds, ...categoryTagIds];

  // 将标签 ID 映射为标签名称
  const ipTagNames: string[] = ipTagIds
    .map((id) => tagIdToName.get(id))
    .filter(Boolean) as string[];
  const categoryTagNames: string[] = categoryTagIds
    .map((id) => tagIdToName.get(id))
    .filter(Boolean) as string[];
  const allTagNames = [...ipTagNames, ...categoryTagNames];

  return {
    id: product.id,
    name: product.title,
    cover: product.image_url || allImages[0] || '',
    images: allImages,
    price: lowestPricePlatform.price || 0,
    originalPrice: lowestPricePlatform.original_price || undefined,
    discountPrice: lowestPricePlatform.zk_final_price || undefined,
    category: product.category_name || '',
    brandName: product.brand_name || undefined,
    // tags: 用于展示的名称数组（由标签管理器填充）
    tags: allTagNames,
    tagNames: allTagNames,
    // 保留原始标签 ID，转换为已映射的名称
    ipTags: ipTagNames,
    categoryTags: categoryTagNames,
    description: product.description || '',
    stock: undefined,
    sales: lowestPricePlatform.volume || undefined,
    annualVol: lowestPricePlatform.annual_vol || undefined,
    shopName: lowestPricePlatform.shop_title || '',
    shopId: lowestPricePlatform.seller_id || '',
    platform: lowestPricePlatform.platform_id as GuziProductH5['platform'],
    platformName: lowestPricePlatform.platform_name || '',
    productUrl: lowestPricePlatform.url || '',
    tkl: lowestPricePlatform.tkl_text || '',
    // 隐藏分佣金额和分佣率 —— 这是淘宝客内部数据，不面向用户展示
    commissionAmount: undefined,
    commissionRate: undefined,
    isHot: (lowestPricePlatform.volume || 0) > 100,
    isActive: product.is_active,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
    // 多平台信息（隐藏分佣相关字段）
    platforms: platforms.map((p) => ({
      platformId: p.platform_id,
      platformName: p.platform_name || p.platform_id,
      price: p.price,
      originalPrice: p.original_price,
      discountPrice: p.zk_final_price,
      // 隐藏分佣数据 —— 这是淘宝客运营人员才需要看到的东西
      commissionAmount: undefined,
      commissionRate: undefined,
      shopTitle: p.shop_title || '',
      shopType: p.user_type === 1 ? '天猫' : '淘宝',
      provcity: p.provcity || '',
      // 来自 item_detail 接口的新字段
      freeShipment: p.free_shipment ?? undefined,
      isPrepay: p.is_prepay ?? undefined,
      volume: p.volume || 0,
      annualVol: p.annual_vol || '',
      tkTotalSales: p.tk_total_sales || '',
      promotionTags: p.promotion_tags || [],
      couponAmount: p.coupon_amount,
      couponUrl: p.coupon_url,
      tkl: p.tkl_text || '',
      url: p.url || '',
    })),
  };
}

// ──────────────────────────────────────────────
// API 接口
// ──────────────────────────────────────────────

/**
 * 获取商品列表
 */
export async function fetchProducts(filter?: ProductFilter, tagIdToName?: Map<string, string>): Promise<GuziProductH5[]> {
  try {
    const params: Record<string, any> = {
      skip: 0,
      limit: 100,
    };

    if (filter?.keyword) {
      params.search = filter.keyword;
    }
    if (filter?.is_active !== false) {
      params.is_active = true; // H5 默认只显示上架商品
    }
    if (filter?.ipTag) {
      params.ip_tag = filter.ipTag;
    }
    if (filter?.categoryTag) {
      params.category_tag = filter.categoryTag;
    }

    const response = await apiClient.get<any>('/guzi-products', { params });
    const rawData = response as any;
    const products = Array.isArray(rawData) ? rawData : (rawData.items || []);

    return (products as BackendGuziProduct[]).map((p) =>
      transformProduct(p, tagIdToName || new Map())
    );
  } catch (error) {
    console.error('获取商品列表失败:', error);
    return [];
  }
}

/**
 * 获取商品详情
 */
export async function fetchProductDetail(id: string, tagIdToName?: Map<string, string>): Promise<GuziProductH5 | null> {
  try {
    const response = await apiClient.get<BackendGuziProduct>(`/guzi-products/${id}`);
    return transformProduct(
      response as unknown as BackendGuziProduct,
      tagIdToName || new Map()
    );
  } catch (error) {
    console.error('获取商品详情失败:', error);
    return null;
  }
}

/**
 * 获取标签列表
 * - tagType 为空：返回全部标签（用于建立 ID→名称 映射）
 * - tagType 为 'ip'：返回 IP 标签列表（用于筛选器）
 * - tagType 为 'category'：返回类别标签列表（用于筛选器）
 */
export async function fetchTags(tagType?: 'ip' | 'category'): Promise<GuziTag[]> {
  try {
    const params: Record<string, any> = {
      limit: 500, // 一次性获取足够多的标签
    };
    if (tagType) {
      params.tag_type = tagType;
      params.show_on_h5 = true; // H5 端只显示管理员设置为"在H5显示"的标签
    }

    const response = await apiClient.get<any>('/guzi-tags', { params });
    const rawData = response as any;
    const items = Array.isArray(rawData)
      ? rawData
      : Array.isArray(rawData.items)
      ? rawData.items
      : [];

    return items.map((tag: any) => ({
      _id: tag._id || tag.id,
      name: tag.name,
      tagType: tag.tag_type || tagType || 'ip',
      color: tag.color,
      isActive: tag.is_active ?? true,
    }));
  } catch (error) {
    console.error('获取标签列表失败:', error);
    return [];
  }
}

/**
 * 获取全部标签并建立 ID→名称 映射表
 * 用于在商品转换时将标签 ID 替换为标签名称
 */
export async function fetchAllTags(): Promise<Map<string, string>> {
  const allTags = await fetchTags();
  const map = new Map<string, string>();
  for (const tag of allTags) {
    map.set(tag._id, tag.name);
  }
  return map;
}

/**
 * 获取首页数据
 */
export async function fetchHomeData(): Promise<HomeData> {
  try {
    // 并行请求多个接口
      const [productsResponse, eventsResponse, releasesResponse] = await Promise.allSettled([
      apiClient.get<BackendGuziProduct[]>('/guzi-products', {
        params: { skip: 0, limit: 10, is_active: true }
      }),
      apiClient.get('/calendar/events', { params: { limit: 5 } }).catch(() => null),
      apiClient.get('/releases', { params: { limit: 5 } }).catch(() => null),
    ]);

    // 处理商品数据
    let products: GuziProductH5[] = [];
    if (productsResponse.status === 'fulfilled') {
      const rawData = productsResponse.value as any;
      const productList = Array.isArray(rawData) ? rawData : (rawData.items || []);
      products = productList.map(transformProduct);
    }

    // 如果后端数据为空，返回空数据而不是模拟数据
    return {
      notices: [],
      events: [],
      releases: [],
      products,
    };
  } catch (error) {
    console.error('获取首页数据失败:', error);
    return {
      notices: [],
      events: [],
      releases: [],
      products: [],
    };
  }
}

/**
 * 获取活动日历列表（微博情报）
 * @param params.mode - calendar=日历视图, list=列表视图
 * @param params.start_date - 开始日期 YYYY-MM-DD
 * @param params.end_date - 结束日期 YYYY-MM-DD（日历视图用）
 * @param params.category - 情报类别过滤
 * @param params.skip - 跳过条数（列表视图分页用）
 * @param params.limit - 返回条数
 */
export async function fetchCalendarEvents(params: {
  mode?: 'calendar' | 'list';
  start_date?: string;
  end_date?: string;
  category?: string;
  skip?: number;
  limit?: number;
} = {}): Promise<{ items: any[]; total: number }> {
  try {
    // apiClient 拦截器已返回 response.data，直接访问
    const intelRes = await apiClient.get('/h5/intel/events', { params }).catch(() => null) as { items: any[]; total: number } | null;
    return {
      items: intelRes?.items || [],
      total: intelRes?.total || 0,
    };
  } catch (error) {
    console.error('获取活动日历失败:', error);
    return { items: [], total: 0 };
  }
}

/**
 * 获取公告列表
 */
export async function fetchNotices() {
  try {
    const response = await apiClient.get<any>('/notices');
    const rawData = response as any;
    return Array.isArray(rawData) ? rawData : (rawData.items || rawData || []);
  } catch (error) {
    console.error('获取公告失败:', error);
    return [];
  }
}

/**
 * 为指定商品的指定平台生成淘口令
 * 响应中只更新了 tkl/tkl_text 字段，其余字段透传后端原始值
 */
export async function generateTkl(productId: string, platformIndex: number): Promise<PlatformInfo | null> {
  try {
    const response = await apiClient.post<any>(
      `/guzi-products/generate-tkl/${productId}`,
      null,
      { params: { platform_index: platformIndex } }
    );
    const p = response as any;
    return {
      platformId: p.platform_id,
      platformName: p.platform_name || p.platform_id,
      price: p.price,
      originalPrice: p.original_price,
      discountPrice: p.zk_final_price,
      commissionAmount: p.commission_amount,
      commissionRate: p.commission_rate,
      shopTitle: p.shop_title || '',
      shopType: p.user_type === 1 ? '天猫' : '淘宝',
      provcity: p.provcity || '',
      freeShipment: p.free_shipment ?? undefined,
      isPrepay: p.is_prepay ?? undefined,
      volume: p.volume || 0,
      annualVol: p.annual_vol || '',
      tkTotalSales: p.tk_total_sales || '',
      promotionTags: p.promotion_tags || [],
      couponAmount: p.coupon_amount,
      couponUrl: p.coupon_url,
      tkl: p.tkl_text || '',
      url: p.url || '',
    };
  } catch (error) {
    console.error('生成淘口令失败:', error);
    throw error;
  }
}

/**
 * 获取术语百科列表（H5 接口，支持分页）
 */
export async function fetchGlossaryTerms(
  page: number = 1,
  pageSize: number = 20,
  category?: string,
  search?: string
): Promise<H5GlossaryResponse | null> {
  try {
    const params: Record<string, any> = {
      page,
      page_size: pageSize,
    };
    if (category) {
      params.category = category;
    }
    if (search) {
      params.search = search;
    }

    const response = await apiClient.get<any>('/h5/glossary', { params });
    return response as unknown as H5GlossaryResponse;
  } catch (error) {
    console.error('获取术语百科失败:', error);
    return null;
  }
}

export async function fetchGlossaryStats(): Promise<H5GlossaryStats | null> {
  try {
    const response = await apiClient.get<any>('/h5/glossary/stats');
    return response as unknown as H5GlossaryStats;
  } catch (error) {
    console.error('获取术语统计数据失败:', error);
    return null;
  }
}

/**
 * 获取情报详情（供 H5 情报详情页使用）
 */
export async function fetchIntelEventDetail(
  intelId: string
): Promise<IntelEventDetail | null> {
  try {
    const response = await apiClient.get<any>(`/h5/intel/events/${intelId}`);
    return response as unknown as IntelEventDetail;
  } catch (error) {
    console.error('获取情报详情失败:', error);
    return null;
  }
}

export default {
  fetchHomeData,
  fetchCalendarEvents,
  fetchIntelEventDetail,
  fetchProducts,
  fetchProductDetail,
  fetchTags,
  fetchAllTags,
  fetchNotices,
  generateTkl,
  fetchGlossaryTerms,
  fetchGlossaryStats,
};
