import { apiClient } from './config';

export interface OverviewStats {
  today_pv: number;
  today_uv: number;
  yesterday_pv: number;
  yesterday_uv: number;
  pv_change: number;
  uv_change: number;
}

export interface PageStatsItem {
  page: string;
  pv: number;
  uv: number;
  click: number;
  expose: number;
  submit: number;
  action: number;
}

export interface ProductDetailStatsItem {
  item_id: string;
  item_name?: string;
  ip_tag?: string;
  category_tag?: string;
  pv: number;
  uv: number;
}

export interface CategoryStatsItem {
  category_tag: string;
  pv: number;
  uv: number;
}

export interface HotIpItem {
  ip_tag: string;
  click: number;
  pv: number;
  detail_count: number;
}

export interface ConversionStep {
  step: string;
  count: number;
}

export interface RetentionItem {
  date: string;
  new_users: number;
  retained_1d: number;
  retained_7d: number;
}

export interface TrackStats {
  overview: OverviewStats;
  page_stats: PageStatsItem[];
  product_detail_stats: ProductDetailStatsItem[];
  category_stats: CategoryStatsItem[];
  hot_ips: HotIpItem[];
  hot_searches: Array<{ keyword: string; count: number }>;
  conversion: { steps: ConversionStep[] };
  retention: RetentionItem[];
}

export interface PageStats {
  start_date: string;
  end_date: string;
  pages: PageStatsItem[];
}

export const analyticsApi = {
  /** 获取全部统计数据 */
  getStats: async (params?: { start_date?: string; end_date?: string }) => {
    const response = await apiClient.get<TrackStats>('/track/stats', { params });
    return response.data;
  },

  /** 获取各页面 PV/UV 排行 */
  getPages: async (params?: { start_date?: string; end_date?: string }) => {
    const response = await apiClient.get<PageStats>('/track/pages', { params });
    return response.data;
  },

  /** 获取指定日期概览（轻量） */
  getOverview: async (date?: string) => {
    const response = await apiClient.get<{ date: string; pv: number; uv: number }>('/track/overview', {
      params: date ? { date } : {},
    });
    return response.data;
  },
};
