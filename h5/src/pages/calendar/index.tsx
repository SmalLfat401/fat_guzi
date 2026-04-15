/**
 * 日历页面
 * 包含：活动日历 + 谷子上新（统一日历视图 + 列表视图）
 */
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { NavBar, Skeleton, Empty } from 'antd-mobile';
import { fetchCalendarEvents } from '@/api';
import type { CalendarEvent } from '@/types';
import dayjs from 'dayjs';
import './index.scss';

// ============================================================
// 统一事件类型（与后端 IntelCategory 保持一致）
// ============================================================
export type UnifiedEventType =
  | 'convention'   // 漫展
  | 'book_signing' // 签售
  | 'pre_order'    // 预售
  | 'product_launch' // 新谷开团
  | 'offline_activity' // 线下活动
  | 'online_activity' // 线上活动
  | 'other';      // 其他

export interface UnifiedEvent {
  id: string;
  date: string;           // YYYY-MM-DD
  time?: string;          // 可选时间描述
  type: UnifiedEventType;
  icon: string;           // emoji 图标
  name: string;
  venue?: string;         // 地点（活动）或平台（谷子）
  badge: string;          // 标签文字
  cover?: string;         // 可选封面图
  productId?: string;     // 跳转商品详情用
  price?: number | string;  // 数字或字符串（如情报的 "80-120"）
  originalPrice?: number;
}

// ============================================================
// 分类标签配置（与后端 IntelCategory 一一对应）
// ============================================================
type FilterType = 'all' | UnifiedEventType;

const FILTER_CONFIG: { key: FilterType; label: string; cls: string }[] = [
  { key: 'all',             label: '全部',             cls: 'all'           },
  { key: 'convention',       label: '🎭 漫展',           cls: 'convention'    },
  { key: 'book_signing',    label: '📖 签售',           cls: 'book_signing'  },
  { key: 'pre_order',        label: '📦 预售',            cls: 'pre_order'     },
  { key: 'product_launch',   label: '🎁 新谷开团',        cls: 'product_launch'},
  { key: 'offline_activity',label: '🎪 线下活动',        cls: 'offline_activity'},
  { key: 'online_activity', label: '📺 线上活动',        cls: 'online_activity'},
  { key: 'other',           label: '📌 其他',           cls: 'other'         },
];

const TYPE_COLORS: Record<UnifiedEventType, { bg: string; text: string; dot: string }> = {
  convention:      { bg: '#EEEDFE', text: '#534AB7', dot: '#7F77DD' },
  book_signing:    { bg: '#FBEAF0', text: '#D4537E', dot: '#ED93B1' },
  pre_order:       { bg: '#FFF3E0', text: '#E65100', dot: '#FF9800' },
  product_launch:  { bg: '#E8F5E9', text: '#2E7D32', dot: '#66BB6A' },
  offline_activity:{ bg: '#E3F2FD', text: '#1565C0', dot: '#42A5F5' },
  online_activity: { bg: '#F3E5F5', text: '#6A1B9A', dot: '#AB47BC' },
  other:           { bg: '#F5F5F5', text: '#616161', dot: '#9E9E9E' },
};

