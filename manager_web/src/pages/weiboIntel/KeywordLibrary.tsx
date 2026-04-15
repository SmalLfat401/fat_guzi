import { useState, useEffect } from 'react';
import {
  message, Button, Space, Table, Tag,
  Modal, Form, Input, Select, Alert, Tabs, Badge, Popconfirm,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined,
  CloseOutlined, SyncOutlined, BulbOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import '../../styles/global.scss';
import { weiboIntelApi } from '../../api/weiboIntel';
import type {
  CategoryKeywords,
  KeywordCandidate,
  IntelCategory,
} from '../../types/weiboIntel';
import { INTEL_CATEGORY_MAP } from '../../types/weiboIntel';

dayjs.locale('zh-cn');

const categoryOptions = Object.entries(INTEL_CATEGORY_MAP).map(([value, label]) => ({ value, label }));

const KeywordLibrary: React.FC = () => {
  // 关键词库状态
  const [keywordsList, setKeywordsList] = useState<CategoryKeywords[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editForm] = Form.useForm();

  // 候选关键词状态
  const [candidates, setCandidates] = useState<KeywordCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidateStatus, setCandidateStatus] = useState<string>('');
  const [selectedCandidates, setSelectedCandidates] = useState<React.Key[]>([]);

  // 加载关键词库
  const fetchKeywords = async () => {
    setLoading(true);
    try {
      const data = await weiboIntelApi.getKeywords();
      setKeywordsList(data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载候选关键词
  const fetchCandidates = async () => {
    setCandidatesLoading(true);
    try {
      const params: Record<string, any> = {};
      if (candidateStatus) params.status = candidateStatus;
      const data = await weiboIntelApi.getKeywordCandidates(params);
      setCandidates(data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setCandidatesLoading(false);
    }
  };

  useEffect(() => { fetchKeywords(); }, []);
  useEffect(() => { fetchCandidates(); }, [candidateStatus]);

  // 打开编辑弹窗
  const handleEdit = (kw: CategoryKeywords) => {
    setEditingCategory(kw.category);
    editForm.setFieldsValue({
      keywords: kw.keywords.join(', '),
      exclude_keywords: kw.exclude_keywords.join(', '),
      ai_confidence_override: kw.ai_confidence_override,
      is_active: kw.is_active,
    });
    setEditModalVisible(true);
  };

  // 新增关键词组
  const handleCreate = () => {
    setEditingCategory(null);
    editForm.resetFields();
    setEditModalVisible(true);
  };

  // 保存关键词
  const handleSave = async () => {
    try {
      const values = await editForm.validateFields();
      const keywords = values.keywords
        ? (values.keywords as string).split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];
      const exclude = values.exclude_keywords
        ? (values.exclude_keywords as string).split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

      if (editingCategory) {
        // 更新
        await weiboIntelApi.updateKeywords(editingCategory, {
          keywords,
          exclude_keywords: exclude,
          ai_confidence_override: values.ai_confidence_override,
          is_active: values.is_active,
        });
        message.success('关键词组已更新');
      } else {
        // 创建
        await weiboIntelApi.saveKeywords({
          category: values.category,
          keywords,
          exclude_keywords: exclude,
          ai_confidence_override: values.ai_confidence_override || 0,
        });
        message.success('关键词组已创建');
      }
      setEditModalVisible(false);
      fetchKeywords();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    }
  };

  // 删除关键词组
  const handleDelete = async (_category: string) => {
    message.info('删除功能暂不开放，请手动从数据库删除');
  };

  // 批准候选关键词
  const handleApproveCandidate = async (id: string) => {
    try {
      await weiboIntelApi.approveKeywordCandidate(id);
      message.success('已批准');
      fetchCandidates();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  // 拒绝候选关键词
  const handleRejectCandidate = async (id: string) => {
    try {
      await weiboIntelApi.rejectKeywordCandidate(id);
      message.success('已拒绝');
      fetchCandidates();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  // 批量批准
  const handleBatchApprove = async () => {
    if (selectedCandidates.length === 0) { message.warning('请先选择'); return; }
    try {
      await weiboIntelApi.batchApproveKeywordCandidates(selectedCandidates as string[]);
      message.success(`已批准 ${selectedCandidates.length} 条`);
      setSelectedCandidates([]);
      fetchCandidates();
      fetchKeywords();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '批量批准失败');
    }
  };

  const keywordColumns: ColumnsType<CategoryKeywords> = [
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (cat: string) => (
        <Tag color="blue">{INTEL_CATEGORY_MAP[cat as IntelCategory] || cat}</Tag>
      ),
    },
    {
      title: '关键词',
      dataIndex: 'keywords',
      key: 'keywords',
      width: 300,
      render: (kws: string[]) => (
        <>
          {kws.slice(0, 5).map(k => (
            <Tag key={k} style={{ marginBottom: 2 }}>{k}</Tag>
          ))}
          {kws.length > 5 && <Tag>+{kws.length - 5}</Tag>}
        </>
      ),
    },
    {
      title: '排除词',
      dataIndex: 'exclude_keywords',
      key: 'exclude_keywords',
      width: 200,
      render: (kws: string[]) => (
        <>
          {kws.map(k => (
            <Tag key={k} color="red" style={{ marginBottom: 2 }}>{k}</Tag>
          ))}
          {kws.length === 0 && <span style={{ color: '#ccc' }}>-</span>}
        </>
      ),
    },
    {
      title: '命中统计',
      key: 'stats',
      width: 100,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>总命中: <strong>{record.usage_count}</strong></span>
          <span style={{ fontSize: 12, color: '#888' }}>今日: {record.hit_count_today}</span>
        </Space>
      ),
    },
    {
      title: '置信度加成',
      dataIndex: 'ai_confidence_override',
      key: 'ai_confidence_override',
      width: 100,
      render: (v: number) => v > 0 ? `+${(v * 100).toFixed(0)}%` : '-',
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 70,
      render: (s: string) => (
        <Tag color={s === 'ai' ? 'purple' : s === 'manual' ? 'cyan' : 'default'}>
          {s === 'ai' ? 'AI学习' : s === 'manual' ? '手动' : '已批准'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 70,
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'}>{active ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 140,
      render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.category)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const candidateColumns: ColumnsType<KeywordCandidate> = [
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 90,
      render: (cat: string) => (
        <Tag>{INTEL_CATEGORY_MAP[cat as IntelCategory] || cat}</Tag>
      ),
    },
    {
      title: '关键词',
      dataIndex: 'keyword',
      key: 'keyword',
      width: 120,
      render: (kw: string) => <Tag color="purple">{kw}</Tag>,
    },
    {
      title: '来源片段',
      dataIndex: 'source_text_snippet',
      key: 'source_text_snippet',
      width: 200,
      ellipsis: true,
      render: (t: string) => <span style={{ color: '#888', fontSize: 12 }}>{t}</span>,
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 80,
      render: (v: number) => `${(v * 100).toFixed(0)}%`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (s: string) => (
        <Tag color={s === 'approved' ? 'success' : s === 'rejected' ? 'error' : 'warning'}>
          {s === 'approved' ? '已批准' : s === 'rejected' ? '已拒绝' : '待审核'}
        </Tag>
      ),
    },
    {
      title: '来源情报',
      dataIndex: 'source_intel_id',
      key: 'source_intel_id',
      width: 120,
      render: (id: string) => (
        <span style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>
          {id.slice(0, 8)}...
        </span>
      ),
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        record.status === 'pending' ? (
          <Space size="small">
            <Button type="link" size="small" icon={<CheckOutlined />}
              onClick={() => handleApproveCandidate(record.id)} style={{ color: '#52c41a' }} />
            <Button type="link" size="small" icon={<CloseOutlined />}
              onClick={() => handleRejectCandidate(record.id)} style={{ color: '#ff4d4f' }} />
          </Space>
        ) : <span style={{ color: '#ccc' }}>-</span>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <div className="page-header" style={{ padding: '20px 24px 16px' }}>
        <h3 className="page-title">关键词库管理</h3>
        <Space>
          <Alert
            message="关键词库说明"
            description="关键词库用于规则预筛。AI 提取成功后会自动学习候选关键词，人工批准后纳入关键词库。"
            type="info"
            showIcon
            style={{ marginBottom: 0, padding: '8px 16px' }}
          />
          <Button type="primary" className="btn-primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新增类别
          </Button>
        </Space>
      </div>

      <Tabs
        defaultActiveKey="keywords"
        style={{ padding: '0 24px' }}
        items={[
          {
            key: 'keywords',
            label: (
              <span><BulbOutlined /> 关键词库</span>
            ),
            children: (
              <div className="data-table">
                <Table
                  columns={keywordColumns}
                  dataSource={keywordsList}
                  rowKey="id"
                  loading={loading}
                  scroll={{ x: 1200 }}
                  pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }}
                  size="small"
                />
              </div>
            ),
          },
          {
            key: 'candidates',
            label: (
              <span>
                <BulbOutlined />
                候选关键词
                <Badge count={candidates.filter(c => c.status === 'pending').length} style={{ marginLeft: 4 }} />
              </span>
            ),
            children: (
              <>
                <div style={{ padding: '0 0 12px' }}>
                  <Space>
                    <Select
                      placeholder="筛选状态"
                      value={candidateStatus}
                      onChange={setCandidateStatus}
                      options={[
                        { label: '全部', value: '' },
                        { label: '待审核', value: 'pending' },
                        { label: '已批准', value: 'approved' },
                        { label: '已拒绝', value: 'rejected' },
                      ]}
                      style={{ width: 120 }}
                      allowClear
                    />
                    <Button icon={<SyncOutlined />} onClick={fetchCandidates}>刷新</Button>
                    <Button
                      type="primary"
                      style={{ background: '#52c41a', borderColor: '#52c41a' }}
                      icon={<CheckOutlined />}
                      onClick={handleBatchApprove}
                      disabled={selectedCandidates.length === 0}
                    >
                      批量批准{selectedCandidates.length > 0 ? ` (${selectedCandidates.length})` : ''}
                    </Button>
                  </Space>
                </div>
                <div className="data-table">
                  <Table
                    columns={candidateColumns}
                    dataSource={candidates}
                    rowKey="id"
                    loading={candidatesLoading}
                    scroll={{ x: 1100 }}
                    rowSelection={{
                      selectedRowKeys: selectedCandidates,
                      onChange: setSelectedCandidates,
                    }}
                    pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }}
                    size="small"
                  />
                </div>
              </>
            ),
          },
        ]}
      />

      {/* 编辑弹窗 */}
      <Modal
        title={editingCategory ? `编辑关键词 - ${INTEL_CATEGORY_MAP[editingCategory as IntelCategory] || editingCategory}` : '新增关键词类别'}
        open={editModalVisible}
        onOk={handleSave}
        onCancel={() => setEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={700}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          {!editingCategory && (
            <Form.Item name="category" label="类别" rules={[{ required: true, message: '请选择类别' }]}>
              <Select options={categoryOptions} placeholder="选择类别" />
            </Form.Item>
          )}
          <Form.Item
            name="keywords"
            label="触发关键词（逗号分隔）"
            tooltip="命中任一关键词的帖子将被纳入分析"
          >
            <Input.TextArea rows={3} placeholder="如: 签售, 预售, 新品, 开团" />
          </Form.Item>
          <Form.Item
            name="exclude_keywords"
            label="排除关键词（逗号分隔）"
            tooltip="命中有触发词但同时命中排除词的帖子将被过滤"
          >
            <Input.TextArea rows={2} placeholder="如: 二手, 求购" />
          </Form.Item>
          <Form.Item name="ai_confidence_override" label="置信度加成" tooltip="命中该类别关键词时，AI置信度额外加成（最多+30%）">
            <Select
              options={[
                { label: '无加成', value: 0 },
                { label: '+10%', value: 0.1 },
                { label: '+20%', value: 0.2 },
                { label: '+30%', value: 0.3 },
              ]}
            />
          </Form.Item>
          <Form.Item name="is_active" label="启用状态" valuePropName="checked" initialValue={true}>
            <span>启用后该类别关键词生效</span>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default KeywordLibrary;
