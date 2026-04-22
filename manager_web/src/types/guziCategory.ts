// 谷子商品一级分类和二级分类类型定义

// ──────────────────────────────────────────────
//  一级分类
// ──────────────────────────────────────────────

export interface GuziCategory {
  _id: string;
  name: string;
  color?: string;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** 该一级分类下的二级分类统计 */
  sub_category_stats?: {
    total: number;
    active: number;
    inactive: number;
  };
}

export interface GuziCategoryCreate {
  name: string;
  color?: string;
  order?: number;
  is_active?: boolean;
}

export interface GuziCategoryUpdate {
  name?: string;
  color?: string;
  order?: number;
  is_active?: boolean;
}

export interface GuziCategoryListResponse {
  items: GuziCategory[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ──────────────────────────────────────────────
//  二级分类
// ──────────────────────────────────────────────

export interface GuziSubCategory {
  _id: string;
  parent_id: string;
  name: string;
  color?: string;
  order: number;
  is_active: boolean;
  /** 淘宝搜索关键词列表（展示用） */
  taobao_search_terms: string[];
  /** 用户搜索黑话/别名（用于拼接搜索词） */
  aliases: string[];
  /** 匹配权重 0-100 */
  match_weight: number;
  /** 排除词列表 */
  exclude: string[];
  /** 材质标签 */
  material_tags: string[];
  remark?: string;
  created_at: string;
  updated_at: string;
}

export interface GuziSubCategoryCreate {
  parent_id: string;
  name: string;
  color?: string;
  order?: number;
  is_active?: boolean;
  taobao_search_terms?: string[];
  aliases?: string[];
  match_weight?: number;
  exclude?: string[];
  material_tags?: string[];
  remark?: string;
}

export interface GuziSubCategoryUpdate {
  name?: string;
  parent_id?: string;
  color?: string;
  order?: number;
  is_active?: boolean;
  taobao_search_terms?: string[];
  aliases?: string[];
  match_weight?: number;
  exclude?: string[];
  material_tags?: string[];
  remark?: string;
}

export interface GuziSubCategoryListResponse {
  items: GuziSubCategory[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ──────────────────────────────────────────────
//  一级分类（含二级分类列表）
// ──────────────────────────────────────────────

export interface GuziCategoryWithSubs extends GuziCategory {
  sub_categories: GuziSubCategory[];
}

export interface GuziCategoryWithSubsListResponse {
  items: GuziCategoryWithSubs[];
  total: number;
}

export interface GuziCategoryStats {
  category_count: number;
  category_active: number;
  sub_category_count: number;
  sub_category_active: number;
}
