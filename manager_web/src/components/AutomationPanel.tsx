import { Button, Tooltip } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  StopOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudDownloadOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { CrawlerTaskStatus } from '../api/crawler';


type CrawlerMode = 'full' | 'limited' | 'specific' | 'category';

interface Category {
  _id: string;
  name: string;
  description?: string;
}

interface AutomationPanelProps {
  taskStatus: CrawlerTaskStatus | null;
  mode: CrawlerMode;
  limitedCount: number;
  targetUids: string[];
  users: Array<{ nickname: string; uid: string }>;
  actionLoading: string | null;
  onModeChange: (mode: CrawlerMode) => void;
  onLimitedCountChange: (count: number) => void;
  onTargetUidsChange: (uids: string[]) => void;
  onSelectCategory: (categoryId: string | null) => void;
  selectedCategory: string | null;
  categories: Category[];
  onAction: (action: 'start' | 'pause' | 'resume' | 'stop' | 'force_stop') => void;
}

const MODE_OPTIONS: Array<{
  value: CrawlerMode;
  label: string;
  desc: string;
  icon: React.ReactNode;
}> = [
  { value: 'full', label: '全量', desc: '更新全部用户', icon: <CloudDownloadOutlined /> },
  { value: 'limited', label: '限量', desc: '每用户限 N 条', icon: <FileTextOutlined /> },
  { value: 'specific', label: '指定', desc: '手动选择用户', icon: <CheckCircleOutlined /> },
  { value: 'category', label: '类别', desc: '按标签批量', icon: <ThunderboltOutlined /> },
];

const STATUS_CONFIG: Record<string, { color: string; label: string; textColor: string }> = {
  idle: { color: 'rgba(255,255,255,0.1)', label: '空闲', textColor: '#9ca3af' },
  running: { color: 'rgba(0,240,255,0.15)', label: '运行中', textColor: '#00f0ff' },
  paused: { color: 'rgba(250,173,20,0.15)', label: '已暂停', textColor: '#faad14' },
  stopping: { color: 'rgba(255,77,79,0.15)', label: '停止中', textColor: '#ff4d4f' },
  completed: { color: 'rgba(82,196,26,0.15)', label: '已完成', textColor: '#52c41a' },
  failed: { color: 'rgba(255,77,79,0.15)', label: '失败', textColor: '#ff4d4f' },
};

