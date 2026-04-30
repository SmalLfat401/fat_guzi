/**
 * 商品列表页
 */
import React, { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  NavBar,
  Card,
  Image,
  Tag,
  Empty,
  Tabs,
  SpinLoading,
} from 'antd-mobile';
import { fetchProducts } from '@/api';
import { tracker, observeExpose } from '@/utils/tracker';
import type { GuziProductH5 } from '@/types';
import { useProducts, PAGE_SIZE } from './ProductsContext';

import './index.scss';

const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);

  const {
    products, setProducts,
    filteredProducts,
    loading, loadingMore, setLoadingMore, total, setTotal,
    categories, ipTags,
    activeTab, setActiveTab,
    selectedIpTag, setSelectedIpTag,
    cascadeValue, setCascadeValue,
    selectedSubCatId,
    ipTagIdToName, subCatIdToName,
    ensureLoaded,
    scrollTop, setScrollTop,
  } = useProducts();

  useEffect(() => {
    ensureLoaded();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 加载更多（ref 保证闭包中拿到最新 products）
  const productsRef = useRef(products);
  productsRef.current = products;

  const loadMoreProducts = useCallback(async () => {
    if (loading || loadingMore) return;
    if (productsRef.current.length >= Math.min(total, 200)) return;

    setLoadingMore(true);
    try {
      const nextPage = Math.floor(productsRef.current.length / PAGE_SIZE) + 1;
      const result = await fetchProducts(
        {
          is_active: true,
          ipTag: selectedIpTag || undefined,
          categoryTag: selectedSubCatId || undefined,
          page: nextPage,
          pageSize: PAGE_SIZE,
        },
        subCatIdToName,
        ipTagIdToName
      );
      setProducts(prev => [...prev, ...result.items]);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load more products:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, total, selectedIpTag, selectedSubCatId, subCatIdToName, ipTagIdToName, setProducts, setTotal, setLoadingMore]);

  // 滚动检测 + 位置恢复
  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    // 从 Context 恢复滚动位置（从详情页返回时生效）
    if (scrollTop > 0) {
      contentEl.scrollTop = scrollTop;
    }

    const handleScroll = () => {
      const { scrollTop: top } = contentEl;
      setScrollTop(top);
      const { scrollTop: st, scrollHeight, clientHeight } = contentEl;
      if (st + clientHeight >= scrollHeight - 100) {
        loadMoreProducts();
      }
    };

    contentEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => contentEl.removeEventListener('scroll', handleScroll);
  }, [loadMoreProducts, scrollTop, setScrollTop]);

  // 曝光监控
  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl || filteredProducts.length === 0) return;

    const timer = setTimeout(() => {
      observeExpose(
        contentRef,
        (el) => el.getAttribute('data-track-id') || '',
        (el) => el.querySelector('.product-title')?.textContent?.trim() || '',
        { threshold: 0.3 }
      );
    }, 100);

    return () => clearTimeout(timer);
  }, [filteredProducts]);

  // ─── 事件处理 ───

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    tracker.action('switch_tab', { extra: { tab } });
  };

  const handleIpTagFilter = (tagId: string | null) => {
    if (tagId) {
      const label = ipTagIdToName.get(tagId) || tagId;
      tracker.filter('ip_tag', label);
    }
    setSelectedIpTag(tagId);
  };

  const handleCategoryTagFilter = (value: [string, string] | null) => {
    if (value) {
      const label = subCatIdToName.get(value[1]) || value[1];
      tracker.filter('category_tag', label);
    }
    setCascadeValue(value);
  };

  // ─── 渲染 ───

  const getProductImages = (product: GuziProductH5) =>
    product.images?.length ? product.images : [product.cover];

  const renderProductCard = (product: GuziProductH5) => {
    const images = getProductImages(product);
    return (
      <div data-track-id={product.id} className="product-card-wrapper">
        <Card
          key={product.id}
          className="product-card"
          onClick={() => {
            tracker.click({ item_id: product.id, item_name: product.name, action: 'product_card' });
            navigate(`/product/${product.id}`);
          }}
        >
          <div className="product-image-wrapper">
            <Image src={product.cover} className="product-image" />
            {images.length > 1 && (
              <div className="image-count-badge"><span>{images.length}</span></div>
            )}
          </div>
          <div className="product-info">
            <h4 className="product-title">{product.name}</h4>
            <div className="product-price-row">
              <span className="product-price">¥{product.price.toFixed(2)}</span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="original-price">¥{product.originalPrice.toFixed(2)}</span>
              )}
            </div>
            {product.ipTags?.length > 0 && (
              <div className="product-tags">
                {product.ipTags.slice(0, 2).map((tag, idx) => (
                  <Tag key={`ip-${idx}`} className="tag-item tag-ip">{tag}</Tag>
                ))}
                {product.categoryTags?.slice(0, 1).map((tag, idx) => (
                  <Tag key={`cat-${idx}`} className="tag-item tag-category">{tag}</Tag>
                ))}
              </div>
            )}
            <div className="product-meta-row">
              {product.platformName && (
                <Tag
                  color={product.platform === 'alimama' ? 'warning' : 'primary'}
                  className="platform-tag"
                >
                  {product.platformName}
                </Tag>
              )}
              {product.shopName && <span className="shop-name">{product.shopName}</span>}
              {product.platforms.length > 1 && (
                <Tag color="success" className="multi-platform-tag">
                  {product.platforms.length}个平台
                </Tag>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  };

  const renderIpFilterTags = () => (
    ipTags.length > 0 && (
      <div className="ip-filter-scroll">
        <Tag
          className={`ip-filter-tag ${selectedIpTag === null ? 'active' : ''}`}
          onClick={() => handleIpTagFilter(null)}
        >
          全部
        </Tag>
        {ipTags.map(tag => (
          <Tag
            key={tag._id}
            className={`ip-filter-tag ${selectedIpTag === tag._id ? 'active' : ''}`}
            onClick={() => handleIpTagFilter(tag._id)}
          >
            {tag.name}
          </Tag>
        ))}
      </div>
    )
  );

  const renderCategorySidebar = () => (
    !loading && categories.length > 0 && (
      <div className="category-sidebar">
        <div
          className={`category-item ${cascadeValue === null ? 'active' : ''}`}
          onClick={() => handleCategoryTagFilter(null)}
        >
          全部
        </div>
        {categories
          .filter(cat => cat.is_active !== false)
          .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name))
          .map(cat => (
            <div key={cat._id} className="category-group">
              <div className="category-parent-name">{cat.name}</div>
              {(cat.sub_categories || [])
                .filter(sub => sub.is_active !== false)
                .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name))
                .map(sub => (
                  <div
                    key={sub._id}
                    className={`category-item sub-category-item ${cascadeValue?.[1] === sub._id ? 'active' : ''}`}
                    onClick={() => handleCategoryTagFilter([cat._id, sub._id])}
                  >
                    {sub.name}
                  </div>
                ))}
            </div>
          ))}
      </div>
    )
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <SpinLoading />
          <span className="loading-text">加载中...</span>
        </div>
      );
    }
    if (filteredProducts.length === 0) {
      return <Empty description={activeTab === 'hot' ? '暂无热门商品' : '暂无商品'} />;
    }
    return (
      <>
        <div className="products-grid">
          {filteredProducts.map(renderProductCard)}
        </div>
        {loadingMore && (
          <div className="loading-more">
            <SpinLoading />
            <span>加载中...</span>
          </div>
        )}
        {!loadingMore && products.length >= Math.min(total, 200) && (
          <div className="no-more">— 已加载全部 {total} 件商品 —</div>
        )}
      </>
    );
  };

  const hasMore = products.length < Math.min(total, 200);

  return (
    <div className="products-page">
      <div className="navbar-fixed">
        <NavBar backIcon={false}>精选好物</NavBar>
      </div>

      <div className="products-sticky-header">
        <div className="search-bar-wrapper" onClick={() => navigate('/search')}>
          <span className="search-icon">🔍</span>
          <span className="search-placeholder">搜索谷子商品...</span>
        </div>
        {!loading && ipTags.length > 0 && (
          <div className="filter-section">
            {renderIpFilterTags()}
          </div>
        )}
      </div>

      <Tabs activeKey={activeTab} onChange={handleTabChange} className="filter-tabs">
        <Tabs.Tab title="全部" key="all">
          <div className="products-content-wrapper">
            {renderCategorySidebar()}
            <div className="products-content" ref={contentRef} style={{ overflowY: 'auto', flex: 1 }}>
              {renderContent()}
            </div>
          </div>
        </Tabs.Tab>

        <Tabs.Tab title="🔥 热门" key="hot">
          <div className="products-content-wrapper">
            {renderCategorySidebar()}
            <div className="products-content" style={{ overflowY: 'auto', flex: 1 }}>
              {renderContent()}
            </div>
          </div>
        </Tabs.Tab>
      </Tabs>

      <div className="bottom-safe-area" />

      <div className="want-guzi-fab" onClick={() => navigate('/want-guzi')}>
        <span className="fab-icon">🎁</span>
        <span className="fab-text">求谷</span>
      </div>
    </div>
  );
};

export default ProductsPage;
