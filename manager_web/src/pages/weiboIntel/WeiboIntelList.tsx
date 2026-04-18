import { useState, useEffect } from 'react';
import {
  message, Space, Tag, Button, Table, Tooltip, Row, Col,
  Card, Empty, Spin, Divider, Alert, Form, Input, Select, DatePicker,
  Modal, Switch, Slider, InputNumber,
} from 'antd';
import {
  EyeOutlined, RobotOutlined, CheckOutlined, CloseOutlined,
  SyncOutlined, ClockCircleOutlined, FileTextOutlined, LinkOutlined,
  SettingOutlined, PlayCircleOutlined, CheckCircleOutlined, LoadingOutlined,
  StopOutlined, CloseCircleOutlined, UndoOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import '../../styles/global.scss';
import { weiboIntelApi } from '../../api/weiboIntel';
import type { WeiboPost } from '../../types/weibo';
import type { SingleExtractResult, IntelConfig } from '../../types/weiboIntel';
import { INTEL_CATEGORY_MAP } from '../../types/weiboIntel';
import IntelLogPanel from './IntelLogPanel';

dayjs.locale('zh-cn');

const INTEL_STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: '未处理', color: 'default' },
  1: { label: '已提取', color: 'green' },
  2: { label: '提取中', color: 'blue' },
  3: { label: '不相关', color: 'red' },
  4: { label: '失败', color: 'orange' },
};

const categoryOptions = Object.entries(INTEL_CATEGORY_MAP).map(([value, label]) => ({ value, label }));

