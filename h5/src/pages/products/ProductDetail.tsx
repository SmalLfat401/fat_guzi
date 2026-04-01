/**
 * 商品详情页
 */
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  NavBar,
  Swiper,
  Tag,
  Button,
  Skeleton,
} from 'antd-mobile';
import { ArrowLeft, Share, Star, Location, Clock } from '@/components/icons';
import { fetchProductDetail } from '@/api';
import type { GuziProduct } from '@/types';
import dayjs from 'dayjs';
import './index.scss';

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<GuziProduct | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (id) {
      loadProduct(id);
    }
  }, [id]);

  const loadProduct = async (productId: string) => {
    try {
      setLoading(true);
      const data = await fetchProductDetail(productId);
      setProduct(data);
    } catch (error) {
      console.error('Failed to load product:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product?.name,
        text: `发现一个超棒的谷子：${product?.name}，仅需 ¥${product?.price}`,
        url: window.location.href,
      });
    }
  };

  const handleBuy = () => {
    // TODO: 实现购买跳转
    console.log('Buy now:', product?.id);
  };

  const handleShareProduct = () => {
    // TODO: 实现分享赚佣金
    console.log('Share product:', product?.id);
  };

  if (loading) {
    return (
      <div className="product-detail-page">
        <NavBar onBack={() => navigate(-1)} />
        <div className="loading-content">
          <Skeleton animated className="skeleton-image" />
          <Skeleton animated className="skeleton-title" />
          <Skeleton animated className="skeleton-price" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-detail-page">
        <NavBar onBack={() => navigate(-1)} />
        <div className="empty-content">
          <div className="empty-text">商品不存在</div>
          <Button onClick={() => navigate('/products')}>返回商品列表</Button>
        </div>
      </div>
    );
  }

  const images = product.images || [product.cover];

  return (
    <div className="product-detail-page">
      <NavBar
        onBack={() => navigate(-1)}
        right={
          <div className="nav-actions">
            <Share onClick={handleShare} />
            <Star />
          </div>
        }
      />

      {/* 商品图片轮播 */}
      <div className="product-images">
        <Swiper
          autoplay
          loop
          onIndexChange={(index) => setActiveImage(index)}
          className="product-swiper"
        >
          {images.map((img, index) => (
            <Swiper.Item key={index}>
              <img src={img} alt={product.name} className="product-image" />
            </Swiper.Item>
          ))}
        </Swiper>
        <div className="image-indicator">
          {activeImage + 1} / {images.length}
        </div>
      </div>

      {/* 商品基本信息 */}
      <div className="product-base">
        <div className="price-section">
          <div className="current-price">
            <span className="price-yuan">¥</span>
            <span className="price-value">{product.price}</span>
            {product.originalPrice && (
              <span className="original-price">¥{product.originalPrice}</span>
            )}
          </div>
          {product.isCommission && (
            <Tag color="#FF6B9D" className="commission-tag">
              分享赚 ¥{product.commissionAmount}
            </Tag>
          )}
        </div>

        <h1 className="product-title">{product.name}</h1>

        {product.description && (
          <p className="product-desc">{product.description}</p>
        )}

        {product.tags && product.tags.length > 0 && (
          <div className="product-tags">
            {product.tags.map((tag) => (
              <Tag key={tag} className="tag-item">{tag}</Tag>
            ))}
          </div>
        )}

        {product.shopName && (
          <div className="shop-info">
            <Location />
            <span>{product.shopName}</span>
          </div>
        )}
      </div>

      {/* 分佣说明 */}
      {product.isCommission && (
        <div className="commission-section">
          <div className="section-title">
            <span className="title-icon">💰</span>
            <span>分享赚佣金</span>
          </div>
          <div className="commission-info">
            <div className="commission-item">
              <span className="label">商品价格</span>
              <span className="value">¥{product.price}</span>
            </div>
            <div className="commission-item highlight">
              <span className="label">预估佣金</span>
              <span className="value">¥{product.commissionAmount}</span>
            </div>
            <div className="commission-item">
              <span className="label">佣金比例</span>
              <span className="value">
                {((product.commissionAmount! / product.price) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
          <Button color="primary" block onClick={handleShareProduct} className="share-btn">
            分享赚佣金
          </Button>
        </div>
      )}

      {/* 商品详情 */}
      <div className="detail-section">
        <div className="section-title">
          <span className="title-icon">📦</span>
          <span>商品详情</span>
        </div>
        <div className="detail-content">
          {product.description && <p>{product.description}</p>}
          {product.createdAt && (
            <div className="detail-meta">
              <Clock />
              <span>上架时间：{dayjs(product.createdAt).format('YYYY-MM-DD')}</span>
            </div>
          )}
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="action-bar">
        <Button className="action-btn favorite-btn">
          <Star />
          <span>收藏</span>
        </Button>
        <Button className="action-btn service-btn" onClick={handleShareProduct}>
          <Share />
          <span>分享</span>
        </Button>
        <Button color="primary" className="buy-btn" onClick={handleBuy}>
          立即购买
        </Button>
      </div>
    </div>
  );
};

export default ProductDetailPage;
