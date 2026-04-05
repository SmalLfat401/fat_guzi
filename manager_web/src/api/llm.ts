import { API_BASE_URL } from './config';

export interface AIAssistParams {
  prompt: string;
  temperature?: number;
  max_tokens?: number;
}

export interface WeiboUserAnalyzeParams {
  nickname: string;
  profile_url?: string;
  available_categories?: string[];
}

export interface WeiboUserAnalyzeResult {
  notes: string;
  categories: string[];
}

/** LLM 对接 API */
export const llmApi = {
  /**
   * 流式助写 - 适用于前端实时展示打字效果
   */
  assistStream: (params: AIAssistParams): Promise<Response> => {
    const url = `${API_BASE_URL}llm/assist-stream`;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: params.prompt,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.max_tokens ?? 2000,
      }),
    });
  },

  /**
   * 非流式助写 - 一次性返回完整结果
   */
  assist: async (params: AIAssistParams): Promise<{ content: string }> => {
    const url = `${API_BASE_URL}llm/assist`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: params.prompt,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.max_tokens ?? 2000,
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as any).detail || `请求失败: ${response.status}`);
    }
    return response.json();
  },

  /**
   * 分析微博用户 - 抓取主页内容后进行 AI 分析
   */
  analyzeWeiboUser: async (params: WeiboUserAnalyzeParams): Promise<WeiboUserAnalyzeResult> => {
    const url = `${API_BASE_URL}/llm/analyze-weibo-user`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: params.nickname,
        profile_url: params.profile_url || '',
        available_categories: params.available_categories || [],
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as any).detail || `请求失败: ${response.status}`);
    }
    return response.json();
  },

  /**
   * 健康检查
   */
  health: async (): Promise<{ status: string; model?: string; error?: string }> => {
    const response = await fetch(`${API_BASE_URL}/llm/health`);
    return response.json();
  },
};
