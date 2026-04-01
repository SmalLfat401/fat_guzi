/**
 * 动态 Rem 计算工具
 * 核心思想：基于设计稿宽度（375px）和动态 dpr，计算 html 的 font-size
 * 使得 1rem = 10px（设计稿中），实现简单换算
 * 
 * 多平台适配：
 * - 微信公众号：使用 WeixinJSBridge 或 document.documentElement.clientWidth
 * - 微信小程序：使用 wx.getSystemInfoSync().windowWidth
 * - 支付宝小程序：使用 my.getSystemInfoSync().windowWidth
 * - 抖音小程序：使用 tt.getSystemInfoSync().windowWidth
 */

import { getPlatform } from '@/platform';

// 设计稿基准宽度
const DESIGN_WIDTH = 375;
// Rem 基准值（1rem = 10px 换算）
const REM_BASE = 10;

let rootFontSize = REM_BASE;
let designWidth = DESIGN_WIDTH;
let dpr = 1;

function getDeviceDpr(): number {
  // 小程序环境使用平台特定 API
  if (getPlatform() === 'weapp') {
    // 微信小程序
    const info = wx?.getSystemInfoSync?.();
    return info?.pixelRatio || window.devicePixelRatio || 1;
  }
  if (getPlatform() === 'alipay') {
    // 支付宝小程序
    const info = my?.getSystemInfoSync?.();
    return info?.pixelRatio || window.devicePixelRatio || 1;
  }
  if (getPlatform() === 'douyin') {
    // 抖音小程序
    const info = tt?.getSystemInfoSync?.();
    return info?.pixelRatio || window.devicePixelRatio || 1;
  }
  return window.devicePixelRatio || 1;
}

function getScreenWidth(): number {
  if (getPlatform() === 'weapp') {
    const info = wx?.getSystemInfoSync?.();
    return info?.windowWidth || document.documentElement.clientWidth;
  }
  if (getPlatform() === 'alipay') {
    const info = my?.getSystemInfoSync?.();
    return info?.windowWidth || document.documentElement.clientWidth;
  }
  if (getPlatform() === 'douyin') {
    const info = tt?.getSystemInfoSync?.();
    return info?.windowWidth || document.documentElement.clientWidth;
  }
  return document.documentElement.clientWidth;
}

/**
 * 设置根元素的 font-size
 * 同时设置 data-dpr 属性用于 CSS 中针对不同 dpr 的适配
 */
function setRootFontSize(): void {
  const screenWidth = getScreenWidth();
  const screenDpr = getDeviceDpr();
  
  // 更新 dpr
  dpr = screenDpr;
  
  // 计算 font-size
  // 使用屏幕宽度动态计算，确保在任何设备上都按设计稿比例显示
  rootFontSize = (screenWidth / designWidth) * REM_BASE;
  
  const root = document.documentElement;
  root.style.fontSize = `${rootFontSize}px`;
  root.setAttribute('data-dpr', String(Math.round(dpr)));
}

/**
 * 初始化 Rem 计算
 * 需要在应用入口调用
 */
export function initRem(): void {
  setRootFontSize();
  
  // 监听窗口大小变化（横竖屏切换）
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', setRootFontSize, { passive: true });
    window.addEventListener('orientationchange', setRootFontSize, { passive: true });
  }
}

/**
 * 获取当前根元素 font-size
 */
export function getRootFontSize(): number {
  return rootFontSize;
}

/**
 * 获取当前设计稿宽度
 */
export function getDesignWidth(): number {
  return designWidth;
}

/**
 * 设置设计稿宽度
 * @param width 设计稿宽度，默认 375
 */
export function setDesignWidth(width: number): void {
  designWidth = width;
  setRootFontSize();
}

/**
 * 将 px 转换为 rem
 * @param px 像素值
 */
export function px2rem(px: number): number {
  return px / REM_BASE;
}

/**
 * 将 rem 转换为 px
 * @param rem rem 值
 */
export function rem2px(rem: number): number {
  return rem * REM_BASE;
}

/**
 * 自适应 px 值（基于设计稿）
 * @param px 设计稿中的 px 值
 */
export function adaptPx(px: number): number {
  const screenWidth = getScreenWidth();
  return (px / designWidth) * screenWidth;
}

/**
 * 获取当前 DPR
 */
export function getCurrentDpr(): number {
  return dpr;
}

export default {
  initRem,
  getRootFontSize,
  getDesignWidth,
  setDesignWidth,
  px2rem,
  rem2px,
  adaptPx,
  getCurrentDpr,
};
