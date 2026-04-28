// 内容类型
export const CONTENT_TYPE_LABELS: Record<string, string> = {
  activity: '活动速递',
  new_product: '新品情报',
  slang_science: '黑话科普',
  meme_interaction: '比价/互动/梗图',
};

// 黑话科普分类
export const SLANG_CATEGORY_LABELS: Record<string, string> = {
  guzi: '谷子',
  coser: 'Coser',
  convention: '漫展',
  game: '游戏',
};

// 发布状态
export const PUBLISH_STATUS_LABELS: Record<string, string> = {
  pending: '待审核',
  confirmed: '已确认',
  published: '已发布',
};

export const PUBLISH_STATUS_OPTIONS = [
  { value: 'pending', label: '待审核', color: 'default' },
  { value: 'confirmed', label: '已确认', color: 'warning' },
  { value: 'published', label: '已发布', color: 'success' },
];

// 关联的术语条目
export interface LinkedSlangItem {
  slang_id: string;
  slang_type: string; // guzi/coser/convention/game
  slang_name: string;
}

// 单平台发布状态
export interface PlatformPublishStatus {
  status: string;
  published_at: string | null;
  confirmed_at: string | null;
  note: string;
}

// 排期条目
export interface ScheduleItem {
  id: string;
  week_year: string;
  date: string;
  content_type: string;
  title: string;
  body: string;
  images: string[];
  slang_category: string | null;
  linked_slags: LinkedSlangItem[];
  is_pinned: boolean;
  platforms: Record<string, PlatformPublishStatus>;
  created_at: string;
  updated_at: string;
}

export interface ScheduleItemCreate {
  week_year: string;
  date: string;
  content_type: string;
  title?: string;
  body?: string;
  images?: string[];
  slang_category?: string;
  linked_slags?: LinkedSlangItem[];
  is_pinned?: boolean;
}

export interface ScheduleItemUpdate {
  title?: string;
  body?: string;
  images?: string[];
  slang_category?: string;
  linked_slags?: LinkedSlangItem[];
  is_pinned?: boolean;
}

// 更新状态请求
export interface UpdateStatusRequest {
  platform_id: string;
  status: string;
  note?: string;
}

// 批量确认请求
export interface BatchConfirmRequest {
  item_ids: string[];
  reason: string;
}

// 周信息
export interface WeekInfo {
  week_year: string;
  week_number: number;
  year: number;
  monday: string;
  sunday: string;
}

// 渠道映射
export interface ChannelMap {
  id: string;
  name: string;
  icon?: string;
}
