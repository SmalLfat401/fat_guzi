import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Modal, Alert, Radio, Space, Row, Col, Tag, Card, Input, Select, Table, Button, Switch, Tooltip } from 'antd';
import { ExclamationCircleOutlined, UserOutlined, CheckCircleOutlined, StopOutlined, LinkOutlined, UserAddOutlined, FileTextOutlined, ChromeOutlined, CloudDownloadOutlined, PlayCircleOutlined, CloseCircleOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { WeiboUser, WeiboUserCreate, WeiboUserUpdate } from '../types/weibo';
import { useWeiboUsers } from '../hooks/useWeiboUsers';
import WeiboUserModal from './WeiboUserModal';
import AutomationPanel from './AutomationPanel';
import CrawlerLogPanel from './CrawlerLogPanel';
import { categoryApi } from '../api/category';
import type { Category } from '../api/category';
import { crawlerApi } from '../api/crawler';
import type { CrawlerTaskStatus } from '../api/crawler';
import dayjs from 'dayjs';

type CrawlerMode = 'full' | 'limited' | 'specific';
import 'dayjs/locale/zh-cn';
import '../styles/global.scss';

dayjs.locale('zh-cn');

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

  const [chromeRunning, setChromeRunning] = useState(false);
  const [pageOpen, setPageOpen] = useState(false);
  const [crawlerLoading, setCrawlerLoading] = useState(false);
  const [crawlingUid, setCrawlingUid] = useState<string | null>(null);

  const [pageInfo, setPageInfo] = useState({ page: 1, pageSize: 20 });
  const [nicknameSearch, setNicknameSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // 爬虫任务状态
  const [taskStatus, setTaskStatus] = useState<CrawlerTaskStatus | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [mode, setMode] = useState<CrawlerMode>('full');
  const [limitedCount, setLimitedCount] = useState<number>(5);
  const [targetUids, setTargetUids] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers(
      (pageInfo.page - 1) * pageInfo.pageSize,
      pageInfo.pageSize,
      isActiveFilter,
      nicknameSearch || undefined,
      categoryFilter.length > 0 ? categoryFilter : undefined
    );
  }, [isActiveFilter, pageInfo, nicknameSearch, categoryFilter]);

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

  const fetchBrowserStatus = async () => {
    try {
      const status = await crawlerApi.getBrowserStatus();
      setChromeRunning(status.chrome_running);
      setPageOpen(status.page_open);
    } catch (err) {
      console.error('Failed to fetch browser status:', err);
    }
  };

  const fetchCrawlerStatus = useCallback(async () => {
    try {
      const status = await crawlerApi.getCrawlerTaskStatus();
      setTaskStatus(status);
      if (status.status !== 'idle' && status.status !== undefined) {
        if (status.mode) setMode(status.mode as CrawlerMode);
        if (status.max_posts != null && status.max_posts > 0) setLimitedCount(status.max_posts);
        if (status.target_uids && status.target_uids.length > 0) setTargetUids(status.target_uids);
      }
    } catch (err) {
      console.error('Failed to fetch crawler status:', err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchBrowserStatus();
    fetchCrawlerStatus();
  }, [fetchCrawlerStatus]);

  // 轮询：只在 status 真正变化时重新设置 interval，不依赖 fetchCrawlerStatus
  const timerIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatusRef = useRef<string>('idle');

  useEffect(() => {
    const currentStatus = taskStatus?.status ?? 'idle';
    const statusChanged = prevStatusRef.current !== currentStatus;
    prevStatusRef.current = currentStatus;

    // 状态变化时才重新设置 interval
    if (statusChanged || timerIdRef.current === null) {
      if (timerIdRef.current) {
        clearInterval(timerIdRef.current);
        timerIdRef.current = null;
      }

      const interval = currentStatus === 'running' || currentStatus === 'paused' || currentStatus === 'stopping'
        ? 2000
        : 15000;

      // 立即拉取一次
      crawlerApi.getCrawlerTaskStatus().then(status => {
        setTaskStatus(status);
      }).catch(console.error);

      timerIdRef.current = setInterval(() => {
        crawlerApi.getCrawlerTaskStatus().then(status => {
          setTaskStatus(status);
        }).catch(console.error);
      }, interval);
    }

    return () => {
      if (timerIdRef.current) {
        clearInterval(timerIdRef.current);
        timerIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskStatus?.status]);

  const handleCrawlerAction = async (action: 'start' | 'pause' | 'resume' | 'stop' | 'force_stop') => {
    // 强制停止直接调用 API
    if (action === 'force_stop') {
      setActionLoading('stop');
      try {
        const result = await crawlerApi.forceStopCrawlerTask();
        if (!result.success) {
          message.error(result.error || '强制停止失败');
        } else {
          message.success(result.message || '已强制停止');
          await fetchCrawlerStatus();
        }
      } catch (err: any) {
        message.error(err.message || '强制停止失败');
      } finally {
        setActionLoading(null);
      }
      return;
    }

    setActionLoading(action);
    try {
      let result: { success: boolean; error?: string; message?: string };
      switch (action) {
        case 'start':
          if ((mode as string) === 'category' && selectedCategory) {
            result = await crawlerApi.startCrawlerByCategory({
              category_id: selectedCategory,
              mode: 'full',
              max_posts: 0,
            });
          } else {
            result = await crawlerApi.startCrawlerTask({
              mode,
              max_posts: mode === 'limited' ? limitedCount : 0,
              target_uids: mode === 'specific' ? targetUids : undefined,
            });
          }
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
        message.error(result.error || result.message || '操作失败');
      } else {
        await fetchCrawlerStatus();
      }
    } catch (err: any) {
      message.error(err.message || '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

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

  const getCategoryNames = (categoryIds: string[] = []) => {
    return categoryIds.map(id => {
      const cat = categories.find(c => c._id === id);
      return cat ? cat.name : id;
    });
  };

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

  const handleNicknameSearch = (value: string) => {
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      setNicknameSearch(value);
      setPageInfo({ ...pageInfo, page: 1 });
    }, 300);
    setSearchTimer(timer);
  };

  const handleCategoryFilterChange = (values: string[]) => {
    setCategoryFilter(values);
    setPageInfo({ ...pageInfo, page: 1 });
  };

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

  const handleApiCrawl = async (uid: string, nickname: string) => {
    if (!chromeRunning) {
      message.warning('请先启动 Chrome 浏览器');
      return;
    }

    setCrawlingUid(uid);
    try {
      const result = await crawlerApi.getWeiboApi(uid, 1, 0);

      if (result.success) {
        message.success(`用户 ${nickname} API采集完成`);
        fetchCrawlerStatus();
      } else {
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
      {/* 浏览器控制 + 自动化功能组 + 爬虫日志 三列 */}
      <Row gutter={[16, 16]} style={{ margin: '16px 24px 0' }} align="stretch">
        {/* 浏览器控制 */}
        <Col xs={24} md={8}>
          <Card
            size="small"
            style={{ height: '100%' }}
            title={<><ChromeOutlined /> 浏览器控制</>}
            extra={
              <Space size={4}>
                <Tag color={chromeRunning ? 'success' : 'default'} style={{ margin: 0 }}>
                  {chromeRunning ? 'Chrome 运行中' : 'Chrome 未启动'}
                </Tag>
                <Tag color={pageOpen ? 'processing' : 'default'} style={{ margin: 0 }}>
                  {pageOpen ? '微博已打开' : '微博未打开'}
                </Tag>
              </Space>
            }
          >
            <Space wrap>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={crawlerLoading}
                onClick={handleStartChrome}
                disabled={chromeRunning}
                size="small"
              >
                启动Chrome
              </Button>
              <Button
                icon={<CloudDownloadOutlined />}
                loading={crawlerLoading}
                onClick={handleOpenWeibo}
                disabled={!chromeRunning}
                size="small"
              >
                打开微博
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                loading={crawlerLoading}
                onClick={handleCloseBrowser}
                disabled={!chromeRunning}
                size="small"
              >
                关闭
              </Button>
            </Space>
          </Card>
        </Col>

        {/* 自动化功能组 */}
        <Col xs={24} md={8}>
          <AutomationPanel
            taskStatus={taskStatus}
            mode={mode}
            limitedCount={limitedCount}
            targetUids={targetUids}
            users={users.map(u => ({ nickname: u.nickname, uid: u.uid }))}
            actionLoading={actionLoading}
            onModeChange={setMode}
            onLimitedCountChange={setLimitedCount}
            onTargetUidsChange={setTargetUids}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            categories={categories}
            onAction={handleCrawlerAction}
          />
        </Col>

        {/* 爬虫日志 */}
        <Col xs={24} md={8}>
          <CrawlerLogPanel taskStatus={taskStatus} />
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
            <div className="stats-value">{statsActive}</div>
            <CheckCircleOutlined className="stats-icon" />
          </div>
        </Col>
        <Col xs={24} sm={8}>
          <div className="stats-card stats-warning">
            <div className="stats-title">已禁用</div>
            <div className="stats-value">{statsInactive}</div>
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
