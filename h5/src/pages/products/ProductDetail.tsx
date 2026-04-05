/**
 * 商品详情页
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  NavBar,
  Swiper,
  Tag,
  Button,
  Skeleton,
  Toast,
  Dialog,
} from 'antd-mobile';
import { ArrowLeft, Share, Star, Location, Clock, ShoppingCart } from '@/components/icons';
import { fetchProductDetail } from '@/api';
import type { GuziProduct } from '@/types';
import dayjs from 'dayjs';
import './ProductDetail.scss';

const FAVORITES_KEY = 'guzi_favorites';

const getFavorites = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
  } catch {
    return [];
  }
};

const toggleFavorite = (productId: string): boolean => {
  const favs = getFavorites();
  const isFav = favs.includes(productId);
  if (isFav) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs.filter((id) => id !== productId)));
  } else {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs, productId]));
  }
  return !isFav;
};

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<GuziProduct | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    if (id) {
      loadProduct(id);
      setIsFavorited(getFavorites().includes(id));
    }
  }, [id]);

  const loadProduct = async (productId: string) => {
    try {
      setLoading(true);
      const data = await fetchProductDetail(productId);
      setProduct(data);
    } catch (error) {
      console.error('Failed to load product:', error);
      Toast.show({ content: '加载失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = useCallback(() => {
    if (!product) return;
    const nowFavorited = toggleFavorite(product.id);
    setIsFavorited(nowFavorited);
    Toast.show({ content: nowFavorited ? '已添加收藏' : '已取消收藏' });
  }, [product]);

  const handleShare = useCallback(async () => {
    if (!product) return;
    const shareText = `发现一个超棒的谷子：${product.name}，仅需 ¥${product.price}`;
    const shareUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, text: shareText, url: shareUrl });
      } catch {
        // 用户取消分享，不做处理
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        Toast.show({ content: '链接已复制到剪贴板' });
      } catch {
        Toast.show({ content: '复制失败，请长按复制' });
      }
    }
  }, [product]);

  const handleBuy = useCallback(() => {
    if (!product) return;
    if (product.productUrl) {
      window.location.href = product.productUrl;
    } else {
      Dialog.alert({
        title: '购买提示',
        content: '该商品暂无购买链接，请联系客服获取购买方式',
        confirmText: '我知道了',
      });
    }
  }, [product]);

  const getPlatformTag = (platform?: GuziProduct['platform']) => {
    if (!platform) return null;
    const colors: Record<string, string> = {
      taobao: '#FF5000',
      jd: '#E1251B',
      pdd: '#E1251B',
      wechat: '#07C160',
    };
    const names: Record<string, string> = {
      taobao: '淘宝',
      jd: '京东',
      pdd: '拼多多',
      wechat: '微信',
    };
    return (
      <Tag color={colors[platform]} className="platform-tag">
        {names[platform]}
      </Tag>
    );
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
          <div className="empty-icon">😢</div>
          <div className="empty-text">商品不存在</div>
          <Button onClick={() => navigate('/products')}>返回商品列表</Button>
        </div>
      </div>
    );
  }

  const images = product.images?.length ? product.images : [product.cover];

  return (
    <div className="product-detail-page">
      {/* 固定顶部导航 */}
      <div className="navbar-fixed">
        <NavBar
          onBack={() => navigate(-1)}
          right={
            <div className="nav-actions">
              <span onClick={handleShare} className="action-icon-btn">
                <Share />
              </span>
              <span onClick={handleToggleFavorite} className="action-icon-btn star-nav-btn">
                <Star className={isFavorited ? 'star-active' : ''} />
              </span>
            </div>
          }
        />
      </div>

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
          {product.platform && getPlatformTag(product.platform)}
        </div>

        <h1 className="product-title">{product.name}</h1>

        {product.description && (
          <p className="product-desc">{product.description}</p>
        )}

        {/* 商品元信息 */}
        <div className="product-meta">
          {product.stock !== undefined && (
            <span className="meta-item">
              {product.stock > 0 ? `库存 ${product.stock} 件` : '已售罄'}
            </span>
          )}
          {product.sales !== undefined && (
            <span className="meta-item">已售 {product.sales} 件</span>
          )}
          {product.rating !== undefined && (
            <span className="meta-item">⭐ {product.rating}</span>
          )}
        </div>

        {product.tags?.length > 0 && (
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
            <svg className="arrow-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>

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
          <div className="detail-id">商品ID：{product.id}</div>
        </div>
      </div>

      {/* 底部安全区占位 */}
      <div className="bottom-safe-area" />

      {/* 底部操作栏 */}
      <div className="action-bar">
        <Button className="action-btn favorite-btn" onClick={handleToggleFavorite}>
          <Star className={isFavorited ? 'star-active' : ''} />
          <span>{isFavorited ? '已收藏' : '收藏'}</span>
        </Button>
        <Button className="action-btn service-btn" onClick={handleShare}>
          <Share />
          <span>分享</span>
        </Button>
        <Button
          color="primary"
          className="buy-btn"
          onClick={handleBuy}
          disabled={product.stock === 0}
        >
          <ShoppingCart />
          <span>立即购买</span>
        </Button>
      </div>
    </div>
  );
};

export default ProductDetailPage;
