/**
 * OpenClaw H5 应用主组件
 */
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { initRem } from '@/utils/rem';
import TabBar from '@/components/TabBar';
import HomePage from '@/pages/home';
import CalendarPage from '@/pages/calendar';
import ProductsPage from '@/pages/products';
import ProductDetailPage from '@/pages/products/ProductDetail';
import ProfilePage from '@/pages/profile';
import './styles/global.scss';

// 路由配置
const routes = [
  { path: '/', component: HomePage },
  { path: '/calendar', component: CalendarPage },
  { path: '/products', component: ProductsPage },
  { path: '/product/:id', component: ProductDetailPage },
  { path: '/profile', component: ProfilePage },
];

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  // 底部 TabBar 白名单
  const tabBarRoutes = ['/', '/calendar', '/products', '/profile'];
  const showTabBar = tabBarRoutes.includes(location.pathname);

  return (
    <div className="app">
      <div className={`page-container ${showTabBar ? '' : 'no-tabbar'}`}>
        <Routes>
          {routes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={<route.component />}
            />
          ))}
        </Routes>
      </div>
      {showTabBar && (
        <TabBar
          currentPath={location.pathname}
          onChange={(path) => navigate(path)}
        />
      )}
    </div>
  );
}

function App() {
  // 初始化 Rem 计算
  useEffect(() => {
    initRem();
  }, []);

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
