/**
 * TabBar 底部导航组件
 */
import React from 'react';
import { TabBar as ADMTabBar } from 'antd-mobile';
import { HomeO, calendarO, cartO, userO } from '@/components/icons';

interface TabBarProps {
  currentPath: string;
  onChange: (path: string) => void;
}

const tabs = [
  { path: '/', title: '首页', icon: HomeO, activeIcon: 'home' },
  { path: '/calendar', title: '日历', icon: calendarO, activeIcon: 'calendar' },
  { path: '/products', title: '好物', icon: cartO, activeIcon: 'products' },
  { path: '/profile', title: '我的', icon: userO, activeIcon: 'profile' },
];

const TabBar: React.FC<TabBarProps> = ({ currentPath, onChange }) => {
  const activeIndex = tabs.findIndex((tab) => tab.path === currentPath);

  return (
    <ADMTabBar
      activeKey={currentPath}
      onChange={(key) => onChange(key as string)}
    >
      {tabs.map((tab) => (
        <ADMTabBar.Item
          key={tab.path}
          title={tab.title}
          icon={<tab.icon />}
        />
      ))}
    </ADMTabBar>
  );
};

export default TabBar;
