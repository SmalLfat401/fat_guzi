// 谷子商品标签数据类型定义

export type TagType = 'ip' | 'category';

export interface GuziTag {
  _id: string;
  tag_type: TagType;
  name: string;
  color?: string;
  remark?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GuziTagCreate {
  tag_type: TagType;
  name: string;
  color?: string;
  remark?: string;
}

export interface GuziTagUpdate {
  name?: string;
  color?: string;
  remark?: string;
  is_active?: boolean;
}

export interface GuziTagStats {
  ip_count: number;
  ip_active: number;
  category_count: number;
  category_active: number;
}
