import { apiClient } from './config';
import type {
  WeiboIntelItem,
  WeiboIntelDetail,
  WeiboIntelCreate,
  WeiboIntelUpdate,
  IntelStats,
  CategoryKeywords,
  KeywordCandidate,
  CategoryKeywordsCreate,
  CategoryKeywordsUpdate,
  IntelFilter,
  BatchResult,
  SingleExtractResult,
  IntelConfig,
} from '../types/weiboIntel';
import type { WeiboPost } from '../types/weibo';

export const weiboIntelApi = {
  // ==================== 帖子列表（情报提取用）====================

  /** 获取帖子列表（用于情报提取页面） */
  getPosts: async (params: {
    skip?: number;
    limit?: number;
    intel_status?: number;
    search?: string;
  }): Promise<{ items: WeiboPost[]; total: number; skip: number; limit: number }> => {
    const response = await apiClient.get<{ items: WeiboPost[]; total: number; skip: number; limit: number }>(
      '/weibo-intel/posts',
      { params }
    );
    return response.data;
  },

  /** 重置帖子情报状态 */
  resetPostStatus: async (fromStatus: number, toStatus: number): Promise<{ success: boolean; message: string; count: number }> => {
    const response = await apiClient.post<{ success: boolean; message: string; count: number }>(
      '/weibo-intel/posts/reset-status',
      null,
      { params: { from_status: fromStatus, to_status: toStatus } }
    );
    return response.data;
  },

  // ==================== 单帖提取 ====================

  /** 触发单帖 AI 提取 */
  extractSingle: async (mid: string): Promise<SingleExtractResult> => {
    const response = await apiClient.post<SingleExtractResult>('/weibo-intel/extract-single', null, {
      params: { mid },
    });
    return response.data;
  },

  /** 确认提取结果，创建情报 */
  createFromExtract: async (data: {
    mid: string;
    category: string;
    title: string;
    description?: string;
    event_start_date?: string;
    event_end_date?: string;
    event_start_time?: string;
    event_location?: string;
    event_city?: string;
    price_info?: string;
    participants?: string[];
    related_ips?: string[];
    tags?: string[];
    confidence: number;
  }): Promise<WeiboIntelItem> => {
    const response = await apiClient.post<WeiboIntelItem>('/weibo-intel/create-from-extract', data);
    return response.data;
  },

  /** 标记帖子为不相关 */
  markNotRelated: async (mid: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post('/weibo-intel/mark-not-related', null, {
      params: { mid },
    });
    return response.data;
  },

  /** 获取帖子提取结果 */
  getExtractResult: async (mid: string): Promise<SingleExtractResult> => {
    const response = await apiClient.get<SingleExtractResult>(`/weibo-intel/extract-result/${mid}`);
    return response.data;
  },

  // ==================== 情报列表与查询 ====================

  /** 获取情报列表 */
  getList: async (filter?: Partial<IntelFilter>) => {
    const response = await apiClient.get<{ items: WeiboIntelItem[]; total: number }>('/weibo-intel', { params: filter });
    return response.data;
  },

  /** 获取待审核情报列表 */
  getPendingList: async (skip = 0, limit = 20) => {
    const response = await apiClient.get<{ items: WeiboIntelItem[]; total: number }>('/weibo-intel/pending', {
      params: { skip, limit },
    });
    return response.data;
  },

  /** 获取告警情报列表 */
  getAlertList: async (skip = 0, limit = 20) => {
    const response = await apiClient.get<{ items: WeiboIntelItem[]; total: number }>('/weibo-intel/alerts', {
      params: { skip, limit },
    });
    return response.data;
  },

  /** 获取情报详情 */
  getDetail: async (id: string) => {
    const response = await apiClient.get<WeiboIntelDetail>(`/weibo-intel/detail/${id}`);
    return response.data;
  },

  /** 获取帖子原文 */
  getPostDetail: async (mid: string) => {
    const response = await apiClient.get<{
      mid: string;
      author_nickname: string;
      author_uid: string;
      text?: string;
      text_raw?: string;
      created_at?: string;
      reposts_count: number;
      comments_count: number;
      attitudes_count: number;
    }>(`/weibo-intel/post/${mid}`);
    return response.data;
  },

  // ==================== 情报 CRUD ====================

  /** 创建情报（手动） */
  create: async (data: WeiboIntelCreate) => {
    const response = await apiClient.post<WeiboIntelItem>('/weibo-intel', data);
    return response.data;
  },

  /** 更新情报 */
  update: async (id: string, data: WeiboIntelUpdate) => {
    const response = await apiClient.put<WeiboIntelItem>(`/weibo-intel/${id}`, data);
    return response.data;
  },

  /** 删除情报 */
  delete: async (id: string) => {
    const response = await apiClient.delete(`/weibo-intel/${id}`);
    return response.data;
  },

  // ==================== 审核操作 ====================

  /** 批准情报 */
  approve: async (id: string, approvedBy = 'admin') => {
    const response = await apiClient.post<WeiboIntelItem>(
      `/weibo-intel/${id}/approve`,
      null,
      { params: { approved_by: approvedBy } }
    );
    return response.data;
  },

  /** 拒绝情报 */
  reject: async (id: string, rejectedBy = 'admin', reason?: string) => {
    const response = await apiClient.post<WeiboIntelItem>(
      `/weibo-intel/${id}/reject`,
      null,
      { params: { rejected_by: rejectedBy, reason } }
    );
    return response.data;
  },

  /** 批量批准 */
  batchApprove: async (ids: string[], approvedBy = 'admin') => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      '/weibo-intel/batch-approve',
      ids,
      { params: { approved_by: approvedBy } }
    );
    return response.data;
  },

  /** 批量拒绝 */
  batchReject: async (ids: string[], rejectedBy = 'admin') => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      '/weibo-intel/batch-reject',
      ids,
      { params: { rejected_by: rejectedBy } }
    );
    return response.data;
  },

  // ==================== 发布控制 ====================

  /** 发布情报到 H5 */
  publish: async (id: string) => {
    const response = await apiClient.post<WeiboIntelItem>(`/weibo-intel/${id}/publish`);
    return response.data;
  },

  /** 取消发布（从 H5 下线） */
  unpublish: async (id: string) => {
    const response = await apiClient.post<WeiboIntelItem>(`/weibo-intel/${id}/unpublish`);
    return response.data;
  },

  /** 批量发布 */
  batchPublish: async (ids: string[]) => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      '/weibo-intel/batch-publish',
      ids
    );
    return response.data;
  },

  /** 批量取消发布 */
  batchUnpublish: async (ids: string[]) => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      '/weibo-intel/batch-unpublish',
      ids
    );
    return response.data;
  },

  // ==================== 告警处理 ====================

  /** 处理告警 */
  resolveAlert: async (id: string, resolvedBy = 'admin', reason?: string) => {
    const response = await apiClient.post<WeiboIntelItem>(
      `/weibo-intel/${id}/resolve-alert`,
      null,
      { params: { resolved_by: resolvedBy, reason } }
    );
    return response.data;
  },

  // ==================== AI 调度器 ====================

  /** 启动调度器 */
  startScheduler: async (interval = 60) => {
    const response = await apiClient.post<{ success: boolean; message: string; interval?: number }>(
      '/weibo-intel/scheduler/start',
      null,
      { params: { interval } }
    );
    return response.data;
  },

  /** 停止调度器 */
  stopScheduler: async () => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      '/weibo-intel/scheduler/stop',
      null
    );
    return response.data;
  },

  /** 手动触发单个批次（临时触发，不依赖调度器） */
  triggerBatch: async (batchSize = 20) => {
    const response = await apiClient.post<{ success: boolean; result: BatchResult }>(
      '/weibo-intel/trigger-batch',
      null,
      { params: { batch_size: batchSize } }
    );
    return response.data;
  },

  /** 取消正在执行的批次 */
  cancelBatch: async () => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      '/weibo-intel/cancel-batch',
      null
    );
    return response.data;
  },

  /** 获取调度器状态（轮询用，合并了 post_stats） */
  getSchedulerStatus: async () => {
    const response = await apiClient.get<{
      scheduler_enabled: boolean;
      scheduler_interval: number;
      batch_status: string;
      last_batch_result?: BatchResult;
      post_stats: Record<string, number>;
    }>('/weibo-intel/scheduler/status');
    return response.data;
  },

  // ==================== 统计 ====================

  /** 获取情报统计 */
  getStats: async () => {
    const response = await apiClient.get<IntelStats>('/weibo-intel/stats');
    return response.data;
  },

  // ==================== 关键词库 ====================

  /** 获取关键词库 */
  getKeywords: async () => {
    const response = await apiClient.get<CategoryKeywords[]>('/weibo-intel/keywords');
    return response.data;
  },

  /** 创建/更新关键词组 */
  saveKeywords: async (data: CategoryKeywordsCreate) => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      '/weibo-intel/keywords',
      data
    );
    return response.data;
  },

  /** 更新指定 category 的关键词 */
  updateKeywords: async (category: string, data: CategoryKeywordsUpdate) => {
    const response = await apiClient.put<{ success: boolean; message: string }>(
      `/weibo-intel/keywords/${category}`,
      data
    );
    return response.data;
  },

  /** 获取候选关键词列表 */
  getKeywordCandidates: async (params?: {
    status?: string;
    category?: string;
    skip?: number;
    limit?: number;
  }) => {
    const response = await apiClient.get<KeywordCandidate[]>('/weibo-intel/keyword-candidates', {
      params,
    });
    return response.data;
  },

  /** 批准候选关键词 */
  approveKeywordCandidate: async (candidateId: string, approvedBy = 'admin') => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/weibo-intel/keyword-candidates/${candidateId}/approve`,
      null,
      { params: { approved_by: approvedBy } }
    );
    return response.data;
  },

  /** 拒绝候选关键词 */
  rejectKeywordCandidate: async (candidateId: string, rejectedBy = 'admin') => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/weibo-intel/keyword-candidates/${candidateId}/reject`,
      null,
      { params: { rejected_by: rejectedBy } }
    );
    return response.data;
  },

  /** 批量批准候选关键词 */
  batchApproveKeywordCandidates: async (candidateIds: string[], approvedBy = 'admin') => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      '/weibo-intel/keyword-candidates/batch-approve',
      candidateIds,
      { params: { approved_by: approvedBy } }
    );
    return response.data;
  },

  // ==================== 情报系统配置 ====================

  /** 获取情报系统配置 */
  getIntelConfig: async () => {
    const response = await apiClient.get<IntelConfig>('/weibo-intel/intel-config');
    return response.data;
  },

  /** 更新情报系统配置 */
  updateIntelConfig: async (data: {
    keyword_library_enabled?: boolean;
    rule_confidence_threshold?: number;
    batch_size?: number;
    max_batches_per_run?: number;
  }) => {
    const response = await apiClient.put<IntelConfig>('/weibo-intel/intel-config', data);
    return response.data;
  },
};
