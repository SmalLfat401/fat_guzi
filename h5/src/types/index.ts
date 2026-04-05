/**
 * 谷子商品类型定义
 */

export interface GuziProduct {
  id: string;
  name: string;
  cover: string;
  images: string[];
  price: number;
  originalPrice?: number;
  category?: string;
  tags: string[];
  description?: string;
  stock?: number;
  sales?: number;
  rating?: number;
  shopName?: string;
  shopId?: string;
  platform?: 'taobao' | 'jd' | 'pdd' | 'wechat';
  productUrl?: string;
  isHot?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductFilter {
  category?: string;
  tags?: string[];
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price' | 'sales' | 'rating' | 'createTime';
  sortOrder?: 'asc' | 'desc';
  keyword?: string;
}

/**
 * 活动日历类型
 */
export interface CalendarEvent {
  id: string;
  title: string;
  subtitle?: string;
  type: 'convention' | 'exhibition' | 'activity' | 'online';
  startDate: string;
  endDate: string;
  location: string;
  city?: string;
  cover?: string;
  status: 'upcoming' | 'ongoing' | 'ended';
  tags: string[];
  description?: string;
  source?: string;
  sourceUrl?: string;
  price?: number;
  isFree?: boolean;
  createdAt?: string;
}

export interface CalendarFilter {
  type?: CalendarEvent['type'];
  city?: string;
  month?: string; // YYYY-MM
  status?: CalendarEvent['status'];
  keyword?: string;
}

/**
 * 谷子上新日历类型
 */
export interface GuziRelease {
  id: string;
  title: string;
  productId?: string;
  brand?: string;
  series?: string;
  cover: string;
  releaseDate: string;
  releaseTime?: string;
  price: number;
  originalPrice?: number;
  type: 'physical' | 'digital' | 'blind_box';
  status: 'upcoming' | 'released' | 'sold_out';
  platform?: string[];
  tags: string[];
  description?: string;
  sourceUrl?: string;
  createdAt?: string;
}

/**
 * 公告类型
 */
export interface Notice {
  id: string;
  title: string;
  content?: string;
  type: 'info' | 'warning' | 'success' | 'activity';
  isTop?: boolean;
  isRead?: boolean;
  publishTime?: string;
  expireTime?: string;
}

/**
 * 首页数据
 */
export interface HomeData {
  notices: Notice[];
  events: CalendarEvent[];
  releases: GuziRelease[];
  products: GuziProduct[];
}
