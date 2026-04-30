/**
 * 埋点 SDK
 * 非侵入式：零依赖、轻量化、支持 sendBeacon 上报
 */
import { API_BASE_URL } from '@/api/config';

// ──────────────────────────────────────────────
// 浏览器指纹生成
// ──────────────────────────────────────────────

const FINGERPRINT_KEY = '__fat_fid';

function getFingerprint(): string {
  // 优先从 localStorage 读取已生成的指纹
  try {
    const stored = localStorage.getItem(FINGERPRINT_KEY);
    if (stored) return stored;
  } catch {}

  // 生成简单指纹：综合多个浏览器特征
  const features = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || '',
    // @ts-ignore
    navigator.deviceMemory || '',
  ].join('|');

  const fid = hashCode(features);

  try {
    localStorage.setItem(FINGERPRINT_KEY, fid);
  } catch {}

  return fid;
}

function hashCode(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ──────────────────────────────────────────────
// 设备信息（采集一次，复用）
// ──────────────────────────────────────────────

let _deviceInfo: Record<string, any> | null = null;

function getDeviceInfo(): Record<string, any> {
  if (_deviceInfo) return _deviceInfo;
  _deviceInfo = {
    ua: navigator.userAgent,
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
    dpr: window.devicePixelRatio || 1,
    platform: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
  };
  return _deviceInfo;
}

// ──────────────────────────────────────────────
// 事件模型
// ──────────────────────────────────────────────

export type TrackEventType = 'pv' | 'click' | 'expose' | 'submit' | 'action';

export interface TrackEvent {
  fid: string;
  event: TrackEventType;
  page: string;
  referrer?: string;
  item_id?: string;
  item_name?: string;
  action?: string;
  extra?: Record<string, any>;
  /** 进入详情页时记录来源上下文：IP 标签名称 */
  ip_tag?: string;
  /** 进入详情页时记录来源上下文：分类标签名称 */
  category_tag?: string;
  device_info?: Record<string, any>;
  timestamp: number;
  date: string;
}

// ──────────────────────────────────────────────
// 核心 Tracker 类
// ──────────────────────────────────────────────

class Tracker {
  private fid: string;
  private queue: TrackEvent[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly BATCH_DELAY = 800; // 批量上报延迟（ms）
  private readonly apiUrl: string;
  private _lastPv: { page: string; ts: number } | null = null; // PV 去重
  private readonly PV_DEDUP_MS = 2000; // 同一页面 2 秒内不重复记 PV

  constructor() {
    this.fid = getFingerprint();
    this.apiUrl = '/api/v1/track/events';
  }

  /** 获取当前指纹 */
  getFid(): string {
    return this.fid;
  }

  /** 获取当前页面路径 */
  private getPage(): string {
    return window.location.pathname;
  }

  /** 获取来源页 */
  private getReferrer(): string {
    return document.referrer || '';
  }

  /** 获取当前日期字符串 */
  private getDateStr(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** 构建事件对象 */
  private buildEvent(
    event: TrackEventType,
    options: {
      item_id?: string;
      item_name?: string;
      action?: string;
      extra?: Record<string, any>;
      ip_tag?: string;
      category_tag?: string;
    } = {}
  ): TrackEvent {
    return {
      fid: this.fid,
      event,
      page: this.getPage(),
      referrer: this.getReferrer(),
      item_id: options.item_id,
      item_name: options.item_name,
      action: options.action,
      extra: options.extra || {},
      ip_tag: options.ip_tag,
      category_tag: options.category_tag,
      device_info: getDeviceInfo(),
      timestamp: Date.now(),
      date: this.getDateStr(),
    };
  }

  /** 发送单条事件（内部使用批量队列） */
  private push(event: TrackEvent): void {
    this.queue.push(event);
    this.scheduleFlush();
  }

  /** 批量上报 */
  private scheduleFlush(): void {
    if (this.batchTimer) return;
    this.batchTimer = setTimeout(() => {
      this.flush();
    }, this.BATCH_DELAY);
  }

  /** 立即发送队列中的所有事件 */
  private flush(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    this.send(events);
  }

  /** 实际发送（sendBeacon 优先，失败降级 fetch） */
  private send(events: TrackEvent[]): void {
    const body = JSON.stringify({ events });

    // sendBeacon 在页面关闭时也能保证发送
    if (navigator.sendBeacon) {
      // sendBeacon 默认 Content-Type: text/plain，FastAPI 解析不了
      // 用 Blob 设置正确类型确保后端能解析 JSON
      const blob = new Blob([body], { type: 'application/json' });
      const ok = navigator.sendBeacon(this.apiUrl, blob);
      if (!ok) {
        this.fetchFallback(this.apiUrl, body);
      }
    } else {
      this.fetchFallback(this.apiUrl, body);
    }
  }

  private fetchFallback(url: string, body: string): void {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  // ──────────────────────────────────────────
  // 对外 API
  // ──────────────────────────────────────────

  /**
   * 页面浏览（自动去重：同一页面 2 秒内只记一次）
   */
  pv(): void {
    this.pvWithContext();
  }

  /**
   * 带上下文的页面浏览（进入商品详情页时使用）
   * 会覆盖同页面普通 pv 的去重，因为上下文信息不同
   */
  pvWithContext(itemId?: string, itemName?: string, ipTag?: string, categoryTag?: string): void {
    const page = this.getPage();
    const now = Date.now();
    const ctxKey = `${page}:${itemId}:${ipTag}:${categoryTag}`;
    if (this._lastPv && this._lastPv.page === ctxKey && now - this._lastPv.ts < this.PV_DEDUP_MS) {
      return;
    }
    this._lastPv = { page: ctxKey, ts: now };
    this.push(this.buildEvent('pv', { item_id: itemId, item_name: itemName, ip_tag: ipTag, category_tag: categoryTag }));
  }

  /**
   * 点击事件
   */
  click(options: {
    item_id?: string;
    item_name?: string;
    action: string;
    extra?: Record<string, any>;
    ip_tag?: string;
    category_tag?: string;
  }): void {
    this.push(this.buildEvent('click', options));
  }

  /**
   * 曝光事件（商品/情报卡片出现在可视区域）
   */
  expose(options: {
    item_id: string;
    item_name?: string;
    extra?: Record<string, any>;
  }): void {
    this.push(this.buildEvent('expose', options));
  }

  /**
   * 表单提交
   */
  submit(options: {
    item_id?: string;
    item_name?: string;
    action?: string;
    extra?: Record<string, any>;
  } = {}): void {
    this.push(this.buildEvent('submit', options));
  }

  /**
   * 特定行为（如收藏、分享、生成淘口令）
   */
  action(action: string, options: {
    item_id?: string;
    item_name?: string;
    extra?: Record<string, any>;
  } = {}): void {
    this.push(this.buildEvent('action', { ...options, action }));
  }

  /**
   * 搜索行为
   */
  search(keyword: string, page: string = this.getPage()): void {
    this.push(this.buildEvent('action', {
      action: 'search',
      extra: { keyword, page },
    }));
  }

  /**
   * 筛选行为
   */
  filter(filterType: string, value: string, page: string = this.getPage()): void {
    this.push(this.buildEvent('action', {
      action: 'filter',
      extra: { filterType, value, page },
    }));
  }

  /**
   * 确保页面离开时发送完队列（配合 beforeunload）
   */
  flushSync(): void {
    this.flush();
  }
}

// 全局单例
export const tracker = new Tracker();

// ──────────────────────────────────────────────
// 曝光监控 Hook（使用 IntersectionObserver）
// ──────────────────────────────────────────────

export function observeExpose(
  containerRef: React.RefObject<HTMLElement | null>,
  getItemId: (el: HTMLElement) => string,
  getItemName?: (el: HTMLElement) => string,
  options: IntersectionObserverInit = { threshold: 0.3 }
): void {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target as HTMLElement;
        tracker.expose({
          item_id: getItemId(el),
          item_name: getItemName?.(el),
        });
        observer.unobserve(el);
      }
    });
  }, options);

  // 监听容器内的 data-track-id 元素
  const container = containerRef.current;
  if (!container) return;

  const observe = () => {
    const items = container.querySelectorAll('[data-track-id]');
    items.forEach((item) => observer.observe(item));
  };

  observe();

  // MutationObserver：监听动态新增的元素
  const mutObserver = new MutationObserver(() => {
    observe();
  });
  mutObserver.observe(container, { childList: true, subtree: true });

  // 组件卸载时断开
  return () => {
    observer.disconnect();
    mutObserver.disconnect();
  };
}

export default tracker;
