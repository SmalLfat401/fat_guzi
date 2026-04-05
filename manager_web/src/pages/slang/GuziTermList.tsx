import { useState, useEffect } from 'react';
import { message, Modal, Alert, Radio, Space, Row, Col, Tag, Select, Input, Tabs, Badge } from 'antd';
import { ExclamationCircleOutlined, PlusOutlined, EditOutlined, DeleteOutlined, BulbOutlined, ImportOutlined, ExportOutlined, SearchOutlined, CopyOutlined, RobotOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { GuziTerm, GuziTermCreate, GuziTermUpdate } from '../../types/guzi';
import { guziTermApi } from '../../api/guziTerm';
import { llmApi } from '../../api/llm';
import { DEFAULT_ASSIST_PROMPT, DEFAULT_SCRIPT_PROMPT } from '../../constants/promptTemplates';
import { Table, Button, Switch, Tooltip, Form } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import '../../styles/global.scss';


dayjs.locale('zh-cn');

// 分类选项
const categoryOptions = [
  { label: '全部分类', value: '' },
  { label: '周边类型', value: '周边类型' },
  { label: '交易术语', value: '交易术语' },
  { label: '圈内黑话', value: '圈内黑话' },
  { label: 'IP相关', value: 'IP相关' },
  { label: '其他', value: '其他' },
];

const GuziTermList: React.FC = () => {
  const [terms, setTerms] = useState<GuziTerm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [statsTotal, setStatsTotal] = useState(0);
  const [statsActive, setStatsActive] = useState(0);
  const [statsInactive, setStatsInactive] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTerm, setEditingTerm] = useState<GuziTerm | null>(null);
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [pageInfo, setPageInfo] = useState({ page: 1, pageSize: 20 });
  const [form] = Form.useForm();

  // AI 助写相关状态
  const [assistModalVisible, setAssistModalVisible] = useState(false);
  const [assistTerm, setAssistTerm] = useState<GuziTerm | null>(null);
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_ASSIST_PROMPT);
  const [contextData, setContextData] = useState('');
  const [assistLoading, setAssistLoading] = useState(false);
  // AI 口播文案内容（流式回填）
  const [aiContent, setAiContent] = useState('');
  // AI 镜头脚本内容（流式回填）
  const [scriptContent, setScriptContent] = useState('');
  // 原始流内容（用于调试）
  const [rawContent, setRawContent] = useState('');
  const [scriptRawContent, setScriptRawContent] = useState('');
  // 镜头脚本加载状态
  const [scriptLoading, setScriptLoading] = useState(false);

  // 打开 AI 助写弹窗
  const handleAIGenerate = (term: GuziTerm) => {
    setAssistTerm(term);
    const contextJson = JSON.stringify({
      术语: term.term,
      含义: term.meaning,
      使用场景: term.usage_scenario,
      分类: term.category || '',
      示例: term.example || '',
    }, null, 2);
    setContextData(contextJson);
    // 回显已保存的 AI 内容（如果有）
    setAiContent(term.ai_copywriting || '');
    setRawContent('');
    setScriptContent(term.ai_script || '');
    setScriptRawContent('');
    setAssistModalVisible(true);
  };

  // 保存 AI 内容到数据库（手动保存）
  const handleSaveContent = async (field: 'ai_copywriting' | 'ai_script', content: string) => {
    if (!assistTerm || !content.trim()) return;
    try {
      await guziTermApi.updateAiContent(assistTerm.id, { [field]: content });
      message.success('已自动保存到数据库');
      // 回填到列表中对应 term 的数据，减少不必要的列表请求
      setTerms(prevTerms =>
        prevTerms.map(term =>
          term.id === assistTerm.id ? { ...term, [field]: content } : term
        )
      );
    } catch (err) {
      message.error('保存失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  // 助写（流式接口）
  const handleAssistWrite = async () => {
    if (!promptTemplate.trim()) { message.warning('提示词模板不能为空'); return; }
    setAssistLoading(true);
    setAiContent('');
    setRawContent('');
    try {
      const fullPrompt = promptTemplate + '\n\n' + contextData;
      const response = await llmApi.assistStream({ prompt: fullPrompt });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as any).detail || `请求失败: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulated = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          for (const line of chunk.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.error) throw new Error(data.error);
              if (data.token) {
                accumulated += data.token;
                setRawContent(accumulated);
                setAiContent(accumulated);
              }
              if (data.done) done = true;
            } catch { /* ignore parse errors */ }
          }
        }
      }
      // 生成完成，自动保存到数据库
      await handleSaveContent('ai_copywriting', accumulated);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '助写失败');
    } finally {
      setAssistLoading(false);
    }
  };

  // 镜头脚本生成（流式接口）
  const handleScriptWrite = async () => {
    if (!DEFAULT_SCRIPT_PROMPT.trim()) { message.warning('镜头脚本提示词模板未设置'); return; }
    if (!aiContent.trim()) { message.warning('请先生成口播文案，再生成镜头脚本'); return; }
    setScriptLoading(true);
    setScriptContent('');
    setScriptRawContent('');
    try {
      // 使用已生成的口播文案来生成镜头脚本
      const fullPrompt = DEFAULT_SCRIPT_PROMPT + '\n\n【已生成的口播文案】：\n' + aiContent;
      const response = await llmApi.assistStream({ prompt: fullPrompt });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as any).detail || `请求失败: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulated = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          for (const line of chunk.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.error) throw new Error(data.error);
              if (data.token) {
                accumulated += data.token;
                setScriptRawContent(accumulated);
                setScriptContent(accumulated);
              }
              if (data.done) done = true;
            } catch { /* ignore parse errors */ }
          }
        }
      }
      // 生成完成，自动保存到数据库
      await handleSaveContent('ai_script', accumulated);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '脚本生成失败');
    } finally {
      setScriptLoading(false);
    }
  };

  // 重新生成口播文案
  const handleRegenerate = () => {
    setAiContent('');
    setRawContent('');
    handleAssistWrite();
  };

  // 重新生成镜头脚本
  const handleRegenerateScript = () => {
    setScriptContent('');
    setScriptRawContent('');
    handleScriptWrite();
  };

  // 复制镜头脚本到剪贴板
  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptContent).then(() => {
      message.success('已复制到剪贴板，可直接粘贴到 AI 视频软件');
    });
  };

  // 加载数据
  const fetchTerms = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        skip: (pageInfo.page - 1) * pageInfo.pageSize,
        limit: pageInfo.pageSize,
      };
      if (isActiveFilter !== undefined) {
        params.is_active = isActiveFilter;
      }
      if (categoryFilter) {
        params.category = categoryFilter;
      }
      if (searchText) {
        params.search = searchText;
      }

      const data = await guziTermApi.getTerms(params);
      setTerms(data.items);
      setTotal(data.total);

      // 获取统计数据
      const stats = await guziTermApi.getTermStats(categoryFilter || undefined);
      setStatsTotal(stats.total);
      setStatsActive(stats.active);
      setStatsInactive(stats.inactive);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
      console.error('Failed to fetch terms:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTerms();
  }, [isActiveFilter, categoryFilter, searchText, pageInfo]);

  const activeCount = statsActive;
  const inactiveCount = statsInactive;

  const handleCreate = () => {
    setEditingTerm(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (term: GuziTerm) => {
    setEditingTerm(term);
    form.setFieldsValue({
      term: term.term,
      meaning: term.meaning,
      usage_scenario: term.usage_scenario,
      category: term.category,
      example: term.example,
      is_active: term.is_active,
      video_generated: term.video_generated ?? false,
      video_published: term.video_published ?? false,
    });
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除术语"${terms.find(t => t.id === id)?.term}"吗？此操作不可恢复。`,
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const termToDelete = terms.find(t => t.id === id);
          await guziTermApi.deleteTerm(id);
          setTerms(prev => prev.filter(t => t.id !== id));
          // 更新统计
          setStatsTotal(prev => prev - 1);
          if (termToDelete?.is_active) {
            setStatsActive(prev => prev - 1);
          } else {
            setStatsInactive(prev => prev - 1);
          }
          message.success('删除成功');
        } catch (err) {
          message.error(err instanceof Error ? err.message : '删除失败');
        }
      },
    });
  };

  const handleStatusChange = async (id: string, checked: boolean) => {
    try {
      await guziTermApi.updateTerm(id, { is_active: checked });
      setTerms(prev => prev.map(t =>
        t.id === id ? { ...t, is_active: checked } : t
      ));
      setStatsActive(prev => checked ? prev + 1 : prev - 1);
      setStatsInactive(prev => checked ? prev - 1 : prev + 1);
      message.success(checked ? '已启用' : '已禁用');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '状态更新失败');
    }
  };

  const handleVideoGeneratedChange = async (id: string) => {
    try {
      const updated = await guziTermApi.toggleVideoGenerated(id);
      setTerms(prev => prev.map(t =>
        t.id === id ? { ...t, video_generated: updated.video_generated } : t
      ));
      message.success(updated.video_generated ? '已标记为已生成' : '已取消生成标记');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '状态更新失败');
    }
  };

  const handleVideoPublishedChange = async (id: string) => {
    try {
      const updated = await guziTermApi.toggleVideoPublished(id);
      setTerms(prev => prev.map(t =>
        t.id === id ? { ...t, video_published: updated.video_published } : t
      ));
      message.success(updated.video_published ? '已标记为已发布' : '已取消发布标记');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '状态更新失败');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      if (editingTerm) {
        // 更新
        const updated = await guziTermApi.updateTerm(editingTerm.id, values as GuziTermUpdate);
        setTerms(prev => prev.map(t =>
          t.id === editingTerm.id ? updated : t
        ));
        // 如果启用状态变化了，更新统计
        if (editingTerm.is_active !== updated.is_active) {
          if (updated.is_active) {
            setStatsActive(prev => prev + 1);
            setStatsInactive(prev => prev - 1);
          } else {
            setStatsActive(prev => prev - 1);
            setStatsInactive(prev => prev + 1);
          }
        }
        message.success('更新成功');
      } else {
        // 新增
        const created = await guziTermApi.createTerm(values as GuziTermCreate);
        setTerms(prev => [created, ...prev]);
        setStatsTotal(prev => prev + 1);
        if (created.is_active) {
          setStatsActive(prev => prev + 1);
        } else {
          setStatsInactive(prev => prev + 1);
        }
        message.success('创建成功');
      }
      setModalVisible(false);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleFilterChange = (e: any) => {
    const value = e.target.value;
    if (value === 'all') setIsActiveFilter(undefined);
    else if (value === 'active') setIsActiveFilter(true);
    else setIsActiveFilter(false);
  };

  const handleImport = () => {
    Modal.info({
      title: '批量导入',
      content: '批量导入功能开发中，敬请期待...',
      onOk() {},
    });
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(terms, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `谷子黑话术语_${dayjs().format('YYYY-MM-DD')}.json`;
    link.click();
    URL.revokeObjectURL(url);
    message.success('导出成功');
  };

  const columns: ColumnsType<GuziTerm> = [
    {
      title: '术语',
      dataIndex: 'term',
      key: 'term',
      width: 120,
      fixed: 'left',
      render: (term: string) => (
        <span style={{ fontWeight: 600, color: '#00f0ff' }}>{term}</span>
      ),
    },
    {
      title: '文案',
      key: 'ai_copywriting',
      width: 70,
      align: 'center',
      render: (_: unknown, record: GuziTerm) => (
        <Tooltip title={record.ai_copywriting ? '已生成口播文案' : '未生成口播文案'}>
          <span style={{ fontSize: 16 }}>
            {record.ai_copywriting
              ? <Badge status="success" />
              : <Badge status="default" />}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '脚本',
      key: 'ai_script',
      width: 70,
      align: 'center',
      render: (_: unknown, record: GuziTerm) => (
        <Tooltip title={record.ai_script ? '已生成镜头脚本' : '未生成镜头脚本'}>
          <span style={{ fontSize: 16 }}>
            {record.ai_script
              ? <Badge status="success" />
              : <Badge status="default" />}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean, record: GuziTerm) => (
        <Switch
          checked={isActive}
          onChange={(checked) => handleStatusChange(record.id, checked)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          size="small"
        />
      ),
    },
    {
      title: '生成',
      key: 'video_generated',
      width: 70,
      align: 'center' as const,
      render: (_: unknown, record: GuziTerm) => (
        <Switch
          checked={record.video_generated || false}
          onChange={() => handleVideoGeneratedChange(record.id)}
          size="small"
        />
      ),
    },
    {
      title: '发布',
      key: 'video_published',
      width: 70,
      align: 'center' as const,
      render: (_: unknown, record: GuziTerm) => (
        <Switch
          checked={record.video_published || false}
          onChange={() => handleVideoPublishedChange(record.id)}
          size="small"
        />
      ),
    },
    {
      title: '含义',
      dataIndex: 'meaning',
      key: 'meaning',
      width: 180,
      // ellipsis: true,
      render: (meaning: string) => (
        <Tooltip title={meaning}>
          <span>{meaning}</span>
        </Tooltip>
      ),
    },
    {
      title: '使用场景',
      dataIndex: 'usage_scenario',
      key: 'usage_scenario',
      width: 180,
      // ellipsis: true,
      render: (scenario: string) => (
        <Tooltip title={scenario}>
          <span style={{ color: '#9ca3af' }}>{scenario}</span>
        </Tooltip>
      ),
    },
    
    {
      title: '示例',
      dataIndex: 'example',
      key: 'example',
      width: 200,
      ellipsis: true,
      render: (example: string) => (
        <Tooltip title={example}>
          <span style={{ fontStyle: 'italic', color: '#10b981' }}>{example || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category: string) => (
        <Tag color="purple">{category || '-'}</Tag>
      ),
    },
    
    {
      title: '添加时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_: unknown, record: GuziTerm) => (
        <Space size="small">
          <Tooltip title="AI 助写">
            <Button
              type="link"
              size="small"
              icon={<RobotOutlined />}
              onClick={() => handleAIGenerate(record)}
              style={{ color: '#722ed1' }}
            />
          </Tooltip>
          <Tooltip title="复制术语数据">
            <Button 
              type="link" 
              size="small" 
              icon={<CopyOutlined />}
              onClick={() => {
                const dataToCopy = {
                  term: record.term,
                  meaning: record.meaning,
                  usage_scenario: record.usage_scenario,
                  category: record.category,
                  example: record.example,
                };
                navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
                message.success('已复制术语数据');
              }}
            />
          </Tooltip>
          <Button 
            type="link" 
            size="small" 
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button 
            type="link" 
            size="small" 
            danger 
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="fade-in">
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ padding: '20px 24px 0' }}>
        <Col xs={24} sm={8}>
          <div className="stats-card">
            <div className="stats-title">术语总数</div>
            <div className="stats-value">{statsTotal}</div>
            <BulbOutlined className="stats-icon" />
          </div>
        </Col>
        <Col xs={24} sm={8}>
          <div className="stats-card stats-success">
            <div className="stats-title">启用</div>
            <div className="stats-value">{activeCount}</div>
            <BulbOutlined className="stats-icon" />
          </div>
        </Col>
        <Col xs={24} sm={8}>
          <div className="stats-card stats-warning">
            <div className="stats-title">禁用</div>
            <div className="stats-value">{inactiveCount}</div>
            <BulbOutlined className="stats-icon" />
          </div>
        </Col>
      </Row>

      {/* 标题和操作栏 */}
      <div className="page-header" style={{ padding: '20px 24px 16px' }}>
        <h3 className="page-title">谷子黑话术语库</h3>
        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} closable onClose={() => setError(null)} />}
        <Space wrap>
          <Input
            placeholder="搜索术语或含义..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="选择分类"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categoryOptions}
            style={{ width: 140 }}
            allowClear
          />
          <Radio.Group onChange={handleFilterChange} defaultValue="all" size="small">
            <Radio.Button value="all">全部</Radio.Button>
            <Radio.Button value="active">已启用</Radio.Button>
            <Radio.Button value="inactive">已禁用</Radio.Button>
          </Radio.Group>
          <Button icon={<ImportOutlined />} onClick={handleImport}>
            批量导入
          </Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            导出数据
          </Button>
          <Button type="primary" className="btn-primary" icon={<PlusOutlined />} onClick={handleCreate}>
            添加术语
          </Button>
        </Space>
      </div>

      {/* 表格 */}
      <div style={{ padding: '0 24px 24px' }} className="data-table">
        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} closable onClose={() => setError(null)} />}
        <Table
          columns={columns}
          dataSource={terms}
          rowKey="id"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{
            total,
            current: pageInfo.page,
            pageSize: pageInfo.pageSize,
            showTotal: (total) => `共 ${total} 条记录`,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            size: 'small',
            onChange: (page, pageSize) => setPageInfo({ page, pageSize })
          }}
          size="small"
        />
      </div>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingTerm ? '编辑术语' : '添加术语'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
        width={700}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            is_active: true,
          }}
        >
          <Form.Item
            name="term"
            label="术语名称"
            rules={[{ required: true, message: '请输入术语名称' }]}
          >
            <Input placeholder="如：谷子、吧唧、set等" />
          </Form.Item>

          <Form.Item
            name="meaning"
            label="含义解释"
            rules={[{ required: true, message: '请输入含义解释' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="详细解释该术语的含义和来源"
            />
          </Form.Item>

          <Form.Item
            name="usage_scenario"
            label="使用场景"
            rules={[{ required: true, message: '请输入使用场景' }]}
          >
            <Input.TextArea
              rows={2}
              placeholder="说明在什么情况下使用这个术语"
            />
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
          >
            <Select
              placeholder="选择分类"
              options={categoryOptions.filter(o => o.value !== '')}
            />
          </Form.Item>

          <Form.Item
            name="example"
            label="使用示例"
          >
            <Input.TextArea
              rows={2}
              placeholder="给出一个实际使用该术语的例子"
            />
          </Form.Item>

          {editingTerm && (
            <Form.Item
              name="is_active"
              label="状态"
              valuePropName="checked"
            >
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          )}

          {editingTerm && (
            <>
              <Form.Item
                name="video_generated"
                label="视频生成"
                valuePropName="checked"
              >
                <Switch checkedChildren="已生成" unCheckedChildren="未生成" />
              </Form.Item>
              <Form.Item
                name="video_published"
                label="视频发布"
                valuePropName="checked"
              >
                <Switch checkedChildren="已发布" unCheckedChildren="未发布" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* AI 助写弹窗 */}
      <Modal
        title={
          <Space>
            <RobotOutlined style={{ color: '#722ed1' }} />
            <span>AI 助写 - {assistTerm?.term}</span>
          </Space>
        }
        open={assistModalVisible}
        onCancel={() => setAssistModalVisible(false)}
        footer={null}
        width={900}
        destroyOnClose
      >
        {/* 术语上下文一行展示 */}
        <div style={{
          
          border: '1px solid #e8e8e8',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Tag color="purple" style={{ margin: 0 }}>{assistTerm?.term}</Tag>
            <Tag color="cyan">{assistTerm?.category || '未分类'}</Tag>
            <span style={{ color: '#888', fontSize: 12 }}>{assistTerm?.meaning || '暂无含义'}</span>
          </div>
          {assistTerm?.usage_scenario && (
            <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
              <span style={{ color: '#aaa', marginRight: 4 }}>场景：</span>{assistTerm.usage_scenario}
            </div>
          )}
        </div>

        {/* Tabs：口播文案 + 镜头脚本 */}
        <Tabs
          defaultActiveKey="copywriting"
          size="small"
          items={[
            {
              key: 'copywriting',
              label: (
                <span>
                  <RobotOutlined /> 口播文案
                </span>
              ),
              children: (
                <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #91d5ff', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontWeight: 500, color: '#0050b3' }}>生成内容</span>
                    {assistLoading && <span style={{ color: '#888', fontSize: 12 }}>正在生成...</span>}
                    {!assistLoading && aiContent && <span style={{ color: '#52c41a', fontSize: 12 }}>生成完成，请检查内容后可手动保存</span>}
                  </div>
                  <Input.TextArea
                    value={aiContent}
                    onChange={(e) => setAiContent(e.target.value)}
                    rows={18}
                    placeholder="点击「开始助写」，AI 将根据术语信息生成短视频口播文案..."
                    style={{ fontSize: 14, lineHeight: 1.8 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                    <Button
                      type="primary"
                      className="btn-primary"
                      icon={<RobotOutlined />}
                      onClick={handleAssistWrite}
                      loading={assistLoading}
                    >
                      {assistLoading ? '生成中...' : '开始助写'}
                    </Button>
                    {aiContent && (
                      <>
                        <Button icon={<ThunderboltOutlined />} onClick={handleRegenerate} loading={assistLoading}>
                          重写
                        </Button>
                        <Button type="primary" icon={<EditOutlined />} onClick={() => handleSaveContent('ai_copywriting', aiContent)}>
                          手动保存
                        </Button>
                      </>
                    )}
                  </div>
                  {rawContent && (
                    <details style={{ marginTop: 12 }}>
                      <summary style={{ cursor: 'pointer', color: '#aaa', fontSize: 12 }}>原始返回</summary>
                      <pre style={{ backgroundColor: '#fafafa', border: '1px solid #e8e8e8', borderRadius: 4, padding: 8, fontSize: 11, fontFamily: 'monospace', maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{rawContent}</pre>
                    </details>
                  )}
                </div>
              ),
            },
            {
              key: 'script',
              label: (
                <span>
                  <ThunderboltOutlined /> 镜头脚本
                </span>
              ),
              children: (
                <div style={{ backgroundColor: '#fff7e6', border: '1px solid #ffd591', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontWeight: 500, color: '#d46b08' }}>镜头脚本</span>
                    {scriptLoading && <span style={{ color: '#888', fontSize: 12 }}>正在生成...</span>}
                    {!scriptLoading && scriptContent && <span style={{ color: '#52c41a', fontSize: 12 }}>生成完成，请检查内容后可手动保存</span>}
                  </div>
                  <Input.TextArea
                    value={scriptContent}
                    onChange={(e) => setScriptContent(e.target.value)}
                    rows={18}
                    placeholder="点击「生成脚本」，AI 将基于口播文案生成对应的镜头分镜脚本..."
                    style={{ fontSize: 14, lineHeight: 1.8 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                    <Button
                      type="primary"
                      className="btn-primary"
                      icon={<ThunderboltOutlined />}
                      onClick={handleScriptWrite}
                      loading={scriptLoading}
                    >
                      {scriptLoading ? '生成中...' : '生成脚本'}
                    </Button>
                    {scriptContent && (
                      <>
                        <Button icon={<ThunderboltOutlined />} onClick={handleRegenerateScript} loading={scriptLoading}>
                          重写
                        </Button>
                        <Button type="primary" icon={<EditOutlined />} onClick={() => handleSaveContent('ai_script', scriptContent)}>
                          手动保存
                        </Button>
                        <Button icon={<CopyOutlined />} onClick={handleCopyScript}>
                          一键复制
                        </Button>
                      </>
                    )}
                  </div>
                  {scriptRawContent && (
                    <details style={{ marginTop: 12 }}>
                      <summary style={{ cursor: 'pointer', color: '#aaa', fontSize: 12 }}>原始返回</summary>
                      <pre style={{ backgroundColor: '#fafafa', border: '1px solid #e8e8e8', borderRadius: 4, padding: 8, fontSize: 11, fontFamily: 'monospace', maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{scriptRawContent}</pre>
                    </details>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default GuziTermList;
