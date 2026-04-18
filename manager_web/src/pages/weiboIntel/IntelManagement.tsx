import { useState, useEffect } from 'react';
import {
  message, Row, Col, Tag, Button, Space, Table, Tooltip,
  Badge, Card, Modal, Descriptions, Select,
} from 'antd';
import {
  CloudUploadOutlined, CloudDownloadOutlined,
} from '@ant-design/icons';
import { Switch } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import '../../styles/global.scss';
import { weiboIntelApi } from '../../api/weiboIntel';
import type { WeiboIntelItem, SourcePostRef } from '../../types/weiboIntel';
import {
  INTEL_CATEGORY_MAP,
  INTEL_STATUS_MAP,
  ALERT_TYPE_MAP,
} from '../../types/weiboIntel';

dayjs.locale('zh-cn');

interface ReviewModalData {
  visible: boolean;
  intel: WeiboIntelItem | null;
  sourcePosts: SourcePostRef[];
  loadingPost: boolean;
}

const IntelManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'approved' | 'pending' | 'alerts'>('approved');
  const [items, setItems] = useState<WeiboIntelItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, pageSize: 20 });
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ approved: 0, pending: 0, alerts: 0 });
  const [filterCategory, setFilterCategory] = useState<string | undefined>(undefined);
  const [filterPublished, setFilterPublished] = useState<boolean | undefined>(undefined);

  // 审核弹窗
  const [reviewModal, setReviewModal] = useState<ReviewModalData>({
    visible: false,
    intel: null,
    sourcePosts: [],
    loadingPost: false,
  });

  const fetchStats = async () => {
    try {
      const data = await weiboIntelApi.getStats();
      setStats({
        approved: data.intel.approved,
        pending: data.intel.pending,
        alerts: data.intel.has_alert,
      });
    } catch {}
  };

  // 修复 category 类型
  const fetchList = async () => {
    setLoading(true);
    try {
      const skip = (pageInfo.page - 1) * pageInfo.pageSize;
      let result: { items: WeiboIntelItem[]; total: number };
      if (activeTab === 'approved') {
        result = await weiboIntelApi.getList({ status: 'approved', skip, limit: pageInfo.pageSize, category: filterCategory as any, is_published: filterPublished });
      } else if (activeTab === 'pending') {
        result = await weiboIntelApi.getPendingList(skip, pageInfo.pageSize);
      } else {
        result = await weiboIntelApi.getAlertList(skip, pageInfo.pageSize);
      }
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      message.error((err as Error).message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPageInfo(p => ({ ...p, page: 1 }));
  }, [activeTab, filterCategory, filterPublished]);

  useEffect(() => {
    fetchList();
    fetchStats();
  }, [activeTab, pageInfo, filterCategory, filterPublished]);

  // ==================== 审核操作 ====================

  const openReviewModal = async (record: WeiboIntelItem) => {
    setReviewModal({ visible: true, intel: record, sourcePosts: [], loadingPost: true });
    try {
      const detail = await weiboIntelApi.getDetail(record.id);
      setReviewModal(prev => ({ ...prev, sourcePosts: detail.source_posts, loadingPost: false }));
    } catch {
      setReviewModal(prev => ({ ...prev, sourcePosts: [], loadingPost: false }));
    }
  };

  const closeReviewModal = () => {
    setReviewModal({ visible: false, intel: null, sourcePosts: [], loadingPost: false });
  };

  const handleApprove = async () => {
    if (!reviewModal.intel) return;
    try {
      await weiboIntelApi.approve(reviewModal.intel.id);
      message.success('已批准');
      closeReviewModal();
      fetchList();
      fetchStats();
    } catch (err) {
      message.error((err as Error).message || '操作失败');
    }
  };

  const handleReject = async () => {
    if (!reviewModal.intel) return;
    try {
      await weiboIntelApi.reject(reviewModal.intel.id);
      message.success('已拒绝');
      closeReviewModal();
      fetchList();
      fetchStats();
    } catch (err) {
      message.error((err as Error).message || '操作失败');
    }
  };

  // ==================== 批量审核 ====================

  const handleBatchApprove = async () => {
    if (selectedRowKeys.length === 0) { message.warning('请先选择'); return; }
    try {
      await weiboIntelApi.batchApprove(selectedRowKeys as string[]);
      message.success(`已批准 ${selectedRowKeys.length} 条`);
      setSelectedRowKeys([]);
      fetchList();
      fetchStats();
    } catch (err) {
      message.error((err as Error).message || '批量批准失败');
    }
  };

  const handleBatchReject = async () => {
    if (selectedRowKeys.length === 0) { message.warning('请先选择'); return; }
    try {
      await weiboIntelApi.batchReject(selectedRowKeys as string[]);
      message.success(`已拒绝 ${selectedRowKeys.length} 条`);
      setSelectedRowKeys([]);
      fetchList();
      fetchStats();
    } catch (err) {
      message.error((err as Error).message || '批量拒绝失败');
    }
  };

  // ==================== 告警处理 ====================

  const handleResolveAlert = async (id: string) => {
    try {
      await weiboIntelApi.resolveAlert(id);
      message.success('告警已处理');
      fetchList();
      fetchStats();
    } catch (err) {
      message.error((err as Error).message || '操作失败');
    }
  };

  // ==================== 发布控制 ====================

  const handlePublish = async (id: string, published: boolean) => {
    try {
      if (published) {
        await weiboIntelApi.publish(id);
        message.success('已发布到 H5');
      } else {
        await weiboIntelApi.unpublish(id);
        message.success('已从 H5 下线');
      }
      fetchList();
    } catch (err) {
      message.error((err as Error).message || '操作失败');
    }
  };

  const handleBatchPublish = async (published: boolean) => {
    if (selectedRowKeys.length === 0) { message.warning('请先选择'); return; }
    try {
      if (published) {
        await weiboIntelApi.batchPublish(selectedRowKeys as string[]);
        message.success(`已发布 ${selectedRowKeys.length} 条到 H5`);
      } else {
        await weiboIntelApi.batchUnpublish(selectedRowKeys as string[]);
        message.success(`已下线 ${selectedRowKeys.length} 条`);
      }
      setSelectedRowKeys([]);
      fetchList();
    } catch (err) {
      message.error((err as Error).message || '操作失败');
    }
  };

  const _handleDelete = async (id: string) => {
    try {
      await weiboIntelApi.delete(id);
      message.success('删除成功');
      fetchList();
      fetchStats();
    } catch (err) {
      message.error((err as Error).message || '删除失败');
    }
  };
  void _handleDelete; // 保留以备后用

  const getCategoryTagColor = (cat: string) => {
    const colors: Record<string, string> = {
      convention: 'blue', book_signing: 'purple', pre_order: 'orange',
      product_launch: 'green', offline_activity: 'cyan', online_activity: 'magenta', other: 'default',
    };
    return colors[cat] || 'default';
  };

  const columns: ColumnsType<WeiboIntelItem> = [
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 80,
      render: (cat: string) => (
        <Tag color={getCategoryTagColor(cat)}>{INTEL_CATEGORY_MAP[cat as keyof typeof INTEL_CATEGORY_MAP] || cat}</Tag>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 180,
      ellipsis: true,
      render: (title: string, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{title}</div>
          {record.event_start_date && (
            <div style={{ fontSize: 12, color: '#888' }}>
              {record.event_start_date}
              {record.event_end_date && record.event_end_date !== record.event_start_date
                ? ` ~ ${record.event_end_date}` : ''}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '地点',
      key: 'location',
      width: 100,
      render: (_: unknown, record: WeiboIntelItem) => (
        <span>{record.event_city || record.event_location || '-'}</span>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 140,
      render: (tags: string[]) => (
        <>
          {tags.slice(0, 2).map(t => <Tag key={t} style={{ marginBottom: 2 }}>{t}</Tag>)}
          {tags.length > 2 && <Tag>+{tags.length - 2}</Tag>}
        </>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        <Tag color={status === 'pending' ? 'warning' : status === 'approved' ? 'success' : 'error'}>
          {INTEL_STATUS_MAP[status as keyof typeof INTEL_STATUS_MAP] || status}
        </Tag>
      ),
    },
    ...(activeTab === 'alerts' ? [{
      title: '告警',
      dataIndex: 'alert_type',
      key: 'alert_type',
      width: 100,
      render: (type: string, record: WeiboIntelItem) => (
        <Tooltip title={record.alert_message}>
          <Tag color="red">
            {ALERT_TYPE_MAP[type as keyof typeof ALERT_TYPE_MAP] || type}
          </Tag>
        </Tooltip>
      ),
    }] : []),
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 70,
      render: (v: number) => v > 0 ? `${(v * 100).toFixed(0)}%` : '-',
    },
    {
      title: '关联帖',
      dataIndex: 'source_posts_count',
      key: 'source_posts_count',
      width: 70,
      render: (n: number) => n > 0 ? <Badge count={n} style={{ backgroundColor: '#52c41a' }} /> : '-',
    },
    {
      title: '日历',
      key: 'calendar',
      width: 70,
      render: (_: unknown, record: WeiboIntelItem) => (
        record.synced_to_calendar
          ? <Badge status="success" text={<span style={{ fontSize: 12 }}>已同步</span>} />
          : <span style={{ color: '#ccc' }}>-</span>
      ),
    },
    ...(activeTab === 'approved' ? [{
      title: '发布H5',
      key: 'published',
      width: 80,
      render: (_: unknown, record: WeiboIntelItem) => (
        <Switch
          size="small"
          checked={record.is_published}
          checkedChildren="已发布"
          unCheckedChildren="未发布"
          onChange={(checked) => handlePublish(record.id, checked)}
        />
      ),
    }] : []),
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 130,
      render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: activeTab === 'pending' ? 120 : 100,
      fixed: 'right',
      render: (_: unknown, record: WeiboIntelItem) => (
        <Space size="small">
          {/* 已提取情报 / 审核队列 / 告警中心：都有查看按钮 */}
          <Button
            type="link" size="small"
            onClick={() => openReviewModal(record)}
          >
            查看
          </Button>
          {/* 审核队列：通过 + 不通过 */}
          {activeTab === 'pending' && (
            <>
              <Button
                type="link" size="small"
                onClick={async () => {
                  try {
                    await weiboIntelApi.approve(record.id);
                    message.success('已批准');
                    fetchList();
                    fetchStats();
                  } catch { message.error('操作失败'); }
                }}
                style={{ color: '#52c41a' }}
              >
                通过
              </Button>
              <Button
                type="link" size="small"
                onClick={async () => {
                  try {
                    await weiboIntelApi.reject(record.id);
                    message.success('已拒绝');
                    fetchList();
                    fetchStats();
                  } catch { message.error('操作失败'); }
                }}
                style={{ color: '#ff4d4f' }}
              >
                不通过
              </Button>
            </>
          )}
          {/* 告警中心：处理告警 */}
          {activeTab === 'alerts' && (
            <Button
              type="link" size="small"
              onClick={() => handleResolveAlert(record.id)}
              style={{ color: '#52c41a' }}
            >
              处理
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const intel = reviewModal.intel;

  return (
    <div className="fade-in">
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ padding: '20px 24px 0' }}>
        <Col xs={8}>
          <Card size="small" bordered={false} style={{ background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)' }}>
            <div style={{ color: '#fff', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.approved}</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>已批准</div>
            </div>
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small" bordered={false} style={{ background: 'linear-gradient(135deg, #faad14 0%, #d48806 100%)' }}>
            <div style={{ color: '#fff', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.pending}</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>待审核</div>
            </div>
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small" bordered={false} style={{ background: 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' }}>
            <div style={{ color: '#fff', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.alerts}</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>告警</div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Tab 切换 + 类别筛选 */}
      <div style={{ padding: '16px 24px 0', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
          {([
            { key: 'approved', label: '已提取情报' },
            { key: 'pending', label: '审核队列' },
            { key: 'alerts', label: '告警中心' },
          ] as const).map(tab => (
            <Button
              key={tab.key}
              type={activeTab === tab.key ? 'primary' : 'text'}
              className={activeTab === tab.key ? 'btn-primary' : ''}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.key === 'pending' && stats.pending > 0 && (
                <Badge count={stats.pending} size="small" style={{ marginLeft: 6 }} />
              )}
              {tab.key === 'alerts' && stats.alerts > 0 && (
                <Badge count={stats.alerts} size="small" style={{ marginLeft: 6 }} />
              )}
            </Button>
          ))}

          {/* 类别筛选 + 发布筛选（仅已提取情报 tab） */}
          {activeTab === 'approved' && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#888', fontSize: 13 }}>类别：</span>
              <Select
                allowClear
                placeholder="全部"
                value={filterCategory}
                onChange={val => setFilterCategory(val)}
                style={{ width: 130 }}
                size="small"
                options={[
                  { value: 'convention', label: '漫展' },
                  { value: 'book_signing', label: '签售' },
                  { value: 'pre_order', label: '预售' },
                  { value: 'product_launch', label: '新谷开团' },
                  { value: 'offline_activity', label: '线下活动' },
                  { value: 'online_activity', label: '线上活动' },
                  { value: 'other', label: '其他' },
                ]}
              />
              <span style={{ color: '#888', fontSize: 13 }}>发布：</span>
              <Select
                allowClear
                placeholder="全部"
                value={filterPublished}
                onChange={val => setFilterPublished(val)}
                style={{ width: 110 }}
                size="small"
                options={[
                  { value: true, label: '已发布' },
                  { value: false, label: '未发布' },
                ]}
              />
            </div>
          )}
        </div>
      </div>

      {/* 批量操作栏 */}
      {activeTab === 'pending' && selectedRowKeys.length > 0 && (
        <div style={{ padding: '8px 24px', background: '#f0f9ff', margin: '8px 24px 0', borderRadius: 4 }}>
          <Space>
            <span style={{ color: '#0050b3' }}>已选择 {selectedRowKeys.length} 条</span>
            <Button size="small" type="primary" onClick={handleBatchApprove}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}>
              批量通过
            </Button>
            <Button size="small" danger onClick={handleBatchReject}>
              批量不通过
            </Button>
            <Button size="small" onClick={() => setSelectedRowKeys([])}>取消选择</Button>
          </Space>
        </div>
      )}

      {/* 已批准 Tab 批量发布 */}
      {activeTab === 'approved' && selectedRowKeys.length > 0 && (
        <div style={{ padding: '8px 24px', background: '#f6ffed', margin: '8px 24px 0', borderRadius: 4 }}>
          <Space>
            <span style={{ color: '#389e0d' }}>已选择 {selectedRowKeys.length} 条</span>
            <Button size="small" type="primary" icon={<CloudUploadOutlined />} onClick={() => handleBatchPublish(true)}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}>
              批量发布到 H5
            </Button>
            <Button size="small" danger icon={<CloudDownloadOutlined />} onClick={() => handleBatchPublish(false)}>
              批量下线
            </Button>
            <Button size="small" onClick={() => setSelectedRowKeys([])}>取消选择</Button>
          </Space>
        </div>
      )}

      {/* 表格 */}
      <div style={{ padding: '8px 24px 24px' }} className="data-table">
        <Table
          columns={columns}
          dataSource={items}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1100 }}
          rowSelection={activeTab !== 'alerts' ? { selectedRowKeys, onChange: setSelectedRowKeys } : undefined}
          pagination={{
            current: pageInfo.page,
            pageSize: pageInfo.pageSize,
            total: total,
            showTotal: t => `共 ${t} 条`,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
          }}
          size="small"
        />
      </div>

      {/* 审核弹窗 */}
      <Modal
        title={`审核情报${intel ? ` - ${intel.title}` : ''}`}
        open={reviewModal.visible}
        onCancel={closeReviewModal}
        footer={
          <Space>
            {activeTab === 'pending' ? (
              <>
                <Button danger onClick={handleReject}>不通过</Button>
                <Button type="primary" onClick={handleApprove}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}>
                  通过
                </Button>
              </>
            ) : (
              <Button type="primary" onClick={closeReviewModal}>关闭</Button>
            )}
          </Space>
        }
        width={700}
      >
        {intel && (
          <div>
            {/* AI 提取内容 */}
            <Descriptions column={2} size="small" bordered title="AI 提取内容" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="类别">
                <Tag color={getCategoryTagColor(intel.category)}>
                  {INTEL_CATEGORY_MAP[intel.category as keyof typeof INTEL_CATEGORY_MAP] || intel.category}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="置信度">
                {intel.confidence > 0 ? `${(intel.confidence * 100).toFixed(0)}%` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="标题" span={2}>{intel.title}</Descriptions.Item>
              {intel.event_start_date && (
                <Descriptions.Item label="日期" span={2}>
                  {intel.event_start_date}
                  {intel.event_end_date && intel.event_end_date !== intel.event_start_date
                    ? ` ~ ${intel.event_end_date}` : ''}
                </Descriptions.Item>
              )}
              {intel.event_city && <Descriptions.Item label="城市">{intel.event_city}</Descriptions.Item>}
              {intel.event_location && <Descriptions.Item label="地点">{intel.event_location}</Descriptions.Item>}
              {intel.price_info && <Descriptions.Item label="价格">{intel.price_info}</Descriptions.Item>}
              {intel.description && (
                <Descriptions.Item label="描述" span={2}>{intel.description}</Descriptions.Item>
              )}
              {intel.participants.length > 0 && (
                <Descriptions.Item label="嘉宾" span={2}>
                  {intel.participants.map(p => <Tag key={p}>{p}</Tag>)}
                </Descriptions.Item>
              )}
              {intel.tags.length > 0 && (
                <Descriptions.Item label="标签" span={2}>
                  {intel.tags.map(t => <Tag key={t}>{t}</Tag>)}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* 帖子原文（可能有多个） */}
            <Descriptions column={1} size="small" bordered title="帖子原文">
              {reviewModal.loadingPost ? (
                <Descriptions.Item label="加载中">正在加载帖子内容...</Descriptions.Item>
              ) : reviewModal.sourcePosts.length > 0 ? (
                reviewModal.sourcePosts.map((p, i) => (
                  <div key={p.mid} style={{ marginBottom: i < reviewModal.sourcePosts.length - 1 ? 16 : 0 }}>
                    {reviewModal.sourcePosts.length > 1 && (
                      <div style={{ fontWeight: 600, marginBottom: 8, color: '#555' }}>
                        帖子 {i + 1}{p.is_trigger_post ? '（原始帖）' : ''}
                      </div>
                    )}
                    <Descriptions column={2} size="small">
                      <Descriptions.Item label="作者">{p.author_nickname}</Descriptions.Item>
                      <Descriptions.Item label="链接">
                        <a
                          href={`https://weibo.com/${p.author_uid}/${p.mid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          查看原帖 ↗
                        </a>
                      </Descriptions.Item>
                      <Descriptions.Item label="发布时间">
                        {p.created_at ? dayjs(p.created_at).format('YYYY-MM-DD HH:mm') : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="互动" span={2}>
                        转{p.reposts_count || 0} / 评论{p.comments_count || 0} / 赞{p.attitudes_count || 0}
                      </Descriptions.Item>
                      <Descriptions.Item label="正文" span={2} style={{ whiteSpace: 'pre-wrap' }}>
                        {p.text_raw || p.text || '（无正文）'}
                      </Descriptions.Item>
                    </Descriptions>
                  </div>
                ))
              ) : (
                <Descriptions.Item label="提示">未找到帖子原文</Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default IntelManagement;
