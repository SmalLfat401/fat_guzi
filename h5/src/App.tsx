/**
 * OpenClaw H5 应用主组件
 */
import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { initRem } from '@/utils/rem';
import { tracker } from '@/utils/tracker';
import TabBar from '@/components/TabBar';
import CalendarPage from '@/pages/calendar';
import IntelEventDetailPage from '@/pages/calendar/IntelEventDetail';
import ProductsPage from '@/pages/products';
import ProductDetailPage from '@/pages/products/ProductDetail';
import WantGuziPage from '@/pages/products/WantGuzi';
import GlossaryPage from '@/pages/glossary';
import { ProductsProvider } from '@/pages/products/ProductsContext';

// 路由配置
const routes = [
  { path: '/calendar', component: CalendarPage, children: [
    { path: 'event/:id', component: IntelEventDetailPage },
  ]},
  { path: '/products', component: ProductsPage },
  { path: '/product/:id', component: ProductDetailPage },
  { path: '/want-guzi', component: WantGuziPage },
  { path: '/glossary', component: GlossaryPage },
];

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  // 底部 TabBar 白名单
  const tabBarRoutes = ['/calendar', '/calendar/event', '/products', '/product', '/want-guzi', '/glossary'];
  const showTabBar = tabBarRoutes.some((r) => location.pathname.startsWith(r));

  // 埋点：PV 自动上报
  React.useEffect(() => {
    tracker.pv();
  }, [location.pathname]);

  // 默认首页跳转到 /products
  React.useEffect(() => {
    if (location.pathname === '/') {
      navigate('/calendar', { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <div className="app">
      <ProductsProvider>
        <div className="page-container">
          <Routes>
            {routes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={<route.component />}
              >
                {route.children?.map((child) => (
                  <Route
                    key={child.path}
                    path={child.path}
                    element={<child.component />}
                  />
                ))}
              </Route>
            ))}
          </Routes>
        </div>
      </ProductsProvider>

      {/* 固定底部 TabBar */}
      {showTabBar && (
        <div className="tabbar-fixed">
          <TabBar
            currentPath={location.pathname}
            onChange={(path) => navigate(path)}
          />
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