const WeiboIntelList: React.FC = () => {
  // 帖子列表状态
  const [posts, setPosts] = useState<WeiboPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedPost, setSelectedPost] = useState<WeiboPost | null>(null);
  const pageSize = 20;

  // 帖子统计
  const [postStats, setPostStats] = useState<Record<string, number>>({
    total: 0, '0': 0, '1': 0, '2': 0, '3': 0, '4': 0,
  });

  // 筛选状态
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined);
  const [statusChanged, setStatusChanged] = useState(false);  // 标记筛选是否变化

  // 是否已初始化（首次加载后设为 true）
  const [initialized, setInitialized] = useState(false);

  // 提取结果状态
  const [extractResult, setExtractResult] = useState<SingleExtractResult | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [editForm] = Form.useForm();

  // 提交状态
  const [saving, setSaving] = useState(false);

  // 批次相关状态
  const [schedulerEnabled, setSchedulerEnabled] = useState(false);
  const [schedulerInterval, setSchedulerInterval] = useState(60);
  const [batchStatus, setBatchStatus] = useState<'idle' | 'running' | 'completed' | 'failed' | 'cancelling'>('idle');
  const [schedulerStarting, setSchedulerStarting] = useState(false);
  const [schedulerStopping, setSchedulerStopping] = useState(false);

  // 配置弹窗
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [intelConfig, setIntelConfig] = useState<IntelConfig | null>(null);
  const [configSaving, setConfigSaving] = useState(false);

  // 重置状态
  const [resetting, setResetting] = useState(false);

  // 加载调度器状态（轮询用，包含 post_stats）
  const fetchSchedulerStatus = async () => {
    try {
      const data = await weiboIntelApi.getSchedulerStatus();
      setSchedulerEnabled(data.scheduler_enabled);
      setSchedulerInterval(data.scheduler_interval);
      setBatchStatus(data.batch_status as typeof batchStatus);
      setPostStats(data.post_stats);
    } catch {}
  };

  // 启动调度器
  const handleStartScheduler = async () => {
    setSchedulerStarting(true);
    try {
      const result = await weiboIntelApi.startScheduler(schedulerInterval);
      if (result.success) {
        setSchedulerEnabled(true);
        message.success(result.message);
      } else {
        message.warning(result.message);
      }
    } catch (err) {
      message.error('启动调度器失败: ' + (err as Error).message);
    } finally {
      setSchedulerStarting(false);
    }
  };

  // 停止调度器
  const handleStopScheduler = async () => {
    setSchedulerStopping(true);
    try {
      const result = await weiboIntelApi.stopScheduler();
      if (result.success) {
        setSchedulerEnabled(false);
        message.success(result.message);
      } else {
        message.warning(result.message);
      }
    } catch (err) {
      message.error('停止调度器失败: ' + (err as Error).message);
    } finally {
      setSchedulerStopping(false);
    }
  };

  // 取消批次
  const handleCancelBatch = async () => {
    try {
      const result = await weiboIntelApi.cancelBatch();
      if (result.success) {
        message.success(result.message);
      } else {
        message.warning(result.message);
      }
    } catch (err) {
      message.error('取消批次失败: ' + (err as Error).message);
    }
  };
  void handleCancelBatch; // 保留以备后用

  // 加载情报系统配置
  const fetchIntelConfig = async () => {
    try {
      const data = await weiboIntelApi.getIntelConfig();
      setIntelConfig(data);
    } catch {}
  };

  // 加载帖子列表
  const fetchPosts = async (pageNum: number = 1) => {
    setPostsLoading(true);
    try {
      const result = await weiboIntelApi.getPosts({
        skip: (pageNum - 1) * pageSize,
        limit: pageSize,
        intel_status: statusFilter,
      });
      setPosts(result.items);
      setTotal(result.total);
      setPage(pageNum);
    } catch (err) {
      message.error('加载帖子失败: ' + (err as Error).message);
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    // 首次加载时初始化
    if (!initialized) {
      fetchPosts(1);
      fetchSchedulerStatus();  // 包含 post_stats
      fetchIntelConfig();
      setInitialized(true);
    }
    // 后续只有筛选变化时才触发重新加载
    if (initialized) {
      fetchPosts(1);
      fetchSchedulerStatus();  // 包含 post_stats
    }
    setStatusChanged(false);
  }, [statusFilter, statusChanged]);

  // 状态筛选变化时，先更新筛选值，statusChanged 触发实际的重新加载
  const handleStatusFilterChange = (newFilter: number | undefined) => {
    setStatusFilter(newFilter);
    setStatusChanged(true);
  };

  // 轮询调度器状态（只轮询状态，不请求帖子列表）
  useEffect(() => {
    const interval = setInterval(fetchSchedulerStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handlePageChange = (pageNum: number) => {
    fetchPosts(pageNum);
  };

  // 选择帖子
  const handleSelectPost = (post: WeiboPost) => {
    setSelectedPost(post);
    setExtractResult(null);
    editForm.resetFields();
  };

  // 触发 AI 提取
  const handleExtract = async () => {
    if (!selectedPost) return;
    setExtracting(true);
    setExtractResult(null);
    try {
      const result = await weiboIntelApi.extractSingle(selectedPost.mid);
      setExtractResult(result);
      if (result.is_valid) {
        // 预填表单
        editForm.setFieldsValue({
          category: result.category,
          title: result.title,
          event_start_date: result.event_start_date ? dayjs(result.event_start_date) : undefined,
          event_end_date: result.event_end_date ? dayjs(result.event_end_date) : undefined,
          event_start_time: result.event_start_time,
          event_location: result.event_location,
          event_city: result.event_city,
          price_info: result.price_info,
          participants: result.participants?.join(', '),
          related_ips: result.related_ips?.join(', '),
          tags: result.tags?.join(', '),
          description: result.description,
        });
      } else {
        message.warning(result.reason || 'AI判定为无效内容');
      }
    } catch (err) {
      message.error('提取失败: ' + (err as Error).message);
    } finally {
      setExtracting(false);
    }
  };

  // 确认保存（创建情报）
  const handleSave = async () => {
    if (!selectedPost || !extractResult?.is_valid) return;
    try {
      const values = await editForm.validateFields();
      setSaving(true);
      await weiboIntelApi.createFromExtract({
        mid: selectedPost.mid,
        category: values.category,
        title: values.title,
        description: values.description,
        event_start_date: values.event_start_date?.format('YYYY-MM-DD'),
        event_end_date: values.event_end_date?.format('YYYY-MM-DD'),
        event_start_time: values.event_start_time,
        event_location: values.event_location,
        event_city: values.event_city,
        price_info: values.price_info,
        participants: values.participants
          ? (values.participants as string).split(',').map(s => s.trim()).filter(Boolean)
          : [],
        related_ips: values.related_ips
          ? (values.related_ips as string).split(',').map(s => s.trim()).filter(Boolean)
          : [],
        tags: values.tags
          ? (values.tags as string).split(',').map(s => s.trim()).filter(Boolean)
          : [],
        confidence: extractResult?.confidence || 0.5,
      });
      message.success('情报已创建');
      setSelectedPost(null);
      setExtractResult(null);
      editForm.resetFields();
      fetchPosts(page);
      fetchSchedulerStatus();
    } catch (err) {
      message.error('保存失败: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // 标记不相关
  const handleNotRelated = async () => {
    if (!selectedPost) return;
    try {
      await weiboIntelApi.markNotRelated(selectedPost.mid);
      message.success('已标记为不相关');
      setSelectedPost(null);
      setExtractResult(null);
      editForm.resetFields();
      fetchPosts(page);
      fetchSchedulerStatus();
    } catch (err) {
      message.error('操作失败: ' + (err as Error).message);
    }
  };

  // 重置帖子状态（将指定状态的帖子批量重置为未提取）
  const handleResetPostsStatus = async (fromStatus: number, toStatus: number = 0) => {
    setResetting(true);
    try {
      const result = await weiboIntelApi.resetPostStatus(fromStatus, toStatus);
      if (result.success) {
        message.success(result.message);
        fetchSchedulerStatus();
        if (statusFilter === fromStatus) {
          fetchPosts(1);
        }
      }
    } catch (err) {
      message.error('重置失败: ' + (err as Error).message);
    } finally {
      setResetting(false);
    }
  };

  // 触发单个批次（临时触发，不影响调度器）
  const handleTriggerBatch = async () => {
    if (batchStatus === 'running') {
      message.warning('批次任务正在执行中，请稍候');
      return;
    }
    const size = intelConfig?.batch_size || 20;
    try {
      const result = await weiboIntelApi.triggerBatch(size);
      setBatchStatus('running');
      message.success(`已触发批次执行，处理 ${result.result.posts_processed} 条`);
      setTimeout(fetchSchedulerStatus, 2000);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '触发失败');
    }
  };
  void handleTriggerBatch; // 保留以备后用

  // 保存配置
  const handleSaveConfig = async (values: {
    keyword_library_enabled: boolean;
    rule_confidence_threshold: number;
    batch_size: number;
    max_batches_per_run: number;
  }) => {
    setConfigSaving(true);
    try {
      await weiboIntelApi.updateIntelConfig({
        keyword_library_enabled: values.keyword_library_enabled,
        rule_confidence_threshold: values.rule_confidence_threshold,
        batch_size: values.batch_size,
        max_batches_per_run: values.max_batches_per_run,
      });
      setConfigModalOpen(false);
      message.success('配置已保存');
      fetchIntelConfig();
    } catch {
      message.error('配置保存失败');
    } finally {
      setConfigSaving(false);
    }
  };

  // 渲染设置弹窗
  const renderConfigModal = () => {
    if (!intelConfig) return null;
    return (
      <Modal
        title={
          <Space>
            <SettingOutlined style={{ color: '#00f0ff' }} />
            <span>情报系统设置</span>
          </Space>
        }
        open={configModalOpen}
        onCancel={() => setConfigModalOpen(false)}
        footer={null}
        destroyOnClose
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Form
          initialValues={{
            keyword_library_enabled: intelConfig.keyword_library_enabled,
            rule_confidence_threshold: intelConfig.rule_confidence_threshold,
            batch_size: intelConfig.batch_size,
            max_batches_per_run: intelConfig.max_batches_per_run ?? 0,
          }}
          onFinish={handleSaveConfig}
          layout="vertical"
        >
          <Form.Item
            name="keyword_library_enabled"
            valuePropName="checked"
            label="关键词库规则匹配"
            extra="开启后先用关键词库规则匹配，未命中则用 AI 分析"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="rule_confidence_threshold"
            label={
              <span>
                规则匹配置信度阈值
                <span style={{ color: '#00f0ff', marginLeft: 8 }}></span>
              </span>
            }
          >
            <Slider
              min={0.3}
              max={0.9}
              step={0.1}
              marks={{ 0.3: '0.3', 0.5: '0.5', 0.7: '0.7', 0.9: '0.9' }}
            />
          </Form.Item>

          <Form.Item name="batch_size" label="每批次处理条数">
            <InputNumber min={1} max={50} style={{ width: 120 }} />
          </Form.Item>

          <Form.Item
            name="max_batches_per_run"
            label="每次运行最大批次限制"
            extra="调度器每次触发时最多执行的批次数，设为 0 则不限（处理完全部待处理数据）"
          >
            <InputNumber min={0} max={100} style={{ width: 120 }} placeholder="0 = 不限" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setConfigModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={configSaving}>
                保存设置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    );
  };

  // 帖子列表列
  const postColumns: ColumnsType<WeiboPost> = [
    {
      title: '状态',
      dataIndex: 'intel_status',
      key: 'intel_status',
      width: 70,
      render: (status: number) => {
        const info = INTEL_STATUS_MAP[status] || INTEL_STATUS_MAP[0];
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '发布时间',
      dataIndex: 'created_at_dt',
      key: 'created_at_dt',
      width: 120,
      render: (date: string) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>
            {date ? dayjs(date).format('MM-DD') : '-'}
          </span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
            {date ? dayjs(date).format('HH:mm') : ''}
          </span>
        </Space>
      ),
    },
    {
      title: '内容摘要',
      dataIndex: 'text',
      key: 'text',
      render: (_: string, record: WeiboPost) => {
        const content = record.text_raw || record.text || '';
        return (
          <div style={{
            maxHeight: 50,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'pre-wrap',
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}>
            {content.slice(0, 120) + (content.length > 120 ? '...' : '')}
          </div>
        );
      },
    },
    {
      title: '互动',
      key: 'stats',
      width: 90,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="转发">
            <span style={{ fontSize: 11 }}>转 {record.reposts_count ?? 0}</span>
          </Tooltip>
          <Tooltip title="评论">
            <span style={{ fontSize: 11 }}>评 {record.comments_count ?? 0}</span>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 60,
      render: (_: unknown, record: WeiboPost) => (
        <Button
          type="link" size="small" icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleSelectPost(record);
          }}
        >
          查看
        </Button>
      ),
    },
  ];

  // 渲染右侧面板
  const renderRightPanel = () => {
    if (!selectedPost) {
      return (
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16,
          color: 'var(--text-secondary)',
        }}>
          <FileTextOutlined style={{ fontSize: 48, opacity: 0.5 }} />
          <span>点击左侧「查看」按钮选择帖子</span>
        </div>
      );
    }

    const content = selectedPost.long_text || selectedPost.text_raw || selectedPost.text?.replace(/<[^>]+>/g, '') || '';

    return (
      <div style={{ padding: 16, height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* 帖子信息头部 */}
        <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-color)' }}>
          <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--text-primary)' }}>
                {selectedPost.user_nickname}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                {selectedPost.created_at_dt
                  ? dayjs(selectedPost.created_at_dt).format('YYYY-MM-DD HH:mm')
                  : selectedPost.created_at}
              </div>
            </div>
            <Space direction="vertical" size={2} align="end">
              <Tag color={INTEL_STATUS_MAP[selectedPost.intel_status || 0].color}>
                {INTEL_STATUS_MAP[selectedPost.intel_status || 0].label}
              </Tag>
              <Button
                type="link" size="small" icon={<LinkOutlined />}
                onClick={() => window.open(`https://weibo.com/${selectedPost.user_idstr}/${selectedPost.mid}`, '_blank')}
                style={{ padding: '2px 0' }}
              >
                原文
              </Button>
            </Space>
          </Space>
        </div>

        {/* 帖子内容 */}
        <div style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-primary)', fontSize: 13 }}>
          {content}
        </div>

        {/* 统计数据 */}
        <Row gutter={16}>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{selectedPost.reposts_count ?? 0}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>转发</div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--accent-purple)' }}>{selectedPost.comments_count ?? 0}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>评论</div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--accent-green)' }}>{selectedPost.attitudes_count ?? 0}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>点赞</div>
            </div>
          </Col>
        </Row>

        <Divider style={{ margin: '4px 0' }} />

        {/* AI 提取区域 */}
        <div>
          <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>AI 提取结果</span>
            <Space>
              {extractResult?.is_valid ? (
                <>
                  <Tag color="green" icon={<CheckOutlined />}>有效</Tag>
                  <span style={{ fontSize: 11, color: '#52c41a' }}>置信度 {((extractResult.confidence || 0) * 100).toFixed(0)}%</span>
                </>
              ) : extractResult ? (
                <Tag color="red" icon={<CloseOutlined />}>无效</Tag>
              ) : null}
            </Space>
          </Space>

          {/* 提取按钮 */}
          {!extractResult && (
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={handleExtract}
              loading={extracting}
              block
              className="btn-primary"
              disabled={selectedPost.intel_status === 1 || selectedPost.intel_status === 3}
            >
              {extracting ? 'AI 提取中...' : '触发 AI 提取'}
            </Button>
          )}

          {/* 提取失败原因 */}
          {extractResult && !extractResult.is_valid && (
            <>
              <Alert
                message={extractResult.reason || 'AI判定为无效内容'}
                type="warning"
                showIcon
                style={{ marginBottom: 8 }}
              />
              <Space>
                <Button
                  icon={<SyncOutlined />}
                  onClick={handleExtract}
                  loading={extracting}
                >
                  重新提取
                </Button>
                <Button danger icon={<CloseOutlined />} onClick={handleNotRelated}>
                  标记不相关
                </Button>
              </Space>
            </>
          )}

          {/* 提取结果编辑表单 */}
          {extractResult?.is_valid && (
            <Form form={editForm} layout="vertical" size="small">
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item name="category" label="类别" rules={[{ required: true }]}>
                    <Select options={categoryOptions} placeholder="选择类别" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="title" label="标题" rules={[{ required: true }]}>
                    <Input placeholder="活动/商品标题" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="event_start_date" label="开始日期">
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="event_end_date" label="结束日期">
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="event_start_time" label="开始时间">
                    <Input placeholder="如 14:00" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="event_city" label="城市">
                    <Input placeholder="如 上海" />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="event_location" label="详细地点">
                    <Input placeholder="场馆名称" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="price_info" label="价格信息">
                    <Input placeholder="如 早鸟票68元" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="participants" label="嘉宾（逗号分隔）">
                    <Input placeholder="嘉宾A, 嘉宾B" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="related_ips" label="相关IP（逗号分隔）">
                    <Input placeholder="IP名1, IP名2" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="tags" label="标签（逗号分隔）">
                    <Input placeholder="标签1, 标签2" />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="description" label="描述">
                    <Input.TextArea rows={2} placeholder="补充描述" />
                  </Form.Item>
                </Col>
              </Row>

              <Space>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={handleSave}
                  loading={saving}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                >
                  确认保存情报
                </Button>
                <Button
                  icon={<SyncOutlined />}
                  onClick={handleExtract}
                  loading={extracting}
                >
                  重新提取
                </Button>
                <Button danger icon={<CloseOutlined />} onClick={handleNotRelated}>
                  不相关
                </Button>
              </Space>
            </Form>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      {/* 页面头部 */}
      <div className="page-header" style={{ padding: '12px 24px', flexShrink: 0 }}>
        <h3 className="page-title">微博情报提取</h3>
        <Space>
          {/* 批次状态区 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: '#111827', border: '1px solid rgba(0, 240, 255, 0.15)', borderRadius: 8 }}>
            {batchStatus === 'running' || batchStatus === 'cancelling' ? (
              <LoadingOutlined style={{ color: '#1677ff', fontSize: 14 }} spin />
            ) : batchStatus === 'completed' ? (
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 14 }} />
            ) : batchStatus === 'failed' ? (
              <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 14 }} />
            ) : (
              <CheckCircleOutlined style={{ color: '#888', fontSize: 14 }} />
            )}
            <span style={{ fontSize: 12, color: '#9ca3af' }}>
              {schedulerEnabled ? '调度运行中' : batchStatus === 'running' ? '执行中...' : batchStatus === 'cancelling' ? '取消中...' : '空闲'}
            </span>
            <span style={{ fontSize: 12, color: '#00f0ff', fontWeight: 600 }}>
              {postStats['0'] || 0}条待处理
            </span>
            {schedulerEnabled ? (
              <Button
                danger
                size="small"
                icon={schedulerStopping ? <LoadingOutlined /> : <StopOutlined />}
                onClick={handleStopScheduler}
                loading={schedulerStopping}
                style={{ fontSize: 12, paddingLeft: 8, paddingRight: 8, height: 24 }}
              >
                停止调度
              </Button>
            ) : (
              <Button
                type="primary"
                size="small"
                icon={schedulerStarting ? <LoadingOutlined /> : <PlayCircleOutlined />}
                onClick={handleStartScheduler}
                loading={schedulerStarting}
                style={{ fontSize: 12, paddingLeft: 8, paddingRight: 8, height: 24 }}
              >
                启动调度
              </Button>
            )}
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined />}
              onClick={() => setConfigModalOpen(true)}
              style={{ color: '#9ca3af', fontSize: 14, padding: '0 4px', height: 24 }}
            />
          </div>
          <Button icon={<SyncOutlined />} onClick={() => setStatusChanged(!statusChanged)}>
            刷新
          </Button>
        </Space>
      </div>

      {/* 帖子统计卡片 */}
      <Row gutter={[12, 8]} style={{ padding: '0 24px 12px', flexShrink: 0 }}>
        {[
          { key: undefined, label: '全部', color: '#00f0ff' },
          { key: 0, label: '未处理', color: '#888' },
          { key: 1, label: '已提取', color: '#52c41a' },
          { key: 2, label: '提取中', color: '#1677ff', resetable: true },
          { key: 3, label: '不相关', color: '#ff4d4f' },
          { key: 4, label: '失败', color: '#faad14', resetable: true },
        ].map(({ key, label, color, resetable }) => (
          <Col xs={8} sm={4} key={String(key)}>
            <Card
              size="small"
              bordered={false}
              style={{
                background: 'var(--bg-secondary)',
                cursor: 'pointer',
                border: statusFilter === key ? `1px solid ${color}` : '1px solid transparent',
              }}
              bodyStyle={{ padding: '8px 12px', textAlign: 'center' }}
              onClick={() => handleStatusFilterChange(key)}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color }}>{postStats[String(key ?? 'total')] ?? 0}</div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{label}</div>
              {resetable && (postStats[String(key)] ?? 0) > 0 && typeof key === 'number' && (
                <Button
                  type="link"
                  size="small"
                  icon={<UndoOutlined />}
                  loading={resetting}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetPostsStatus(key);
                  }}
                  style={{
                    fontSize: 10,
                    color: color,
                    padding: '2px 4px',
                    height: 'auto',
                    marginTop: 2,
                  }}
                >
                  重置
                </Button>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      {/* 情报调度日志 */}
      <div style={{ padding: '0 24px 12px', flexShrink: 0 }}>
        <IntelLogPanel />
      </div>

      {/* 左右布局 */}
      <div style={{ flex: 1, padding: '0 24px 24px', display: 'flex', gap: 16, minHeight: 0 }}>
        {/* 左侧帖子列表 */}
        <div style={{ flex: '0 0 55%', minWidth: 0, overflow: 'hidden' }} className="data-table">
          {postsLoading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spin size="large" />
            </div>
          ) : posts.length === 0 ? (
            <Empty description="暂无帖子数据" />
          ) : (
            <Table
              columns={postColumns}
              dataSource={posts}
              rowKey="mid"
              pagination={{
                current: page,
                total,
                pageSize,
                showTotal: (t) => `共 ${t} 条`,
                showSizeChanger: false,
                onChange: handlePageChange,
              }}
              scroll={{ x: 600, y: 400 }}
              size="small"
              rowClassName={(record) => selectedPost?.mid === record.mid ? 'ant-table-row-selected' : ''}
              onRow={(record) => ({
                onClick: () => handleSelectPost(record),
                style: { cursor: 'pointer' },
              })}
            />
          )}
        </div>

        {/* 右侧详情+提取 */}
        <div style={{
          flex: '0 0 45%',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg, 8px)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {selectedPost ? '帖子详情 & AI 提取' : '帖子详情'}
            </span>
            {selectedPost && (
              <Tag color={INTEL_STATUS_MAP[selectedPost.intel_status || 0].color}>
                {INTEL_STATUS_MAP[selectedPost.intel_status || 0].label}
              </Tag>
            )}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {renderRightPanel()}
          </div>
        </div>
        {renderConfigModal()}
      </div>
    </div>
  );
};

export default WeiboIntelList;
