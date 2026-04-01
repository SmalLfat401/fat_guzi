import { useState, useEffect, useRef } from 'react';
import { Card, Space, Button, Progress, Timeline, Tag, Typography, Alert, Radio, InputNumber, Select, Divider } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { crawlerApi, type CrawlerMode } from '../api/crawler';
import type { WeiboCrawlerTaskStatus, CrawlerLogEntry } from '../api/crawler';
import { useWeiboUsers } from '../hooks/useWeiboUsers';

const { Text } = Typography;

const STATUS_CONFIG = {
  idle: { color: 'default', label: '空闲', icon: <InfoCircleOutlined /> },
  running: { color: 'processing', label: '运行中', icon: <PlayCircleOutlined spin /> },
  paused: { color: 'warning', label: '已暂停', icon: <PauseCircleOutlined /> },
  stopping: { color: 'error', label: '停止中', icon: <StopOutlined /> },
  completed: { color: 'success', label: '已完成', icon: <CheckCircleOutlined /> },
  failed: { color: 'error', label: '失败', icon: <CloseCircleOutlined /> },
};

const ACTION_LABEL: Record<string, string> = {
  start: '启动',
  fetch_posts: '抓取微博',
  fetch_longtext: '获取全文',
  user_completed: '完成',
  user_failed: '失败',
  paused: '暂停',
  stopped: '停止',
  completed: '完成',
  error: '异常',
};

const MODE_OPTIONS = [
  { label: '全量模式', value: 'full' as CrawlerMode, desc: '更新所有已启用的微博用户' },
  { label: '限量测试', value: 'limited' as CrawlerMode, desc: '限制每用户微博条数，用于小范围测试' },
  { label: '指定用户', value: 'specific' as CrawlerMode, desc: '自定义选择要更新的微博账户' },
];

