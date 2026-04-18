/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// 小程序 API 类型声明
interface Wx {
  getSystemInfoSync?: () => {
    pixelRatio?: number;
    windowWidth?: number;
    windowHeight?: number;
    statusBarHeight?: number;
  };
  showShareMenu?: (options?: {
    withShareTicket?: boolean;
    menus?: string[];
  }) => void;
  showToast?: (options?: {
    title?: string;
    icon?: string;
    duration?: number;
  }) => void;
  navigateToMiniProgram?: (options?: {
    appId: string;
    path?: string;
  }) => void;
}

interface My {
  getSystemInfoSync?: () => {
    pixelRatio?: number;
    windowWidth?: number;
    windowHeight?: number;
    statusBarHeight?: number;
  };
  showToast?: (options?: {
    content?: string;
    type?: string;
    duration?: number;
  }) => void;
  navigateToMiniProgram?: (options?: {
    appId: string;
    path?: string;
  }) => void;
}

interface Tt {
  getSystemInfoSync?: () => {
    pixelRatio?: number;
    windowWidth?: number;
    windowHeight?: number;
    statusBarHeight?: number;
  };
  showToast?: (options?: {
    title?: string;
    duration?: number;
  }) => void;
}

declare const wx: Wx;
declare const my: My;
declare const tt: Tt;
