import { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Space, Tag, Alert, Divider, Table, message, Timeline, Empty } from 'antd';
import { ChromeOutlined, PlayCircleOutlined, StopOutlined, CloudOutlined, FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useWeiboUsers } from '../hooks/useWeiboUsers';
import { crawlerApi } from '../api/crawler';
import dayjs from 'dayjs';
import '../styles/global.scss';

interface CrawlLog {
  id: string;
  uid: string;
  nickname: string;
  time: string;
  success: boolean;
  message: string;
  data_count?: number;
}

const CrawlerMonitor: React.FC = () => {
  const { users, loading: usersLoading, fetchUsers } = useWeiboUsers();
  const [chromeRunning, setChromeRunning] = useState(false);
  const [pageOpen, setPageOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [crawlingUid, setCrawlingUid] = useState<string | null>(null);
  const [crawlLogs, setCrawlLogs] = useState<CrawlLog[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string>('');

  // 活跃用户列表
  const activeUsers = users.filter(u => u.is_active);

  useEffect(() => {
    fetchUsers(0, 100, true);
  }, []);

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

  // 打开微博页面
  const handleOpenWeibo = async () => {
    setLoading(true);
    try {
      const result = await crawlerApi.openBrowser({ url: 'https://weibo.com/' });
      if (result.success) {
        message.success('微博页面已打开');
        setPageOpen(true);
        if (result.url) setCurrentUrl(result.url);
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
        setCurrentUrl('');
      } else {
        message.error(result.error || '关闭失败');
      }
    } catch (e: any) {
      message.error(e.message || '关闭失败');
    } finally {
      setLoading(false);
    }
  };

  // API采集 - 调用 /api/v1/weibo/api
  const handleApiCrawl = async (uid: string, nickname: string) => {
    if (!chromeRunning) {
      message.warning('请先启动 Chrome 浏览器');
      return;
    }

    setCrawlingUid(uid);
    const logId = `${uid}_${Date.now()}`;

    try {
      const result = await crawlerApi.getWeiboApi(uid, 1, 0);

      const newLog: CrawlLog = {
        id: logId,
        uid,
        nickname,
        time: dayjs().format('HH:mm:ss'),
        success: result.success,
        message: result.success ? 'API采集成功' : (result.error || 'API采集失败'),
        data_count: result.saved_count || 0,
      };

      setCrawlLogs(prev => [newLog, ...prev].slice(0, 50));

      if (result.success) {
        message.success(`用户 ${nickname} API采集完成`);
      } else {
        message.error(result.error || 'API采集失败');
      }
    } catch (e: any) {
      const newLog: CrawlLog = {
        id: logId,
        uid,
        nickname,
        time: dayjs().format('HH:mm:ss'),
        success: false,
        message: e.message || 'API采集失败',
      };
      setCrawlLogs(prev => [newLog, ...prev].slice(0, 50));
      message.error(e.message || 'API采集失败');
    } finally {
      setCrawlingUid(null);
    }
  };

  // 浏览器采集 - 调用 /api/v1/browser/open
  const handleBrowserCrawl = async (uid: string, nickname: string) => {
    if (!chromeRunning) {
      message.warning('请先启动 Chrome 浏览器');
      return;
    }

    setCrawlingUid(uid);
    const logId = `${uid}_${Date.now()}`;

    try {
      const profileUrl = `https://weibo.com/u/${uid}`;
      const result = await crawlerApi.openBrowser({ url: profileUrl });

      const newLog: CrawlLog = {
        id: logId,
        uid,
        nickname,
        time: dayjs().format('HH:mm:ss'),
        success: result.success,
        message: result.success ? '浏览器采集成功' : (result.error || '浏览器采集失败'),
      };

      setCrawlLogs(prev => [newLog, ...prev].slice(0, 50));

      if (result.success) {
        message.success(`用户 ${nickname} 浏览器已打开`);
      } else {
        message.error(result.error || '浏览器采集失败');
      }
    } catch (e: any) {
      const newLog: CrawlLog = {
        id: logId,
        uid,
        nickname,
        time: dayjs().format('HH:mm:ss'),
        success: false,
        message: e.message || '浏览器采集失败',
      };
      setCrawlLogs(prev => [newLog, ...prev].slice(0, 50));
      message.error(e.message || '浏览器采集失败');
    } finally {
      setCrawlingUid(null);
    }
  };

  const userColumns: ColumnsType<any> = [
    {
      title: 'UID',
      dataIndex: 'uid',
      key: 'uid',
      width: 120,
      render: (uid: string) => <span className="text-mono" style={{ fontSize: 12 }}>{uid}</span>,
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
      width: 140,
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            loading={crawlingUid === record.uid}
            onClick={() => handleApiCrawl(record.uid, record.nickname)}
          >
            API采集
          </Button>
          <Button
            size="small"
            icon={<ChromeOutlined />}
            loading={crawlingUid === record.uid}
            onClick={() => handleBrowserCrawl(record.uid, record.nickname)}
          >
            浏览器
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <Row gutter={[16, 16]} style={{ padding: '20px 24px 0' }}>
        <Col xs={24} sm={8}>
          <div className={`stats-card ${chromeRunning ? 'stats-success' : ''}`}>
            <div className="stats-title">Chrome 浏览器</div>
            <div className="stats-value" style={{ fontSize: 24 }}>
              {chromeRunning ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              <span style={{ marginLeft: 8 }}>{chromeRunning ? '已启动' : '未启动'}</span>
            </div>
            <ChromeOutlined className="stats-icon" />
          </div>
        </Col>
        <Col xs={24} sm={8}>
          <div className={`stats-card ${pageOpen ? 'stats-success' : ''}`}>
            <div className="stats-title">页面状态</div>
            <div className="stats-value" style={{ fontSize: 24 }}>
              {pageOpen ? <CheckCircleOutlined /> : <StopOutlined />}
              <span style={{ marginLeft: 8 }}>{pageOpen ? '已打开' : '未打开'}</span>
            </div>
            <FileTextOutlined className="stats-icon" />
          </div>
        </Col>
        <Col xs={24} sm={8}>
          <div className="stats-card stats-warning">
            <div className="stats-title">监控用户</div>
            <div className="stats-value">{activeUsers.length}</div>
            <CloudOutlined className="stats-icon" />
          </div>
        </Col>
      </Row>

      {/* 控制栏 */}
      <div className="page-header" style={{ padding: '20px 24px 16px' }}>
        <h3 className="page-title">爬虫控制台</h3>
        <Space>
          <Button
            type="primary"
            icon={<ChromeOutlined />}
            onClick={handleStartChrome}
            loading={loading}
            disabled={chromeRunning}
          >
            启动 Chrome
          </Button>
          <Button
            icon={<FileTextOutlined />}
            onClick={handleOpenWeibo}
            loading={loading}
            disabled={!chromeRunning}
          >
            打开微博
          </Button>
          <Button
            danger
            icon={<StopOutlined />}
            onClick={handleCloseBrowser}
            loading={loading}
            disabled={!chromeRunning}
          >
            关闭浏览器
          </Button>
          <Divider type="vertical" />
        </Space>
      </div>

      {currentUrl && (
        <Alert
          message="当前页面"
          description={currentUrl}
          type="info"
          showIcon
          style={{ margin: '0 24px 16px' }}
          closable
        />
      )}

      {!chromeRunning && (
        <Alert
          message="浏览器未启动"
          description="请先点击「启动 Chrome」按钮启动调试模式浏览器，然后手动登录微博。登录状态会被保存，之后即可使用爬虫功能。"
          type="warning"
          showIcon
          style={{ margin: '0 24px 16px' }}
        />
      )}

      <Row gutter={16} style={{ padding: '0 24px 24px' }}>
        {/* 用户列表 */}
        <Col xs={24} lg={14}>
          <Card
            title="监控用户列表"
            extra={<Tag color="blue">共 {activeUsers.length} 个</Tag>}
            className="data-card"
          >
            <Table
              columns={userColumns}
              dataSource={activeUsers}
              rowKey="uid"
              loading={usersLoading}
              size="small"
              pagination={false}
              scroll={{ y: 300 }}
            />
          </Card>
        </Col>

        {/* 爬取日志 */}
        <Col xs={24} lg={10}>
          <Card
            title="爬取日志"
            extra={<Tag color={crawlLogs.filter(l => l.success).length > 0 ? 'green' : 'default'}>{crawlLogs.filter(l => l.success).length} 成功</Tag>}
            className="data-card"
            bodyStyle={{ maxHeight: 360, overflow: 'auto' }}
          >
            {crawlLogs.length === 0 ? (
              <Empty description="暂无爬取记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Timeline
                items={crawlLogs.map(log => ({
                  color: log.success ? 'green' : 'red',
                  children: (
                    <div key={log.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 500 }}>{log.nickname}</span>
                        <Tag style={{ margin: 0 }}>{log.time}</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: '#888' }}>
                        {log.message}
                        {log.data_count !== undefined && ` · ${log.data_count} 条数据`}
                      </div>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CrawlerMonitor;
