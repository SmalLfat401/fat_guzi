/**
 * OpenClaw H5 应用入口
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'antd-mobile/es/global';
import './styles/global.scss';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
