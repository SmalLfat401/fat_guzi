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
import { fetchProducts, fetchCategories, fetchTags } from '@/api';
import type { GuziProductH5, GuziCategoryWithSubs, GuziTag } from '@/types';

import './index.scss';

const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<GuziProductH5[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<GuziProductH5[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [ipTags, setIpTags] = useState<GuziTag[]>([]);
  const [categories, setCategories] = useState<GuziCategoryWithSubs[]>([]);
  // 从 ipTags 构建 IP标签 ID→名称映射
  const ipTagIdToName = React.useMemo(
    () => new Map(ipTags.map(t => [t._id, t.name])),
    [ipTags]
  );
  // 从 categories 构建 sub_category ID→名称映射
  const subCatIdToName = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories) {
      for (const sub of cat.sub_categories || []) {
        map.set(sub._id, sub.name);
      }
    }
    return map;
  }, [categories]);

  // 筛选状态
  const [selectedIpTag, setSelectedIpTag] = useState<string | null>(null);
  // 级联选择：一级分类ID + 二级分类ID
  const [cascadeValue, setCascadeValue] = useState<[string, string] | null>(null);

  // 计算当前选中的二级分类ID（用于API筛选）
  const selectedSubCatId = cascadeValue?.[1] || null;

  useEffect(() => {
    loadInitialData();
  }, []);

  // 初始化：加载分类数据 + IP标签 + 商品
  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 并行获取：一级分类（含二级）和 IP 标签
      const [categoriesData, ipTagsData] = await Promise.all([
        fetchCategories(true),
        fetchTags('ip'),
      ]);
      setCategories(categoriesData);
      setIpTags(ipTagsData);

      // 构建映射后加载商品
      const ipMap = new Map(ipTagsData.map((t: GuziTag) => [t._id, t.name]));
      const subMap = new Map<string, string>();
      for (const cat of categoriesData) {
        for (const sub of cat.sub_categories || []) {
          subMap.set(sub._id, sub.name);
        }
      }
      await reloadProducts(subMap, ipMap);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 根据当前筛选条件加载商品列表
  const reloadProducts = async (
    subMap?: Map<string, string>,
    ipMap?: Map<string, string>
  ) => {
    const subCatMap = subMap || subCatIdToName;
    const ipMapData = ipMap || ipTagIdToName;
    const productsData = await fetchProducts(
      {
        is_active: true,
        ipTag: selectedIpTag || undefined,
        categoryTag: selectedSubCatId || undefined,
      },
      subCatMap,
      ipMapData
    );
    setProducts(productsData);
    applyFilters(productsData, activeTab, searchValue);
  };

  // 重新加载数据（当标签筛选变化时）
  useEffect(() => {
    reloadProducts();
  }, [selectedIpTag, selectedSubCatId]);

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

  // 类别标签筛选（级联：返回 [一级ID, 二级ID] 或 null）
  const handleCategoryTagFilter = (value: [string, string] | null) => {
    setCascadeValue(value);
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

          {/* 标签：IP标签 + 类别标签分开展示 */}
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

  // 渲染 IP 标签（横向滚动）
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

  return (
    <div className="products-page">
      {/* 固定顶部导航（tabs 页无返回按钮） */}
      <div className="navbar-fixed">
        <NavBar backIcon={false}>精选好物</NavBar>
      </div>

      {/* SearchBar + 标签筛选（sticky 整体吸附在导航栏下方） */}
      <div className="products-sticky-header">
        <SearchBar
          placeholder="搜索谷子商品..."
          value={searchValue}
          onChange={handleSearch}
          className="search-bar"
        />

        {/* IP 标签横向滚动筛选 */}
        {!loading && ipTags.length > 0 && (
          <div className="filter-section">
            {renderIpFilterTags()}
          </div>
        )}
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        className="filter-tabs"
      >
        <Tabs.Tab title="全部" key="all">
          <div className="products-content-wrapper">
            {/* 左侧一二级级联分类侧边栏 */}
            {!loading && categories.length > 0 && (
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
            )}
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
          </div>
        </Tabs.Tab>

        <Tabs.Tab title={<>🔥 热门</>} key="hot">
          <div className="products-content-wrapper">
            {/* 左侧一二级级联分类侧边栏 */}
            {!loading && categories.length > 0 && (
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
            )}
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
          </div>
        </Tabs.Tab>
      </Tabs>

      {/* 底部安全区占位 */}
      <div className="bottom-safe-area" />

      {/* 求谷悬浮按钮 */}
      <div className="want-guzi-fab" onClick={() => navigate('/want-guzi')}>
        <span className="fab-icon">🎁</span>
        <span className="fab-text">求谷</span>
      </div>
    </div>
  );
};

export default ProductsPage;
