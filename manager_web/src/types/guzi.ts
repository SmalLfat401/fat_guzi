// 谷子黑话/术语数据类型定义
export interface GuziTerm {
  id: string;                // 术语ID
  term: string;              // 术语名称 (如 "谷子", "吧唧")
  meaning: string;           // 含义解释
  usage_scenario: string;    // 使用场景
  category?: string;         // 分类 (如 "周边类型", "交易术语", "圈内黑话")
  example?: string;          // 使用示例
  is_active: boolean;       // 是否启用
  ai_copywriting?: string;  // AI口播文案
  ai_script?: string;        // AI镜头脚本
  video_generated?: boolean; // 视频是否已生成
  video_published?: boolean; // 视频是否已发布
  created_at: string;
  updated_at: string;
}

export interface GuziTermCreate {
  term: string;
  meaning: string;
  usage_scenario: string;
  category?: string;
  example?: string;
}

export interface GuziTermUpdate {
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
