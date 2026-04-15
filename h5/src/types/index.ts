/**
 * 谷子商品类型定义 (H5)
 * 适配后端 GuziProduct 数据结构
 */

// 平台商品信息
export interface PlatformInfo {
  platformId: string;
  platformName: string;
  price: number;
  originalPrice?: number;
  discountPrice?: number;
  commissionAmount?: number;
  commissionRate?: number;
  shopTitle?: string;
  shopType?: string;
  provcity?: string;
  // 来自 item_detail 接口的字段
  freeShipment?: boolean;       // 是否包邮
  isPrepay?: boolean;           // 是否支持花呗/信用卡
  volume?: number;               // 30天引导销量
  annualVol?: string;            // 年销量
  tkTotalSales?: string;         // 淘客引导付款金额
  promotionTags?: string[];      // 推广标签（如：包邮、满减等）
  couponAmount?: number;
  couponUrl?: string;
  tkl?: string;
  url?: string;
}

// 谷子商品（适配后端 GuziProduct）
export interface GuziProductH5 {
  id: string;
  name: string;
  cover: string;
  images: string[];
  price: number;
  originalPrice?: number;
  discountPrice?: number;
  category?: string;
  brandName?: string;             // 品牌名称
  // tags: 展示用的标签名称数组（由 tagNames 填充）
  tags: string[];
  tagNames: string[];
  // 以下为后端原始标签 ID，用于筛选和映射
  ipTags: string[];
  categoryTags: string[];
  description?: string;
  stock?: number;
  sales?: number;
  annualVol?: string;             // 年销量
  shopName?: string;
  shopId?: string;
  platform?: 'alimama' | 'jd' | 'pdd' | 'wechat' | string;
  platformName?: string;
  productUrl?: string;
  tkl?: string;
  commissionAmount?: number;
  commissionRate?: number;
  isHot?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  // 多平台信息
  platforms: PlatformInfo[];
}

// 商品筛选条件
export interface ProductFilter {
  category?: string;
  tags?: string[];
  ipTag?: string;
  categoryTag?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price' | 'sales' | 'commission' | 'createTime';
  sortOrder?: 'asc' | 'desc';
  keyword?: string;
  is_active?: boolean;
}

// 标签类型
export interface GuziTag {
  _id: string;
  name: string;
  tagType: 'ip' | 'category';
  color?: string;
  isActive?: boolean;
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

/**
 * H5 情报事件（来自 weibo_intel，已发布）
 */
export interface IntelCalendarEvent {
  id: string;
  date: string;
  time?: string;
  type: 'expo';
  icon: string;
  name: string;
  venue?: string;
  badge: string;
  cover?: string;
  price?: string;
}

/** H5 情报详情 */
export interface IntelEventDetail {
  id: string;
  uuid: string;
  date: string;
  end_date?: string;
  time?: string;
  type: string;
  icon: string;
  name: string;
  description?: string;
  venue?: string;
  city?: string;
  badge: string;
  cover?: string;
  price?: string;
  purchase_url?: string;
  participants: string[];
  related_ips: string[];
  tags: string[];
  source_post_url?: string;
  author_nickname?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface CalendarFilter {
  type?: CalendarEvent['type'];
  city?: string;
  month?: string;
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
  products: GuziProductH5[];
}

/**
 * H5 术语百科类型
 */
export type GlossaryCategory = 'guzi' | 'coser' | 'convention' | 'game';

export interface H5GlossaryItem {
  id: string;
  term: string;
  definition: string;
  category: GlossaryCategory;
  subcategory?: string;
  examples?: string[];
}

export interface H5GlossaryStats {
  total: number;
  categories: Record<GlossaryCategory, number>;
}

export interface H5GlossaryResponse {
  items: H5GlossaryItem[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
  stats: H5GlossaryStats;
}
