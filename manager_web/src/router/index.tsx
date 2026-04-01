import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from '../App';
import WeiboUserTable from '../components/WeiboUserTable';
import CrawlerDashboard from '../components/CrawlerDashboard';
import CategoryCrawlerDetail from '../pages/crawler/CategoryCrawlerDetail';
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
        path: 'crawler',
        children: [
          {
            index: true,
            element: <CrawlerDashboard />,
          },
          {
            path: 'category/:categoryId',
            element: <CategoryCrawlerDetail />,
          },
        ],
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
