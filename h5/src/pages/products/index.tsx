/**
 * 商品列表页
 */
import React, { useEffect, useState } from 'react';
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
} from 'antd-mobile';
import { fetchProducts } from '@/api';
import type { GuziProduct } from '@/types';

import './index.scss';

const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<GuziProduct[]>([]);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await fetchProducts({ keyword: searchValue });
      setProducts(data);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchValue(value);
    loadProducts();
  };

  const renderProductCard = (product: GuziProduct) => (
    <Card
      key={product.id}
      className="product-card"
      onClick={() => navigate(`/product/${product.id}`)}
    >
      <Image src={product.cover} className="product-image" />
      <div className="product-info">
        <h4 className="product-title">{product.name}</h4>
        <div className="product-price-row">
          <span className="product-price">¥{product.price}</span>
          {product.originalPrice && (
            <span className="original-price">¥{product.originalPrice}</span>
          )}
        </div>
        {product.tags && product.tags.length > 0 && (
          <div className="product-tags">
            {product.tags.slice(0, 2).map((tag) => (
              <Tag key={tag} className="tag-item">{tag}</Tag>
            ))}
          </div>
        )}
        {product.shopName && (
          <div className="shop-name">{product.shopName}</div>
        )}
      </div>
    </Card>
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

      <Tabs defaultActiveKey="all" className="filter-tabs">
        <Tabs.Tab title="全部" key="all">
          <div className="products-content">
            {loading ? (
              <div className="products-grid">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="product-card">
                    <Skeleton animated className="skeleton-image" />
                    <Skeleton animated className="skeleton-text" />
                  </Card>
                ))}
              </div>
            ) : products.length === 0 ? (
              <Empty description="暂无商品" />
            ) : (
              <div className="products-grid">
                {products.map(renderProductCard)}
              </div>
            )}
          </div>
        </Tabs.Tab>

        <Tabs.Tab title="🔥 热门" key="hot">
          <div className="products-content">
            {loading ? (
              <div className="products-grid">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="product-card">
                    <Skeleton animated />
                  </Card>
                ))}
              </div>
            ) : products.filter((p) => p.isHot).length === 0 ? (
              <Empty description="暂无热门商品" />
            ) : (
              <div className="products-grid">
                {products.filter((p) => p.isHot).map(renderProductCard)}
              </div>
            )}
          </div>
        </Tabs.Tab>
      </Tabs>
    </div>
  );
};

export default ProductsPage;
