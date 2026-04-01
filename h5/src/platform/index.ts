/**
 * 平台检测与适配层
 * 支持：微信公众号(H5)、微信小程序、支付宝小程序、抖音小程序
 */

export type Platform = 'h5' | 'weapp' | 'alipay' | 'douyin';

let currentPlatform: Platform = 'h5';

/**
 * 自动检测当前平台
 */
export function detectPlatform(): Platform {
  // 微信小程序
  if (typeof wx !== 'undefined' && wx?.getSystemInfoSync) {
    return 'weapp';
  }
  // 支付宝小程序
  if (typeof my !== 'undefined' && my?.getSystemInfoSync) {
    return 'alipay';
  }
  // 抖音小程序
  if (typeof tt !== 'undefined' && tt?.getSystemInfoSync) {
    return 'douyin';
  }
  // 微信公众号（浏览器环境）
  return 'h5';
}

/**
 * 获取当前平台
 */
export function getPlatform(): Platform {
  if (currentPlatform === 'h5') {
    // 微信公众号环境检测
    const ua = navigator.userAgent.toLowerCase();
    if (ua.indexOf('micromessenger') > -1) {
      return 'wechat';
    }
  }
  return currentPlatform;
}

/**
 * 设置当前平台（手动设置时使用）
 */
export function setPlatform(platform: Platform): void {
  currentPlatform = platform;
}

/**
 * 是否为微信环境
 */
export function isWechat(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return ua.indexOf('micromessenger') > -1;
}

/**
 * 是否为移动端浏览器
 */
export function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * 是否为小程序环境
 */
export function isMiniProgram(): boolean {
  return ['weapp', 'alipay', 'douyin'].includes(getPlatform());
}

/**
 * 获取平台特定配置
 */
export function getPlatformConfig() {
  const platform = getPlatform();
  
  const configs = {
    h5: {
      name: 'H5',
      supportShare: true,
      safeArea: true,
      apiPrefix: '/api',
    },
    wechat: {
      name: '微信公众号',
      supportShare: true,
      safeArea: true,
      apiPrefix: '/api',
    },
    weapp: {
      name: '微信小程序',
      supportShare: true,
      safeArea: true,
      apiPrefix: '/api',
    },
    alipay: {
      name: '支付宝小程序',
      supportShare: false,
      safeArea: true,
      apiPrefix: '/api',
    },
    douyin: {
      name: '抖音小程序',
      supportShare: true,
      safeArea: true,
      apiPrefix: '/api',
    },
  };
  
  return configs[platform] || configs.h5;
}

/**
 * 平台特定 API 封装
 */
export const platformAPI = {
  /**
   * 获取系统信息
   */
  getSystemInfo() {
    const platform = getPlatform();
    
    if (platform === 'weapp') {
      return wx?.getSystemInfoSync?.() || {};
    }
    if (platform === 'alipay') {
      return my?.getSystemInfoSync?.() || {};
    }
    if (platform === 'douyin') {
      return tt?.getSystemInfoSync?.() || {};
    }
    
    // H5 环境
    return {
      pixelRatio: window.devicePixelRatio || 1,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight,
      statusBarHeight: 0,
    };
  },

  /**
   * 获取安全区域
   */
  getSafeArea() {
    const platform = getPlatform();
    
    if (platform === 'weapp') {
      return wx?.getSystemInfoSync?.() || {};
    }
    
    // H5 环境使用 CSS env()
    const safeArea = {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    };
    
    return safeArea;
  },

  /**
   * 分享
   */
  share(options: { title?: string; desc?: string; link?: string; imgUrl?: string }) {
    const platform = getPlatform();
    
    if (platform === 'weapp' && wx?.showShareMenu) {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline'],
      });
    }
    
    // 其他平台使用 Web Share API
    if (navigator.share && platform === 'h5') {
      navigator.share({
        title: options.title,
        text: options.desc,
        url: options.link,
      }).catch(() => {});
    }
  },

  /**
   * 显示Toast
   */
  toast(message: string, duration = 2000) {
    const platform = getPlatform();
    
    if (platform === 'weapp' && wx?.showToast) {
      wx.showToast({ title: message, icon: 'none', duration });
    } else if (platform === 'alipay' && my?.showToast) {
      my.showToast({ content: message, type: 'none', duration });
    } else if (platform === 'douyin' && tt?.showToast) {
      tt.showToast({ title: message, duration });
    }
    // H5 环境使用 Vant Toast
  },

  /**
   * 跳转到其他小程序/应用
   */
  navigateToMiniProgram(appId: string, path?: string) {
    const platform = getPlatform();
    
    if (platform === 'weapp' && wx?.navigateToMiniProgram) {
      wx.navigateToMiniProgram({ appId, path });
    } else if (platform === 'alipay' && my?.navigateToMiniProgram) {
      my.navigateToMiniProgram({ appId, path });
    }
  },
};

export default {
  detectPlatform,
  getPlatform,
  setPlatform,
  isWechat,
  isMobile,
  isMiniProgram,
  getPlatformConfig,
  platformAPI,
};
