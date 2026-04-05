import { Card, Space, Typography, Progress, Timeline, Tag } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { WeiboCrawlerTaskStatus, CrawlerLogEntry } from '../api/crawler';

const { Text: Txt } = Typography;

const ACTION_LABEL: Record<string, string> = {
  fetch_posts: '抓取微博',
  fetch_longtext: '获取全文',
  user_completed: '完成',
  user_failed: '失败',
  completed: '完成',
  error: '异常',
};

interface CrawlerLogPanelProps {
  taskStatus: WeiboCrawlerTaskStatus | null;
}

const CrawlerLogPanel: React.FC<CrawlerLogPanelProps> = ({ taskStatus }) => {
  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  const renderLogItem = (log: CrawlerLogEntry, idx: number) => {
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
            <Txt type="secondary" style={{ fontSize: 11 }}>{timeStr}</Txt>
            <Txt strong style={{ fontSize: 13 }}>{log.message}</Txt>
          </Space>
        ),
      };
    }

    return {
      key: idx,
      dot,
      children: (
        <Space>
          <Txt type="secondary" style={{ fontSize: 11 }}>{timeStr}</Txt>
          <Tag color="blue" style={{ fontSize: 11, marginRight: 4 }}>@{log.nickname}</Tag>
          <Txt type="secondary" style={{ fontSize: 11 }}>
            [{ACTION_LABEL[log.action] || log.action}]
          </Txt>
          <Txt style={{ fontSize: 13 }}>{log.message}</Txt>
        </Space>
      ),
    };
  };

  return (
    <Card
      size="small"
      style={{ height: '100%', margin: 0 }}
      title="爬虫日志"
    >
      {/* 进度 - 运行中/暂停时显示 */}
      {(taskStatus?.status === 'running' || taskStatus?.status === 'paused') && (
        <div style={{ marginBottom: 12 }}>
          <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 4 }}>
            <Txt>
              用户 <Txt strong>{taskStatus?.processed_users}</Txt>/{taskStatus?.total_users}
              {taskStatus?.failed_users > 0 && (
                <Txt type="danger" style={{ fontSize: 11 }}> (失败 {taskStatus.failed_users})</Txt>
              )}
            </Txt>
            <Txt>
              微博 <Txt strong>{taskStatus?.saved_blogs}</Txt>
            </Txt>
            <Txt>
              全文 <Txt strong style={{ color: '#1890ff' }}>{taskStatus?.saved_longtext}</Txt>/{taskStatus?.total_longtext}
            </Txt>
            <Txt type="secondary">{taskStatus?.progress}%</Txt>
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
            <Txt type="secondary">
              上次任务完成：
              用户 <Txt strong>{taskStatus.processed_users}</Txt>
              {taskStatus.failed_users > 0 && (
                <Txt type="danger" style={{ fontSize: 11 }}> (失败 {taskStatus.failed_users})</Txt>
              )}
            </Txt>
            <Txt type="secondary">
              微博 <Txt strong>{taskStatus.saved_blogs}</Txt>
            </Txt>
            <Txt type="secondary">
              全文 <Txt strong style={{ color: '#1890ff' }}>{taskStatus.saved_longtext}</Txt>/{taskStatus.total_longtext}
              {taskStatus.failed_longtext > 0 && (
                <Txt type="danger" style={{ fontSize: 11 }}> (失败 {taskStatus.failed_longtext})</Txt>
              )}
            </Txt>
          </Space>
        </div>
      )}

      {/* 日志 */}
      {taskStatus?.logs && taskStatus.logs.length > 0 && (
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          <Space style={{ marginBottom: 4 }}>
            <Txt type="secondary" style={{ fontSize: 11 }}>
              共 {taskStatus.log_count || taskStatus.logs.length} 条日志
            </Txt>
          </Space>
          <Timeline
            items={taskStatus.logs.slice(-50).map((log, idx) => renderLogItem(log, idx))}
          />
        </div>
      )}

      {(!taskStatus?.logs || taskStatus.logs.length === 0) && (
        <Txt type="secondary" style={{ fontSize: 12 }}>
          {taskStatus?.status === 'idle'
            ? '暂无日志'
            : '等待日志输出...'}
        </Txt>
      )}
    </Card>
  );
};

export default CrawlerLogPanel;
