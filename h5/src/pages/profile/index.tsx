/**
 * 个人中心页面
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  NavBar,
  List,
} from 'antd-mobile';
import {
  ArrowRight,
  Setting,
  Help,
  Info,
  Gift,
  ShoppingBag,
  Bell,
  Star,
} from '@/components/icons';
import './index.scss';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();

  // 模拟用户数据
  const userInfo = {
    name: '二次元爱好者',
    avatar: '',
    level: 'Lv.5',
    isVip: false,
    totalCommission: 128.50,
    orderCount: 12,
    favoriteCount: 36,
  };

  const handleLogin = () => {
    // TODO: 跳转到登录页
    console.log('Login');
  };

  const handleSettings = () => {
    // TODO: 跳转到设置页
    console.log('Settings');
  };

  const menuItems = [
    {
      title: '我的订单',
      icon: <ShoppingBag />,
      path: '/profile/orders',
      badge: userInfo.orderCount,
    },
    {
      title: '我的收藏',
      icon: <Star />,
      path: '/profile/favorites',
      badge: userInfo.favoriteCount,
    },
    {
      title: '我的佣金',
      icon: <Gift />,
      path: '/profile/commission',
      value: `¥${userInfo.totalCommission.toFixed(2)}`,
    },
    {
      title: '活动通知',
      icon: <Bell />,
      path: '/profile/notifications',
    },
    {
      title: '帮助中心',
      icon: <Help />,
      path: '/profile/help',
    },
    {
      title: '关于我们',
      icon: <Info />,
      path: '/profile/about',
    },
  ];

  return (
    <div className="profile-page">
      <NavBar onBack={() => navigate(-1)}>我的</NavBar>

      {/* 用户信息卡片 */}
      <div className="user-card">
        <div className="user-info" onClick={handleLogin}>
          <div className="user-avatar">
            {userInfo.avatar ? '' : '👤'}
          </div>
          <div className="user-detail">
            <div className="user-name-row">
              <span className="user-name">{userInfo.name}</span>
              <span className="level-tag">{userInfo.level}</span>
            </div>
            <div className="user-stats">
              <div className="stat-item">
                <span className="stat-value">¥{userInfo.totalCommission.toFixed(2)}</span>
                <span className="stat-label">累计佣金</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <span className="stat-value">{userInfo.orderCount}</span>
                <span className="stat-label">订单</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <span className="stat-value">{userInfo.favoriteCount}</span>
                <span className="stat-label">收藏</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 佣金卡片 */}
      <div className="commission-card">
        <div className="commission-header">
          <span className="title">本月预估佣金</span>
          <span className="question">?</span>
        </div>
        <div className="commission-value">
          <span className="currency">¥</span>
          <span className="amount">{(userInfo.totalCommission * 0.3).toFixed(2)}</span>
        </div>
        <div className="commission-tips">
          <span>分享商品即可获得佣金</span>
        </div>
      </div>

      {/* 功能菜单 */}
      <List className="menu-list">
        {menuItems.map((item, index) => (
          <List.Item
            key={index}
            prefix={item.icon}
            extra={
              <div className="menu-extra">
                {item.badge !== undefined && (
                  <span className="badge">{item.badge > 99 ? '99+' : item.badge}</span>
                )}
                {item.value && <span className="value">{item.value}</span>}
                <ArrowRight />
              </div>
            }
            onClick={() => navigate(item.path)}
          >
            {item.title}
          </List.Item>
        ))}
      </List>

      {/* 设置入口 */}
      <div className="settings-entry" onClick={handleSettings}>
        <Setting />
        <span>设置</span>
      </div>
    </div>
  );
};

export default ProfilePage;
