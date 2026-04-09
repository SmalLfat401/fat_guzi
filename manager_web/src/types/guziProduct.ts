// 谷子商品数据类型定义

// 单个平台的商品信息
export interface PlatformProduct {
  platform_id: string;        // 平台ID: alimama / jd / pdd
  platform_name: string;      // 平台名称: 淘宝/京东/拼多多
  platform_product_id: string; // 平台商品ID
  url: string;                // 原始推广链接（click_url）
  short_link?: string;        // 短链接（s.click.taobao.com/xxx），由单独接口生成
  tkl?: string;               // 淘口令短码（₤xxx₤）
  tkl_text?: string;          // 淘口令码（₤xxx₤），用于拼接推广文案
  link_generated_at?: string; // 短链接/淘口令生成时间（ISO 8601 UTC）
  link_expires_at?: string;   // 短链接过期时间（ISO 8601 UTC）
  price: number;               // 券后价/到手价
  original_price?: number;     // 标价/划线价（reserve_price）
  zk_final_price?: number;    // 折扣价（zk_final_price）
  commission_rate: number;     // 佣金率 (%)
  commission_amount: number;  // 预估佣金金额
  commission_type?: string;    // 佣金类型：COMMON/MKT/ZX
  coupon_amount?: number;      // 优惠券金额（元）
  coupon_url?: string;        // 优惠券链接
  coupon_share_url?: string;  // 优惠券领取链接
  shop_title?: string;        // 店铺名称
  seller_id?: string;         // 卖家ID
  user_type?: number;         // 店铺类型：0=淘宝, 1=天猫
  provcity?: string;          // 发货地
  real_post_fee?: string;     // 实际运费
  // 商品属性（来自 item_detail 接口）
  item_url?: string;          // 商品详情页URL
  free_shipment?: boolean;     // 是否包邮
  is_prepay?: boolean;         // 是否支持花呗/信用卡支付
  volume?: number;            // 30天引导销量
  annual_vol?: string;         // 年销量/预估年销量，如 "200+"
  tk_total_sales?: string;     // 淘客引导付款金额
  promotion_tags?: string[];   // 推广标签列表
  description?: string;         // 商品副标题/卖点
}
export interface GuziProduct {
  id: string;                 // MongoDB 文档ID（_id 被映射为 id）
  title: string;              // 商品标题
  image_url: string;          // 商品图片URL (本地路径)
  original_image_url?: string; // 原始图片URL
  small_images?: string[];    // 商品小图列表
  platforms: PlatformProduct[]; // 多平台商品信息
  // 自动计算的便捷字段
  lowest_price?: number;       // 最低价
  lowest_price_platform?: string; // 最低价平台ID
  highest_commission?: number; // 最高佣金
  highest_commission_platform?: string; // 最高佣金平台ID
  total_volume?: number;       // 所有平台累计销量
  description?: string;       // 商品文案/描述
  ip_tags: string[];          // IP标签ID列表
  category_tags: string[];     // 类别标签ID列表
  is_active: boolean;          // 是否上架
  brand_name?: string;         // 品牌名称
  category_id?: number;        // 商品类目ID
  category_name?: string;     // 商品类目名称
  level_one_category_id?: number; // 一级类目ID
  level_one_category_name?: string; // 一级类目名称
  // 是否已调用过 fetch-detail 接口（用于前端区分按钮文案）
  detail_fetched?: boolean;
  created_at: string;
  updated_at: string;
}

export interface GuziProductCreate {
  title: string;
  image_url: string;
  original_image_url?: string;
  small_images?: string[];
  platforms: PlatformProduct[];
  description?: string;
  ip_tags?: string[];
  category_tags?: string[];
  brand_name?: string;
  category_id?: number;
  category_name?: string;
  level_one_category_id?: number;
  level_one_category_name?: string;
}

export interface GuziProductUpdate {
  title?: string;
  image_url?: string;
  original_image_url?: string;
  small_images?: string[];
  platforms?: PlatformProduct[];
  description?: string;
  is_active?: boolean;
  ip_tags?: string[];
  category_tags?: string[];
  brand_name?: string;
  category_id?: number;
  category_name?: string;
  level_one_category_id?: number;
  level_one_category_name?: string;
}

// 搜索结果 - 多平台合并结果
export interface MultiPlatformSearchResult {
  keyword: string;
  results: ProductSearchItem[];
}

// 单个搜索结果项
export interface ProductSearchItem {
  title: string;
  image_url: string;
  small_images?: string[];
  sub_title?: string;
  platforms: PlatformProduct[];
  recommended_platform?: string;
  lowest_price: number;
  original_lowest_price?: number;
  highest_commission: number;
  volume?: number;
  annual_vol?: string;
  brand_name?: string;
  category_id?: number;
  category_name?: string;
  level_one_category_id?: number;
  level_one_category_name?: string;
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

// 获取商品详情响应
export interface FetchItemDetailResponse {
  product_id: string;             // 谷子商品ID（新增或已有）
  is_new: boolean;                 // 是否为新创建的商品
  platform_updated: boolean;       // platforms 是否被更新
  detail_filled?: {
    title?: string;
    price?: number;
    commission_rate?: number;
    commission_amount?: number;
    volume?: number;
    shop_title?: string;
    free_shipment?: boolean;
    is_prepay?: boolean;
    promotion_tags?: string[];
    small_images_count?: number;
  };
}

// 获取商品详情请求参数
export interface FetchItemDetailRequest {
  item_id: string;                 // 淘宝商品ID（num_iid）
  product_id?: string;             // 已有谷子商品ID（可选，不传则创建新商品）
  generate_links?: boolean;         // 是否同时生成短链接和淘口令
}
