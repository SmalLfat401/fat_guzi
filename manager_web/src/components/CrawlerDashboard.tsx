import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Button, Space, Tag, Progress, Timeline, message, Statistic, Empty, Tooltip, Badge } from 'antd';
import {
  ChromeOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  CloudDownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { crawlerApi } from '../api/crawler';
import type { WeiboCrawlerTaskStatus, CrawlerLogEntry } from '../api/crawler';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import '../styles/global.scss';

dayjs.extend(relativeTime);

// 按类别分组的微博用户（一次性获取全部）
interface CategoryUsers {
  category_id: string;
  category_name: string;
  category_description?: string;
  user_count: number;
  uids: string[];
}

const CrawlerDashboard: React.FC = () => {
  const navigate = useNavigate();
  // 爬虫任务状态
  const [taskStatus, setTaskStatus] = useState<WeiboCrawlerTaskStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);

  // 浏览器状态
  const [chromeRunning, setChromeRunning] = useState(false);
  const [pageOpen, setPageOpen] = useState(false);

  // 类别和分组数据（一次性加载全部）
  const [categoryUsers, setCategoryUsers] = useState<CategoryUsers[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // 初始化加载
  useEffect(() => {
    fetchTaskStatus();
    fetchBrowserStatus();
    fetchCategoryGroups();
  }, []);

  // 定时刷新：任务活跃时高频，完成后降频
  useEffect(() => {
    const active =
      taskStatus?.status === 'running' ||
      taskStatus?.status === 'paused' ||
      taskStatus?.status === 'stopping';
    const interval = setInterval(() => {
      fetchTaskStatus();
      fetchBrowserStatus();
    }, active ? 2000 : 15000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [taskStatus?.status]);

  // 加载爬虫状态
  const fetchTaskStatus = async () => {
    try {
      const status = await crawlerApi.getCrawlerTaskStatus();
      setTaskStatus(status);
    } catch (err) {
      console.error('获取任务状态失败:', err);
    }
  };

  // 加载浏览器状态
  const fetchBrowserStatus = async () => {
    try {
      const status = await crawlerApi.getBrowserStatus();
      setChromeRunning(status.chrome_running);
      setPageOpen(status.page_open);
    } catch (err) {
      console.error('获取浏览器状态失败:', err);
    }
  };

  // 加载类别和分组统计（一次请求搞定）
  const fetchCategoryGroups = async () => {
    setUsersLoading(true);
    try {
      const res = await crawlerApi.getCategoryUsers();
      if (res.success) {
        setCategoryUsers(res.categories);
      }
    } catch (err) {
      console.error('获取分组失败:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  // 启动 Chrome
  const handleStartChrome = async () => {
    setLoading(true);
    try {
      const result = await crawlerApi.startChrome({ profile_dir: 'Default', port: 9222 });
      if (result.success) {
        message.success(result.message || 'Chrome 启动成功');
        setChromeRunning(true);
      } else {
        message.error(result.error || '启动失败');
      }
    } catch (e: any) {
      message.error(e.message || '启动失败');
    } finally {
      setLoading(false);
    }
  };

  // 打开微博
  const handleOpenWeibo = async () => {
    setLoading(true);
    try {
      const result = await crawlerApi.openBrowser({ url: 'https://weibo.com/' });
      if (result.success) {
        message.success('微博页面已打开');
        setPageOpen(true);
      } else {
        message.error(result.error || '打开失败');
      }
    } catch (e: any) {
      message.error(e.message || '打开失败');
    } finally {
      setLoading(false);
    }
  };

  // 关闭浏览器
  const handleCloseBrowser = async () => {
    setLoading(true);
    try {
      const result = await crawlerApi.closeBrowser();
      if (result.success) {
        message.success('浏览器已关闭');
        setChromeRunning(false);
        setPageOpen(false);
      } else {
        message.error(result.error || '关闭失败');
      }
    } catch (e: any) {
      message.error(e.message || '关闭失败');
    } finally {
      setLoading(false);
    }
  };

  // 启动爬虫任务（按类别）
  const handleStartByCategory = async (categoryId: string, mode: 'full' | 'limited' = 'full', maxPosts: number = 0) => {
    setTaskLoading(true);
    try {
      const result = await crawlerApi.startCrawlerByCategory({
        category_id: categoryId,
        mode,
        max_posts: maxPosts,
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

  // 启动全量爬虫
  const handleStartFull = async () => {
    setTaskLoading(true);
    try {
      const result = await crawlerApi.startCrawlerTask({ mode: 'full' });
      if (result.success) {
        message.success(result.message || '全量爬虫任务已启动');
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

  // 启动限量爬虫
  const handleStartLimited = async (maxPosts: number = 5) => {
    setTaskLoading(true);
    try {
      const result = await crawlerApi.startCrawlerTask({ mode: 'limited', max_posts: maxPosts });
      if (result.success) {
        message.success(result.message || '限量爬虫任务已启动');
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

  // 暂停任务
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

  // 恢复任务
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

  // 停止任务
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

  // 任务状态
  const isRunning = taskStatus?.status === 'running';
  const isPaused = taskStatus?.status === 'paused';
  const isCompleted = taskStatus?.status === 'completed';
  const isFailed = taskStatus?.status === 'failed';
  const isIdle = taskStatus?.status === 'idle' || !taskStatus;
  const isTaskActive = isRunning || isPaused;
  const isTaskDone = isCompleted || isFailed;

  // 渲染任务卡片
  const renderTaskCard = () => (
    <Card
      size="small"
      title={
        <Space>
          <CloudDownloadOutlined />
          <span>自动爬虫任务</span>
          {taskStatus && (
            <Tag color={isRunning ? 'processing' : isPaused ? 'warning' : isCompleted ? 'success' : isFailed ? 'error' : 'default'}>
              {isRunning ? '运行中' : isPaused ? '已暂停' : isCompleted ? '已完成' : isFailed ? '失败' : '空闲'}
            </Tag>
          )}
        </Space>
      }
      extra={
        <Space>
          <Tooltip title="刷新状态">
            <Button size="small" icon={<ReloadOutlined />} onClick={fetchTaskStatus} />
          </Tooltip>
        </Space>
      }
    >
      {/* 进度信息 */}
      {taskStatus && (isTaskActive || isTaskDone) && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>
              已处理 {taskStatus.processed_users} / {taskStatus.total_users} 个用户
            </span>
            <span>{taskStatus.progress.toFixed(1)}%</span>
          </div>
          <Progress
            percent={taskStatus.progress}
            size="small"
            status={isRunning ? 'active' : isCompleted ? 'success' : isFailed ? 'exception' : 'normal'}
            strokeColor={isRunning ? '#1890ff' : isCompleted ? '#52c41a' : '#faad14'}
          />
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#666' }}>
            <span>
              <ClockCircleOutlined /> 等待全文: {taskStatus.total_longtext}
            </span>
            <span>
              <CheckCircleOutlined /> 已完成全文: {taskStatus.saved_longtext}
            </span>
            {taskStatus.started_at && (
              <span>
                <ClockCircleOutlined /> 开始于: {dayjs(taskStatus.started_at).fromNow()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 控制按钮 */}
      <Space wrap>
        {isIdle && (
          <>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleStartFull}
              loading={taskLoading}
              disabled={!chromeRunning}
              size="small"
            >
              全量爬取
            </Button>
            <Button
              icon={<PlayCircleOutlined />}
              onClick={() => handleStartLimited(5)}
              loading={taskLoading}
              disabled={!chromeRunning}
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
        {(isPaused || taskStatus?.status === 'stopping') && (
          <>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleResume}
              loading={taskLoading}
              disabled={taskStatus?.status === 'stopping'}
              size="small"
            >
              {taskStatus?.status === 'stopping' ? '停止中...' : '恢复'}
            </Button>
            <Button
              danger
              icon={<StopOutlined />}
              onClick={handleStop}
              loading={taskLoading}
              disabled={taskStatus?.status === 'stopping'}
              size="small"
            >
              停止
            </Button>
          </>
        )}
      </Space>

      {/* 模式标签 */}
      {taskStatus && taskStatus.mode && (
        <div style={{ marginTop: 8 }}>
          <Tag color="blue">
            模式: {taskStatus.mode === 'full' ? '全量' : taskStatus.mode === 'limited' ? '限量' : '指定'}
          </Tag>
          {taskStatus.max_posts > 0 && <Tag>每用户 {taskStatus.max_posts} 条</Tag>}
          {taskStatus.target_uids && taskStatus.target_uids.length > 0 && (
            <Tag>指定 {taskStatus.target_uids.length} 个用户</Tag>
          )}
        </div>
      )}
    </Card>
  );

  // 渲染浏览器卡片
  const renderBrowserCard = () => (
    <Card
      size="small"
      title={
        <Space>
          <ChromeOutlined />
          <span>浏览器控制</span>
        </Space>
      }
      extra={
        <Space>
          <Badge status={chromeRunning ? 'success' : 'default'} text={chromeRunning ? 'Chrome 运行中' : 'Chrome 未启动'} />
          {pageOpen && <Badge status="processing" text="微博已打开" />}
        </Space>
      }
    >
      <Space wrap>
        <Button
          icon={<PlayCircleOutlined />}
          onClick={handleStartChrome}
          loading={loading}
          disabled={chromeRunning}
          size="small"
        >
          启动 Chrome
        </Button>
        <Button
          icon={<ChromeOutlined />}
          onClick={handleOpenWeibo}
          loading={loading}
          disabled={!chromeRunning}
          size="small"
        >
          打开微博
        </Button>
        <Button
          danger
          icon={<CloseCircleOutlined />}
          onClick={handleCloseBrowser}
          loading={loading}
          disabled={!chromeRunning}
          size="small"
        >
          关闭
        </Button>
      </Space>
    </Card>
  );

  // 渲染日志卡片
  const renderLogCard = () => {
    const logs = taskStatus?.logs || [];
    return (
      <Card
        size="small"
        title={
          <Space>
            <ClockCircleOutlined />
            <span>任务日志</span>
            {logs.length > 0 && <Tag color="blue">{logs.length}</Tag>}
          </Space>
        }
        bodyStyle={{ maxHeight: 280, overflow: 'auto' }}
      >
        {logs.length === 0 ? (
          <Empty description="暂无日志" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Timeline
            items={logs.slice(0, 20).map((log: CrawlerLogEntry, idx: number) => ({
              color: log.success ? 'green' : 'red',
              children: (
                <div key={idx} style={{ fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={4}>
                      <UserOutlined />
                      <strong>{log.nickname || '系统'}</strong>
                      <Tag color={log.action === 'start' ? 'blue' : log.action === 'stopped' ? 'red' : 'default'} style={{ margin: 0 }}>
                        {log.action}
                      </Tag>
                    </Space>
                    <span style={{ color: '#888' }}>{dayjs(log.timestamp).format('HH:mm:ss')}</span>
                  </div>
                  <div style={{ color: log.success ? '#333' : '#d46b08', marginTop: 2 }}>
                    {log.message}
                  </div>
                </div>
              ),
            }))}
          />
        )}
      </Card>
    );
  };

  // 渲染按类别分组的爬虫卡片
  const renderCategoryCards = () => (
    <Row gutter={[16, 16]}>
      {categoryUsers.map((group) => (
        <Col xs={24} sm={12} md={8} lg={6} key={group.category_id}>
          <Card
            size="small"
            hoverable
            onClick={() => navigate(`/crawler/category/${group.category_id}`)}
            title={
              <Space>
                <Tag color="blue">{group.category_name}</Tag>
              </Space>
            }
            extra={
              <Space size={4}>
                <UserOutlined />
                <span>{group.user_count}</span>
              </Space>
            }
            actions={[
              <Tooltip title="全量爬取此类别" key="full">
                <Button
                  type="text"
                  size="small"
                  icon={<CloudDownloadOutlined />}
                  onClick={(e) => { e.stopPropagation(); handleStartByCategory(group.category_id, 'full'); }}
                  loading={taskLoading}
                  disabled={!chromeRunning || isTaskActive}
                />
              </Tooltip>,
              <Tooltip title="限量测试 (5条/用户)" key="limited">
                <Button
                  type="text"
                  size="small"
                  icon={<PlayCircleOutlined />}
                  onClick={(e) => { e.stopPropagation(); handleStartByCategory(group.category_id, 'limited', 5); }}
                  loading={taskLoading}
                  disabled={!chromeRunning || isTaskActive}
                />
              </Tooltip>,
              <Tooltip title="查看用户列表" key="view">
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={(e) => { e.stopPropagation(); window.open(`/weibo-users?category=${group.category_id}`, '_blank'); }}
                />
              </Tooltip>,
            ]}
          >
            <Statistic
              title="监控用户"
              value={group.user_count}
              valueStyle={{ fontSize: 20 }}
              suffix="个"
            />
            {group.category_description && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                {group.category_description}
              </div>
            )}
          </Card>
        </Col>
      ))}
    </Row>
  );

  return (
    <div className="fade-in">
      {/* 顶部状态卡片 */}
      <Row gutter={[16, 16]} style={{ padding: '20px 24px 0' }}>
        <Col xs={12} sm={6}>
          <div className={`stats-card ${chromeRunning ? 'stats-success' : ''}`}>
            <div className="stats-title">Chrome 浏览器</div>
            <div className="stats-value" style={{ fontSize: 20 }}>
              {chromeRunning ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              <span style={{ marginLeft: 8, fontSize: 14 }}>
                {chromeRunning ? '已启动' : '未启动'}
              </span>
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className={`stats-card ${pageOpen ? 'stats-success' : ''}`}>
            <div className="stats-title">微博页面</div>
            <div className="stats-value" style={{ fontSize: 20 }}>
              {pageOpen ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              <span style={{ marginLeft: 8, fontSize: 14 }}>
                {pageOpen ? '已打开' : '未打开'}
              </span>
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className={`stats-card ${isRunning ? 'stats-success' : ''}`}>
            <div className="stats-title">任务状态</div>
            <div className="stats-value" style={{ fontSize: 20 }}>
              {isRunning ? <PlayCircleOutlined /> : isPaused ? <PauseCircleOutlined /> : <StopOutlined />}
              <span style={{ marginLeft: 8, fontSize: 14 }}>
                {isRunning ? '运行中' : isPaused ? '已暂停' : '空闲'}
              </span>
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stats-card stats-info">
            <div className="stats-title">总分类数</div>
            <div className="stats-value">{categoryUsers.length}</div>
          </div>
        </Col>
      </Row>

      {/* 浏览器控制 + 任务状态 */}
      <Row gutter={[16, 16]} style={{ padding: '16px 24px 0' }}>
        <Col xs={24} lg={10}>
          {renderBrowserCard()}
        </Col>
        <Col xs={24} lg={14}>
          {renderTaskCard()}
        </Col>
      </Row>

      {/* 分类爬虫卡片 */}
      <div style={{ padding: '16px 24px 0' }}>
        <div className="page-header" style={{ paddingBottom: 12 }}>
          <h3 className="page-title">按类别爬取</h3>
          <Space>
            <Button
              type="primary"
              icon={<CloudDownloadOutlined />}
              onClick={handleStartFull}
              loading={taskLoading}
              disabled={!chromeRunning || isRunning}
            >
              全量爬取全部
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchCategoryGroups}
              loading={usersLoading}
            >
              刷新分类
            </Button>
          </Space>
        </div>
        {renderCategoryCards()}
      </div>

      {/* 任务日志 */}
      <div style={{ padding: '16px 24px 24px' }}>
        {renderLogCard()}
      </div>
    </div>
  );
};

export default CrawlerDashboard;
