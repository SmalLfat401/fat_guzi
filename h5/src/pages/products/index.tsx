/**
 * 商品列表页
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  NavBar,
  SearchBar,
  Card,
  Image,
  Tag,
  Skeleton,
  Empty,
  Tabs,
  SpinLoading,
  DotLoading,
} from 'antd-mobile';
import { fetchProducts, fetchTags, fetchAllTags } from '@/api';
import type { GuziProductH5, GuziTag } from '@/types';

import './index.scss';

const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<GuziProductH5[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<GuziProductH5[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [ipTags, setIpTags] = useState<GuziTag[]>([]);
  const [categoryTags, setCategoryTags] = useState<GuziTag[]>([]);
  const [selectedIpTag, setSelectedIpTag] = useState<string | null>(null);
  const [selectedCategoryTag, setSelectedCategoryTag] = useState<string | null>(null);
  // 标签 ID→名称 映射（从 fetchAllTags 一次获取全部标签建立）
  const [tagIdToName, setTagIdToName] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    loadInitialData();
  }, []);

  // 初始化：加载全部标签（建立映射）+ 筛选器分类标签
  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 1. 获取全部标签并建立 ID→名称 映射
      const allTagMap = await fetchAllTags();
      setTagIdToName(allTagMap);

      // 2. 分别获取 IP 标签和类别标签（用于筛选器，is_active=true）
      const [ipTagsData, categoryTagsData] = await Promise.all([
        fetchTags('ip'),
        fetchTags('category'),
      ]);
      setIpTags(ipTagsData);
      setCategoryTags(categoryTagsData);

      // 3. 加载商品（使用标签映射填充 tagNames）
      await reloadProducts(allTagMap);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 根据当前筛选条件加载商品列表
  const reloadProducts = async (tagMap?: Map<string, string>) => {
    const map = tagMap || tagIdToName;
    const productsData = await fetchProducts(
      {
        is_active: true,
        ipTag: selectedIpTag || undefined,
        categoryTag: selectedCategoryTag || undefined,
      },
      map
    );
    setProducts(productsData);
    applyFilters(productsData, activeTab, searchValue);
  };

  // 重新加载数据（当标签筛选变化时）
  useEffect(() => {
    reloadProducts();
  }, [selectedIpTag, selectedCategoryTag]);

  // 应用筛选逻辑（仅用于前端筛选）
  const applyFilters = useCallback((
    allProducts: GuziProductH5[],
    tab: string,
    keyword: string,
  ) => {
    let filtered = [...allProducts];

    // Tab 筛选
    if (tab === 'hot') {
      filtered = filtered.filter(p => p.isHot);
    }

    // 关键词搜索（仅在后端筛选后进行补充筛选）
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(lowerKeyword) ||
        p.description?.toLowerCase().includes(lowerKeyword)
      );
    }

    setFilteredProducts(filtered);
  }, []);

  // 搜索处理
  const handleSearch = (value: string) => {
    setSearchValue(value);
    applyFilters(products, activeTab, value);
  };

  // Tab 切换处理
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    applyFilters(products, tab, searchValue);
  };

  // IP 标签筛选
  const handleIpTagFilter = (tagId: string | null) => {
    setSelectedIpTag(tagId);
  };

  // 类别标签筛选
  const handleCategoryTagFilter = (tagId: string | null) => {
    setSelectedCategoryTag(tagId);
  };

  // 获取商品图片（支持多图）
  const getProductImages = (product: GuziProductH5) => {
    if (product.images && product.images.length > 0) {
      return product.images;
    }
    return [product.cover];
  };

  // 渲染商品卡片
  const renderProductCard = (product: GuziProductH5) => {
    const images = getProductImages(product);
    const showImageCount = images.length > 1;

    return (
      <Card
        key={product.id}
        className="product-card"
        onClick={() => navigate(`/product/${product.id}`)}
      >
        <div className="product-image-wrapper">
          <Image src={product.cover} className="product-image" />
          {showImageCount && (
            <div className="image-count-badge">
              <span>{images.length}</span>
            </div>
          )}
        </div>
        <div className="product-info">
          <h4 className="product-title">{product.name}</h4>

          {/* 价格区域 */}
          <div className="product-price-row">
            <span className="product-price">¥{product.price.toFixed(2)}</span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="original-price">¥{product.originalPrice.toFixed(2)}</span>
            )}
          </div>

          {/* 标签 */}
          {product.tags && product.tags.length > 0 && (
            <div className="product-tags">
              {product.tags.slice(0, 3).map((tag, idx) => (
                <Tag key={idx} className="tag-item" color={idx === 0 ? 'primary' : 'medium'}>{tag}</Tag>
              ))}
            </div>
          )}

          {/* 店铺和平台信息 */}
          <div className="product-meta-row">
            {product.platformName && (
              <Tag color={product.platform === 'alimama' ? 'warning' : 'primary'} className="platform-tag">
                {product.platformName}
              </Tag>
            )}
            {product.shopName && (
              <span className="shop-name">{product.shopName}</span>
            )}
            {product.platforms.length > 1 && (
              <Tag color="success" className="multi-platform-tag">
                {product.platforms.length}个平台
              </Tag>
            )}
          </div>
        </div>
      </Card>
    );
  };

  // 渲染筛选标签
  const renderFilterTags = () => (
    <div className="filter-tags-section">
      {/* IP 标签筛选 */}
      {ipTags.length > 0 && (
        <div className="filter-row">
          <span className="filter-label">IP:</span>
          <div className="filter-tags">
            <Tag
              className={`filter-tag ${selectedIpTag === null ? 'active' : ''}`}
              onClick={() => handleIpTagFilter(null)}
            >
              全部
            </Tag>
            {ipTags.slice(0, 6).map(tag => (
              <Tag
                key={tag._id}
                className={`filter-tag ${selectedIpTag === tag._id ? 'active' : ''}`}
                color={tag.color}
                onClick={() => handleIpTagFilter(tag._id)}
              >
                {tag.name}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {/* 类别标签筛选 */}
      {categoryTags.length > 0 && (
        <div className="filter-row">
          <span className="filter-label">品类:</span>
          <div className="filter-tags">
            <Tag
              className={`filter-tag ${selectedCategoryTag === null ? 'active' : ''}`}
              onClick={() => handleCategoryTagFilter(null)}
            >
              全部
            </Tag>
            {categoryTags.slice(0, 6).map(tag => (
              <Tag
                key={tag._id}
                className={`filter-tag ${selectedCategoryTag === tag._id ? 'active' : ''}`}
                color="purple"
                onClick={() => handleCategoryTagFilter(tag._id)}
              >
                {tag.name}
              </Tag>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="products-page">
      {/* 固定顶部导航 */}
      <div className="navbar-fixed">
        <NavBar onBack={() => navigate(-1)}>精选好物</NavBar>
      </div>

      {/* SearchBar + TabBar（sticky 吸附在导航栏下方） */}
      <div className="products-sticky-header">
        <SearchBar
          placeholder="搜索谷子商品..."
          value={searchValue}
          onChange={handleSearch}
          className="search-bar"
        />
      </div>

      {/* 标签筛选区域 */}
      {!loading && (ipTags.length > 0 || categoryTags.length > 0) && (
        <div className="filter-section">
          {renderFilterTags()}
        </div>
      )}

      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        className="filter-tabs"
      >
        <Tabs.Tab title="全部" key="all">
          <div className="products-content">
            {loading ? (
              <div className="loading-container">
                <SpinLoading />
                <span className="loading-text">加载中...</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <Empty description="暂无商品" />
            ) : (
              <div className="products-grid">
                {filteredProducts.map(renderProductCard)}
              </div>
            )}
          </div>
        </Tabs.Tab>

        <Tabs.Tab title={<>🔥 热门</>} key="hot">
          <div className="products-content">
            {loading ? (
              <div className="loading-container">
                <SpinLoading />
                <span className="loading-text">加载中...</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <Empty description="暂无热门商品" />
            ) : (
              <div className="products-grid">
                {filteredProducts.map(renderProductCard)}
              </div>
            )}
          </div>
        </Tabs.Tab>
      </Tabs>

      {/* 底部安全区占位 */}
      <div className="bottom-safe-area" />
    </div>
  );
};

export default ProductsPage;
