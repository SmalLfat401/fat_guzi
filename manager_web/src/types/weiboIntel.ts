// 微博情报类型定义

// 情报类别
export type IntelCategory =
  | 'convention'
  | 'book_signing'
  | 'pre_order'
  | 'product_launch'
  | 'offline_activity'
  | 'online_activity'
  | 'other';

// 情报状态
export type IntelStatus = 'pending' | 'approved' | 'rejected' | 'extracting' | 'extract_failed' | 'not_related';

// 告警类型
export type AlertType = 'date_changed' | 'location_changed' | 'price_changed' | 'cancelled' | 'conflicting_info';

// 提取方式
export type ExtractMethod = 'rule' | 'ai' | 'manual';

// 情报类别映射
export const INTEL_CATEGORY_MAP: Record<IntelCategory, string> = {
  convention: '漫展',
  book_signing: '签售',
  pre_order: '预售',
  product_launch: '新谷开团',
  offline_activity: '线下活动',
  online_activity: '线上活动',
  other: '其他',
};

// 情报状态映射
export const INTEL_STATUS_MAP: Record<IntelStatus, string> = {
  pending: '待审核',
  approved: '已批准',
  rejected: '已拒绝',
  extracting: '提取中',
  extract_failed: '提取失败',
  not_related: '不相关',
};

// 告警类型映射
export const ALERT_TYPE_MAP: Record<AlertType, string> = {
  date_changed: '日期变更',
  location_changed: '地点变更',
  price_changed: '价格变动',
  cancelled: '活动取消',
  conflicting_info: '信息冲突',
};

// 来源帖子引用（可含正文）
export interface SourcePostRef {
  mid: string;
  author_nickname: string;
  author_uid: string;
  posted_at?: string;
  linked_at: string;
  update_type?: string;
  is_trigger_post: boolean;
  // 正文内容（详情接口返回）
  text?: string;
  text_raw?: string;
  created_at?: string;
  reposts_count?: number;
  comments_count?: number;
  attitudes_count?: number;
}

// 变更记录
export interface IntelChange {
  changed_at: string;
  changed_by: string;
  field?: string;
  old_value?: any;
  new_value?: any;
  source_post_mid?: string;
  change_type: 'created' | 'updated' | 'merged' | 'approved' | 'rejected' | 'alert_resolved';
  change_reason?: string;
}

// 情报列表项
export interface WeiboIntelItem {
  id: string;
  category: IntelCategory;
  category_display: string;
  title: string;
  description?: string;
  event_start_date?: string;
  event_end_date?: string;
  event_start_time?: string;
  event_location?: string;
  event_city?: string;
  price_info?: string;
  purchase_url?: string;
  participants: string[];
  related_ips: string[];
  tags: string[];
  cover_image?: string;

  status: IntelStatus;
  alert_type?: AlertType;
  alert_message?: string;
  alert_resolved: boolean;

  version: number;
  is_latest: boolean;
  merged_from_ids: string[];
  source_posts_count: number;
  first_post_author?: string;
  first_post_time?: string;

  extract_method: ExtractMethod;
  confidence: number;
  ai_model?: string;

  synced_to_calendar: boolean;
  calendar_event_id?: string;

  is_published: boolean;

  has_alert: boolean;
  change_history_count: number;

  created_at: string;
  updated_at: string;
  approved_at?: string;
}

// 情报详情
export interface WeiboIntelDetail extends WeiboIntelItem {
  source_posts: SourcePostRef[];
  change_history: IntelChange[];
  learned_keywords: string[];
  ai_raw_response?: Record<string, any>;
}

// 创建情报
export interface WeiboIntelCreate {
  category: IntelCategory;
  title: string;
  description?: string;
  event_start_date?: string;
  event_end_date?: string;
  event_start_time?: string;
  event_location?: string;
  event_city?: string;
  price_info?: string;
  purchase_url?: string;
  participants?: string[];
  related_ips?: string[];
  tags?: string[];
  cover_image?: string;
  source_post_mid?: string;
  author_uid?: string;
  author_nickname?: string;
}

// 更新情报
export interface WeiboIntelUpdate {
  category?: IntelCategory;
  title?: string;
  description?: string;
  event_start_date?: string;
  event_end_date?: string;
  event_start_time?: string;
  event_location?: string;
  event_city?: string;
  price_info?: string;
  purchase_url?: string;
  participants?: string[];
  related_ips?: string[];
  tags?: string[];
  cover_image?: string;
  alert_resolved?: boolean;
  is_published?: boolean;
}

// 情报统计
export interface IntelStats {
  intel: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    has_alert: number;
    synced_to_calendar: number;
    by_category: Record<string, number>;
    today_new: number;
  };
  pending_posts: number;
  batch_status: 'idle' | 'running' | 'completed' | 'failed';
  last_batch_result?: BatchResult;
}

// 批次执行结果
export interface BatchResult {
  posts_processed: number;
  intel_created: number;
  intel_merged: number;
  not_related: number;
  failed: number;
  errors: number;
  duration: number;
}

// 关键词组
export interface CategoryKeywords {
  id: string;
  category: IntelCategory;
  category_display: string;
  keywords: string[];
  exclude_keywords: string[];
  usage_count: number;
  hit_count_today: number;
  ai_confidence_override: number;
  source: 'ai' | 'manual' | 'approved';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 候选关键词
export interface KeywordCandidate {
  id: string;
  category: IntelCategory;
  category_display: string;
  keyword: string;
  source_intel_id: string;
  source_text_snippet: string;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

// 创建关键词组
export interface CategoryKeywordsCreate {
  category: IntelCategory;
  keywords: string[];
  exclude_keywords?: string[];
  ai_confidence_override?: number;
  source?: 'manual' | 'ai';
}

// 更新关键词组
export interface CategoryKeywordsUpdate {
  keywords?: string[];
  exclude_keywords?: string[];
  ai_confidence_override?: number;
  is_active?: boolean;
}

// 情报系统配置
export interface IntelConfig {
  keyword_library_enabled: boolean;
  rule_confidence_threshold: number;
  batch_size: number;
  max_batches_per_run: number;
  has_keywords: boolean;
  updated_at?: string;
}

// 单帖提取结果
export interface SingleExtractResult {
  mid: string;
  is_valid: boolean;
  reason?: string;
  category?: string;
  title?: string;
  event_start_date?: string;
  event_end_date?: string;
  event_start_time?: string;
  event_location?: string;
  event_city?: string;
  price_info?: string;
  participants: string[];
  related_ips: string[];
  tags: string[];
  description?: string;
  confidence: number;
  learned_keywords: string[];
}

// 情报筛选参数
export interface IntelFilter {
  skip?: number;
  limit?: number;
  status?: IntelStatus;
  category?: IntelCategory;
  has_alert?: boolean;
  search?: string;
  start_date_from?: string;
  start_date_to?: string;
  sort_by?: 'created_at' | 'updated_at' | 'event_start_date' | 'confidence';
  sort_order?: 'asc' | 'desc';
}
