/**
 * 首页
 * 功能：
 * 1. 活动公告轮播
 * 2. 活动日历（即将到来的漫展/展会）
 * 3. 谷子上新日历
 * 4. 热门好物推荐
 */
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Swiper,
  Card,
  Image,
  Tag,
  Skeleton,
  Empty,
  Tabs,
} from 'antd-mobile';
import { ArrowRight, Location, Clock, Fire, Gift } from '@/components/icons';
import { fetchHomeData } from '@/api';
import type { Notice, CalendarEvent, GuziRelease, GuziProductH5 } from '@/types';
import dayjs from 'dayjs';

import './index.scss';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [releases, setReleases] = useState<GuziRelease[]>([]);
  const [products, setProducts] = useState<GuziProductH5[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchHomeData();
      setNotices(data.notices || []);
      setEvents(data.events || []);
      setReleases(data.releases || []);
      setProducts(data.products || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    if (start.isSame(end, 'month')) {
      return `${start.month() + 1}月${start.date()}日`;
    }
    return `${start.month() + 1}月${start.date()}日 - ${end.month() + 1}月${end.date()}日`;
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

  return (
    <div className="home-page">
      {/* 顶部搜索栏 */}
      <div className="home-header">
        <div className="search-bar" onClick={() => navigate('/products')}>
          <span className="search-icon">🔍</span>
          <span className="search-placeholder">搜索谷子、漫展...</span>
        </div>
      </div>

      {/* 公告轮播 */}
      {notices.length > 0 && (
        <div className="notice-section">
          <Swiper autoplay loop className="notice-swiper">
            {notices.map((notice) => (
              <Swiper.Item key={notice.id}>
                <div className={`notice-card notice-${notice.type}`}>
                  <span className="notice-icon">
                    {notice.type === 'activity' ? '🎉' : notice.type === 'warning' ? '⚠️' : '📢'}
                  </span>
                  <span className="notice-text">{notice.title}</span>
                </div>
              </Swiper.Item>
            ))}
          </Swiper>
        </div>
      )}

      {/* 快捷入口 */}
      <div className="quick-entry">
        <div className="entry-item" onClick={() => navigate('/calendar')}>
          <div className="entry-icon" style={{ background: 'linear-gradient(135deg, #FF6B9D, #FFB6C8)' }}>
            📅
          </div>
          <span className="entry-title">活动日历</span>
        </div>
        <div className="entry-item" onClick={() => navigate('/calendar?tab=releases')}>
          <div className="entry-icon" style={{ background: 'linear-gradient(135deg, #36D1DC, #5B86E5)' }}>
            🎁
          </div>
          <span className="entry-title">谷子上新</span>
        </div>
        <div className="entry-item" onClick={() => navigate('/products')}>
          <div className="entry-icon" style={{ background: 'linear-gradient(135deg, #F093FB, #F5576C)' }}>
            🛍️
          </div>
          <span className="entry-title">精选好物</span>
        </div>
        <div className="entry-item" onClick={() => navigate('/profile')}>
          <div className="entry-icon" style={{ background: 'linear-gradient(135deg, #FEE140, #FA709A)' }}>
            👤
          </div>
          <span className="entry-title">我的</span>
        </div>
      </div>

      {/* Tab 切换 */}
      <Tabs defaultActiveKey="events" className="home-tabs">
        <Tabs.Tab title="🔥 活动日历" key="events">
          <div className="tab-content">
            {loading ? (
              <div className="loading-list">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="event-card">
                    <Skeleton animated />
                  </Card>
                ))}
              </div>
            ) : events.length === 0 ? (
              <Empty description="暂无活动" />
            ) : (
              <div className="event-list">
                {events.slice(0, 5).map((event) => {
                  const statusConfig = getStatusTag(event.status);
                  return (
                    <Card
                      key={event.id}
                      className="event-card"
                      onClick={() => navigate(`/calendar?event=${event.id}`)}
                    >
                      <div className="event-cover">
                        <Image src={event.cover} alt={event.title} />
                        <Tag color={statusConfig.color} className="status-tag">
                          {statusConfig.text}
                        </Tag>
                      </div>
                      <div className="event-info">
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
                        {event.tags && event.tags.length > 0 && (
                          <div className="event-tags">
                            {event.tags.slice(0, 3).map((tag) => (
                              <Tag key={tag} className="tag-item">{tag}</Tag>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
                {events.length > 5 && (
                  <div className="view-more" onClick={() => navigate('/calendar')}>
                    <span>查看更多活动</span>
                    <ArrowRight />
                  </div>
                )}
              </div>
            )}
          </div>
        </Tabs.Tab>

        <Tabs.Tab title="🎁 谷子上新" key="releases">
          <div className="tab-content">
            {loading ? (
              <div className="loading-list">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="release-card">
                    <Skeleton animated />
                  </Card>
                ))}
              </div>
            ) : releases.length === 0 ? (
              <Empty description="暂无上新" />
            ) : (
              <div className="release-list">
                {releases.slice(0, 8).map((release) => {
                  const statusConfig = getReleaseStatusTag(release.status);
                  return (
                    <Card
                      key={release.id}
                      className="release-card"
                      onClick={() => navigate(`/product/${release.productId}`)}
                    >
                      <div className="release-item">
                        <Image src={release.cover} className="release-image" />
                        <div className="release-info">
                          <h4 className="release-title">{release.title}</h4>
                          <div className="release-price">
                            <span className="current-price">¥{release.price}</span>
                            {release.originalPrice && (
                              <span className="original-price">¥{release.originalPrice}</span>
                            )}
                          </div>
                          <Tag color={statusConfig.color} className="release-status">
                            {statusConfig.text}
                          </Tag>
                          <div className="release-date">
                            <Clock />
                            {dayjs(release.releaseDate).format('MM/DD HH:mm')}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
                {releases.length > 8 && (
                  <div className="view-more" onClick={() => navigate('/calendar?tab=releases')}>
                    <span>查看更多</span>
                    <ArrowRight />
                  </div>
                )}
              </div>
            )}
          </div>
        </Tabs.Tab>

        <Tabs.Tab title="🛍️ 热门好物" key="products">
          <div className="tab-content">
            {loading ? (
              <div className="loading-grid">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="product-card">
                    <Skeleton animated />
                  </Card>
                ))}
              </div>
            ) : products.length === 0 ? (
              <Empty description="暂无商品" />
            ) : (
              <div className="product-grid">
                {products.slice(0, 6).map((product) => (
                  <Card
                    key={product.id}
                    className="product-card"
                    onClick={() => navigate(`/product/${product.id}`)}
                  >
                    <Image src={product.cover} className="product-image" />
                    <div className="product-info">
                      <h4 className="product-title">{product.name}</h4>
                      <div className="product-price-row">
                        <span className="product-price">¥{product.price.toFixed(2)}</span>
                        {product.originalPrice && (
                          <span className="original-price">¥{product.originalPrice.toFixed(2)}</span>
                        )}
                      </div>
                      {product.tags && product.tags.length > 0 && (
                        <div className="product-tags">
                          {product.tags.slice(0, 2).map((tag) => (
                            <Tag key={tag} className="tag-item">{tag}</Tag>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
            {products.length > 6 && (
              <div className="view-more" onClick={() => navigate('/products')}>
                <span>查看更多商品</span>
                <ArrowRight />
              </div>
            )}
          </div>
        </Tabs.Tab>
      </Tabs>
    </div>
  );
};

export default HomePage;
