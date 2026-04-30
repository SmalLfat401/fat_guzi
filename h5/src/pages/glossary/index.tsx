/**
 * 科普页面 - 术语解释
 * 支持谷子、Coser、漫展、游戏四个领域的术语查询
 * 采用滚动懒加载分页请求
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavBar, SearchBar, Card, Tabs, Empty } from 'antd-mobile';
import { Help, Gift, Camera, CalendarEvent, Gamepad } from '@/components/icons';
import { fetchGlossaryTerms, fetchGlossaryStats } from '@/api';
import { tracker } from '@/utils/tracker';
import type { H5GlossaryItem, GlossaryCategory, H5GlossaryStats } from '@/types';
import './index.scss';

interface CategoryConfig {
  label: string;
  color: string;
  icon: React.FC;
}

const categoryConfig: Record<GlossaryCategory, CategoryConfig> = {
  guzi: {
    label: '通用',
    color: '#FF6B9D',
    icon: Gift,
  },
  coser: {
    label: 'Coser',
    color: '#36D1DC',
    icon: Camera,
  },
  convention: {
    label: '漫展',
    color: '#F093FB',
    icon: CalendarEvent,
  },
  game: {
    label: '游戏',
    color: '#52c41a',
    icon: Gamepad,
  },
};

const PAGE_SIZE = 20;

const GlossaryPage: React.FC = () => {
  const [searchValue, setSearchValue] = useState('');
  const [activeTab, setActiveTab] = useState('guzi');
  const [terms, setTerms] = useState<H5GlossaryItem[]>([]);
  const [stats, setStats] = useState<H5GlossaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [showBackTop, setShowBackTop] = useState(false);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTabRef = useRef(activeTab);
  const searchValueRef = useRef(searchValue);
  const prevSearchRef = useRef(searchValue);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      const data = await fetchGlossaryStats();
      if (data) {
        setStats(data);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }, []);

  // 加载数据
  const loadTerms = useCallback(async (page: number = 1, append: boolean = false) => {
    try {
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const data = await fetchGlossaryTerms(
        page,
        PAGE_SIZE,
        // 搜索时跨全部分类，不限制 category
        searchValueRef.current ? undefined : activeTabRef.current,
        searchValueRef.current || undefined
      );

      if (data) {
        if (append) {
          // 追加数据
          setTerms((prev) => [...prev, ...data.items]);
        } else {
          // 首次加载或搜索
          setTerms(data.items);
        }

        setHasMore(data.has_more);
        setCurrentPage(data.page);
      }
    } catch (error) {
      console.error('加载术语失败:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // 初始加载 - 先加载统计，再加载数据
  useEffect(() => {
    loadStats().then(() => {
      loadTerms(1, false);
    });
  }, [loadStats, loadTerms]);

  // 搜索防抖（仅处理搜索输入，不主动加载数据）
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      if (searchValue.trim() && searchValue.trim() !== prevSearchRef.current) {
        tracker.search(searchValue.trim());
        prevSearchRef.current = searchValue.trim();
      }
      setCurrentPage(1);
      loadTerms(1, false);
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchValue]);

  // 保持 ref 同步
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    searchValueRef.current = searchValue;
  }, [searchValue]);

  // 切换 Tab 重置并加载
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setCurrentPage(1);
    setTerms([]);
    activeTabRef.current = key;
    tracker.action('switch_tab', { extra: { tab: key } });
    loadTerms(1, false);
  };

  // 监听页面滚动
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setShowBackTop(scrollTop > 300);

      if (loadingMore || !hasMore || loading) return;
      if (scrollTop + window.innerHeight >= document.documentElement.scrollHeight - 100) {
        loadTerms(currentPage + 1, true);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loadingMore, hasMore, loading, currentPage, loadTerms]);

  // 回到顶部
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 统计数据
  const termStats = {
    all: stats?.total || 0,
    guzi: stats?.categories?.guzi || 0,
    coser: stats?.categories?.coser || 0,
    convention: stats?.categories?.convention || 0,
    game: stats?.categories?.game || 0,
  };

  const renderGlossaryCard = (item: H5GlossaryItem, index: number) => {
    const config = categoryConfig[item.category as GlossaryCategory] || categoryConfig.guzi;

    return (
      <Card key={`${item.category}-${item.id || item.term}-${index}`} className="glossary-card">
        <div className="card-header">
          <span className="term-name">{item.term}</span>
          <span className="category-badge" style={{ background: config.color }}>
            {config.label}
          </span>
        </div>
        <p className="term-definition">{item.definition}</p>
        {item.subcategory && (
          <div className="term-subcategory">
            <span className="subcategory-label">分类：</span>
            <span className="subcategory-value">{item.subcategory}</span>
          </div>
        )}
        {item.examples && item.examples.length > 0 && (
          <div className="term-examples">
            {item.examples.map((example, idx) => (
              <span key={idx} className="example-tag">
                {example}
              </span>
            ))}
          </div>
        )}
      </Card>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="loading-state">
          <div className="skeleton-list">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-title" />
                <div className="skeleton-text" />
                <div className="skeleton-text short" />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (terms.length === 0) {
      return (
        <div className="empty-result">
          <Help />
          <p>{searchValue ? '未找到相关术语' : '该分类暂无术语'}</p>
        </div>
      );
    }

    return (
      <div className="glossary-list">
        {terms.map((item, index) => renderGlossaryCard(item, index))}

        {/* 加载更多 */}
        {loadingMore && (
          <div className="loading-more">
            <div className="loading-spinner" />
            <span>加载中...</span>
          </div>
        )}

        {/* 没有更多数据 */}
        {!hasMore && terms.length > 0 && (
          <div className="no-more-data">— 已加载全部 —</div>
        )}
      </div>
    );
  };

  const getTabTitle = (category: GlossaryCategory) => {
    const config = categoryConfig[category];
    const IconComponent = config.icon;
    const count = termStats[category];
    return (
      <>
        <IconComponent />
        <span className="tab-label">{config.label}</span>
        <span className="tab-count">{count}</span>
      </>
    );
  };

  return (
    <div className="glossary-page">
      {/* 固定顶部导航 */}
      <div className="navbar-fixed">
        <NavBar backIcon={false}>术语百科</NavBar>
      </div>

      {/* 搜索栏 */}
      <div className="glossary-search">
        <SearchBar
          placeholder="搜索谷子、Coser、漫展、游戏术语..."
          value={searchValue}
          onChange={setSearchValue}
          className="search-bar"
        />
      </div>

      {/* Tab 分类 */}
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        className="glossary-tabs"
      >
        <Tabs.Tab title={getTabTitle('guzi')} key="guzi">
          <div className="glossary-content">
            {renderContent()}
          </div>
        </Tabs.Tab>

        <Tabs.Tab title={getTabTitle('coser')} key="coser">
          <div className="glossary-content">
            {renderContent()}
          </div>
        </Tabs.Tab>

        <Tabs.Tab title={getTabTitle('convention')} key="convention">
          <div className="glossary-content">
            {renderContent()}
          </div>
        </Tabs.Tab>

        <Tabs.Tab title={getTabTitle('game')} key="game">
          <div className="glossary-content">
            {renderContent()}
          </div>
        </Tabs.Tab>
      </Tabs>

      {/* 底部安全区占位 */}
      <div className="bottom-safe-area" />

      {/* 回到顶部 */}
      {showBackTop && (
        <div className="back-to-top" onClick={scrollToTop}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 19V5M5 12L12 5L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
    </div>
  );
};

export default GlossaryPage;
