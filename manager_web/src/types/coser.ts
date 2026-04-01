// Coser圈黑话/术语数据类型定义
export interface CoserTerm {
  id: string;                // 术语ID
  term: string;              // 术语名称 (如 "COS", "C服", "妆面")
  meaning: string;           // 含义解释
  usage_scenario: string;    // 使用场景
  category?: string;         // 分类 (如 "基础术语", "装备术语", "化妆术语")
  example?: string;          // 使用示例
  is_active: boolean;       // 是否启用
  ai_copywriting?: string;  // AI口播文案
  ai_script?: string;       // AI镜头脚本
  video_generated?: boolean; // 视频是否已生成
  video_published?: boolean;  // 视频是否已发布
  created_at: string;
  updated_at: string;
}

export interface CoserTermCreate {
  term: string;
  meaning: string;
  usage_scenario: string;
  category?: string;
  example?: string;
}

export interface CoserTermUpdate {
  term?: string;
  meaning?: string;
  usage_scenario?: string;
  category?: string;
  example?: string;
  is_active?: boolean;
  ai_copywriting?: string;
  ai_script?: string;
  video_generated?: boolean;
  video_published?: boolean;
}