const AutomationPanel: React.FC<AutomationPanelProps> = ({
  taskStatus,
  mode,
  limitedCount,
  targetUids,
  users,
  actionLoading,
  onModeChange,
  onLimitedCountChange,
  onTargetUidsChange,
  onSelectCategory,
  selectedCategory,
  categories,
  onAction,
}) => {
  const statusCfg = taskStatus
    ? STATUS_CONFIG[taskStatus.status] || STATUS_CONFIG.idle
    : STATUS_CONFIG.idle;

  const canStart = !taskStatus
    || taskStatus.status === 'idle'
    || taskStatus.status === 'completed'
    || taskStatus.status === 'failed';

  const isTaskRunning = taskStatus?.status === 'running'
    || taskStatus?.status === 'paused'
    || taskStatus?.status === 'stopping';

  const userOptions = users.map(u => ({ label: u.nickname, value: u.uid }));
  const categoryOptions = categories.map(c => ({ label: c.name, value: c._id }));

  const startDisabled =
    (mode === 'specific' && targetUids.length === 0) ||
    (mode === 'category' && !selectedCategory);

  const selectedMode = MODE_OPTIONS.find(m => m.value === mode)!;

  // 渲染辅助配置
  const renderModeConfig = () => {
    if (mode === 'limited') {
      return (
        <div className="mode-config-inline">
          <span className="mode-config-label">每用户抓取</span>
          <input
            type="number"
            className="mode-config-input"
            min={1}
            max={50}
            value={limitedCount}
            disabled={isTaskRunning}
            onChange={e => onLimitedCountChange(parseInt(e.target.value) || 5)}
          />
          <span className="mode-config-label">条</span>
        </div>
      );
    }
    if (mode === 'specific') {
      return (
        <div className="mode-config-inline">
          <select
            className="mode-config-select"
            multiple
            disabled={isTaskRunning}
            value={targetUids}
            onChange={e => onTargetUidsChange(Array.from(e.target.selectedOptions, o => o.value))}
          >
            {userOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {targetUids.length > 0 && (
            <span className="mode-config-label">{targetUids.length} 个用户</span>
          )}
        </div>
      );
    }
    if (mode === 'category') {
      return (
        <div className="mode-config-inline">
          <select
            className="mode-config-select-single"
            disabled={isTaskRunning}
            value={selectedCategory || ''}
            onChange={e => onSelectCategory(e.target.value || null)}
          >
            <option value="">全部类别</option>
            {categoryOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {selectedCategory && (
            <span className="mode-config-label">
              {categories.find(c => c._id === selectedCategory)?.name}
            </span>
          )}
        </div>
      );
    }
    return (
      <span className="mode-config-desc">{selectedMode.desc}</span>
    );
  };

  // 渲染右侧状态指示器
  const renderStatusIndicators = () => {
    if (!taskStatus || !isTaskRunning) return null;

    const items = [
      { icon: <CloudDownloadOutlined />, label: '微博', value: taskStatus.saved_blogs, color: '#00f0ff' },
      { icon: <FileTextOutlined />, label: '全文', value: taskStatus.saved_longtext, total: taskStatus.total_longtext, color: '#52c41a' },
      { icon: <CheckCircleOutlined />, label: '完成', value: taskStatus.processed_users, total: taskStatus.total_users, color: '#9c27b0' },
    ];

    return (
      <div className="status-indicators">
        {items.map((item, i) => (
          <div key={i} className="status-indicator-item">
            <span className="status-indicator-icon" style={{ color: item.color }}>{item.icon}</span>
            <span className="status-indicator-value" style={{ color: item.color }}>
              {item.value}
              {item.total !== undefined && <span className="status-indicator-total">/{item.total}</span>}
            </span>
            <span className="status-indicator-label">{item.label}</span>
          </div>
        ))}
      </div>
    );
  };

  // 渲染主按钮
  const renderMainAction = () => {
    if (taskStatus?.status === 'running') {
      return (
        <div className="action-row">
          <Button
            size="large"
            icon={<PauseCircleOutlined />}
            loading={actionLoading === 'pause'}
            onClick={() => onAction('pause')}
            className="btn-pause"
          >
            暂停
          </Button>
          <Button
            size="large"
            danger
            icon={<StopOutlined />}
            loading={actionLoading === 'stop'}
            onClick={() => onAction('stop')}
            className="btn-stop"
          >
            停止
          </Button>
        </div>
      );
    }
    if (taskStatus?.status === 'paused') {
      return (
        <div className="action-row">
          <Button
            size="large"
            type="primary"
            icon={<ReloadOutlined />}
            loading={actionLoading === 'resume'}
            onClick={() => onAction('resume')}
            className="btn-resume"
          >
            继续任务
          </Button>
          <Button
            size="large"
            danger
            icon={<StopOutlined />}
            loading={actionLoading === 'stop'}
            onClick={() => onAction('stop')}
            className="btn-stop"
          >
            停止
          </Button>
        </div>
      );
    }
    if (taskStatus?.status === 'stopping') {
      return (
        <div className="action-row">
          <div className="stopping-indicator">
            <span className="stopping-dot" />
            <span className="stopping-text">正在停止...</span>
          </div>
          <Button
            size="large"
            danger
            icon={<StopOutlined />}
            onClick={() => onAction('force_stop')}
            className="btn-force-stop"
          >
            强制停止
          </Button>
        </div>
      );
    }
    if (canStart) {
      return (
        <div className="action-row">
          <Button
            size="large"
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={actionLoading === 'start'}
            onClick={() => onAction('start')}
            disabled={startDisabled}
            className="btn-start"
          >
            开始任务
          </Button>
        </div>
      );
    }
    return null;
  };

  // 渲染进度条
  const renderProgress = () => {
    if (!taskStatus || !isTaskRunning) return null;

    const progress = taskStatus.progress || 0;
    const isPaused = taskStatus.status === 'paused';

    return (
      <div className="progress-section">
        <div className="progress-header">
          <span className="progress-label">用户进度</span>
          <span className="progress-stats">
            {taskStatus.processed_users} / {taskStatus.total_users}
            <span className="progress-pct"> · {progress.toFixed(1)}%</span>
          </span>
        </div>
        <div className="progress-track">
          <div
            className={`progress-fill ${isPaused ? 'paused' : 'running'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="automation-panel">
      {/* 顶部状态栏 */}
      <div className="ap-header">
        <div className="ap-title">
          <ThunderboltOutlined className="ap-title-icon" />
          <span>自动化控制</span>
        </div>
        <div className="ap-header-right">
          <div className="ap-status-badge" style={{ color: statusCfg.textColor, borderColor: statusCfg.color }}>
            <span className="ap-status-dot" style={{ background: statusCfg.textColor }} />
            {statusCfg.label}
          </div>
          {taskStatus?.started_at && (
            <div className="ap-start-time">
              <ClockCircleOutlined />
              {new Date(taskStatus.started_at).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
          )}
        </div>
      </div>

      {/* 主内容区：模式选择 + 动作 */}
      <div className="ap-body">
        {/* 左侧：模式选择 */}
        <div className="ap-modes">
          {MODE_OPTIONS.map(opt => {
            const active = mode === opt.value;
            return (
              <Tooltip key={opt.value} title={opt.desc} placement="top">
                <button
                  className={`mode-btn ${active ? 'active' : ''}`}
                  disabled={isTaskRunning}
                  onClick={() => onModeChange(opt.value)}
                >
                  <span className="mode-btn-icon">{opt.icon}</span>
                  <span className="mode-btn-label">{opt.label}</span>
                </button>
              </Tooltip>
            );
          })}
          <div className="mode-config-area">
            {renderModeConfig()}
          </div>
        </div>

        {/* 右侧：操作区 + 状态指示 */}
        <div className="ap-action-area">
          {isTaskRunning && taskStatus ? (
            <div className="ap-live-stats">
              {renderStatusIndicators()}
            </div>
          ) : null}
          {renderMainAction()}
        </div>
      </div>

      {/* 进度条 */}
      {renderProgress()}
    </div>
  );
};

export default AutomationPanel;
