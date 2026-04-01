/**
 * 日历页面
 * 包含：活动日历 + 谷子上新日历
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  NavBar,
  Tabs,
  Card,
  Image,
  Tag,
  Skeleton,
  Empty,
} from 'antd-mobile';
import { ArrowRight, Location, Clock, Fire, Gift } from '@/components/icons';
import { fetchCalendarEvents, fetchGuziReleases } from '@/api';
import type { CalendarEvent, GuziRelease } from '@/types';
import dayjs from 'dayjs';
import './index.scss';

const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'releases' ? 1 : 0);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [releases, setReleases] = useState<GuziRelease[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventsData, releasesData] = await Promise.all([
        fetchCalendarEvents({ month: selectedMonth }),
        fetchGuziReleases({ month: selectedMonth }),
      ]);
      setEvents(eventsData);
      setReleases(releasesData);
    } catch (error) {
      console.error('Failed to load calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status: CalendarEvent['status']) => {
    const configs = {
      upcoming: { text: '即将开始', color: '#FF6B9D' },
      ongoing: { text: '正在进行', color: '#52c41a' },
      ended: { text: '已结束', color: '#999999' },
    };
    return configs[status];
  };

  const getReleaseStatusTag = (status: GuziRelease['status']) => {
    const configs = {
      upcoming: { text: '即将发售', color: '#FF6B9D' },
      released: { text: '已发售', color: '#52c41a' },
      sold_out: { text: '已售罄', color: '#999999' },
    };
    return configs[status];
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    if (start.isSame(end, 'month')) {
      return `${start.month() + 1}月${start.date()}日`;
    }
    return `${start.month() + 1}月${start.date()}日 - ${end.month() + 1}月${end.date()}日`;
  };

  const groupEventsByMonth = (eventList: CalendarEvent[]) => {
    const groups: { [key: string]: CalendarEvent[] } = {};
    eventList.forEach((event) => {
      const monthKey = dayjs(event.startDate).format('YYYY-MM');
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(event);
    });
    return groups;
  };

  const groupedEvents = groupEventsByMonth(events);

  return (
    <div className="calendar-page">
      <NavBar onBack={() => navigate(-1)}>日历</NavBar>

      <Tabs
        activeKey={activeTab === 0 ? 'events' : 'releases'}
        onChange={(key) => setActiveTab(key === 'events' ? 0 : 1)}
        className="calendar-tabs"
      >
        <Tabs.Tab title="🎪 活动日历" key="events">
          <div className="calendar-content">
            {/* 月份选择器 */}
            <div className="month-selector">
              <div
                className="month-nav prev"
                onClick={() => setSelectedMonth(dayjs(selectedMonth).subtract(1, 'month').format('YYYY-MM'))}
              >
                ‹
              </div>
              <span className="current-month">{dayjs(selectedMonth).format('YYYY年MM月')}</span>
              <div
                className="month-nav next"
                onClick={() => setSelectedMonth(dayjs(selectedMonth).add(1, 'month').format('YYYY-MM'))}
              >
                ›
              </div>
            </div>

            {loading ? (
              <div className="loading-list">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="event-card">
                    <Skeleton animated />
                  </Card>
                ))}
              </div>
            ) : events.length === 0 ? (
              <Empty description="本月暂无活动" />
            ) : (
              <div className="events-list">
                {Object.entries(groupedEvents).map(([month, monthEvents]) => (
                  <div key={month} className="month-group">
                    <div className="month-title">{dayjs(month).format('MM月')}</div>
                    {monthEvents.map((event) => {
                      const statusConfig = getStatusTag(event.status);
                      return (
                        <Card
                          key={event.id}
                          className="event-card"
                          onClick={() => navigate(`/calendar?event=${event.id}`)}
                        >
                          <div className="event-item">
                            <Image src={event.cover} className="event-cover" />
                            <div className="event-detail">
                              <h3 className="event-title">{event.title}</h3>
                              <div className="event-meta">
                                <span className="meta-item">
                                  <Location />
                                  {event.location}
                                </span>
                                <span className="meta-item">
                                  <Clock />
                                  {formatDateRange(event.startDate, event.endDate)}
                                </span>
                              </div>
                              <Tag color={statusConfig.color} className="status-tag">
                                {statusConfig.text}
                              </Tag>
                            </div>
                            <ArrowRight className="arrow-icon" />
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Tabs.Tab>

        <Tabs.Tab title="🎁 谷子上新" key="releases">
          <div className="calendar-content">
            {/* 月份选择器 */}
            <div className="month-selector">
              <div
                className="month-nav prev"
                onClick={() => setSelectedMonth(dayjs(selectedMonth).subtract(1, 'month').format('YYYY-MM'))}
              >
                ‹
              </div>
              <span className="current-month">{dayjs(selectedMonth).format('YYYY年MM月')}</span>
              <div
                className="month-nav next"
                onClick={() => setSelectedMonth(dayjs(selectedMonth).add(1, 'month').format('YYYY-MM'))}
              >
                ›
              </div>
            </div>

            {loading ? (
              <div className="loading-list">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="release-card">
                    <Skeleton animated />
                  </Card>
                ))}
              </div>
            ) : releases.length === 0 ? (
              <Empty description="本月暂无上新" />
            ) : (
              <div className="releases-list">
                {releases.map((release) => {
                  const statusConfig = getReleaseStatusTag(release.status);
                  return (
                    <Card
                      key={release.id}
                      className="release-card"
                      onClick={() => navigate(`/product/${release.productId}`)}
                    >
                      <div className="release-item">
                        <Image src={release.cover} className="release-cover" />
                        <div className="release-detail">
                          <h3 className="release-title">{release.title}</h3>
                          <div className="release-price">
                            <span className="current-price">¥{release.price}</span>
                            {release.originalPrice && (
                              <span className="original-price">¥{release.originalPrice}</span>
                            )}
                          </div>
                          <div className="release-date">
                            <Clock />
                            {dayjs(release.releaseDate).format('MM/DD HH:mm')}
                          </div>
                          <Tag color={statusConfig.color} className="status-tag">
                            {statusConfig.text}
                          </Tag>
                        </div>
                        <ArrowRight className="arrow-icon" />
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </Tabs.Tab>
      </Tabs>
    </div>
  );
};

export default CalendarPage;
