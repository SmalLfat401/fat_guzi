import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { message, Tag, Button, Space, Empty, Spin, Card, Row, Col, Divider } from 'antd';
import { ArrowLeftOutlined, EyeOutlined, CloudDownloadOutlined, CheckCircleOutlined, ClockCircleOutlined, FileTextOutlined, LinkOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Table } from 'antd';
import { weiboUserApi } from '../api/weiboUser';
import type { WeiboPost } from '../types/weibo';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import '../styles/global.scss';

dayjs.locale('zh-cn');

const WeiboPosts: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const userIdstr = searchParams.get('userIdstr') || '';
  const displayName = searchParams.get('nickname') || '';
  
  const [posts, setPosts] = useState<WeiboPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedPost, setSelectedPost] = useState<WeiboPost | null>(null);
  const [longTextLoading, setLongTextLoading] = useState(false);
  const pageSize = 20;

  const fetchPosts = async (pageNum: number = 1) => {
    if (!userIdstr) {
      message.error('缺少用户ID');
      return;
    }
    
    setLoading(true);
    try {
      const result = await weiboUserApi.getPosts(userIdstr, pageNum, pageSize);
      if (result.success) {
        setPosts(result.data);
        setTotal(result.total);
        setPage(result.page);
      } else {
        message.error('获取帖子失败');
      }
    } catch (error) {
      message.error('获取帖子失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(1);
  }, [userIdstr]);

  const handlePageChange = (pageNum: number) => {
    fetchPosts(pageNum);
  };

  // 查看长文本内容
  const handleViewLongText = (post: WeiboPost) => {
    setSelectedPost(post);
  };

  // 爬取并保存长文本
  const handleFetchLongText = async (post: WeiboPost) => {
    setLongTextLoading(true);
    try {
      // 先爬取
      const fetchResult = await weiboUserApi.fetchLongText(post.mblogid);
      if (!fetchResult.success) {
        message.error(fetchResult.error || '爬取长文本失败');
        return;
      }
      
      if (!fetchResult.longTextContent) {
        message.info('该微博没有长文本内容');
        return;
      }

      // 保存到数据库
      const saveResult = await weiboUserApi.saveLongText(post.mblogid);
      if (saveResult.success) {
        message.success('长文本已爬取并保存');
        // 更新当前帖子数据
        const updatedPost = { ...post, long_text: fetchResult.longTextContent };
        setSelectedPost(updatedPost);
        // 刷新列表
        fetchPosts(page);
      } else {
        message.error(saveResult.error || '保存失败');
      }
    } catch (error) {
      message.error('操作失败: ' + (error as Error).message);
    } finally {
      setLongTextLoading(false);
    }
  };

  const renderContent = (text: string, textRaw?: string) => {
    const content = textRaw || text.replace(/<[^>]+>/g, '');
    return content.slice(0, 200) + (content.length > 200 ? '...' : '');
  };

  const columns: ColumnsType<WeiboPost> = [
    
    {
      title: '发布时间',
      dataIndex: 'created_at_dt',
      key: 'created_at_dt',
      width: 130,
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
      render: (_: string, record: WeiboPost) => (
        <div style={{ 
          maxHeight: 50, 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          whiteSpace: 'pre-wrap',
          fontSize: 12,
          color: 'var(--text-secondary)'
        }}>
          {renderContent(record.text, record.text_raw)}
        </div>
      ),
    },
    {
      title: '转发',
      dataIndex: 'reposts_count',
      key: 'reposts_count',
      width: 50,
      render: (count: number) => <span style={{ fontSize: 12 }}>{count}</span>,
    },
    {
      title: '评论',
      dataIndex: 'comments_count',
      key: 'comments_count',
      width: 50,
      render: (count: number) => <span style={{ fontSize: 12 }}>{count}</span>,
    },
    {
      title: '状态',
      key: 'status',
      width: 70,
      render: (_: unknown, record: WeiboPost) => (
        <Space direction="vertical" size={2}>
          {record.is_top && <Tag color="red" style={{ margin: 0, fontSize: 10 }}>置顶</Tag>}
          {record.long_text ? (
            <Tag color="green" style={{ margin: 0, fontSize: 10 }}>长文</Tag>
          ) : record.continue_tag ? (
            <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>全文</Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: WeiboPost) => (
        <Space direction="vertical" size={4}>
          <Button 
            type="link" 
            size="small" 
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleViewLongText(record);
            }}
          >
            查看
          </Button>
          {/* 只有需要爬取全文(continue_tag)或已有长文本(long_text)的才显示按钮 */}
          {(record.continue_tag || record.long_text) && (
            <Button 
              type="link" 
              size="small" 
              icon={<CloudDownloadOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleFetchLongText(record);
              }}
              loading={longTextLoading}
            >
              {record.long_text ? '已抓取' : '爬取全文'}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 渲染右侧长文本内容
  const renderLongTextPanel = () => {
    if (!selectedPost) {
      return (
        <div style={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          flexDirection: 'column',
          gap: 16
        }}>
          <FileTextOutlined style={{ fontSize: 48, opacity: 0.5 }} />
          <span>点击左侧"查看"按钮查看微博详情</span>
        </div>
      );
    }

    const content = selectedPost.long_text || selectedPost.text_raw || selectedPost.text.replace(/<[^>]+>/g, '');

    return (
      <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
        {/* 微博信息头部 */}
        <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border-color)' }}>
          <Space align="start">
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4, color: 'var(--text-primary)' }}>
                {selectedPost.user_nickname}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                {selectedPost.created_at_dt ? dayjs(selectedPost.created_at_dt).format('YYYY-MM-DD HH:mm:ss') : selectedPost.created_at}
              </div>
            </div>
          </Space>
        </div>

        {/* 微博内容 */}
        <div style={{ marginBottom: 16, lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-primary)' }}>
          {content}
        </div>

        {/* 统计数据 */}
        <Divider style={{ margin: '12px 0', borderColor: 'var(--border-color)' }} />
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{selectedPost.reposts_count}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>转发</div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--accent-purple)' }}>{selectedPost.comments_count}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>评论</div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--accent-green)' }}>{selectedPost.attitudes_count}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>点赞</div>
            </div>
          </Col>
        </Row>

        {/* 来源信息 */}
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          <span>来源: {selectedPost.source}</span>
          {selectedPost.region_name && <span style={{ marginLeft: 16 }}>{selectedPost.region_name}</span>}
        </div>

        {/* 操作按钮 */}
        <Space wrap>
          {selectedPost.long_text && (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              长文本已抓取
            </Tag>
          )}
        </Space>
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      {/* 页面头部 */}
      <div className="page-header" style={{ padding: '12px 24px', flexShrink: 0 }}>
        <Space align="center">
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/weibo-users')}
          >
            返回
          </Button>
          <span style={{ margin: '0 8px' }}>|</span>
          <h3 className="page-title" style={{ margin: 0 }}>
            {displayName} 的微博
          </h3>
          <Tag color="purple">共 {total} 条</Tag>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 8]} style={{ padding: '0 24px 16px', flexShrink: 0 }}>
        <Col xs={24} sm={8}>
          <Card size="small" bordered={false} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <div style={{ color: '#fff', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold' }}>{total}</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>微博总数</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" bordered={false} style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            <div style={{ color: '#fff', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold' }}>
                {posts.reduce((sum, p) => sum + p.reposts_count, 0)}
              </div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>总转发</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" bordered={false} style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
            <div style={{ color: '#fff', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold' }}>
                {posts.reduce((sum, p) => sum + p.comments_count, 0)}
              </div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>总评论</div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 左右布局 */}
      <div style={{ flex: 1, padding: '0 24px 24px', display: 'flex', gap: 16, minHeight: 0 }}>
        {/* 左侧列表 */}
        <div style={{ flex: '0 0 55%', minWidth: 0, overflow: 'hidden' }} className="data-table">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spin size="large" />
            </div>
          ) : posts.length === 0 ? (
            <Empty description="暂无微博数据" />
          ) : (
            <Table
              columns={columns}
              dataSource={posts}
              rowKey="mblogid"
              pagination={{
                current: page,
                total,
                pageSize,
                showTotal: (total) => `共 ${total} 条`,
                showSizeChanger: false,
                onChange: handlePageChange,
              }}
              scroll={{ x: 550, y: 400 }}
              size="small"
              rowClassName={(record) => selectedPost?.mblogid === record.mblogid ? 'ant-table-row-selected' : ''}
              onRow={(record) => ({
                onClick: () => setSelectedPost(record),
                style: { cursor: 'pointer' }
              })}
            />
          )}
        </div>

        {/* 右侧详情 */}
        <div style={{
          flex: '0 0 45%',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg, 8px)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>微博详情</span>
            {selectedPost && (
              <Button
                type="link"
                size="small"
                icon={<LinkOutlined />}
                onClick={() => {
                  window.open(`https://weibo.com/${selectedPost.user_idstr}/${selectedPost.mid}`, '_blank');
                }}
              >
                查看原文
              </Button>
            )}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {renderLongTextPanel()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeiboPosts;
