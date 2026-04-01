import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Button, Space, Tag, Progress, Timeline, message,
  Statistic, Table, Badge, Spin, Alert, Tooltip, Divider, Empty,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  CloudDownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  UserOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { crawlerApi } from '../../api/crawler';
import type { WeiboCrawlerTaskStatus, CrawlerLogEntry } from '../../api/crawler';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import '../../styles/global.scss';

dayjs.extend(relativeTime);

interface CategoryUser {
  category_id: string;
  category_name: string;
  category_description?: string;
  user_count: number;
  users: Array<{ uid: string; nickname: string }>;
}

interface UserProgress {
  uid: string;
  nickname: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  log?: string;
}

const CategoryCrawlerDetail: React.FC = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();

  const [categoryUsers, setCategoryUsers] = useState<CategoryUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskStatus, setTaskStatus] = useState<WeiboCrawlerTaskStatus | null>(null);

  const isThisCategory = categoryUsers
    ? taskStatus?.target_uids?.length === categoryUsers.users.length &&
      categoryUsers.users.every(user => taskStatus?.target_uids?.includes(user.uid))
    : false;

  const isRunning = isThisCategory && taskStatus?.status === 'running';
  const isPaused = isThisCategory && taskStatus?.status === 'paused';
  const isStopping = isThisCategory && taskStatus?.status === 'stopping';
  const globalTaskRunning = taskStatus?.status === 'running' || taskStatus?.status === 'stopping' || taskStatus?.status === 'paused';

  // 加载类别信息和爬虫状态
  const fetchData = useCallback(async () => {
    if (!categoryId) return;
    try {
      const res = await crawlerApi.getCategoryUsers();
      if (res.success) {
        const found = res.categories.find(c => c.category_id === categoryId);
        if (found) {
          setCategoryUsers(found);
        } else {
          message.error('未找到该类别');
          navigate('/crawler');
        }
      }
    } catch (err) {
      console.error('获取类别失败:', err);
    } finally {
      setLoading(false);
    }
  }, [categoryId, navigate]);

  const fetchTaskStatus = useCallback(async () => {
    try {
      const status = await crawlerApi.getCrawlerTaskStatus();
      setTaskStatus(status);
    } catch (err) {
      console.error('获取任务状态失败:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchTaskStatus();
    const interval = setInterval(fetchTaskStatus, 2000);
    return () => clearInterval(interval);
  }, [fetchData, fetchTaskStatus]);

  // 构建用户进度表
  const buildUserProgress = (): UserProgress[] => {
    if (!categoryUsers || !taskStatus) return [];

    const logs = taskStatus.logs || [];
    const processedSet = new Set<string>();

    // 从日志中提取已处理的用户
    logs.forEach(log => {
      if (log.action === 'user_completed' && log.success) {
        processedSet.add(log.uid);
      }
    });

    // 构建 uid -> nickname 的映射
    const uidToNickname: Record<string, string> = {};
    categoryUsers.users.forEach(u => {
      uidToNickname[u.uid] = u.nickname;
    });

    return categoryUsers.users.map((user, idx) => {
      const userLog = logs.find(l => l.uid === user.uid);
      let status: UserProgress['status'] = 'pending';

      if (taskStatus.status === 'idle') {
        status = processedSet.has(user.uid) ? 'done' : 'pending';
      } else if (taskStatus.status === 'running' || taskStatus.status === 'paused') {
        if (processedSet.has(user.uid)) {
          status = 'done';
        } else if (taskStatus.paused_after_uid === user.uid) {
          status = 'processing';
        } else {
          // 判断是否在当前用户之前已处理
          const currentIdx = categoryUsers.users.findIndex(u => u.uid === taskStatus.paused_after_uid);
          if (currentIdx >= 0 && idx < currentIdx) {
            status = 'done';
          } else {
            status = 'pending';
          }
        }
      }

      return {
        uid: user.uid,
        nickname: userLog?.nickname || uidToNickname[user.uid] || user.nickname || `用户 ${user.uid.slice(0, 8)}...`,
        status,
        log: userLog?.message,
      };
    });
  };

  const handleStart = async () => {
    setTaskLoading(true);
    try {
      const result = await crawlerApi.startCrawlerByCategory({
        category_id: categoryId!,
        mode: 'full',
      });
      if (result.success) {
        message.success(result.message || '任务已启动');
        fetchTaskStatus();
      } else {
        message.error(result.error || '启动失败');
      }
    } catch (e: any) {
      message.error(e.message || '启动失败');
    } finally {
      setTaskLoading(false);
    }
  };

  const handleStartLimited = async () => {
    setTaskLoading(true);
    try {
      const result = await crawlerApi.startCrawlerByCategory({
        category_id: categoryId!,
        mode: 'limited',
        max_posts: 5,
      });
      if (result.success) {
        message.success(result.message || '限量测试已启动');
        fetchTaskStatus();
      } else {
        message.error(result.error || '启动失败');
      }
    } catch (e: any) {
      message.error(e.message || '启动失败');
    } finally {
      setTaskLoading(false);
    }
  };

  const handlePause = async () => {
    setTaskLoading(true);
    try {
      const result = await crawlerApi.pauseCrawlerTask();
      if (result.success) {
        message.success('任务已暂停');
        fetchTaskStatus();
      } else {
        message.error(result.error || '暂停失败');
      }
    } catch (e: any) {
      message.error(e.message || '暂停失败');
    } finally {
      setTaskLoading(false);
    }
  };

  const handleResume = async () => {
    setTaskLoading(true);
    try {
      const result = await crawlerApi.resumeCrawlerTask();
      if (result.success) {
        message.success('任务已恢复');
        fetchTaskStatus();
      } else {
        message.error(result.error || '恢复失败');
      }
    } catch (e: any) {
      message.error(e.message || '恢复失败');
    } finally {
      setTaskLoading(false);
    }
  };

  const handleStop = async () => {
    setTaskLoading(true);
    try {
      const result = await crawlerApi.stopCrawlerTask();
      if (result.success) {
        message.success('任务已停止');
        fetchTaskStatus();
      } else {
        message.error(result.error || '停止失败');
      }
    } catch (e: any) {
      message.error(e.message || '停止失败');
    } finally {
      setTaskLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!categoryUsers) return null;

  const userProgress = buildUserProgress();
  const processedCount = userProgress.filter(u => u.status === 'done').length;
  const progress = categoryUsers.user_count > 0
    ? (processedCount / categoryUsers.user_count) * 100
    : 0;

  const statusBadge = (status: UserProgress['status']) => {
    switch (status) {
      case 'done':
        return <Badge status="success" text="已完成" />;
      case 'processing':
        return <Badge status="processing" text="处理中" />;
      case 'failed':
        return <Badge status="error" text="失败" />;
      default:
        return <Badge status="default" text="等待中" />;
    }
  };

  const columns: ColumnsType<UserProgress> = [
    {
      title: '序号',
      width: 60,
      render: (_, __, idx) => idx + 1,
    },
    {
      title: 'UID',
      dataIndex: 'uid',
      key: 'uid',
      render: (uid: string) => (
        <a
          href={`https://weibo.com/u/${uid}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        >
          {uid}
        </a>
      ),
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: UserProgress['status']) => statusBadge(status),
    },
    {
      title: '最近日志',
      dataIndex: 'log',
      key: 'log',
      render: (log?: string) => log ? (
        <Tooltip title={log}>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{log.slice(0, 30)}...</span>
        </Tooltip>
      ) : '-',
    },
  ];

  const relevantLogs = (taskStatus?.logs || []).filter(
    log => categoryUsers.users.some(user => user.uid === log.uid)
  ).slice(-30);

  return (
    <div className="fade-in">
      {/* 顶部导航 */}
      <div style={{ padding: '16px 24px 0' }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/crawler')}
          size="small"
        >
          返回爬虫监控
        </Button>
      </div>

      {/* 类别标题卡片 */}
      <div style={{ padding: '16px 24px 0' }}>
        <Card
          size="small"
          title={
            <Space>
              <Tag color="blue">{categoryUsers.category_name}</Tag>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                共 {categoryUsers.user_count} 个用户
              </span>
            </Space>
          }
          extra={
            isRunning ? (
              <Tag color="processing">运行中</Tag>
            ) : isPaused ? (
              <Tag color="warning">已暂停</Tag>
            ) : isStopping ? (
              <Tag color="error">停止中</Tag>
            ) : (
              <Tag>空闲</Tag>
            )
          }
        >
          {categoryUsers.category_description && (
            <div style={{ marginBottom: 8, fontSize: 13, color: '#9ca3af' }}>
              {categoryUsers.category_description}
            </div>
          )}

          {/* 进度 */}
          {(isRunning || isPaused || isStopping) && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>用户进度</span>
                <span>{processedCount} / {categoryUsers.user_count}</span>
              </div>
              <Progress
                percent={progress}
                size="small"
                status={isStopping ? 'exception' : isRunning ? 'active' : 'normal'}
                strokeColor={isStopping ? '#ff4d4f' : isRunning ? '#00f0ff' : '#faad14'}
              />
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
                <span><ClockCircleOutlined /> 全文字数: {taskStatus?.total_longtext || 0}</span>
                <span><CheckCircleOutlined /> 已获取: {taskStatus?.saved_longtext || 0}</span>
                {taskStatus?.started_at && (
                  <span>开始于: {dayjs(taskStatus.started_at).fromNow()}</span>
                )}
              </div>
            </>
          )}

          {/* 控制按钮 */}
          <Divider style={{ margin: '12px 0' }} />
          <Space wrap>
            {!isRunning && !isPaused && !isStopping && (
              <>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleStart}
                  loading={taskLoading}
                  size="small"
                >
                  全量爬取
                </Button>
                <Button
                  icon={<CloudDownloadOutlined />}
                  onClick={handleStartLimited}
                  loading={taskLoading}
                  size="small"
                >
                  限量测试 (5条/用户)
                </Button>
              </>
            )}
            {isRunning && (
              <>
                <Button
                  icon={<PauseCircleOutlined />}
                  onClick={handlePause}
                  loading={taskLoading}
                  size="small"
                >
                  暂停
                </Button>
                <Button
                  danger
                  icon={<StopOutlined />}
                  onClick={handleStop}
                  loading={taskLoading}
                  size="small"
                >
                  停止
                </Button>
              </>
            )}
            {(isPaused || isStopping) && (
              <>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleResume}
                  loading={taskLoading}
                  disabled={isStopping}
                  size="small"
                >
                  {isStopping ? '停止中...' : '恢复'}
                </Button>
                <Button
                  danger
                  icon={<StopOutlined />}
                  onClick={handleStop}
                  loading={taskLoading}
                  disabled={isStopping}
                  size="small"
                >
                  停止
                </Button>
              </>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchTaskStatus}
              size="small"
            >
              刷新
            </Button>
          </Space>

          {/* 非当前类别的全局任务提示 */}
          {globalTaskRunning && !isThisCategory && (
            <Alert
              type="info"
              showIcon
              icon={<RobotOutlined />}
              message={
                taskStatus?.status === 'stopping'
                  ? `其他任务（${taskStatus.category_name || '全局'}${taskStatus.mode}）正在停止中，请稍候...`
                  : `当前有其他任务在运行（${taskStatus?.category_name || '全局'}${taskStatus?.mode === 'full' ? '全量' : taskStatus?.mode === 'limited' ? '限量' : '指定'}模式），请等待完成后操作。`
              }
              style={{ marginTop: 12 }}
            />
          )}
        </Card>
      </div>

      {/* 用户表格 + 日志 */}
      <Row gutter={[16, 16]} style={{ padding: '16px 24px 0' }}>
        <Col xs={24} lg={14}>
          <Card
            size="small"
            title={
              <Space>
                <UserOutlined />
                <span>用户列表</span>
                <Tag>{categoryUsers.user_count} 个</Tag>
              </Space>
            }
            bodyStyle={{ padding: '0 12px' }}
          >
            <Table
              rowKey="uid"
              size="small"
              columns={columns}
              dataSource={userProgress}
              pagination={{ pageSize: 10, size: 'small' }}
              scroll={{ x: 600 }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            size="small"
            title={
              <Space>
                <ClockCircleOutlined />
                <span>任务日志</span>
                {relevantLogs.length > 0 && <Tag color="blue">{relevantLogs.length}</Tag>}
              </Space>
            }
            bodyStyle={{ maxHeight: 480, overflow: 'auto', padding: '12px 16px' }}
          >
            {relevantLogs.length === 0 ? (
              <Empty description="暂无日志" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Timeline
                items={relevantLogs.map((log: CrawlerLogEntry, idx: number) => ({
                  color: log.success ? 'green' : 'red',
                  children: (
                    <div key={idx} style={{ fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>{log.nickname || '系统'}</strong>
                        <span style={{ color: '#888' }}>{dayjs(log.timestamp).format('HH:mm:ss')}</span>
                      </div>
                      <div style={{ color: log.success ? '#333' : '#d46b08' }}>
                        {log.message}
                      </div>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 全局状态统计 */}
      <div style={{ padding: '16px 24px 24px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={8}>
            <div className="stats-card stats-info">
              <div className="stats-title">总用户</div>
              <div className="stats-value">{categoryUsers.user_count}</div>
            </div>
          </Col>
          <Col xs={8}>
            <div className={`stats-card ${processedCount > 0 ? 'stats-success' : ''}`}>
              <div className="stats-title">已完成</div>
              <div className="stats-value">{processedCount}</div>
            </div>
          </Col>
          <Col xs={8}>
            <div className="stats-card stats-info">
              <div className="stats-title">待处理</div>
              <div className="stats-value">{categoryUsers.user_count - processedCount}</div>
            </div>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default CategoryCrawlerDetail;
