import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from '../App';
import WeiboUserTable from '../components/WeiboUserTable';
import Dashboard from '../pages/Dashboard';
import CategoryList from '../pages/categories/CategoryList';
import CommissionAccountSettings from '../pages/settings/CommissionAccountSettings';
import GuziTagSettings from '../pages/settings/GuziTagSettings';
import WeiboPosts from '../pages/WeiboPosts';
import GuziTermList from '../pages/slang/GuziTermList';
import CoserTermList from '../pages/slang/CoserTermList';
import ConventionTermList from '../pages/slang/ConventionTermList';
import GameTermList from '../pages/slang/GameTermList';
import GuziProductList from '../pages/guzi/GuziProductList';
import WantGuziList from '../pages/wantGuzi/WantGuziList';
import WeiboIntelList from '../pages/weiboIntel/WeiboIntelList';
import IntelManagement from '../pages/weiboIntel/IntelManagement';
import WeiboIntelDetailPage from '../pages/weiboIntel/WeiboIntelDetail';
import WeiboIntelEditPage from '../pages/weiboIntel/WeiboIntelEdit';
import KeywordLibrary from '../pages/weiboIntel/KeywordLibrary';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <Navigate to="/weibo-users" replace />,
      },
      {
        path: 'weibo-users',
        element: <WeiboUserTable />,
      },
      {
        path: 'weibo-users/:uid/posts',
        element: <WeiboPosts />,
      },
      {
        path: 'guzi-terms',
        element: <GuziTermList />,
      },
      {
        path: 'coser-terms',
        element: <CoserTermList />,
      },
      {
        path: 'convention-terms',
        element: <ConventionTermList />,
      },
      {
        path: 'game-terms',
        element: <GameTermList />,
      },
      {
        path: 'guzi-products',
        element: <GuziProductList />,
      },
      {
        path: 'want-guzi',
        element: <WantGuziList />,
      },
      {
        path: 'weibo-intel',
        element: <WeiboIntelList />,
      },
      {
        path: 'weibo-intel/management',
        element: <IntelManagement />,
      },
      {
        path: 'weibo-intel/detail/:id',
        element: <WeiboIntelDetailPage />,
      },
      {
        path: 'weibo-intel/edit',
        element: <WeiboIntelEditPage />,
      },
      {
        path: 'weibo-intel/keywords',
        element: <KeywordLibrary />,
      },
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      {
        path: 'settings',
          children: [
            {
              index: true,
              element: <Navigate to="/settings/categories" replace />,
            },
            {
              path: 'categories',
              element: <CategoryList />,
            },
            {
              path: 'guzi-tags',
              element: <GuziTagSettings />,
            },
            {
              path: 'commission-account',
              element: <CommissionAccountSettings />,
            },
            {
              path: 'database',
              element: <div style={{ padding: 24 }}>数据库管理开发中...</div>,
            },
          ],
        },
    ],
  },
]);

export default router;