export const WeiboCrawlerPanel: React.FC = () => {
  const { users, fetchUsers } = useWeiboUsers();
  const [taskStatus, setTaskStatus] = useState<WeiboCrawlerTaskStatus | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 模式相关状态
  const [mode, setMode] = useState<CrawlerMode>('full');
  const [limitedCount, setLimitedCount] = useState<number>(5);
  const [targetUids, setTargetUids] = useState<string[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // 初始加载用户列表
  useEffect(() => {
    fetchUsers(0, 100);
  }, []);

  // 加载状态
  const fetchStatus = async () => {
    try {
      const status = await crawlerApi.getCrawlerTaskStatus();
      setTaskStatus(status);
      // 只有任务运行中/暂停时才从后端同步模式信息，idle 时保留用户的 UI 选择
      if (status.status !== 'idle' && status.status !== undefined) {
        if (status.mode) {
          setMode(status.mode);
        }
        if (status.max_posts > 0) {
          setLimitedCount(status.max_posts);
        }
        if (status.target_uids && status.target_uids.length > 0) {
          setTargetUids(status.target_uids);
        }
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch crawler status:', err);
    }
  };

  // 轮询状态：运行中高频刷新，完成后降频刷新
  useEffect(() => {
    fetchStatus();
    const pollInterval =
      taskStatus?.status === 'running' || taskStatus?.status === 'paused' || taskStatus?.status === 'stopping'
        ? 2000
        : 15000;
    timerRef.current = setInterval(fetchStatus, pollInterval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [taskStatus?.status]);

  // 自动滚动日志
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [taskStatus?.logs.length]);

  // 操作处理
  const handleAction = async (action: 'start' | 'pause' | 'resume' | 'stop') => {
    setActionLoading(action);
    setError(null);
    try {
      let result: { success: boolean; error?: string; message?: string };
      switch (action) {
        case 'start':
          result = await crawlerApi.startCrawlerTask({
            mode,
            max_posts: mode === 'limited' ? limitedCount : 0,
            target_uids: mode === 'specific' ? targetUids : undefined,
          });
          break;
        case 'pause':
          result = await crawlerApi.pauseCrawlerTask();
          break;
        case 'resume':
          result = await crawlerApi.resumeCrawlerTask();
          break;
        case 'stop':
          result = await crawlerApi.stopCrawlerTask();
          break;
      }
      if (!result.success) {
        setError(result.error || result.message || '操作失败');
      } else {
        await fetchStatus();
      }
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  const statusCfg = taskStatus
    ? STATUS_CONFIG[taskStatus.status]
    : STATUS_CONFIG.idle;

  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderLogItem = (log: CrawlerLogEntry, idx: number): any => {
    const isSystem = log.uid === '';
    const dot = log.success
      ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
      : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    const timeStr = formatTime(log.timestamp);

    if (isSystem) {
      return {
        key: idx,
        dot,
        color: log.success ? 'green' : 'red',
        children: (
          <Space>
            <Text type="secondary" style={{ fontSize: 11 }}>{timeStr}</Text>
            <Text strong style={{ fontSize: 13 }}>{log.message}</Text>
          </Space>
        ),
      };
    }

    return {
      key: idx,
      dot,
      children: (
        <Space>
          <Text type="secondary" style={{ fontSize: 11 }}>{timeStr}</Text>
          <Tag color="blue" style={{ fontSize: 11, marginRight: 4 }}>@{log.nickname}</Tag>
          <Text type="secondary" style={{ fontSize: 11 }}>
            [{ACTION_LABEL[log.action] || log.action}]
          </Text>
          <Text style={{ fontSize: 13 }}>{log.message}</Text>
        </Space>
      ),
    };
  };

  const isIdle = taskStatus?.status === 'idle' || !taskStatus?.status;

  // 用户下拉选项（用于指定模式）
  const userOptions = users.map(u => ({
    label: u.nickname,
    value: u.uid,
  }));

  return (
    <Card
      size="small"
      style={{ height: '100%', margin: 0 }}
      bodyStyle={{ paddingBottom: 0 }}
      title={<><RobotOutlined /> 自动爬虫任务</>}
      extra={
        <Space>
          {taskStatus?.browser_connected === false && (
            <Tag color="error">Chrome 未连接</Tag>
          )}
          <Tag color={statusCfg.color} icon={statusCfg.icon}>
            {statusCfg.label}
          </Tag>
          {taskStatus?.started_at && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {formatTime(taskStatus.started_at)}
            </Text>
          )}
        </Space>
      }
    >
      {/* 模式选择（仅空闲状态可编辑） */}
      {isIdle && (
        <>
          <div style={{ marginBottom: 8 }}>
            <Radio.Group
              value={mode}
              onChange={e => setMode(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              size="small"
            >
              {MODE_OPTIONS.map(opt => (
                <Radio.Button key={opt.value} value={opt.value}>
                  {opt.label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </div>

          {/* 限量模式：输入每用户条数 */}
          {mode === 'limited' && (
            <Space style={{ marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>每用户抓取条数：</Text>
              <InputNumber
                min={1}
                max={50}
                value={limitedCount}
                onChange={v => setLimitedCount(v || 5)}
                size="small"
                style={{ width: 80 }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>条</Text>
            </Space>
          )}

          {/* 指定模式：选择用户 */}
          {mode === 'specific' && (
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>选择要更新的用户：</Text>
              <Select
                mode="multiple"
                placeholder="搜索微博用户"
                value={targetUids}
                onChange={setTargetUids}
                options={userOptions}
                size="small"
                style={{ width: '100%', marginTop: 4 }}
                maxTagCount={3}
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </div>
          )}

          <Divider style={{ margin: '8px 0' }} />
        </>
      )}

      {/* 进度 - 运行中/暂停时显示 */}
      {(taskStatus?.status === 'running' || taskStatus?.status === 'paused') && (
        <div style={{ marginBottom: 12 }}>
          <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text>
              用户 <Text strong>{taskStatus?.processed_users}</Text>/{taskStatus?.total_users}
              {taskStatus?.failed_users > 0 && (
                <Text type="danger" style={{ fontSize: 11 }}> (失败 {taskStatus.failed_users})</Text>
              )}
            </Text>
            <Text>
              微博 <Text strong>{taskStatus?.saved_blogs}</Text>
            </Text>
            <Text>
              全文 <Text strong style={{ color: '#1890ff' }}>{taskStatus?.saved_longtext}</Text>/{taskStatus?.total_longtext}
            </Text>
            <Text type="secondary">{taskStatus?.progress}%</Text>
          </Space>
          <Progress
            percent={taskStatus?.progress || 0}
            size="small"
            status={taskStatus?.status === 'paused' ? 'exception' : 'active'}
            strokeColor="#1890ff"
          />
        </div>
      )}

      {/* 最终统计 - 任务完成后显示 */}
      {taskStatus?.status === 'idle' && taskStatus.logs && taskStatus.logs.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text type="secondary">
              上次任务完成：
              用户 <Text strong>{taskStatus.processed_users}</Text>
              {taskStatus.failed_users > 0 && (
                <Text type="danger" style={{ fontSize: 11 }}> (失败 {taskStatus.failed_users})</Text>
              )}
            </Text>
            <Text type="secondary">
              微博 <Text strong>{taskStatus.saved_blogs}</Text>
            </Text>
            <Text type="secondary">
              全文 <Text strong style={{ color: '#1890ff' }}>{taskStatus.saved_longtext}</Text>/{taskStatus.total_longtext}
              {taskStatus.failed_longtext > 0 && (
                <Text type="danger" style={{ fontSize: 11 }}> (失败 {taskStatus.failed_longtext})</Text>
              )}
            </Text>
          </Space>
        </div>
      )}

      {/* 操作按钮 */}
      <Space style={{ marginBottom: 12 }}>
        {taskStatus?.status === 'idle' && (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={actionLoading === 'start'}
            onClick={() => handleAction('start')}
            disabled={mode === 'specific' && targetUids.length === 0}
          >
            开始任务
          </Button>
        )}
        {taskStatus?.status === 'running' && (
          <>
            <Button
              icon={<PauseCircleOutlined />}
              loading={actionLoading === 'pause'}
              onClick={() => handleAction('pause')}
            >
              暂停
            </Button>
            <Button
              danger
              icon={<StopOutlined />}
              loading={actionLoading === 'stop'}
              onClick={() => handleAction('stop')}
            >
              停止
            </Button>
          </>
        )}
        {taskStatus?.status === 'paused' && (
          <>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              loading={actionLoading === 'resume'}
              onClick={() => handleAction('resume')}
            >
              继续
            </Button>
            <Button
              danger
              icon={<StopOutlined />}
              loading={actionLoading === 'stop'}
              onClick={() => handleAction('stop')}
            >
              停止
            </Button>
          </>
        )}
        {taskStatus?.status === 'stopping' && (
          <Text type="secondary">任务正在停止...</Text>
        )}
      </Space>

      {/* 错误提示 */}
      {error && (
        <Alert message={error} type="error" showIcon closable style={{ marginBottom: 12 }} />
      )}

      {/* 日志 */}
      {taskStatus?.logs && taskStatus.logs.length > 0 && (
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          <Space style={{ marginBottom: 4 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              共 {taskStatus.log_count || taskStatus.logs.length} 条日志
            </Text>
          </Space>
          <Timeline
            items={taskStatus.logs.slice(-50).map((log, idx) => renderLogItem(log, idx))}
          />
          <div ref={logEndRef} />
        </div>
      )}

      {(!taskStatus?.logs || taskStatus.logs.length === 0) && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {taskStatus?.status === 'idle'
            ? '点击「开始任务」启动自动爬虫'
            : '等待日志输出...'}
        </Text>
      )}
    </Card>
  );
};
