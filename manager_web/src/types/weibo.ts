// 微博用户数据类型定义
export interface WeiboUser {
  uid: string;
  nickname: string;
  profile_url: string;
  followers_count?: number;
  is_active: boolean;
  notes?: string;
  categories?: string[];
  created_at: string;
  updated_at: string;
  last_crawled_at?: string;
}

export interface WeiboUserCreate {
  uid: string;
  nickname: string;
  profile_url?: string;
  followers_count?: number;
  notes?: string;
  categories?: string[];
}

export interface WeiboUserUpdate {
  nickname?: string;
  profile_url?: string;
  followers_count?: number;
  is_active?: boolean;
  notes?: string;
  categories?: string[];
}

// 微博帖子数据类型定义
export interface WeiboPost {
  _id?: string;
  mid: string;
  mblogid?: string;
  user_id?: number;
  user_idstr: string;
  user_nickname: string;
  text?: string;
  text_raw?: string;
  created_at?: string;
  created_at_dt?: string;
  reposts_count?: number;
  comments_count?: number;
  attitudes_count?: number;
  source?: string;
  region_name?: string;
  continue_tag?: {
    title: string;
    pic: string;
    scheme: string;
    cleaned: boolean;
  } | null;
  source_uid?: string;
  crawled_at?: string;
  crawl_source?: string;
  is_top?: boolean;
  long_text?: string;
  long_text_updated_at?: string;
  /** 情报分析状态: 0未处理/1已提取/2提取中/3不相关/4失败 */
  intel_status?: number;
  intel_confidence?: number;
  intel_analyzed_at?: string;
  intel_extracted_info?: Record<string, unknown>;
}
