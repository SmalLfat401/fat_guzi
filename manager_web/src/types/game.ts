// 游戏圈/二游黑话/术语数据类型定义
export interface GameTerm {
  id: string;                // 术语ID
  term: string;              // 术语名称 (如 "保底", "井", "初始号")
  meaning: string;           // 含义解释
  usage_scenario: string;    // 使用场景
  category?: string;         // 分类 (如 "抽卡术语", "交易术语", "玩法术语")
  example?: string;          // 使用示例
  is_active: boolean;       // 是否启用
  ai_copywriting?: string;  // AI口播文案
  ai_script?: string;       // AI镜头脚本
  video_generated?: boolean; // 视频生成标记
  video_published?: boolean;  // 视频发布标记
  created_at: string;
  updated_at: string;
}

export interface GameTermCreate {
  term: string;
  meaning: string;
  usage_scenario: string;
  category?: string;
  example?: string;
}

export interface GameTermUpdate {
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