const MONTH_NAMES = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // 检测是否在子路由（情报详情页），如果是则只渲染 Outlet，不渲染日历主体
  const isChildRoute = location.pathname !== '/calendar';

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [events, setEvents] = useState<(CalendarEvent | any)[]>([]);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const listViewRef = useRef<HTMLDivElement>(null);
  const eventsLengthRef = useRef(0);

  const [curYear, setCurYear]   = useState(dayjs().year());
  const [curMonth, setCurMonth] = useState(dayjs().month()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [curFilter, setCurFilter] = useState<FilterType>('all');
  const [curMode, setCurMode] = useState<'cal' | 'list'>('cal');

  // 当前筛选的类别（传给后端）
  const [curCategory, setCurCategory] = useState<FilterType>('all');

  // 加载数据：日历视图按月范围请求，列表视图支持分页
  const loadData = useCallback(async (reset: boolean = true) => {
    try {
      if (reset) {
        setLoading(true);
        setEvents([]);
        eventsLengthRef.current = 0;
      } else {
        setLoadingMore(true);
      }

      const today = dayjs().format('YYYY-MM-DD');
      const params: Parameters<typeof fetchCalendarEvents>[0] = {};

      if (curMode === 'cal') {
        const startDate = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(curYear, curMonth + 1, 0).getDate();
        const endDate = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${lastDay}`;
        params.mode = 'calendar';
        params.start_date = startDate;
        params.end_date = endDate;
      } else {
        params.mode = 'list';
        params.start_date = today;
        params.skip = reset ? 0 : eventsLengthRef.current;
        params.limit = pageSize;
      }

      if (curCategory !== 'all') {
        params.category = curCategory;
      }

      const data = await fetchCalendarEvents(params);
      if (reset) {
        setEvents(data.items);
        eventsLengthRef.current = data.items.length;
      } else {
        setEvents(prev => {
          eventsLengthRef.current = prev.length + data.items.length;
          return [...prev, ...data.items];
        });
      }
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to load calendar data:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [curMode, curYear, curMonth, curCategory]);

  // 首次加载 + 模式/筛选切换时重新加载
  useEffect(() => {
    if (curMode === 'list') {
      loadData(true);
    } else {
      loadData();
    }
  }, [curMode, curYear, curMonth, curCategory]);

  // 切换分类时重新加载
  const handleFilterChange = (filter: FilterType) => {
    setCurFilter(filter);
    setCurCategory(filter);
  };

  // 切换月份时重新加载（仅日历视图）
  const changeMonth = (delta: number) => {
    let m = curMonth + delta;
    let y = curYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    setCurMonth(m);
    setCurYear(y);
  };

  // 切换视图模式时重新加载
  const handleModeChange = (mode: 'cal' | 'list') => {
    setCurMode(mode);
  };

  // ============================================================
  // 将 events + releases 转换为 UnifiedEvent
  // ============================================================
  const unifiedEvents: UnifiedEvent[] = useMemo(() => {
    const evts: UnifiedEvent[] = [];

    events.forEach((e) => {
      // 处理情报事件（IntelCalendarEvent，id 以 intel_ 开头）
      // 后端已返回 intel.category 作为 type，与管理端 IntelCategory 一致
      if (e.id && e.id.startsWith('intel_')) {
        evts.push({
          id: e.id,
          date: e.date || '',
          time: e.time,
          type: (e.type as UnifiedEventType) || 'other',
          icon: e.icon || '📌',
          name: e.name,
          venue: e.venue,
          badge: e.badge,
          cover: e.cover,
          price: e.price,
        });
        return;
      }
      // 处理普通日历事件（CalendarEvent）
      const statusMap: Record<string, string> = {
        upcoming: '即将开始',
        ongoing:  '进行中',
        ended:    '已结束',
      };
      evts.push({
        id: e.id,
        date: dayjs(e.startDate).format('YYYY-MM-DD'),
        time: `${dayjs(e.startDate).format('MM/DD')}-${dayjs(e.endDate).format('MM/DD')}`,
        type: 'other',
        icon: '🏛',
        name: e.title,
        venue: e.location,
        badge: statusMap[e.status as string] || '预告',
        cover: e.cover,
        price: e.price,
      });
    });

    return evts;
  }, [events]);

  // ============================================================
  // 过滤
  // ============================================================
  const filteredEvents = useMemo(() => {
    if (curFilter === 'all') return unifiedEvents;
    return unifiedEvents.filter((e) => e.type === curFilter);
  }, [unifiedEvents, curFilter]);

  // ============================================================
  // 日历数据
  // ============================================================
  const calData = useMemo(() => {
    const firstDay = new Date(curYear, curMonth, 1).getDay(); // 0=周日
    const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(curYear, curMonth, 0).getDate();

    const today = dayjs().format('YYYY-MM-DD');

    const days: Array<{
      label: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      types: UnifiedEventType[];
    }> = [];

    // 上月
    for (let i = 0; i < firstDay; i++) {
      const d = daysInPrevMonth - firstDay + 1 + i;
      const dateStr = dayjs().date(d).month(curMonth === 0 ? 11 : curMonth - 1).year(curMonth === 0 ? curYear - 1 : curYear).format('YYYY-MM-DD');
      days.push({ label: d, dateStr, isCurrentMonth: false, isToday: false, isSelected: false, types: [] });
    }

    // 当月
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEvents = filteredEvents.filter((e) => e.date === dateStr);
      const types = [...new Set(dayEvents.map((e) => e.type))];
      days.push({
        label: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === today,
        isSelected: dateStr === selectedDate,
        types,
      });
    }

    // 下月（补齐 6 行 = 42 格）
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const dateStr = dayjs().date(d).month(curMonth === 11 ? 0 : curMonth + 1).year(curMonth === 11 ? curYear + 1 : curYear).format('YYYY-MM-DD');
      days.push({ label: d, dateStr, isCurrentMonth: false, isToday: false, isSelected: false, types: [] });
    }

    return days;
  }, [curYear, curMonth, selectedDate, filteredEvents]);

  // 当前选中日期的事件
  const selectedDayEvents = useMemo(() => {
    return filteredEvents.filter((e) => e.date === selectedDate);
  }, [filteredEvents, selectedDate]);

  // ============================================================
  // 列表数据（按日期分组）
  // ============================================================
  const listData = useMemo(() => {
    const grouped: Record<string, UnifiedEvent[]> = {};
    filteredEvents.forEach((e) => {
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(e);
    });
    return Object.keys(grouped)
      .sort()
      .map((date) => ({ date, events: grouped[date] }));
  }, [filteredEvents]);

  // ============================================================
  // 滚动加载更多
  // ============================================================
  const hasMore = events.length < total;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = target;
    if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !loadingMore && !loading) {
      loadData(false);
    }
  }, [hasMore, loadingMore, loading, loadData]);

  // ============================================================
  // 交互
  // ============================================================
  const selectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    if (curMode !== 'cal') handleModeChange('cal');
  };

  const today = dayjs().format('YYYY-MM-DD');

  const handleCardClick = (e: UnifiedEvent) => {
    if (e.productId) {
      navigate(`/product/${e.productId}`);
    } else if (e.id && e.id.startsWith('intel_')) {
      navigate(`/calendar/event/${e.id}`);
    }
  };

  // ============================================================
  // 渲染
  // ============================================================
  const renderEventCard = (e: UnifiedEvent) => {
    const colors = TYPE_COLORS[e.type];
    return (
      <div key={e.id} className="event-card" onClick={() => handleCardClick(e)}>
        <div className="event-icon" style={{ background: colors.bg }}>
          {e.icon}
        </div>
        <div className="event-body">
          <div className="event-name">{e.name}</div>
          <div className="event-meta">
            {e.time && <span>{e.time}</span>}
            {e.time && e.venue && <span>·</span>}
            {e.venue && <span>{e.venue}</span>}
          </div>
        </div>
        <div className="event-right">
          {e.price !== undefined && (
            <span className="event-price">¥{e.price}</span>
          )}
          <span className="event-tag" style={{ background: colors.bg, color: colors.text }}>
            {e.badge}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="calendar-page">
      {/* Header */}
      <div className="cal-header">
        <div className="header-top">
          <div>
            <div className="header-title">活动日历</div>
            <div className="header-sub">会展 · 谷子预告</div>
          </div>
          <div className="mode-toggle">
            <button
              className={`mode-btn ${curMode === 'cal' ? 'active' : ''}`}
              onClick={() => handleModeChange('cal')}
            >
              日历
            </button>
            <button
              className={`mode-btn ${curMode === 'list' ? 'active' : ''}`}
              onClick={() => handleModeChange('list')}
            >
              列表
            </button>
          </div>
        </div>
      </div>

      {/* 分类标签 */}
      <div className="filter-row">
        {FILTER_CONFIG.map((f) => (
          <button
            key={f.key}
            className={`tag ${f.cls} ${curFilter === f.key ? 'active' : ''}`}
            onClick={() => handleFilterChange(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ========== 日历视图 ========== */}
      {curMode === 'cal' && (
        <div className="cal-view">
          {loading ? (
            <div className="cal-loading">
              <Skeleton animated style={{ height: '20rem', borderRadius: '0.8rem', margin: '1rem' }} />
            </div>
          ) : (
            <>
              {/* 月份导航 */}
              <div className="cal-nav">
                <button className="cal-nav-btn" onClick={() => changeMonth(-1)}>‹</button>
                <span className="cal-month">{curYear}年 {MONTH_NAMES[curMonth]}</span>
                <button className="cal-nav-btn" onClick={() => changeMonth(1)}>›</button>
              </div>

              {/* 星期头 */}
              <div className="cal-grid">
                <div className="cal-weekdays">
                  {WEEKDAY_NAMES.map((d) => <div key={d}>{d}</div>)}
                </div>
                <div className="cal-days">
                  {calData.map((day, idx) => {
                    const cls = [
                      'cal-day',
                      !day.isCurrentMonth ? 'other-month' : '',
                      day.isToday && !day.isSelected ? 'today' : '',
                      day.isSelected ? 'selected' : '',
                    ].filter(Boolean).join(' ');
                    return (
                      <div
                        key={idx}
                        className={cls}
                        onClick={() => selectDate(day.dateStr)}
                      >
                        {day.label}
                        {day.types.length > 0 && (
                          <div className="dot-row">
                            {day.types.map((t) => (
                              <span key={t} className="dot" style={{ background: TYPE_COLORS[t].dot }} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="divider" />

              {/* 选中日期的事件 */}
              <div className="day-label">
                {dayjs(selectedDate).month() + 1}月{+dayjs(selectedDate).format('DD')}日
                {' · '}
                {selectedDayEvents.length ? `${selectedDayEvents.length}个活动` : '暂无活动'}
              </div>
              <div className="event-list">
                {selectedDayEvents.length === 0 ? (
                  <div className="empty-day">这天暂无活动 ✦</div>
                ) : (
                  selectedDayEvents.map(renderEventCard)
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ========== 列表视图 ========== */}
      {curMode === 'list' && (
        <div className="list-view" ref={listViewRef} onScroll={handleScroll}>
          {loading ? (
            <div className="cal-loading">
              <Skeleton animated style={{ height: '20rem', borderRadius: '0.8rem', margin: '1rem' }} />
            </div>
          ) : listData.length === 0 ? (
            <Empty description="暂无相关活动" className="list-empty" />
          ) : (
            <>
              {listData.map(({ date, events: dayEvents }) => {
                const isToday = date === today;
                return (
                  <div key={date} className="list-section">
                    <div className="list-date-header">
                      {dayjs(date).month() + 1}月{+dayjs(date).format('DD')}日
                      {' 周' + WEEKDAY_NAMES[dayjs(date).day()]}
                      {isToday && <span className="list-today-badge">今天</span>}
                    </div>
                    <div className="event-list">
                      {dayEvents.map(renderEventCard)}
                    </div>
                  </div>
                );
              })}
              {loadingMore && (
                <div className="load-more-loading">
                  <Skeleton animated style={{ height: '2rem' }} />
                </div>
              )}
              {!hasMore && listData.length > 0 && (
                <div className="load-more-end">— 已加载全部 {total} 条 —</div>
              )}
            </>
          )}
        </div>
      )}

      {/* 子路由页面用遮罩层渲染，不替换日历 DOM，保证列表滚动位置和分页数据不丢失 */}
      {isChildRoute && (
        <div className="calendar-child-overlay">
          <Outlet />
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
