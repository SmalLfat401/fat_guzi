/**
 * 情报详情页面
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NavBar, Skeleton, Empty, Button } from 'antd-mobile';
import { fetchIntelEventDetail } from '@/api';
import type { IntelEventDetail } from '@/types';
import dayjs from 'dayjs';
import './IntelEventDetail.scss';

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  convention:      { bg: '#EEEDFE', text: '#534AB7' },
  book_signing:    { bg: '#FBEAF0', text: '#D4537E' },
  pre_order:       { bg: '#FFF3E0', text: '#E65100' },
  product_launch: { bg: '#E8F5E9', text: '#2E7D32' },
  offline_activity:{ bg: '#E3F2FD', text: '#1565C0' },
  online_activity: { bg: '#F3E5F5', text: '#6A1B9A' },
  other:           { bg: '#F5F5F5', text: '#616161' },
};

const IntelEventDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<IntelEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchIntelEventDetail(id);
        setDetail(data);
        if (!data) setError('情报不存在或暂不可查看');
      } catch {
        setError('加载失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const colors = detail ? (TYPE_COLORS[detail.type] || TYPE_COLORS['other']) : TYPE_COLORS['other'];

  const dateLabel = detail?.date
    ? (detail.end_date && detail.end_date !== detail.date
        ? `${detail.date} ~ ${detail.end_date}`
        : detail.date)
    : '';

  const formatDate = (iso?: string) =>
    iso ? dayjs(iso).format('YYYY-MM-DD HH:mm') : '';

  const openPurchaseUrl = () => {
    if (detail?.purchase_url) {
      window.location.href = detail.purchase_url;
    }
  };

  const openSourcePost = () => {
    if (detail?.source_post_url) {
      window.location.href = detail.source_post_url;
    }
  };

  return (
    <div className="intel-detail-page">
      <NavBar
        className="detail-navbar"
        onBack={() => navigate(-1)}
        backArrow
      >
        活动详情
      </NavBar>

      {loading && (
        <div className="detail-loading">
          <Skeleton animated style={{ height: '16rem', borderRadius: '0' }} />
          <div className="detail-skeleton-body">
            <Skeleton animated style={{ height: '2.4rem', width: '70%', marginBottom: '1rem' }} />
            <Skeleton animated style={{ height: '1.4rem', width: '50%', marginBottom: '0.6rem' }} />
            <Skeleton animated style={{ height: '1.4rem', width: '40%', marginBottom: '0.6rem' }} />
            <Skeleton animated style={{ marginTop: '2rem' }} />
            <Skeleton animated style={{ height: '1rem', width: '60%', marginTop: '0.5rem' }} />
            <Skeleton animated style={{ height: '1rem', width: '40%', marginTop: '0.5rem' }} />
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="detail-error">
          <Empty description={error} />
          <Button fill="none" onClick={() => navigate(-1)} style={{ marginTop: '1rem', color: '#534AB7' }}>
            返回上一页
          </Button>
        </div>
      )}

      {detail && !loading && (
        <div className="detail-content">
          {/* 封面图 */}
          {detail.cover && (
            <div className="detail-cover">
              <img src={detail.cover} alt={detail.name} />
            </div>
          )}

          <div className="detail-body">
            {/* 标签 + 标题 */}
            <div className="detail-header">
              <span
                className="detail-badge"
                style={{ background: colors.bg, color: colors.text }}
              >
                {detail.icon} {detail.badge}
              </span>
              <h1 className="detail-title">{detail.name}</h1>
            </div>

            {/* 核心信息 */}
            <div className="detail-meta-list">
              {dateLabel && (
                <div className="detail-meta-item">
                  <span className="meta-icon">📅</span>
                  <span className="meta-label">日期</span>
                  <span className="meta-value">{dateLabel}</span>
                </div>
              )}
              {detail.time && (
                <div className="detail-meta-item">
                  <span className="meta-icon">⏰</span>
                  <span className="meta-label">时间</span>
                  <span className="meta-value">{detail.time}</span>
                </div>
              )}
              {detail.venue && (
                <div className="detail-meta-item">
                  <span className="meta-icon">📍</span>
                  <span className="meta-label">地点</span>
                  <span className="meta-value">
                    {detail.city ? `${detail.city} · ${detail.venue}` : detail.venue}
                  </span>
                </div>
              )}
              {detail.price && (
                <div className="detail-meta-item">
                  <span className="meta-icon">💰</span>
                  <span className="meta-label">价格</span>
                  <span className="meta-value price-value">¥{detail.price}</span>
                </div>
              )}
            </div>

            {/* 描述 */}
            {detail.description && (
              <div className="detail-section">
                <div className="section-title">活动介绍</div>
                <div className="detail-desc">{detail.description}</div>
              </div>
            )}

            {/* 嘉宾列表 */}
            {detail.participants && detail.participants.length > 0 && (
              <div className="detail-section">
                <div className="section-title">嘉宾阵容</div>
                <div className="detail-tags">
                  {detail.participants.map((p, i) => (
                    <span key={i} className="detail-tag guest-tag">{p}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 相关IP */}
            {detail.related_ips && detail.related_ips.length > 0 && (
              <div className="detail-section">
                <div className="section-title">相关IP</div>
                <div className="detail-tags">
                  {detail.related_ips.map((ip, i) => (
                    <span key={i} className="detail-tag ip-tag">{ip}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 标签 */}
            {detail.tags && detail.tags.length > 0 && (
              <div className="detail-section">
                <div className="section-title">标签</div>
                <div className="detail-tags">
                  {detail.tags.map((tag, i) => (
                    <span key={i} className="detail-tag">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 情报来源 */}
            <div className="detail-source">
              <span className="source-label">情报来源</span>
              {detail.author_nickname && (
                <span className="source-author">@{detail.author_nickname}</span>
              )}
              {detail.created_at && (
                <span className="source-time">{formatDate(detail.created_at)}</span>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="detail-actions">
              {detail.purchase_url && (
                <Button
                  block
                  color="primary"
                  className="action-btn purchase-btn"
                  onClick={openPurchaseUrl}
                >
                  🔗 前往购买 / 预约
                </Button>
              )}
              {detail.source_post_url && (
                <Button
                  block
                  fill="outline"
                  className="action-btn source-btn"
                  onClick={openSourcePost}
                >
                  📱 查看原文微博
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntelEventDetailPage;
