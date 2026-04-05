/**
 * 日历页面
 * 包含：活动日历 + 谷子上新（统一日历视图 + 列表视图）
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, Skeleton, Empty } from 'antd-mobile';
import { fetchCalendarEvents, fetchGuziReleases } from '@/api';
import type { CalendarEvent, GuziRelease } from '@/types';
import dayjs from 'dayjs';
import './index.scss';

// ============================================================
// 统一事件类型（events + releases 合并）
// ============================================================
export type UnifiedEventType = 'expo' | 'merch' | 'sale';

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
  price?: number;
  originalPrice?: number;
}

// ============================================================
// 分类标签配置
// ============================================================
type FilterType = 'all' | UnifiedEventType;

const FILTER_CONFIG: { key: FilterType; label: string; cls: string }[] = [
  { key: 'all',   label: '全部',          cls: 'all'   },
  { key: 'expo',  label: '🏛 会展活动',   cls: 'expo'  },
  { key: 'merch', label: '🎀 谷子上新',   cls: 'merch' },
  { key: 'sale',  label: '🔥 限时特卖',    cls: 'sale'  },
];

const TYPE_COLORS: Record<UnifiedEventType, { bg: string; text: string; dot: string }> = {
  expo:  { bg: '#EEEDFE', text: '#534AB7', dot: '#7F77DD' },
  merch: { bg: '#FBEAF0', text: '#D4537E', dot: '#ED93B1' },
  sale:  { bg: '#FAEEDA', text: '#BA7517', dot: '#EF9F27' },
};

const MONTH_NAMES = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

const CalendarPage: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [releases, setReleases] = useState<GuziRelease[]>([]);

  const [curYear, setCurYear]   = useState(dayjs().year());
  const [curMonth, setCurMonth] = useState(dayjs().month()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [curFilter, setCurFilter] = useState<FilterType>('all');
  const [curMode, setCurMode] = useState<'cal' | 'list'>('cal');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventsData, releasesData] = await Promise.all([
        fetchCalendarEvents({}),
        fetchGuziReleases({}),
      ]);
      setEvents(eventsData);
      setReleases(releasesData);
    } catch (error) {
      console.error('Failed to load calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // 将 events + releases 转换为 UnifiedEvent
  // ============================================================
  const unifiedEvents: UnifiedEvent[] = useMemo(() => {
    const evts: UnifiedEvent[] = [];

    events.forEach((e) => {
      const statusMap: Record<CalendarEvent['status'], string> = {
        upcoming: '即将开始',
        ongoing:  '进行中',
        ended:    '已结束',
      };
      evts.push({
        id: e.id,
        date: dayjs(e.startDate).format('YYYY-MM-DD'),
        time: `${dayjs(e.startDate).format('MM/DD')}-${dayjs(e.endDate).format('MM/DD')}`,
        type: 'expo',
        icon: '🏛',
        name: e.title,
        venue: e.location,
        badge: statusMap[e.status] || '预告',
        cover: e.cover,
        price: e.price,
      });
    });

    releases.forEach((r) => {
      const statusMap: Record<GuziRelease['status'], string> = {
        upcoming: '预告',
        released: '今日上新',
        sold_out: '已售罄',
      };
      const type: UnifiedEventType = r.status === 'sold_out' ? 'sale' : 'merch';
      evts.push({
        id: r.id,
        date: dayjs(r.releaseDate).format('YYYY-MM-DD'),
        time: dayjs(r.releaseDate).format('HH:mm'),
        type,
        icon: '🎀',
        name: r.title,
        venue: r.platform?.join(' · '),
        badge: statusMap[r.status] || '预告',
        cover: r.cover,
        productId: r.productId,
        price: r.price,
        originalPrice: r.originalPrice,
      });
    });

    return evts;
  }, [events, releases]);

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
  // 交互
  // ============================================================
  const changeMonth = (delta: number) => {
    let m = curMonth + delta;
    let y = curYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    setCurMonth(m);
    setCurYear(y);
  };

  const selectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    if (curMode !== 'cal') setCurMode('cal');
  };

  const today = dayjs().format('YYYY-MM-DD');

  const handleCardClick = (e: UnifiedEvent) => {
    if (e.productId) {
      navigate(`/product/${e.productId}`);
    } else if (e.type === 'expo') {
      // 活动详情页（暂未实现）
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
      <NavBar onBack={() => navigate(-1)} />

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
              onClick={() => setCurMode('cal')}
            >
              日历
            </button>
            <button
              className={`mode-btn ${curMode === 'list' ? 'active' : ''}`}
              onClick={() => setCurMode('list')}
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
            onClick={() => setCurFilter(f.key)}
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
        <div className="list-view">
          {loading ? (
            <div className="cal-loading">
              <Skeleton animated style={{ height: '20rem', borderRadius: '0.8rem', margin: '1rem' }} />
            </div>
          ) : listData.length === 0 ? (
            <Empty description="暂无相关活动" className="list-empty" />
          ) : (
            listData.map(({ date, events: dayEvents }) => {
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
            })
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
