import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { UserOutlined, RobotOutlined, DashboardOutlined, SettingOutlined, TagOutlined, DatabaseOutlined, BulbOutlined, ShoppingOutlined, BookOutlined, FireOutlined, CalendarOutlined, HeartOutlined, KeyOutlined, ThunderboltOutlined } from '@ant-design/icons';
import './styles/global.scss';

const { Header, Content, Sider } = Layout;

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/weibo-users', icon: <UserOutlined />, label: '微博用户管理' },
    {
      key: 'slang',
      icon: <BookOutlined />,
      label: '黑话术语库',
      children: [
        { key: '/guzi-terms', icon: <BulbOutlined />, label: '谷子黑话' },
        { key: '/coser-terms', icon: <HeartOutlined />, label: 'Coser圈' },
        { key: '/convention-terms', icon: <CalendarOutlined />, label: '漫展圈' },
        { key: '/game-terms', icon: <FireOutlined />, label: '游戏圈/二游' },
      ],
    },
    { key: '/guzi-products', icon: <ShoppingOutlined />, label: '谷子商品' },
    { key: '/crawler', icon: <RobotOutlined />, label: '爬虫监控' },
    { key: '/dashboard', icon: <DashboardOutlined />, label: '数据看板' },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      children: [
        { key: '/settings/categories', icon: <TagOutlined />, label: '标签管理' },
        { key: '/settings/guzi-tags', icon: <ThunderboltOutlined />, label: '谷子标签管理' },
        { key: '/settings/commission-account', icon: <KeyOutlined />, label: '返佣账号管理' },
        { key: '/settings/database', icon: <DatabaseOutlined />, label: '数据库管理' },
      ],
    },
  ];

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#00f0ff',
          borderRadius: 8,
          colorBgContainer: '#111827',
          colorBgElevated: '#1a2234',
          colorBorder: 'rgba(0, 240, 255, 0.2)',
          colorText: '#e5e7eb',
          colorTextSecondary: '#9ca3af',
        },
      }}
    >
      <Layout className="app-layout">
        <div className="bg-animation">
          <div className="grid-pattern" />
        </div>
        <Header className="app-header">
          <div className="header-title">
            OpenClaw 爬虫管理平台
          </div>
        </Header>
        <Layout>
          <Sider width={200} className="app-sider">
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
              items={menuItems}
              onClick={(e) => navigate(e.key)}
            />
          </Sider>
          <Content className="app-content">
            <div className="content-card">
              <Outlet />
            </div>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
