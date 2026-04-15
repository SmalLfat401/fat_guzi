import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  message, Card, Row, Col, Tag, Button, Space, Descriptions,
  Timeline, Alert, Collapse, Empty, Modal,
} from 'antd';
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined, EditOutlined,
  LinkOutlined, WarningOutlined, DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import '../../styles/global.scss';
import { weiboIntelApi } from '../../api/weiboIntel';
import type { WeiboIntelDetail } from '../../types/weiboIntel';
import {
  INTEL_CATEGORY_MAP,
  INTEL_STATUS_MAP,
  ALERT_TYPE_MAP,
} from '../../types/weiboIntel';

dayjs.locale('zh-cn');

const { Panel } = Collapse;

const WeiboIntelDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<WeiboIntelDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await weiboIntelApi.getDetail(id);
      setItem(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetail(); }, [id]);

  const handleApprove = async () => {
    if (!item) return;
    try {
      await weiboIntelApi.approve(item.id);
      message.success('已批准并同步到日历');
      fetchDetail();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleReject = async () => {
    if (!item) return;
    try {
      await weiboIntelApi.reject(item.id);
      message.success('已拒绝');
      fetchDetail();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleResolveAlert = async () => {
    if (!item) return;
    try {
      await weiboIntelApi.resolveAlert(item.id);
      message.success('告警已处理');
      fetchDetail();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    Modal.confirm({
      title: '确认删除？',
      content: '删除后无法恢复，确定要删除这条情报吗？',
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await weiboIntelApi.delete(item.id);
          message.success('删除成功');
          navigate('/weibo-intel');
        } catch (err) {
          message.error(err instanceof Error ? err.message : '删除失败');
        }
      },
    });
  };

  if (loading) return null;
  if (error || !item) return (
    <div style={{ padding: 24 }}>
      <Alert message={error || '情报不存在'} type="error" showIcon />
      <Button style={{ marginTop: 16 }} icon={<ArrowLeftOutlined />} onClick={() => navigate('/weibo-intel')}>
        返回列表
      </Button>
    </div>
  );

  const getCategoryTagColor = (cat: string) => {
    const colors: Record<string, string> = {
      convention: 'blue', book_signing: 'purple', pre_order: 'orange',
      product_launch: 'green', offline_activity: 'cyan', online_activity: 'magenta', other: 'default',
    };
    return colors[cat] || 'default';
  };

  return (
    <div className="fade-in" style={{ padding: 24 }}>
      {/* 顶部导航 */}
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/weibo-intel')}>
          返回列表
        </Button>
      </div>

      {/* 状态和操作 */}
      <Card
        title={
          <Space>
            <Tag color={getCategoryTagColor(item.category)} style={{ fontSize: 14 }}>
              {INTEL_CATEGORY_MAP[item.category as keyof typeof INTEL_CATEGORY_MAP] || item.category}
            </Tag>
            <span style={{ fontWeight: 600, fontSize: 16 }}>{item.title}</span>
          </Space>
        }
        extra={
          <Space>
            {item.status === 'pending' && (
              <>
                <Button type="primary" icon={<CheckOutlined />} style={{ background: '#52c41a', borderColor: '#52c41a' }}
                  onClick={handleApprove}>
                  批准
                </Button>
                <Button danger icon={<CloseOutlined />} onClick={handleReject}>
                  拒绝
                </Button>
              </>
            )}
            {item.has_alert && (
              <Button icon={<CheckOutlined />} onClick={handleResolveAlert}>
                处理告警
              </Button>
            )}
            <Button icon={<EditOutlined />} onClick={() => navigate(`/weibo-intel/edit/${item.id}`)}>
              编辑
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
              删除
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          <Col span={4}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#00f0ff' }}>{item.confidence > 0 ? `${(item.confidence * 100).toFixed(0)}%` : '-'}</div>
              <div style={{ color: '#888', fontSize: 12 }}>置信度</div>
            </div>
          </Col>
          <Col span={4}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: item.status === 'approved' ? '#52c41a' : item.status === 'rejected' ? '#ff4d4f' : '#faad14' }}>
                {INTEL_STATUS_MAP[item.status as keyof typeof INTEL_STATUS_MAP] || item.status}
              </div>
              <div style={{ color: '#888', fontSize: 12 }}>审核状态</div>
            </div>
          </Col>
          <Col span={4}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: item.has_alert ? '#ff4d4f' : '#52c41a' }}>
                {item.has_alert ? '有' : '无'}
              </div>
              <div style={{ color: '#888', fontSize: 12 }}>告警</div>
            </div>
          </Col>
          <Col span={4}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#00f0ff' }}>{item.source_posts_count}</div>
              <div style={{ color: '#888', fontSize: 12 }}>关联帖子</div>
            </div>
          </Col>
          <Col span={4}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: item.synced_to_calendar ? '#52c41a' : '#ccc' }}>
                {item.synced_to_calendar ? '已' : '未'}
              </div>
              <div style={{ color: '#888', fontSize: 12 }}>同步日历</div>
            </div>
          </Col>
          <Col span={4}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#00f0ff' }}>v{item.version}</div>
              <div style={{ color: '#888', fontSize: 12 }}>版本</div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* 告警提示 */}
      {item.has_alert && (
        <Alert
          message={
            <Space>
              <WarningOutlined style={{ color: '#ff4d4f' }} />
              <span>{ALERT_TYPE_MAP[item.alert_type as keyof typeof ALERT_TYPE_MAP] || item.alert_type}</span>
              <span style={{ color: '#888' }}>{item.alert_message}</span>
            </Space>
          }
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 基本信息 */}
      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="标题">{item.title}</Descriptions.Item>
          <Descriptions.Item label="类别">
            <Tag color={getCategoryTagColor(item.category)}>{INTEL_CATEGORY_MAP[item.category as keyof typeof INTEL_CATEGORY_MAP]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="开始日期">{item.event_start_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="结束日期">{item.event_end_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="开始时间">{item.event_start_time || '-'}</Descriptions.Item>
          <Descriptions.Item label="城市">{item.event_city || '-'}</Descriptions.Item>
          <Descriptions.Item label="地点">{item.event_location || '-'}</Descriptions.Item>
          <Descriptions.Item label="价格/票务">{item.price_info || '-'}</Descriptions.Item>
          {item.purchase_url && (
            <Descriptions.Item label="购买链接" span={2}>
              <a href={item.purchase_url} target="_blank" rel="noopener noreferrer">
                {item.purchase_url} <LinkOutlined />
              </a>
            </Descriptions.Item>
          )}
          <Descriptions.Item label="标签">
            {item.tags.map(t => <Tag key={t}>{t}</Tag>)}
            {item.tags.length === 0 && '-'}
          </Descriptions.Item>
          <Descriptions.Item label="相关IP">
            {item.related_ips.map(ip => <Tag key={ip} color="blue">{ip}</Tag>)}
            {item.related_ips.length === 0 && '-'}
          </Descriptions.Item>
          <Descriptions.Item label="嘉宾/参与者">
            {item.participants.map(p => <Tag key={p} color="purple">{p}</Tag>)}
            {item.participants.length === 0 && '-'}
          </Descriptions.Item>
          <Descriptions.Item label="描述">{item.description || '-'}</Descriptions.Item>
          <Descriptions.Item label="封面图">
            {item.cover_image ? (
              <img src={item.cover_image} alt="cover" style={{ maxHeight: 80, borderRadius: 4 }} />
            ) : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 关联帖子 */}
      <Card title={`关联帖子 (${item.source_posts.length})`} style={{ marginBottom: 16 }}>
        {item.source_posts.length === 0 ? (
          <Empty description="暂无关联帖子" />
        ) : (
          item.source_posts.map((post, idx) => (
            <div key={post.mid} style={{ padding: '8px 0', borderBottom: idx < item.source_posts.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
              <Space>
                <Tag color={post.is_trigger_post ? 'blue' : 'default'}>
                  {post.is_trigger_post ? '原始帖' : '关联帖'}
                </Tag>
                <span>{post.author_nickname}</span>
                <span style={{ color: '#888' }}>{dayjs(post.linked_at).format('YYYY-MM-DD HH:mm')}</span>
                <a href={`https://weibo.com/${post.author_uid}/${post.mid}`} target="_blank" rel="noopener noreferrer">
                  查看原帖 <LinkOutlined />
                </a>
              </Space>
            </div>
          ))
        )}
      </Card>

      {/* 变更历史 */}
      <Card title={`变更历史 (${item.change_history.length})`}>
        {item.change_history.length === 0 ? (
          <Empty description="暂无变更记录" />
        ) : (
          <Timeline
            mode="left"
            items={[...item.change_history].reverse().map(change => ({
              color: change.change_type === 'approved' ? 'green'
                : change.change_type === 'rejected' ? 'red'
                  : change.change_type === 'alert_resolved' ? 'blue' : 'gray',
              children: (
                <div>
                  <div>
                    <Tag>{change.change_type}</Tag>
                    <span style={{ fontWeight: 600 }}>{change.changed_by}</span>
                    <span style={{ color: '#888', marginLeft: 8 }}>{dayjs(change.changed_at).format('YYYY-MM-DD HH:mm')}</span>
                  </div>
                  {change.field && (
                    <div style={{ marginTop: 4, color: '#666', fontSize: 13 }}>
                      字段「{change.field}」：
                      {change.old_value !== null && change.old_value !== undefined && (
                        <span style={{ textDecoration: 'line-through', color: '#ff4d4f', marginRight: 4 }}>
                          {String(change.old_value)}
                        </span>
                      )}
                      {change.new_value !== null && change.new_value !== undefined && (
                        <span style={{ color: '#52c41a' }}>{String(change.new_value)}</span>
                      )}
                    </div>
                  )}
                  {change.change_reason && (
                    <div style={{ marginTop: 2, color: '#888', fontSize: 12 }}>{change.change_reason}</div>
                  )}
                </div>
              ),
            }))}
          />
        )}
      </Card>

      {/* AI 原始返回（折叠） */}
      {item.ai_raw_response && (
        <Collapse style={{ marginTop: 16 }}>
          <Panel header="AI 原始返回（调试用）" key="ai">
            <pre style={{ maxHeight: 300, overflow: 'auto', fontSize: 11 }}>
              {JSON.stringify(item.ai_raw_response, null, 2)}
            </pre>
          </Panel>
        </Collapse>
      )}
    </div>
  );
};

export default WeiboIntelDetailPage;
