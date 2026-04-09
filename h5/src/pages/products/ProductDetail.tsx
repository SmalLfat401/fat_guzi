/**
 * 商品详情页
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  NavBar,
  Swiper,
  ImageViewer,
  Tag,
  Button,
  Skeleton,
  Toast,
  ActionSheet,
} from 'antd-mobile';
import { Share, Star, Clock, Fire, Wallet, Package, Store, Truck, CreditCard } from '@/components/icons';
import { fetchProductDetail, fetchAllTags, generateTkl } from '@/api';
import type { GuziProductH5 } from '@/types';
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
  const [product, setProduct] = useState<GuziProductH5 | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [generatingTkl, setGeneratingTkl] = useState(false);
  const [selectedPlatformIndex, setSelectedPlatformIndex] = useState(0);

  // 初始化：加载标签映射 + 商品详情
  const loadInitialData = async () => {
    try {
      const tagMap = await fetchAllTags();
      if (id) {
        const data = await fetchProductDetail(id, tagMap);
        if (data) {
          setProduct(data);
          setIsFavorited(getFavorites().includes(id));
        }
      }
    } catch (error) {
      console.error('加载商品失败:', error);
      Toast.show({ content: '加载失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // 收藏/取消收藏
  const handleToggleFavorite = useCallback(() => {
    if (!product) return;
    const nowFavorited = toggleFavorite(product.id);
    setIsFavorited(nowFavorited);
    Toast.show({ content: nowFavorited ? '已添加收藏' : '已取消收藏' });
  }, [product]);

  // 分享（复制本页链接）
  const handleShare = useCallback(async () => {
    if (!product) return;
    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
      Toast.show({ content: '链接已复制到剪贴板' });
    } catch {
      Toast.show({ content: '复制失败，请长按复制' });
    }
  }, [product]);

  // 复制淘口令
  const handleCopyTkl = useCallback(async (tkl: string) => {
    try {
      await navigator.clipboard.writeText(tkl);
      Toast.show({ content: '淘口令已复制，可直接打开淘宝APP' });
    } catch {
      Toast.show({ content: '复制失败，请长按复制' });
    }
  }, []);

  // 实际执行淘口令生成并复制
  const doGenerateAndCopy = useCallback(async (platformIndex: number) => {
    if (!product) return;

    setGeneratingTkl(true);
    try {
      const updatedPlatform = await generateTkl(product.id, platformIndex);
      if (updatedPlatform) {
        setProduct(prev => {
          if (!prev) return prev;
          const newPlatforms = [...prev.platforms];
          newPlatforms[platformIndex] = updatedPlatform;
          return { ...prev, platforms: newPlatforms };
        });
        // 生成成功后自动复制组合好的淘口令格式
        if (updatedPlatform.tkl) {
          const title = product.name;
          const price = updatedPlatform.price.toFixed(2);
          // 组合格式：🎁【商品名】淘口令 + 到手 **价格元**
          const tklText = `🎁【${title}】${updatedPlatform.tkl}\n到手 **${price}元**`;
          await navigator.clipboard.writeText(tklText);
          Toast.show({ content: '淘口令已复制，可直接打开淘宝APP' });
        } else {
          Toast.show({ content: '淘口令生成成功' });
        }
      }
    } catch (error) {
      Toast.show({ content: (error as Error).message || '生成淘口令失败' });
    } finally {
      setGeneratingTkl(false);
    }
  }, [product]);

  // 获取淘口令（点击后先选平台，再生成，生成后自动复制）
  const handleGetTkl = useCallback(async () => {
    if (!product) return;

    const platforms = product.platforms || [];
    if (platforms.length === 0) {
      Toast.show({ content: '暂无购买链接' });
      return;
    }

    // 如果有多个平台，先让用户选择
    if (platforms.length > 1) {
      const platformNames = platforms.map((p) => p.platformName || p.platformId);
      ActionSheet.show({
        actions: platformNames.map((name, index) => ({
          text: name,
          key: index,
          onClick: () => {
            setSelectedPlatformIndex(index);
            doGenerateAndCopy(index);
          },
        })),
        cancelText: '取消',
      });
    } else {
      // 只有一个平台，直接生成并复制
      doGenerateAndCopy(0);
    }
  }, [product, doGenerateAndCopy]);

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
  const currentPlatform = product.platforms?.[selectedPlatformIndex];
  const hasTkl = !!currentPlatform?.tkl;

  return (
    <div className="product-detail-page">
      {/* 固定顶部导航 */}
      <div className="navbar-fixed">
        <NavBar onBack={() => navigate(-1)}>
          {product.name}
        </NavBar>
      </div>

      {/* 商品图片轮播 */}
      <div className="product-images">
        <Swiper
          loop
          onIndexChange={(index) => setActiveImage(index)}
          className="product-swiper"
        >
          {images.map((img, index) => (
            <Swiper.Item key={index}>
              <img
                src={img}
                alt={product.name}
                className="product-image"
                onClick={() => setImageViewerVisible(true)}
              />
            </Swiper.Item>
          ))}
        </Swiper>
        {images.length > 1 && (
          <div className="image-indicator">
            {activeImage + 1} / {images.length}
          </div>
        )}
      </div>

      {/* 商品基本信息 */}
      <div className="product-base">
        <h1 className="product-title">{product.name}</h1>

        {/* 价格区域 */}
        <div className="price-section">
          <div className="price-row">
            <div className="current-price">
              <span className="price-yuan">¥</span>
              <span className="price-value">{product.price.toFixed(2)}</span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="original-price">¥{product.originalPrice.toFixed(2)}</span>
              )}
            </div>
            {product.discountPrice && product.discountPrice < product.price && (
              <Tag color="danger" className="discount-tag">
                券后¥{product.discountPrice.toFixed(2)}
              </Tag>
            )}
          </div>

          {/* 销量和年销量 */}
          <div className="price-ext-info">
            {product.sales !== undefined && product.sales > 0 && (
              <span className="ext-item">
                <Fire /> 30天 {product.sales} 件
              </span>
            )}
            {product.annualVol && (
              <span className="ext-item">
                <Package /> 年销 {product.annualVol}
              </span>
            )}
            {/* 包邮和花呗标签 */}
            {currentPlatform?.freeShipment && (
              <span className="ext-item free-shipping">
                <Truck /> 包邮
              </span>
            )}
            {currentPlatform?.isPrepay && (
              <span className="ext-item prepay">
                <CreditCard /> 花呗
              </span>
            )}
          </div>

          {/* 推广标签 */}
          {currentPlatform?.promotionTags && currentPlatform.promotionTags.length > 0 && (
            <div className="promotion-tags">
              {currentPlatform.promotionTags.slice(0, 4).map((tag, idx) => (
                <Tag key={idx} className="promotion-tag" color={tag.includes('包邮') ? 'success' : 'warning'}>
                  {tag}
                </Tag>
              ))}
            </div>
          )}
        </div>

        {/* 佣金信息 */}
        {product.commissionRate !== undefined && product.commissionRate > 0 && (
          <div className="commission-section">
            <div className="commission-tag">
              <Wallet /> 返佣 {product.commissionRate}% ≈ ¥{product.commissionAmount?.toFixed(2) || '0.00'}
            </div>
          </div>
        )}

        {/* 商品标签：IP标签 + 类别标签分开展示 */}
        {(product.ipTags?.length || product.categoryTags?.length) && (
          <div className="product-tags">
            {product.ipTags?.map((tag, idx) => (
              <Tag key={`ip-${idx}`} className="tag-item tag-ip">{tag}</Tag>
            ))}
            {product.categoryTags?.map((tag, idx) => (
              <Tag key={`cat-${idx}`} className="tag-item tag-category">{tag}</Tag>
            ))}
          </div>
        )}

      </div>

      {/* 店铺信息卡片 */}
      {product.shopName && (
        <div className="shop-card">
          <div className="shop-icon">
            <Store />
          </div>
          <div className="shop-info">
            <div className="shop-name">{product.shopName}</div>
            <div className="shop-meta-row">
              {currentPlatform?.shopType && (
                <Tag color={currentPlatform.shopType === '天猫' ? 'danger' : 'warning'} className="shop-type-tag">
                  {currentPlatform.shopType}
                </Tag>
              )}
              {currentPlatform?.provcity && (
                <span className="shop-provcity">{currentPlatform.provcity}</span>
              )}
              {product.brandName && (
                <Tag color="primary" className="brand-tag">{product.brandName}</Tag>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 底部安全区占位 */}
      <div className="bottom-safe-area" />

      {/* 底部操作栏 */}
      <div className="action-bar">
        <div className="action-bar-left">
          <Button className="action-btn favorite-btn" onClick={handleToggleFavorite}>
            <Star className={isFavorited ? 'star-active' : ''} />
            <span>{isFavorited ? '已收藏' : '收藏'}</span>
          </Button>
          <Button className="action-btn service-btn" onClick={handleShare}>
            <Share />
            <span>分享</span>
          </Button>
        </div>
        <div className="action-bar-right">
          {hasTkl ? (
            <Button
              color="primary"
              className="buy-btn"
              onClick={() => {
                const title = product.name;
                const price = currentPlatform.price.toFixed(2);
                const tklText = `🎁【${title}】${currentPlatform.tkl}\n到手 **${price}元**`;
                handleCopyTkl(tklText);
              }}
            >
              <span>复制淘口令</span>
            </Button>
          ) : (
            <Button color="primary" className="buy-btn" onClick={handleGetTkl} loading={generatingTkl}>
              <span>获取淘口令</span>
            </Button>
          )}
        </div>
      </div>

      {/* 图片大图预览 */}
      <ImageViewer.Multi
        images={images}
        defaultIndex={activeImage}
        visible={imageViewerVisible}
        onClose={() => setImageViewerVisible(false)}
      />
    </div>
  );
};

export default ProductDetailPage;