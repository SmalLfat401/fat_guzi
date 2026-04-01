import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Modal, Alert, Radio, Space, Row, Col, Tag, Card, Timeline, Input, Select } from 'antd';
import { ExclamationCircleOutlined, UserOutlined, CheckCircleOutlined, StopOutlined, LinkOutlined, UserAddOutlined, FileTextOutlined, ChromeOutlined, CloudDownloadOutlined, PlayCircleOutlined, CloseCircleOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { WeiboUser, WeiboUserCreate, WeiboUserUpdate } from '../types/weibo';
import { useWeiboUsers } from '../hooks/useWeiboUsers';
import WeiboUserModal from './WeiboUserModal';
import { WeiboCrawlerPanel } from './WeiboCrawlerPanel';
import { Table, Button, Switch, Tooltip } from 'antd';
import { categoryApi } from '../api/category';
import type { Category } from '../api/category';
import { crawlerApi } from '../api/crawler';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import '../styles/global.scss';

dayjs.locale('zh-cn');

interface CrawlLog {
  id: string;
  uid: string;
  nickname: string;
  time: string;
  success: boolean;
  message: string;
  data_count?: number;
}

const WeiboUserTable: React.FC = () => {
  const { users, loading, error, total, fetchUsers, createUser, updateUser, deleteUser } = useWeiboUsers();
  const navigate = useNavigate();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<WeiboUser | null>(null);
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | undefined>(undefined);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statsTotal, setStatsTotal] = useState(0);
  const [statsActive, setStatsActive] = useState(0);
  const [statsInactive, setStatsInactive] = useState(0);
  
  // 爬虫状态
  const [chromeRunning, setChromeRunning] = useState(false);
  const [pageOpen, setPageOpen] = useState(false);
  const [crawlerLoading, setCrawlerLoading] = useState(false);
  const [crawlingUid, setCrawlingUid] = useState<string | null>(null);
  const [crawlLogs, setCrawlLogs] = useState<CrawlLog[]>([]);

  const [pageInfo, setPageInfo] = useState({ page: 1, pageSize: 20 });
  const [nicknameSearch, setNicknameSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchUsers(
      (pageInfo.page - 1) * pageInfo.pageSize,
      pageInfo.pageSize,
      isActiveFilter,
      nicknameSearch || undefined,
      categoryFilter.length > 0 ? categoryFilter : undefined
    );
  }, [isActiveFilter, pageInfo, nicknameSearch, categoryFilter]);

  // 加载统计数据
  const fetchStats = async () => {
    try {
      const { weiboUserApi } = await import('../api/weiboUser');
      const stats = await weiboUserApi.getUserStats();
      setStatsTotal(stats.total);
      setStatsActive(stats.active);
      setStatsInactive(stats.inactive);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  // 加载浏览器状态
  const fetchBrowserStatus = async () => {
    try {
      const status = await crawlerApi.getBrowserStatus();
      setChromeRunning(status.chrome_running);
      setPageOpen(status.page_open);
    } catch (err) {
      console.error('Failed to fetch browser status:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchBrowserStatus();
  }, []);

  // 加载分类数据
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await categoryApi.getCategories(0, 100);
        setCategories(data);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    };
    fetchCategories();
  }, []);

  // 根据分类ID获取分类名称
  const getCategoryNames = (categoryIds: string[] = []) => {
    return categoryIds.map(id => {
      const cat = categories.find(c => c._id === id);
      return cat ? cat.name : id;
    });
  };

  const activeCount = statsActive;
  const inactiveCount = statsInactive;

  const handleCreate = () => {
    setEditingUser(null);
    setModalVisible(true);
  };

  const handleEdit = (user: WeiboUser) => {
    setEditingUser(user);
    setModalVisible(true);
  };

  const handleDelete = (uid: string) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除用户 ${uid} 吗？此操作不可恢复。`,
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        const fetchParams = {
          skip: (pageInfo.page - 1) * pageInfo.pageSize,
          limit: pageInfo.pageSize,
          isActive: isActiveFilter,
          nickname: nicknameSearch || undefined,
          categoryIds: categoryFilter.length > 0 ? categoryFilter : undefined,
        };
        const success = await deleteUser(uid, fetchParams);
        if (success) {
          message.success('删除成功');
          fetchStats();
        } else {
          message.error('删除失败');
        }
      },
    });
  };

  const handleStatusChange = async (uid: string, checked: boolean) => {
    const success = await updateUser(uid, { is_active: checked });
    if (success) {
      message.success(checked ? '已启用监控' : '已禁用监控');
      fetchStats();
    } else {
      message.error('状态更新失败');
    }
  };

  const handleModalOk = async (values: WeiboUserCreate | WeiboUserUpdate) => {
    const fetchParams = {
      skip: (pageInfo.page - 1) * pageInfo.pageSize,
      limit: pageInfo.pageSize,
      isActive: isActiveFilter,
      nickname: nicknameSearch || undefined,
      categoryIds: categoryFilter.length > 0 ? categoryFilter : undefined,
    };

    let success: boolean;
    if (editingUser) {
      success = await updateUser(editingUser.uid, values as WeiboUserUpdate, fetchParams);
      if (success) {
        message.success('更新成功');
        fetchStats();
      }
    } else {
      success = await createUser(values as WeiboUserCreate, fetchParams);
      if (success) {
        message.success('创建成功');
        fetchStats();
      }
    }
    if (success) setModalVisible(false);
  };

  const handleFilterChange = (e: any) => {
    const value = e.target.value;
    if (value === 'all') setIsActiveFilter(undefined);
    else if (value === 'active') setIsActiveFilter(true);
    else setIsActiveFilter(false);
    setPageInfo({ ...pageInfo, page: 1 });
  };

  // 昵称搜索（防抖）
  const handleNicknameSearch = (value: string) => {
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      setNicknameSearch(value);
      setPageInfo({ ...pageInfo, page: 1 });
    }, 300);
    setSearchTimer(timer);
  };

  // 标签过滤变化
  const handleCategoryFilterChange = (values: string[]) => {
    setCategoryFilter(values);
    setPageInfo({ ...pageInfo, page: 1 });
  };

  // 启动 Chrome
  const handleStartChrome = async () => {
    setCrawlerLoading(true);
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
      setCrawlerLoading(false);
    }
  };

  // 打开微博页面
  const handleOpenWeibo = async () => {
    setCrawlerLoading(true);
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
      setCrawlerLoading(false);
    }
  };

  // 关闭浏览器
  const handleCloseBrowser = async () => {
    setCrawlerLoading(true);
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
      setCrawlerLoading(false);
    }
  };

  // API采集
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
        data_count: result.data?.data?.list?.length || 0,
      };

      setCrawlLogs(prev => [newLog, ...prev].slice(0, 50));

      if (result.success) {
        message.success(`用户 ${nickname} API采集完成`);
      } else {
        // 检测登录过期
        if ((result as any).need_login) {
          Modal.warning({
            title: '登录已过期',
            content: '浏览器登录状态已失效，请重新在浏览器中登录微博后重试',
          });
        } else {
          message.error(result.error || 'API采集失败');
        }
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

  const columns: ColumnsType<WeiboUser> = [
    {
      title: 'UID',
      dataIndex: 'uid',
      key: 'uid',
      width: 140,
      fixed: 'left',
      render: (uid: string) => <span className="text-mono" style={{ fontSize: 13 }}>{uid}</span>,
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
      width: 150,
      render: (nickname: string) => <span style={{ fontWeight: 500 }}>{nickname}</span>,
    },
    {
      title: '主页',
      dataIndex: 'profile_url',
      key: 'profile_url',
      width: 100,
      render: (url: string) => (
        <Tooltip title={url}>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <LinkOutlined /> 访问
          </a>
        </Tooltip>
      ),
    },
    {
      title: '粉丝数',
      dataIndex: 'followers_count',
      key: 'followers_count',
      width: 100,
      align: 'right',
      render: (count: number | null) => count ? count.toLocaleString() : '-',
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean, record: WeiboUser) => (
        <Switch
          checked={isActive}
          onChange={(checked) => handleStatusChange(record.uid, checked)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          size="small"
        />
      ),
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      width: 160,
      ellipsis: true,
      render: (notes: string) => notes || '-',
    },
    {
      title: '标签',
      dataIndex: 'categories',
      key: 'categories',
      width: 200,
      render: (categories: string[] = []) => (
        <Space wrap size={2}>
          {categories.length > 0 ? (
            getCategoryNames(categories).map((name, idx) => (
              <Tag key={idx} color="blue">{name}</Tag>
            ))
          ) : (
            <span style={{ color: '#666' }}>-</span>
          )}
        </Space>
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
      width: 280,
      fixed: 'right',
      render: (_: unknown, record: WeiboUser) => (
        <Space size="small">
          <Button 
            type="primary" 
            size="small" 
            icon={<CloudDownloadOutlined />}
            loading={crawlingUid === record.uid}
            onClick={() => handleApiCrawl(record.uid, record.nickname)}
            disabled={!chromeRunning}
          >
            抓取
          </Button>
          <Button 
            type="link" 
            size="small" 
            icon={<FileTextOutlined />}
            onClick={() => navigate(`/weibo-users/${record.uid}/posts?userIdstr=${record.uid}&nickname=${encodeURIComponent(record.nickname)}`)}
          >
            微博
          </Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(record.uid)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="fade-in">
      {/* 浏览器控制 + 自动爬虫任务 并排 */}
      <Row gutter={[16, 16]} style={{ margin: '16px 24px 0' }} align="stretch">
        {/* 浏览器控制 */}
        <Col xs={24} md={12}>
          <Card
            size="small"
            style={{ height: '100%' }}
            title={<><ChromeOutlined /> 浏览器控制</>}
            extra={
              <Space>
                <Tag color={chromeRunning ? 'success' : 'default'}>
                  {chromeRunning ? 'Chrome 运行中' : 'Chrome 未启动'}
                </Tag>
                <Tag color={pageOpen ? 'processing' : 'default'}>
                  {pageOpen ? '微博已打开' : '微博未打开'}
                </Tag>
              </Space>
            }
          >
            <Space style={{ marginBottom: 12 }}>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={crawlerLoading}
                onClick={handleStartChrome}
                disabled={chromeRunning}
              >
                启动Chrome
              </Button>
              <Button
                icon={<CloudDownloadOutlined />}
                loading={crawlerLoading}
                onClick={handleOpenWeibo}
                disabled={!chromeRunning}
              >
                打开微博
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                loading={crawlerLoading}
                onClick={handleCloseBrowser}
                disabled={!chromeRunning}
              >
                关闭
              </Button>
            </Space>
          </Card>
        </Col>

        {/* 自动爬虫任务 */}
        <Col xs={24} md={12}>
          <WeiboCrawlerPanel />
        </Col>
      </Row>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ padding: '20px 24px 0' }}>
        <Col xs={24} sm={8}>
          <div className="stats-card">
            <div className="stats-title">总用户数</div>
            <div className="stats-value">{statsTotal}</div>
            <UserOutlined className="stats-icon" />
          </div>
        </Col>
        <Col xs={24} sm={8}>
          <div className="stats-card stats-success">
            <div className="stats-title">启用监控</div>
            <div className="stats-value">{activeCount}</div>
            <CheckCircleOutlined className="stats-icon" />
          </div>
        </Col>
        <Col xs={24} sm={8}>
          <div className="stats-card stats-warning">
            <div className="stats-title">已禁用</div>
            <div className="stats-value">{inactiveCount}</div>
            <StopOutlined className="stats-icon" />
          </div>
        </Col>
      </Row>

      {/* 标题和操作栏 */}
      <div className="page-header" style={{ padding: '20px 24px 16px' }}>
        <h3 className="page-title">微博用户列表</h3>
        <Space wrap>
          <Input.Search
            placeholder="搜索用户名"
            allowClear
            prefix={<SearchOutlined />}
            style={{ width: 160 }}
            onSearch={handleNicknameSearch}
            onChange={(e) => handleNicknameSearch(e.target.value)}
          />
          <Select
            mode="multiple"
            placeholder="标签过滤"
            allowClear
            style={{ minWidth: 160, maxWidth: 240 }}
            showSearch
            filterOption={(input, option) =>
              (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={categories.map(cat => ({
              value: cat._id,
              label: cat.name,
            }))}
            onChange={handleCategoryFilterChange}
            maxTagCount={2}
          />
          <Radio.Group onChange={handleFilterChange} defaultValue="all" size="small">
            <Radio.Button value="all">全部</Radio.Button>
            <Radio.Button value="active">已启用</Radio.Button>
            <Radio.Button value="inactive">已禁用</Radio.Button>
          </Radio.Group>
          <Button type="primary" className="btn-primary" icon={<UserAddOutlined />} onClick={handleCreate}>
            添加用户
          </Button>
        </Space>
      </div>

      {error && <Alert message={error} type="error" showIcon style={{ margin: '0 24px 16px' }} closable />}

      {/* 表格 */}
      <div style={{ padding: '0 24px 24px' }} className="data-table">
        <Table
          columns={columns}
          dataSource={users}
          rowKey="uid"
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
            onChange: (page, pageSize) => setPageInfo({ page, pageSize: pageSize || 20 })
          }}
          size="small"
        />
      </div>

      {/* 抓取日志 */}
      {crawlLogs.length > 0 && (
        <Card 
          size="small" 
          style={{ margin: '0 24px 24px' }}
          title="抓取日志"
        >
          <Timeline
            items={crawlLogs.slice(0, 10).map(log => ({
              color: log.success ? 'green' : 'red',
              children: (
                <div>
                  <span style={{ color: '#888' }}>{log.time}</span>
                  {' '}
                  <strong>{log.nickname}</strong>
                  {' '}
                  <span>{log.message}</span>
                  {log.data_count !== undefined && (
                    <Tag color={log.success ? 'green' : 'red'} style={{ marginLeft: 8 }}>
                      {log.data_count} 条
                    </Tag>
                  )}
                </div>
              ),
            }))}
          />
        </Card>
      )}

      <WeiboUserModal
        visible={modalVisible}
        user={editingUser}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
      />
    </div>
  );
};

export default WeiboUserTable;
