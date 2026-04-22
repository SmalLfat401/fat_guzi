// 谷子商品标签数据类型定义

export type TagType = 'ip' | 'category';

export type IpCategory = 'animation' | 'game' | 'other';

// IP类别中文映射
export const IP_CATEGORY_LABELS: Record<IpCategory, string> = {
  animation: '动漫',
  game: '游戏',
  other: '其他',
};

// IP类别颜色映射
export const IP_CATEGORY_COLORS: Record<IpCategory, string> = {
  animation: '#1890ff',  // 蓝色 - 动漫
  game: '#722ed1',      // 紫色 - 游戏
  other: '#faad14',     // 橙色 - 其他
};

export interface GuziTag {
  _id: string;
  tag_type: TagType;
  name: string;
  color?: string;
  remark?: string;
  is_active: boolean;
  show_on_h5: boolean;
  ip_category?: IpCategory;
  created_at: string;
  updated_at: string;
}

export interface GuziTagCreate {
  tag_type: TagType;
  name: string;
  color?: string;
  remark?: string;
  show_on_h5?: boolean;
  ip_category?: IpCategory;
}

export interface GuziTagUpdate {
  name?: string;
  color?: string;
  remark?: string;
  is_active?: boolean;
  show_on_h5?: boolean;
  ip_category?: IpCategory;
}

export interface GuziTagStats {
  ip_count: number;
  ip_active: number;
  category_count: number;
  category_active: number;
}
