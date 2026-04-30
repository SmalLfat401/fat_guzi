import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Tag,
  Spin,
  Select,
  Empty,
  Typography,
  Tooltip,
} from 'antd';
import {
  EyeOutlined,
  UserOutlined,
  BarChartOutlined,
  SearchOutlined,
  FireOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { analyticsApi, type TrackStats } from '@/api/analytics';
import './Dashboard.css';

const { Title, Text } = Typography;

const formatNum = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1)}万` : String(n));

const pageNameMap: Record<string, string> = {
  '/calendar': '活动日历',
  '/products': '商品列表',
  '/product': '商品详情',
  '/want-guzi': '求谷表单',
  '/glossary': '术语百科',
};
const getPageName = (path: string) => {
  for (const key of Object.keys(pageNameMap)) {
    if (path.startsWith(key)) return pageNameMap[key];
  }
  return path;
};

// ──────────────────────────────────────────────
// 渐变统计卡片
// ──────────────────────────────────────────────
const StatCard = ({
  title,
  value,
  change,
  icon,
  loading,
  gradient,
  sub,
}: {
  title: string;
  value: number;
  change: number;
  icon: React.ReactNode;
  loading: boolean;
  gradient: string;
  sub?: string;
}) => (
  <Card
    size="small"
    className="stat-card"
    styles={{ body: { padding: '20px 24px' } }}
    loading={loading}
  >
    <div className="stat-card-inner">
      <div className="stat-icon-wrap" style={{ background: gradient }}>
        {icon}
      </div>
      <div className="stat-info">
        <Text className="stat-label">{title}</Text>
        <div className="stat-number">{formatNum(value)}</div>
        <div className="stat-footer">
          {sub && <Text type="secondary" style={{ fontSize: 12 }}>{sub}</Text>}
          {change !== 0 && (
            <span className={`change-badge ${change > 0 ? 'up' : 'down'}`}>
              {change > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              {Math.abs(change)}%
            </span>
          )}
          {change === 0 && <Text type="secondary" style={{ fontSize: 12 }}>—</Text>}
        </div>
      </div>
    </div>
  </Card>
);

// ──────────────────────────────────────────────
// 迷你趋势柱状图（纯 CSS）
// ──────────────────────────────────────────────
const MiniBarChart = ({ data }: { data: Array<{ date: string; pv: number; uv: number }> }) => {
  if (!data.length) return null;
  const maxPv = Math.max(...data.map((d) => d.pv), 1);
  const maxUv = Math.max(...data.map((d) => d.uv), 1);

  return (
    <div className="mini-bar-chart">
      <div className="chart-legend">
        <span className="legend-dot pv" />PV
        <span className="legend-dot uv" />UV
      </div>
      <div className="chart-bars">
        {data.map((d) => (
          <Tooltip key={d.date} title={`${d.date}\nPV: ${formatNum(d.pv)}\nUV: ${formatNum(d.uv)}`}>
            <div className="bar-group">
              <div className="bar-stack">
                <div
                  className="bar bar-uv"
                  style={{ height: `${(d.uv / maxUv) * 100}%` }}
                />
                <div
                  className="bar bar-pv"
                  style={{ height: `${(d.pv / maxPv) * 100}%` }}
                />
              </div>
              <div className="bar-date">{d.date.slice(5)}</div>
            </div>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────
// 页面统计（带迷你图）
// ──────────────────────────────────────────────
const PageStatsCard = ({
  stats,
  loading,
}: {
  stats: Array<{ page: string; pv: number; uv: number; click: number; expose: number; submit: number; action: number }>;
  loading: boolean;
}) => {
  const totalPv = stats.reduce((s, r) => s + r.pv, 0);
  const totalUv = stats.reduce((s, r) => s + r.uv, 0);
  const totalClick = stats.reduce((s, r) => s + r.click, 0);
  const totalSubmit = stats.reduce((s, r) => s + r.submit, 0);

  const pageColumns = [
    {
      title: '页面',
      dataIndex: 'page',
      key: 'page',
      render: (v: string) => <Tag color="cyan">{getPageName(v)}</Tag>,
    },
    {
      title: 'PV',
      dataIndex: 'pv',
      key: 'pv',
      align: 'right' as const,
      render: (v: number, r: any) => (
        <div className="table-num">
          <span className="num-main">{formatNum(v)}</span>
          <div className="num-bar-wrap">
            <div className="num-bar" style={{ width: `${totalPv > 0 ? (v / totalPv) * 100 : 0}%` }} />
          </div>
        </div>
      ),
    },
    {
      title: 'UV',
      dataIndex: 'uv',
      key: 'uv',
      align: 'right' as const,
      render: (v: number) => <span className="num-main">{formatNum(v)}</span>,
    },
    {
      title: '点击',
      dataIndex: 'click',
      key: 'click',
      align: 'right' as const,
      render: (v: number) => <span className="num-accent">{formatNum(v)}</span>,
    },
    {
      title: '提交',
      dataIndex: 'submit',
      key: 'submit',
      align: 'right' as const,
      render: (v: number) => <span className="num-success">{formatNum(v)}</span>,
    },
  ];

  return (
    <Spin spinning={loading}>
      <div className="page-stats-summary">
        <div className="summary-item">
          <span className="summary-label">总 PV</span>
          <span className="summary-val pv">{formatNum(totalPv)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">总 UV</span>
          <span className="summary-val uv">{formatNum(totalUv)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">总点击</span>
          <span className="summary-val click">{formatNum(totalClick)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">总提交</span>
          <span className="summary-val submit">{formatNum(totalSubmit)}</span>
        </div>
      </div>
      <Table
        dataSource={stats}
        columns={pageColumns}
        rowKey="page"
        size="small"
        pagination={false}
        locale={{ emptyText: <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        style={{ marginTop: 12 }}
      />
    </Spin>
  );
};

// ──────────────────────────────────────────────
// 搜索词标签云
// ──────────────────────────────────────────────
const HotSearchCloud = ({
  searches,
  loading,
}: {
  searches: Array<{ keyword: string; count: number }>;
  loading: boolean;
}) => {
  if (!searches.length && !loading) return <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  const max = Math.max(...searches.map((s) => s.count), 1);

  return (
    <Spin spinning={loading}>
      <div className="search-cloud">
        {searches.map((s) => {
          const scale = 0.8 + (s.count / max) * 0.7;
          const colors = ['#1890ff', '#722ed1', '#fa8c16', '#52c41a', '#f5222d', '#13c2c2'];
          const colorIdx = Math.floor((s.count / max) * (colors.length - 1));
          return (
            <Tooltip key={s.keyword} title={`搜索 ${s.count} 次`}>
              <Tag
                className="cloud-tag"
                style={{ fontSize: `${scale}rem`, color: colors[colorIdx] }}
              >
                {s.keyword}
              </Tag>
            </Tooltip>
          );
        })}
      </div>
    </Spin>
  );
};

// ──────────────────────────────────────────────
// 可视化漏斗
// ──────────────────────────────────────────────
const VisualFunnel = ({
  steps,
  loading,
}: {
  steps: Array<{ step: string; count: number }>;
  loading: boolean;
}) => {
  if (!steps.length && !loading) return <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  const max = steps[0]?.count || 1;

  return (
    <Spin spinning={loading}>
      <div className="visual-funnel">
        {steps.map((s, i) => {
          const pct = max > 0 ? Math.round((s.count / max) * 100) : 0;
          const prev = steps[i - 1]?.count || max;
          const convRate = i > 0 && prev > 0 ? Math.round((s.count / prev) * 100) : null;
          const funnelColors = ['#1890ff', '#722ed1', '#52c41a', '#fa8c16', '#f5222d'];
          const color = funnelColors[i] || '#1890ff';

          return (
            <div key={s.step} className="funnel-row">
              <div className="funnel-step-label">{s.step}</div>
              <div className="funnel-bar-wrap">
                <div
                  className="funnel-bar"
                  style={{ width: `${pct}%`, background: color }}
                />
                <span className="funnel-count">{formatNum(s.count)}</span>
              </div>
              {convRate !== null && (
                <Tag color={convRate > 50 ? 'green' : convRate > 20 ? 'orange' : 'red'} className="conv-tag">
                  转化 {convRate}%
                </Tag>
              )}
            </div>
          );
        })}
      </div>
    </Spin>
  );
};

// ──────────────────────────────────────────────
// 留存趋势图
// ──────────────────────────────────────────────
const RetentionPanel = ({
  data,
  loading,
}: {
  data: Array<{ date: string; new_users: number; retained_1d: number; retained_7d: number }>;
  loading: boolean;
}) => {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Spin spinning={loading}>
      {sorted.length === 0 ? (
        <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div className="retention-wrap">
          <div className="retention-chart">
            {sorted.map((r, i) => (
              <div key={r.date} className="retention-row">
                <Text type="secondary" style={{ fontSize: 12, width: 56, flexShrink: 0 }}>
                  {r.date.slice(5)}
                </Text>
                <div className="retention-bar-wrap">
                  <Tooltip title={`次日留存 ${r.retained_1d}%`}>
                    <div className="retention-bar retention-1d" style={{ width: `${r.retained_1d}%` }} />
                  </Tooltip>
                </div>
                <Text style={{ fontSize: 12, width: 36, textAlign: 'right', color: '#52c41a' }}>
                  {r.retained_1d}%
                </Text>
              </div>
            ))}
          </div>
          <div className="retention-legend">
            <span className="legend-bar 1d" />次日留存
            <span className="legend-bar 7d" />7日留存
          </div>
          <div className="retention-table-mini">
            <table>
              <thead>
                <tr>
                  <th>日期</th>
                  <th>新用户</th>
                  <th>次日留存</th>
                  <th>7日留存</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.date}>
                    <td>{r.date}</td>
                    <td>{formatNum(r.new_users)}</td>
                    <td className="td-1d">{r.retained_1d}%</td>
                    <td className="td-7d">{r.retained_7d}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Spin>
  );
};

// ──────────────────────────────────────────────
// 商品类别统计网格（按 PV 排序）
// ──────────────────────────────────────────────
const CategoryStatsGrid = ({
  items,
  loading,
}: {
  items: Array<{ category_tag: string; pv: number; uv: number }>;
  loading: boolean;
}) => {
  if (!items.length && !loading) return <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  const totalPv = items.reduce((s, r) => s + r.pv, 0);

  return (
    <Spin spinning={loading}>
      <div className="product-detail-grid">
        {items.map((item, idx) => (
          <div key={item.category_tag} className="product-detail-card">
            <div className={`rank-badge rank-${idx + 1}`}>{idx + 1}</div>
            <div className="card-content">
              <Tooltip title={item.category_tag}>
                <Text strong style={{ fontSize: 13, display: 'block' }} ellipsis>
                  {item.category_tag}
                </Text>
              </Tooltip>
              <div className="card-metrics">
                <span className="metric pv" title="页面浏览量">
                  <EyeOutlined /> {formatNum(item.pv)}
                </span>
                <span className="metric uv" title="独立访客">
                  <UserOutlined /> {formatNum(item.uv)}
                </span>
                {totalPv > 0 && (
                  <div className="pv-bar-wrap">
                    <div className="pv-bar" style={{ width: `${(item.pv / totalPv) * 100}%` }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Spin>
  );
};

// ──────────────────────────────────────────────
// 商品详情页统计网格（按 PV 排序）
// ──────────────────────────────────────────────
const ProductDetailStatsGrid = ({
  items,
  loading,
}: {
  items: Array<{ item_id: string; item_name?: string; ip_tag?: string; category_tag?: string; pv: number; uv: number }>;
  loading: boolean;
}) => {
  if (!items.length && !loading) return <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  const totalPv = items.reduce((s, r) => s + r.pv, 0);

  return (
    <Spin spinning={loading}>
      <div className="product-detail-grid">
        {items.map((item, idx) => (
          <div key={item.item_id} className="product-detail-card">
            <div className={`rank-badge rank-${idx + 1}`}>{idx + 1}</div>
            <div className="card-content">
              <Tooltip title={item.item_name || item.item_id}>
                <Text strong style={{ fontSize: 13, display: 'block' }} ellipsis>
                  {item.item_name || item.item_id.slice(0, 16) + '...'}
                </Text>
              </Tooltip>
              {(item.ip_tag || item.category_tag) && (
                <div className="card-tags">
                  {item.ip_tag && <Tag color="purple" style={{ marginRight: 4, fontSize: 11 }}>{item.ip_tag}</Tag>}
                  {item.category_tag && <Tag color="cyan" style={{ fontSize: 11 }}>{item.category_tag}</Tag>}
                </div>
              )}
              <div className="card-metrics">
                <span className="metric pv" title="页面浏览量">
                  <EyeOutlined /> {formatNum(item.pv)}
                </span>
                <span className="metric uv" title="独立访客">
                  <UserOutlined /> {formatNum(item.uv)}
                </span>
                {totalPv > 0 && (
                  <div className="pv-bar-wrap">
                    <div className="pv-bar" style={{ width: `${(item.pv / totalPv) * 100}%` }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Spin>
  );
};

// ──────────────────────────────────────────────
// 主组件
// ──────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const [data, setData] = useState<TrackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  const loadData = async () => {
    setLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - (days - 1));
      const fmt = (d: Date) => d.toISOString().split('T')[0];
      const stats = await analyticsApi.getStats({ start_date: fmt(start), end_date: fmt(end) });
      setData(stats);
    } catch (e) {
      console.error('加载看板数据失败', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [days]);

  // 生成近 N 天的 PV/UV 趋势（用于迷你图）
  const buildDailyTrend = () => {
    if (!data) return [];
    const end = new Date();
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(end);
      d.setDate(d.getDate() - (days - 1 - i));
      const dateStr = d.toISOString().split('T')[0];
      const dayStats = data.page_stats.filter(() => dateStr === dateStr);
      return { date: dateStr, pv: 0, uv: 0 };
    });
  };

  return (
    <div className="dashboard">
      {/* 页面头部 */}
      <div className="dashboard-header">
        <div className="header-left">
          <Title level={4} style={{ margin: 0, color: '#1a1a2e' }}>
            数据看板
          </Title>
          <Text type="secondary">
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </Text>
        </div>
        <div className="header-right">
          <Select
            value={days}
            onChange={setDays}
            style={{ width: 140 }}
            options={[
              { value: 7, label: '最近 7 天' },
              { value: 14, label: '最近 14 天' },
              { value: 30, label: '最近 30 天' },
            ]}
          />
          <button className="refresh-btn" onClick={loadData} disabled={loading}>
            {loading ? '刷新中...' : '刷新数据'}
          </button>
        </div>
      </div>

      {/* 概览统计卡片 */}
      <Row gutter={[16, 16]} className="stat-row">
        <Col xs={12} sm={12} md={6}>
          <StatCard
            title="今日 PV"
            value={data?.overview.today_pv || 0}
            change={data?.overview.pv_change || 0}
            icon={<EyeOutlined style={{ fontSize: 22, color: '#0a1929' }} />}
            gradient="linear-gradient(135deg, #00f0ff, #00c4d6)"
            loading={loading}
            sub="页面浏览量"
          />
        </Col>
        <Col xs={12} sm={12} md={6}>
          <StatCard
            title="今日 UV"
            value={data?.overview.today_uv || 0}
            change={data?.overview.uv_change || 0}
            icon={<UserOutlined style={{ fontSize: 22, color: '#0a1929' }} />}
            gradient="linear-gradient(135deg, #a78bfa, #8b5cf6)"
            loading={loading}
            sub="独立访客"
          />
        </Col>
        <Col xs={12} sm={12} md={6}>
          <StatCard
            title="昨日 PV"
            value={data?.overview.yesterday_pv || 0}
            change={0}
            icon={<EyeOutlined style={{ fontSize: 22, color: '#0a1929' }} />}
            gradient="linear-gradient(135deg, #374151, #4b5563)"
            loading={loading}
            sub="较前日"
          />
        </Col>
        <Col xs={12} sm={12} md={6}>
          <StatCard
            title="昨日 UV"
            value={data?.overview.yesterday_uv || 0}
            change={0}
            icon={<UserOutlined style={{ fontSize: 22, color: '#0a1929' }} />}
            gradient="linear-gradient(135deg, #1f2937, #111827)"
            loading={loading}
            sub="较前日"
          />
        </Col>
      </Row>

      {/* 主要内容区 */}
      <Row gutter={[16, 16]}>
        {/* 左列 */}
        <Col xs={24} lg={14}>
          {/* 页面统计 */}
          <Card
            className="panel-card"
            title={
              <span className="card-title">
                <BarChartOutlined /> 页面统计
              </span>
            }
          >
            <PageStatsCard stats={data?.page_stats || []} loading={loading} />
          </Card>

          {/* 热门搜索 */}
          <Card
            className="panel-card"
            title={
              <span className="card-title">
                <SearchOutlined /> 热门搜索词
              </span>
            }
            style={{ marginTop: 16 }}
          >
            <HotSearchCloud searches={data?.hot_searches || []} loading={loading} />
          </Card>
        </Col>

        {/* 右列 */}
        <Col xs={24} lg={10}>
          {/* 转化漏斗 */}
          <Card
            className="panel-card"
            title={
              <span className="card-title">
                <FireOutlined /> 转化漏斗
              </span>
            }
          >
            <VisualFunnel steps={data?.conversion.steps || []} loading={loading} />
          </Card>

          {/* 留存趋势 */}
          <Card
            className="panel-card"
            title={
              <span className="card-title">
                <UserOutlined /> 用户留存
              </span>
            }
            style={{ marginTop: 16 }}
          >
            <RetentionPanel data={data?.retention || []} loading={loading} />
          </Card>
        </Col>
      </Row>

      {/* 商品详情页热度 | 商品类别热度 | 热门 IP — 三列布局 */}
      <Row gutter={[16, 16]}>
        {/* 商品详情页热度 */}
        <Col xs={24} sm={12} md={8}>
          <Card
            className="panel-card"
            title={
              <span className="card-title">
                <FireOutlined /> 商品详情页热度（按 PV 排序 Top 10）
              </span>
            }
          >
            <ProductDetailStatsGrid items={data?.product_detail_stats || []} loading={loading} />
          </Card>
        </Col>

        {/* 商品类别热度 */}
        <Col xs={24} sm={12} md={8}>
          <Card
            className="panel-card"
            title={
              <span className="card-title">
                <AppstoreOutlined /> 商品类别热度（按 PV 排序 Top 20）
              </span>
            }
          >
            <CategoryStatsGrid items={data?.category_stats || []} loading={loading} />
          </Card>
        </Col>

        {/* 热门 IP */}
        <Col xs={24} sm={12} md={8}>
          <Card
            className="panel-card"
            title={
              <span className="card-title">
                <FireOutlined /> 热门 IP（按进入详情页次数 Top 10）
              </span>
            }
          >
            <ProductDetailStatsGrid items={
              (data?.hot_ips || []).map(item => ({
                item_id: item.ip_tag,
                item_name: item.ip_tag,
                ip_tag: undefined,
                category_tag: undefined,
                pv: item.pv,
                uv: 0,
              }))
            } loading={loading} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
