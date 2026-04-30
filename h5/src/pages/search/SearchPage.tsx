/**
 * 商品搜索页
 * 支持搜索历史、热门搜索、实时搜索结果
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  SearchBar,
  Card,
  Image,
  Tag,
  Empty,
  SpinLoading,
} from 'antd-mobile';
import { searchProducts, fetchTags, fetchCategories, fetchHotSearches } from '@/api';
import { tracker } from '@/utils/tracker';
import type { GuziProductH5 } from '@/types';

import './SearchPage.scss';

const SEARCH_HISTORY_KEY = 'fat_guzi_search_history';
const MAX_HISTORY = 10;
const PAGE_SIZE = 20;

interface SearchResult {
  items: GuziProductH5[];
  total: number;
}

const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // 状态
  const [searchValue, setSearchValue] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [hotSearchTerms, setHotSearchTerms] = useState<string[]>([]);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  
  // 分类和标签映射（用于数据转换）
  const [subCatIdToName] = useState<Map<string, string>>(new Map());
  const [ipTagIdToName] = useState<Map<string, string>>(new Map());
  
  const contentRef = useRef<HTMLDivElement>(null);
  const hasMoreRef = useRef(false);

  // 初始化
  useEffect(() => {
    // 加载搜索历史
    try {
      const history = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (history) {
        setSearchHistory(JSON.parse(history));
      }
    } catch (e) {
      console.error('读取搜索历史失败:', e);
    }

    // 加载热门搜索词（从埋点数据获取）
    Promise.all([
      fetchHotSearches(10),
      fetchTags('ip'),
    ])
      .then(([hotSearches, ipTags]) => {
        // 优先使用埋点中的热门搜索词，如果没有则使用 IP 标签
        if (hotSearches.length > 0) {
          setHotSearchTerms(hotSearches.map(item => item.keyword));
        } else if (ipTags.length > 0) {
          // 备用：使用 IP 标签名称
          setHotSearchTerms(ipTags.slice(0, 10).map(t => t.name));
        }
      })
      .catch(console.error);
  }, []);

  // 保存搜索历史
  const saveSearchHistory = useCallback((keyword: string) => {
    if (!keyword.trim()) return;
    
    const newHistory = [
      keyword.trim(),
      ...searchHistory.filter(h => h !== keyword.trim())
    ].slice(0, MAX_HISTORY);
    
    setSearchHistory(newHistory);
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (e) {
      console.error('保存搜索历史失败:', e);
    }
  }, [searchHistory]);

  // 执行搜索（需要在 useEffect 之前定义）
  const handleSearch = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setSearchResult(null);
      setShowHistory(true);
      return;
    }

    setLoading(true);
    setShowHistory(false);
    saveSearchHistory(keyword);
    tracker.search(keyword.trim());

    try {
      const result = await searchProducts(
        keyword.trim(),
        1,
        PAGE_SIZE,
        subCatIdToName,
        ipTagIdToName
      );
      setSearchResult(result);
      hasMoreRef.current = result.items.length < result.total;
    } catch (error) {
      console.error('搜索失败:', error);
      setSearchResult({ items: [], total: 0 });
    } finally {
      setLoading(false);
    }
  }, [saveSearchHistory, subCatIdToName, ipTagIdToName]);

  // 如果有 URL 参数中的搜索词，自动搜索
  useEffect(() => {
    const kw = searchParams.get('q');
    if (kw) {
      setSearchValue(kw);
      handleSearch(kw);
    }
  }, [searchParams, handleSearch]);

  // 删除单条历史记录
  const deleteHistory = useCallback((keyword: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newHistory = searchHistory.filter(h => h !== keyword);
    setSearchHistory(newHistory);
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (e) {
      console.error('删除搜索历史失败:', e);
    }
  }, [searchHistory]);

  // 清空全部历史
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (e) {
      console.error('清空搜索历史失败:', e);
    }
  }, []);

  // 搜索值变化
  const handleChange = useCallback((value: string) => {
    setSearchValue(value);
    if (!value.trim()) {
      setSearchResult(null);
      setShowHistory(true);
    }
  }, []);

  // 点击搜索按钮
  const handleSearchSubmit = useCallback((value: string) => {
    handleSearch(value);
  }, [handleSearch]);

  // 加载更多
  const loadMore = useCallback(async () => {
    if (loadingMore || !searchResult || !hasMoreRef.current) return;
    
    setLoadingMore(true);
    try {
      const nextPage = Math.floor(searchResult.items.length / PAGE_SIZE) + 1;
      const result = await searchProducts(
        searchValue.trim(),
        nextPage,
        PAGE_SIZE,
        subCatIdToName,
        ipTagIdToName
      );
      
      setSearchResult({
        items: [...searchResult.items, ...result.items],
        total: result.total,
      });
      hasMoreRef.current = (searchResult.items.length + result.items.length) < result.total;
    } catch (error) {
      console.error('加载更多失败:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, searchResult, searchValue, subCatIdToName, ipTagIdToName]);

  // 滚动检测（在整个内容区域滚动）
  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = contentEl;
      if (scrollTop + clientHeight >= scrollHeight - 200) {
        loadMore();
      }
    };

    contentEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => contentEl.removeEventListener('scroll', handleScroll);
  }, [loadMore]);

  // 点击历史/热门搜索词
  const handleQuickSearch = useCallback((keyword: string) => {
    setSearchValue(keyword);
    handleSearch(keyword);
  }, [handleSearch]);

  // 渲染商品卡片
  const renderProductCard = (product: GuziProductH5) => {
    const images = product.images?.length ? product.images : [product.cover];
    return (
      <div 
        key={product.id} 
        className="search-result-card"
        onClick={() => {
          tracker.click({ item_id: product.id, item_name: product.name, action: 'search_result' });
          navigate(`/product/${product.id}`);
        }}
      >
        <Card>
          <div className="result-card-content">
            <div className="result-image-wrapper">
              <Image src={product.cover} className="result-image" />
              {images.length > 1 && (
                <div className="image-count-badge"><span>{images.length}</span></div>
              )}
            </div>
            <div className="result-info">
              <h4 className="result-title">{product.name}</h4>
              <div className="result-price-row">
                <span className="result-price">¥{product.price.toFixed(2)}</span>
                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="original-price">¥{product.originalPrice.toFixed(2)}</span>
                )}
              </div>
              {product.ipTags?.length > 0 && (
                <div className="result-tags">
                  {product.ipTags.slice(0, 2).map((tag, idx) => (
                    <Tag key={`ip-${idx}`} className="tag-item tag-ip">{tag}</Tag>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  };

  // 渲染搜索历史
  const renderHistory = () => (
    <div className="search-section">
      <div className="section-header">
        <span className="section-title">搜索历史</span>
        {searchHistory.length > 0 && (
          <span className="clear-btn" onClick={clearHistory}>清空</span>
        )}
      </div>
      <div className="section-content">
        {searchHistory.length > 0 ? (
          searchHistory.map((keyword, idx) => (
            <div key={idx} className="history-item">
              <span 
                className="history-keyword"
                onClick={() => handleQuickSearch(keyword)}
              >
                {keyword}
              </span>
              <span 
                className="delete-btn"
                onClick={(e) => deleteHistory(keyword, e)}
              >
                ×
              </span>
            </div>
          ))
        ) : (
          <span className="empty-hint">暂无搜索历史</span>
        )}
      </div>
    </div>
  );

  // 渲染热门搜索
  const renderHotSearch = () => (
    <div className="search-section">
      <div className="section-header">
        <span className="section-title">热门搜索</span>
      </div>
      <div className="section-content">
        <div className="hot-search-list">
          {hotSearchTerms.map((term, idx) => (
            <Tag
              key={idx}
              className="hot-search-tag"
              onClick={() => handleQuickSearch(term)}
            >
              {idx + 1}. {term}
            </Tag>
          ))}
        </div>
      </div>
    </div>
  );

  // 渲染搜索结果
  const renderSearchResult = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <SpinLoading />
          <span className="loading-text">搜索中...</span>
        </div>
      );
    }

    if (!searchResult || searchResult.items.length === 0) {
      return (
        <div className="search-empty">
          <Empty description={`未找到"${searchValue}"相关商品`} />
        </div>
      );
    }

    return (
      <div className="search-result-wrapper">
        <div className="search-result-header">
          找到 {searchResult.total} 个相关商品
        </div>
        <div className="search-result-list">
          {searchResult.items.map(renderProductCard)}
        </div>
        {loadingMore && (
          <div className="loading-more">
            <SpinLoading />
            <span>加载中...</span>
          </div>
        )}
        {!loadingMore && !hasMoreRef.current && searchResult.items.length > 0 && (
          <div className="no-more">— 已加载全部 —</div>
        )}
      </div>
    );
  };

  return (
    <div className="search-page">
      <div className="search-header">
        <div className="search-navbar">
          <span
            className="back-btn"
            onClick={() => navigate('/products')}
            aria-label="返回商品列表"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </span>
          <SearchBar
            placeholder="搜索谷子商品、IP、类别..."
            value={searchValue}
            onChange={handleChange}
            onSearch={handleSearchSubmit}
            onCancel={() => navigate('/products')}
            showCancelButton
            className="search-bar"
            style={{flex: 1}}
          />
        </div>
      </div>

      <div className="search-content" ref={contentRef}>
        {showHistory ? (
          <div className="history-hot-container">
            {renderHotSearch()}
            {renderHistory()}
          </div>
        ) : (
          renderSearchResult()
        )}
      </div>
    </div>
  );
};

export default SearchPage;
