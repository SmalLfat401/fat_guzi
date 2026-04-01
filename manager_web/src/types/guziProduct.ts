// 谷子商品数据类型定义

// 单个平台的商品信息
export interface PlatformProduct {
  platform_id: string;        // 平台ID: alimama / jd / pdd
  platform_name: string;      // 平台名称: 淘宝/京东/拼多多
  platform_product_id: string; // 平台商品ID
  url: string;                // 原始推广链接（click_url）
  short_link?: string;        // 短链接（s.click.taobao.com/xxx），由单独接口生成
  tkl?: string;               // 淘口令短码（₤xxx₤）
  tkl_text?: string;   // 淘口令码（₤xxx₤），用于拼接推广文案
  link_generated_at?: string; // 短链接/淘口令生成时间（ISO 8601 UTC）
  link_expires_at?: string;   // 短链接过期时间（ISO 8601 UTC）
  price: number;              // 价格
  commission_rate: number;    // 佣金率 (%)
  commission_amount: number;  // 预估佣金金额
  description?: string;      // 商品描述
}

// 谷子商品（支持多平台）
export interface GuziProduct {
  id: string;                 // MongoDB 文档ID（_id 被映射为 id）
  title: string;              // 商品标题
  image_url: string;          // 商品图片URL (本地路径)
  original_image_url?: string; // 原始图片URL
  platforms: PlatformProduct[]; // 多平台商品信息

  // 自动计算的便捷字段
  lowest_price?: number;      // 最低价
  lowest_price_platform?: string; // 最低价平台ID
  highest_commission?: number; // 最高佣金
  highest_commission_platform?: string; // 最高佣金平台ID

  description?: string;        // 商品文案/描述
  ip_tags: string[];            // IP标签ID列表
  category_tags: string[];     // 类别标签ID列表
  is_active: boolean;         // 是否上架
  created_at: string;
  updated_at: string;
}

export interface GuziProductCreate {
  title: string;
  image_url: string;
  original_image_url?: string;
  platforms: PlatformProduct[];
  description?: string;
  ip_tags?: string[];
  category_tags?: string[];
}

export interface GuziProductUpdate {
  title?: string;
  image_url?: string;
  original_image_url?: string;
  platforms?: PlatformProduct[];
  description?: string;
  is_active?: boolean;
  ip_tags?: string[];
  category_tags?: string[];
}

// 搜索结果 - 多平台合并结果
export interface MultiPlatformSearchResult {
  keyword: string;
  results: ProductSearchItem[];
}

// 单个搜索结果项（可能是多平台的同一个商品）
export interface ProductSearchItem {
  // 合并后的基本信息
  title: string;
  image_url: string;
  
  // 多平台商品列表
  platforms: PlatformProduct[];
  
  // 推荐计算
  recommended_platform?: string; // 推荐平台ID (综合最优)
  lowest_price: number;
  highest_commission: number;
}

// 单平台搜索结果（原始API返回格式）
export interface SinglePlatformSearchResult {
  platform_id: string;
  platform_name: string;
  products: PlatformProduct[];
}

// 阿里妈妈搜索结果 (兼容旧版)
export interface AlimamaSearchResult {
  product_id: string;
  title: string;
  image_url: string;
  product_url: string;
  commission_rate?: number;
  price?: number;
  description?: string;
}
