import { useState, useEffect } from 'react';
import { message, Modal, Space, Tag, Input, Button, Dropdown, Select, Tooltip, Image, Checkbox } from 'antd';
import type { MenuProps } from 'antd';
import {
  CloudDownloadOutlined,
  CloudSyncOutlined,
  ShoppingOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  DollarOutlined,
  StarOutlined,
  CopyOutlined,
  EditOutlined,
  FilterOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { GuziProduct, ProductSearchItem } from '../../types/guziProduct';
import type { GuziTag } from '../../types/guziTag';
import { guziProductApi } from '../../api/guziProduct';
import { guziTagApi } from '../../api/guziTag';
import { Table, Switch, Form, Spin, Drawer, Badge } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import '../../styles/global.scss';

dayjs.locale('zh-cn');

// 模拟多平台搜索结果（用于演示）
const mockSearchResults: ProductSearchItem[] = [
  {
    title: '【正版】咒术回战 虎杖悠仁 吧唧 徽章 动漫周边',
    image_url: 'https://img.alicdn.com/bao/uploaded/i1/123456789.jpg',
    platforms: [
      {
        platform_id: 'alimama',
        platform_name: '淘宝',
        platform_product_id: 'TB001',
        url: 'https://s.click.taobao.com/xxx',
        price: 25.8,
        commission_rate: 10.5,
        commission_amount: 2.71,
        description: '咒术回战正版周边',
      },
      {
        platform_id: 'jd',
        platform_name: '京东',
        platform_product_id: 'JD001',
        url: 'https://union.jd.com/xxx',
        price: 28.0,
        commission_rate: 8.0,
        commission_amount: 2.24,
        description: '咒术回战正版周边',
      },
      {
        platform_id: 'pdd',
        platform_name: '拼多多',
        platform_product_id: 'PDD001',
        url: 'https://youxuan.pinduoduo.com/xxx',
        price: 23.0,
        commission_rate: 5.0,
        commission_amount: 1.15,
        description: '咒术回战正版周边',
      },
    ],
    lowest_price: 23.0,
    highest_commission: 2.71,
    recommended_platform: 'alimama',
  },
  {
    title: '排球少年 及川彻 Q版手办 动漫模型',
    image_url: 'https://img.alicdn.com/bao/uploaded/i2/123456789.jpg',
    platforms: [
      {
        platform_id: 'alimama',
        platform_name: '淘宝',
        platform_product_id: 'TB002',
        url: 'https://s.click.taobao.com/yyy',
        price: 158.0,
        commission_rate: 12.0,
        commission_amount: 18.96,
        description: '排球少年及川彻Q版手办',
      },
      {
        platform_id: 'jd',
        platform_name: '京东',
        platform_product_id: 'JD002',
        url: 'https://union.jd.com/yyy',
        price: 165.0,
        commission_rate: 10.0,
        commission_amount: 16.5,
        description: '排球少年及川彻Q版手办',
      },
    ],
    lowest_price: 158.0,
    highest_commission: 18.96,
    recommended_platform: 'alimama',
  },
  {
    title: '原神 钟离 流沙票夹 金属周边',
    image_url: 'https://img.alicdn.com/bao/uploaded/i3/123456789.jpg',
    platforms: [
      {
        platform_id: 'alimama',
        platform_name: '淘宝',
        platform_product_id: 'TB003',
        url: 'https://s.click.taobao.com/zzz',
        price: 45.0,
        commission_rate: 8.5,
        commission_amount: 3.83,
        description: '原神钟离同款流沙票夹',
      },
      {
        platform_id: 'pdd',
        platform_name: '拼多多',
        platform_product_id: 'PDD003',
        url: 'https://youxuan.pinduoduo.com/zzz',
        price: 38.0,
        commission_rate: 6.0,
        commission_amount: 2.28,
        description: '原神钟离同款流沙票夹',
      },
    ],
    lowest_price: 38.0,
    highest_commission: 3.83,
    recommended_platform: 'alimama',
  },
];

// 模拟已保存的商品数据（支持多平台）
const mockProducts: GuziProduct[] = [];

export default function GuziProductList() {
  const [products, setProducts] = useState<GuziProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchResults, setSearchResults] = useState<ProductSearchItem[]>([]);
  const [selectedRows, setSelectedRows] = useState<ProductSearchItem[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedProductForCompare, setSelectedProductForCompare] = useState<GuziProduct | null>(null);
  const [compareDrawerVisible, setCompareDrawerVisible] = useState(false);
  const [generatingTklMap, setGeneratingTklMap] = useState<Record<string, boolean>>({});
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  // 搜索分页状态
  const [searchPagination, setSearchPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  // 排序状态
  const [searchSort, setSearchSort] = useState('tk_rate_des');
  // 跟踪已添加的商品标题（用于在列表中标记）
  const [addedProductTitles, setAddedProductTitles] = useState<Set<string>>(new Set());
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // 标签相关状态
  const [ipTags, setIpTags] = useState<GuziTag[]>([]);
  const [categoryTags, setCategoryTags] = useState<GuziTag[]>([]);
  const [selectedIpTag, setSelectedIpTag] = useState<string | undefined>(undefined);
  const [selectedCategoryTag, setSelectedCategoryTag] = useState<string | undefined>(undefined);

  // 搜索 Modal 专用的标签/关键词状态
  const [searchIpTag, setSearchIpTag] = useState<string | undefined>(undefined);
  const [searchCategoryTag, setSearchCategoryTag] = useState<string | undefined>(undefined);

  // 编辑相关状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<GuziProduct | null>(null);
  const [editForm] = Form.useForm();

  // 获取详情相关状态
  const [fetchDetailModalVisible, setFetchDetailModalVisible] = useState(false);
  const [fetchingDetailId, setFetchingDetailId] = useState<string | null>(null); // 当前正在获取详情的商品ID
  const [fetchDetailLoading, setFetchDetailLoading] = useState(false);
  const [fetchDetailResult, setFetchDetailResult] = useState<{
    success: boolean;
    message: string;
    detail?: {
      title?: string;
      price?: number;
      commission_rate?: number;
      commission_amount?: number;
      volume?: number;
      shop_title?: string;
      free_shipment?: boolean;
      is_prepay?: boolean;
      promotion_tags?: string[];
      small_images_count?: number;
    };
  } | null>(null);

  // 批量获取详情相关状态
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchFetchModalVisible, setBatchFetchModalVisible] = useState(false);
  const [batchFetchLoading, setBatchFetchLoading] = useState(false);
  const [batchFetchResults, setBatchFetchResults] = useState<{
    total: number;
    success_count: number;
    skipped_count: number;
    failed_count: number;
    results: Array<{
      product_id: string;
      status: string;
      message?: string;
    }>;
  } | null>(null);
  // 是否包含已爬取过的数据进行刷新（默认不包含，仅处理未爬取的）
  const [batchFetchIncludeFetched, setBatchFetchIncludeFetched] = useState(false);

  // 获取商品列表
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await guziProductApi.getProducts({
        skip: (pagination.current - 1) * pagination.pageSize,
        limit: pagination.pageSize,
        is_active: filterActive,
        ip_tag: selectedIpTag,
        category_tag: selectedCategoryTag,
      });
      setProducts(data);
      // 获取总数
      const total = await guziProductApi.getProductCount({
        is_active: filterActive,
        ip_tag: selectedIpTag,
        category_tag: selectedCategoryTag,
      });
      setPagination(prev => ({ ...prev, total }));
      // 刷新数据时清空选中状态，避免旧选择与新数据混淆
      setSelectedRowKeys([]);
    } catch (error) {
      // 后端未实现时使用模拟数据
      setProducts(mockProducts);
      setPagination(prev => ({ ...prev, total: mockProducts.length }));
      setSelectedRowKeys([]);
    } finally {
      setLoading(false);
    }
  };

  // 获取标签列表
  const fetchTags = async () => {
    try {
      const [ipData, categoryData] = await Promise.all([
        guziTagApi.getTags({ tag_type: 'ip', is_active: true, limit: 100 }),
        guziTagApi.getTags({ tag_type: 'category', is_active: true, limit: 100 }),
      ]);
      setIpTags(ipData.items);
      setCategoryTags(categoryData.items);
    } catch (error) {
      console.error('加载标签失败:', error);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [pagination.current, pagination.pageSize, filterActive, selectedIpTag, selectedCategoryTag]);

  // 搜索谷子商品
  const handleSearch = async (keyword: string) => {
    const trimmedKeyword = keyword.trim();

    // 组装最终搜索词：IP标签名 + 类别标签名 + 用户关键词
    const parts: string[] = [];
    if (searchIpTag) {
      const tag = ipTags.find(t => t._id === searchIpTag);
      if (tag) parts.push(tag.name);
    }
    if (searchCategoryTag) {
      const tag = categoryTags.find(t => t._id === searchCategoryTag);
      if (tag) parts.push(tag.name);
    }
    if (trimmedKeyword) {
      parts.push(trimmedKeyword);
    }

    const finalKeyword = parts.join(' ');

    if (!finalKeyword) {
      message.warning('请至少选择一个标签或输入关键词');
      return;
    }

    setSearchLoading(true);
    try {
      // 从第1页开始搜索，重置分页
      setSearchPagination(prev => ({ ...prev, current: 1 }));
      const response = await guziProductApi.searchAlimama(finalKeyword, 1, searchPagination.pageSize, searchSort);
      setSearchResults(response.items);
      setSearchPagination(prev => ({ ...prev, total: response.total }));
    } catch (error) {
      // 后端未实现时使用模拟数据
      setSearchResults(mockSearchResults);
      setSearchPagination(prev => ({ ...prev, total: mockSearchResults.length }));
    } finally {
      setSearchLoading(false);
    }
  };

  // 搜索结果分页切换
  const handleSearchPageChange = async (page: number, pageSize: number) => {
    // 组装搜索词
    const parts: string[] = [];
    if (searchIpTag) {
      const tag = ipTags.find(t => t._id === searchIpTag);
      if (tag) parts.push(tag.name);
    }
    if (searchCategoryTag) {
      const tag = categoryTags.find(t => t._id === searchCategoryTag);
      if (tag) parts.push(tag.name);
    }
    if (searchKeyword) {
      parts.push(searchKeyword.trim());
    }
    const finalKeyword = parts.join(' ');

    if (!finalKeyword) return;

    setSearchLoading(true);
    setSearchPagination(prev => ({ ...prev, current: page, pageSize }));
    try {
      const response = await guziProductApi.searchAlimama(finalKeyword, page, pageSize, searchSort);
      setSearchResults(response.items);
    } catch (error) {
      message.error('加载更多失败');
    } finally {
      setSearchLoading(false);
    }
  };

  // 排序切换
  const handleSortChange = async (sort: string) => {
    setSearchSort(sort);
    // 组装搜索词
    const parts: string[] = [];
    if (searchIpTag) {
      const tag = ipTags.find(t => t._id === searchIpTag);
      if (tag) parts.push(tag.name);
    }
    if (searchCategoryTag) {
      const tag = categoryTags.find(t => t._id === searchCategoryTag);
      if (tag) parts.push(tag.name);
    }
    if (searchKeyword) {
      parts.push(searchKeyword.trim());
    }
    const finalKeyword = parts.join(' ');

    if (!finalKeyword) return;

    setSearchLoading(true);
    setSearchPagination(prev => ({ ...prev, current: 1 }));
    try {
      const response = await guziProductApi.searchAlimama(finalKeyword, 1, searchPagination.pageSize, sort);
      setSearchResults(response.items);
      setSearchPagination(prev => ({ ...prev, total: response.total }));
    } catch (error) {
      message.error('切换排序失败');
    } finally {
      setSearchLoading(false);
    }
  };

  // 清空搜索 Modal 的筛选条件
  const handleResetSearch = () => {
    setSearchIpTag(undefined);
    setSearchCategoryTag(undefined);
    setSearchKeyword('');
    setSearchResults([]);
    setSelectedRows([]);
    setSearchPagination({ current: 1, pageSize: 20, total: 0 });
    setAddedProductTitles(new Set());
    setSearchSort('tk_rate_des');
  };

  // 添加选中的商品到列表
  const handleAddSelected = async () => {
    if (selectedRows.length === 0) {
      message.warning('请先选择要添加的商品');
      return;
    }

    setLoading(true);
    try {
      // 收集本次搜索选中的标签
      const ipTagIds: string[] = searchIpTag ? [searchIpTag] : [];
      const categoryTagIds: string[] = searchCategoryTag ? [searchCategoryTag] : [];

      const productsToCreate = selectedRows.map(item => ({
        title: item.title,
        image_url: item.image_url,
        small_images: item.small_images || [],
        platforms: item.platforms,
        description: '从淘宝联盟搜索添加',
        ip_tags: ipTagIds,
        category_tags: categoryTagIds,
      }));

      await guziProductApi.createProducts(productsToCreate);
      message.success(`成功添加 ${selectedRows.length} 个商品到数据库`);
      // 标记这些商品已添加（视觉区分）
      setAddedProductTitles(prev => {
        const newSet = new Set(prev);
        selectedRows.forEach(item => newSet.add(item.title));
        return newSet;
      });
      // 不关闭弹窗，方便继续添加其他商品
      // 清空已选中的商品
      setSelectedRows([]);
      // 刷新主列表
      fetchProducts();
    } catch (error) {
      message.error('添加商品失败');
    } finally {
      setLoading(false);
    }
  };

  // 切换上下架状态
  const handleToggleActive = async (id: string) => {
    try {
      await guziProductApi.toggleActive(id);
      message.success('状态已更新');
      fetchProducts();
    } catch (error) {
      // 模拟更新
      setProducts(prev => prev.map(p => 
        p.id === id ? { ...p, is_active: !p.is_active } : p
      ));
      message.success('状态已更新');
    }
  };

  // 删除商品
  const handleDelete = async (id: string) => {
    try {
      await guziProductApi.deleteProduct(id);
      message.success('删除成功');
      fetchProducts();
    } catch (error) {
      // 模拟删除
      setProducts(prev => prev.filter(p => p.id !== id));
      message.success('删除成功');
    }
  };

  // 生成淘口令
  const handleGenerateTkl = async (productId: string, platformIndex: number, _platformId: string) => {
    const key = `${productId}-${platformIndex}`;
    setGeneratingTklMap(prev => ({ ...prev, [key]: true }));
    try {
      const updatedPlatform = await guziProductApi.generateTkl(productId, platformIndex);
      // 同时更新对比抽屉中的 state
      setSelectedProductForCompare(prev => {
        if (!prev) return prev;
        const newPlatforms = [...prev.platforms];
        newPlatforms[platformIndex] = updatedPlatform;
        return { ...prev, platforms: newPlatforms };
      });
      // 同时更新列表中的 state（这样下次打开抽屉也能看到）
      setProducts(prev => prev.map(p => {
        if (p.id !== productId) return p;
        const newPlatforms = [...p.platforms];
        newPlatforms[platformIndex] = updatedPlatform;
        return { ...p, platforms: newPlatforms };
      }));
      message.success('淘口令生成成功');
    } catch (error) {
      message.error((error as Error).message || '生成失败');
    } finally {
      setGeneratingTklMap(prev => ({ ...prev, [key]: false }));
    }
  };

  // 打开编辑弹窗
  const handleOpenEdit = (product: GuziProduct) => {
    setEditingProduct(product);
    setEditModalVisible(true);
  };

  // 打开获取详情弹窗
  const handleOpenFetchDetail = (product: GuziProduct) => {
    // 获取第一个 alimama 平台的 platform_product_id
    const alimamaPlatform = product.platforms?.find(p => p.platform_id === 'alimama');
    if (!alimamaPlatform?.platform_product_id) {
      message.warning('该商品没有淘宝平台数据，无法获取详情');
      return;
    }
    setFetchingDetailId(product.id);
    // detail_fetched=True 表示之前调用过详情接口且已保存数据
    // detail_fetched=False 表示没有调用过详情接口
    if (product.detail_fetched === true) {
      setFetchDetailResult({
        success: true,
        message: '以下是之前已保存的商品详情',
        detail: {
          title: product.title,
          price: alimamaPlatform.price,
          commission_rate: alimamaPlatform.commission_rate,
          commission_amount: alimamaPlatform.commission_amount,
          volume: alimamaPlatform.volume,
          shop_title: alimamaPlatform.shop_title,
          free_shipment: alimamaPlatform.free_shipment,
          is_prepay: alimamaPlatform.is_prepay,
          promotion_tags: alimamaPlatform.promotion_tags,
          small_images_count: product.small_images?.length,
        },
      });
    } else {
      setFetchDetailResult(null);
    }
    setFetchDetailModalVisible(true);
  };

  // 确认获取详情
  const handleConfirmFetchDetail = async () => {
    if (!fetchingDetailId) return;
    const product = products.find(p => p.id === fetchingDetailId);
    if (!product) return;
    const alimamaPlatform = product.platforms.find(p => p.platform_id === 'alimama');
    if (!alimamaPlatform?.platform_product_id) return;

    setFetchDetailLoading(true);
    try {
      const result = await guziProductApi.fetchItemDetail({
        item_id: alimamaPlatform.platform_product_id,
        product_id: product.id,
        generate_links: true,
      });
      setFetchDetailResult({
        success: true,
        message: result.is_new ? '新建商品成功' : result.platform_updated ? '详情已填充' : '无需更新',
        detail: result.detail_filled || undefined,
      });
      message.success(result.is_new ? '新建商品成功' : '详情获取并填充成功');
      fetchProducts();
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string } } };
      setFetchDetailResult({
        success: false,
        message: err.response?.data?.detail || (error as Error).message || '获取详情失败',
      });
    } finally {
      setFetchDetailLoading(false);
    }
  };


  // 确认批量获取详情
  const handleConfirmBatchFetchDetail = async () => {
    if (selectedRowKeys.length === 0) return;

    // 根据选项过滤：排除已爬取过的商品（除非明确选择包含）
    let targetIds = selectedRowKeys as string[];
    if (!batchFetchIncludeFetched) {
      targetIds = targetIds.filter(id => {
        const product = products.find(p => p.id === id);
        return product?.detail_fetched !== true;
      });
      if (targetIds.length === 0) {
        message.warning('所选商品已全部获取过详情，请勾选"包含已爬取数据"重新尝试');
        return;
      }
    }

    setBatchFetchLoading(true);
    try {
      const result = await guziProductApi.batchFetchItemDetail(targetIds, true);
      setBatchFetchResults(result);
      message.success(`批量获取完成：成功 ${result.success_count} 个`);
      fetchProducts();
    } catch (error) {
      message.error((error as Error).message || '批量获取详情失败');
    } finally {
      setBatchFetchLoading(false);
    }
  };

  // Modal 动画完成后再填充表单数据
  const handleEditModalAfterOpenChange = (open: boolean) => {
    if (open && editingProduct) {
      editForm.setFieldsValue({
        ip_tags: editingProduct.ip_tags || [],
        category_tags: editingProduct.category_tags || [],
        is_active: editingProduct.is_active,
      });
    }
    if (!open) {
      setEditingProduct(null);
      editForm.resetFields();
    }
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    try {
      const values = await editForm.validateFields();
      await guziProductApi.updateProduct(editingProduct.id, {
        ip_tags: values.ip_tags || [],
        category_tags: values.category_tags || [],
        is_active: values.is_active,
      });
      message.success('商品更新成功');
      setEditModalVisible(false);
      setEditingProduct(null);
      editForm.resetFields();
      fetchProducts();
    } catch (error) {
      message.error((error as Error).message || '更新失败');
    }
  };

  // 表格列定义 - 支持多平台
  const columns: ColumnsType<GuziProduct> = [
    {
      title: '商品图片',
      dataIndex: 'image_url',
      key: 'image_url',
      width: 140,
      fixed: 'left',
      render: (url: string, record: GuziProduct) => {
        const allImages = [url, ...(record.small_images || [])].filter(Boolean);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Image.PreviewGroup>
              <Image
                src={url}
                width={60}
                height={60}
                style={{ objectFit: 'cover', borderRadius: 4, cursor: 'zoom-in' }}
                fallback="https://via.placeholder.com/60?text=No+Image"
              />
              {allImages.length > 1 && (
                <div style={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {allImages.slice(1, 5).map((img, idx) => (
                    <Image
                      key={idx}
                      src={img}
                      width={28}
                      height={28}
                      style={{ objectFit: 'cover', borderRadius: 2, border: '1px solid #333' }}
                      fallback="https://via.placeholder.com/28?text=?"
                    />
                  ))}
                  {allImages.length > 5 && (
                    <span style={{ fontSize: 10, color: '#8c8c8c', lineHeight: '28px' }}>+{allImages.length - 5}</span>
                  )}
                </div>
              )}
            </Image.PreviewGroup>
          </div>
        );
      },
    },
    {
      title: '商品信息',
      key: 'info',
      width: 200,
      render: (_, record: GuziProduct) => {
        const rec = record.platforms[0];
        return (
          <div>
            <Tooltip title={record.title}>
              <div style={{ fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
                {record.title}
              </div>
            </Tooltip>
            {rec?.shop_title && (
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>
                <Tag color={rec.user_type === 1 ? 'red' : 'orange'} style={{ fontSize: 10, padding: '0 2px' }}>
                  {rec.user_type === 1 ? '天猫' : '淘宝'}
                </Tag>
                <Tooltip title={rec.shop_title}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: 100, verticalAlign: 'middle' }}>
                    {rec.shop_title}
                  </span>
                </Tooltip>
              </div>
            )}
            {rec?.provcity && (
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>{rec.provcity}</div>
            )}
            {record.brand_name && (
              <Tag style={{ fontSize: 10, marginTop: 2 }}>品牌: {record.brand_name}</Tag>
            )}
            {record.category_name && (
              <Tag color="purple" style={{ fontSize: 10, marginTop: 2 }}>{record.category_name}</Tag>
            )}
          </div>
        );
      },
    },
    {
      title: '价格 / 佣金',
      key: 'price',
      width: 120,
      render: (_, record: GuziProduct) => {
        if (!record.platforms || record.platforms.length === 0) return '-';
        const lowest = record.platforms.reduce((min, p) => p.price < min.price ? p : min, record.platforms[0]);
        return (
          <div>
            <span style={{ color: '#52c41a', fontWeight: 700, fontSize: 15 }}>¥{lowest.price.toFixed(2)}</span>
            {lowest.original_price && lowest.original_price > lowest.price && (
              <div>
                <span style={{ color: '#8c8c8c', textDecoration: 'line-through', fontSize: 11 }}>
                  ¥{lowest.original_price.toFixed(2)}
                </span>
              </div>
            )}
            {record.highest_commission != null && (
              <div style={{ marginTop: 2 }}>
                <span style={{ color: '#fa8c16', fontSize: 12 }}>返 ¥{record.highest_commission.toFixed(2)}</span>
              </div>
            )}
            {lowest.commission_rate > 0 && (
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>佣金率 {lowest.commission_rate}%</div>
            )}
          </div>
        );
      },
    },
    {
      title: '最高佣金',
      key: 'highest_commission',
      width: 100,
      render: (_, record: GuziProduct) => {
        if (!record.platforms || record.platforms.length === 0) return '-';
        const highest = record.platforms.reduce((max, p) => p.commission_amount > max.commission_amount ? p : max, record.platforms[0]);
        return (
          <div>
            <span style={{ color: '#fa8c16', fontWeight: 600 }}>¥{highest.commission_amount.toFixed(2)}</span>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>{highest.platform_name}</div>
          </div>
        );
      },
    },
    {
      title: '平台数',
      key: 'platform_count',
      width: 80,
      render: (_, record: GuziProduct) => (
        <Tag color={record.platforms?.length > 1 ? 'blue' : 'default'}>
          {record.platforms?.length || 0} 个平台
        </Tag>
      ),
    },
    {
      title: 'IP标签',
      key: 'ip_tags',
      width: 150,
      render: (_, record: GuziProduct) => {
        const tags = record.ip_tags || [];
        if (tags.length === 0) return <span style={{ color: '#4b5563' }}>-</span>;
        return (
          <Space wrap size={2}>
            {tags.map(tagId => {
              const tag = ipTags.find(t => t._id === tagId);
              return tag ? (
                <Tag key={tagId} color={tag.color || 'blue'}>{tag.name}</Tag>
              ) : (
                <Tag key={tagId} color="blue">{tagId}</Tag>
              );
            })}
          </Space>
        );
      },
    },
    {
      title: '类别标签',
      key: 'category_tags',
      width: 180,
      render: (_, record: GuziProduct) => {
        const tags = record.category_tags || [];
        if (tags.length === 0) return <span style={{ color: '#4b5563' }}>-</span>;
        return (
          <Space wrap size={2}>
            {tags.map(tagId => {
              const tag = categoryTags.find(t => t._id === tagId);
              return tag ? (
                <Tag key={tagId} color={tag.color || 'purple'}>{tag.name}</Tag>
              ) : (
                <Tag key={tagId} color="purple">{tagId}</Tag>
              );
            })}
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (active: boolean, record: GuziProduct) => (
        <Switch
          checked={active}
          checkedChildren="上架"
          unCheckedChildren="下架"
          onChange={() => handleToggleActive(record.id)}
        />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record: GuziProduct) => (
        <Space size="small">
          <Tooltip title={record.detail_fetched === true ? '查看商品详情' : '从淘宝获取最新详情并填充'}>
            <Button
              type="default"
              size="small"
              icon={record.detail_fetched === true ? <StarOutlined /> : <CloudSyncOutlined />}
              onClick={() => handleOpenFetchDetail(record)}
            >
              {record.detail_fetched === true ? '查看详情' : '抓取详情'}
            </Button>
          </Tooltip>
          <Tooltip title="编辑标签">
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(record)}
            >
              编辑
            </Button>
          </Tooltip>
          <Button
            type="primary"
            size="small"
            onClick={() => {
              setSelectedProductForCompare(record);
              setCompareDrawerVisible(true);
            }}
          >
            比价
          </Button>
          <Tooltip title="删除">
            <Button
              type="text"
              size="small"
              danger
              onClick={() => handleDelete(record.id)}
            >
              删除
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 搜索结果表格列 - 多平台比价展示
  const searchColumns: ColumnsType<ProductSearchItem> = [
    {
      title: '选择',
      key: 'selection',
      width: 60,
      render: (_, record) => {
        const isAdded = addedProductTitles.has(record.title);
        const isSelected = selectedRows.some(r => r.title === record.title);
        return (
          <Checkbox
            checked={isSelected}
            disabled={isAdded}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedRows(prev => [...prev, record]);
              } else {
                setSelectedRows(prev => prev.filter(r => r.title !== record.title));
              }
            }}
          />
        );
      },
    },
    {
      title: '商品图片',
      dataIndex: 'image_url',
      key: 'image_url',
      width: 140,
      render: (url: string, record: ProductSearchItem) => {
        const allImages = [url, ...(record.small_images || [])].filter(Boolean);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Image.PreviewGroup>
              <Image
                src={url}
                width={60}
                height={60}
                style={{ objectFit: 'cover', borderRadius: 4, cursor: 'zoom-in' }}
                fallback="https://via.placeholder.com/60?text=No+Image"
              />
              {allImages.length > 1 && (
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {allImages.slice(1, 5).map((img, idx) => (
                    <Image
                      key={idx}
                      src={img}
                      width={28}
                      height={28}
                      style={{ objectFit: 'cover', borderRadius: 2, border: '1px solid #333', cursor: 'pointer' }}
                      fallback="https://via.placeholder.com/28?text=?"
                    />
                  ))}
                  {allImages.length > 5 && (
                    <span style={{ fontSize: 10, color: '#8c8c8c', lineHeight: '28px' }}>+{allImages.length - 5}</span>
                  )}
                </div>
              )}
            </Image.PreviewGroup>
          </div>
        );
      },
    },
    {
      title: '商品信息',
      key: 'info',
      width: 220,
      render: (_, record) => (
        <div>
          <Tooltip title={record.title}>
            <div style={{ fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
              {record.title}
            </div>
          </Tooltip>
          {record.sub_title && (
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {record.sub_title}
            </div>
          )}
          {record.brand_name && (
            <Tag style={{ fontSize: 11, marginBottom: 2 }}>品牌: {record.brand_name}</Tag>
          )}
          {record.category_name && (
            <Tag style={{ fontSize: 11, marginBottom: 2 }} color="purple">{record.category_name}</Tag>
          )}
          {record.level_one_category_name && record.level_one_category_name !== record.category_name && (
            <Tag style={{ fontSize: 11, marginBottom: 2 }}>{record.level_one_category_name}</Tag>
          )}
          {record.annual_vol && (
            <Tag style={{ fontSize: 11, marginBottom: 2 }} color="blue">年销 {record.annual_vol}</Tag>
          )}
        </div>
      ),
    },
    {
      title: '价格 / 佣金',
      key: 'price',
      width: 120,
      render: (_, record) => {
        const rec = record.platforms[0];
        return (
          <div>
            <div>
              <span style={{ color: '#52c41a', fontWeight: 700, fontSize: 15 }}>¥{record.lowest_price.toFixed(2)}</span>
            </div>
            {rec?.original_price && rec.original_price > record.lowest_price && (
              <div>
                <span style={{ color: '#8c8c8c', textDecoration: 'line-through', fontSize: 11 }}>
                  ¥{rec.original_price.toFixed(2)}
                </span>
              </div>
            )}
            {rec?.zk_final_price && rec.zk_final_price > record.lowest_price && (
              <div style={{ fontSize: 11, color: '#fa8c16' }}>
                折扣价 ¥{rec.zk_final_price.toFixed(2)}
              </div>
            )}
            <div style={{ marginTop: 4 }}>
              <span style={{ color: '#fa8c16', fontSize: 12 }}>返 ¥{record.highest_commission.toFixed(2)}</span>
            </div>
            {rec?.commission_rate && (
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>佣金率 {rec.commission_rate}%</div>
            )}
          </div>
        );
      },
    },
    {
      title: '店铺 / 销量',
      key: 'shop',
      width: 130,
      render: (_, record) => {
        const rec = record.platforms[0];
        return (
          <div>
            {rec?.shop_title && (
              <div style={{ fontSize: 12, marginBottom: 2 }}>
                <Tag color={rec.user_type === 1 ? 'red' : 'orange'} style={{ fontSize: 10 }}>
                  {rec.user_type === 1 ? '天猫' : '淘宝'}
                </Tag>
                <Tooltip title={rec.shop_title}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: 70, verticalAlign: 'middle' }}>
                    {rec.shop_title}
                  </span>
                </Tooltip>
              </div>
            )}
            {rec?.provcity && (
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>{rec.provcity}</div>
            )}
            {record.volume && record.volume > 0 && (
              <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>30天 {record.volume} 件</div>
            )}
          </div>
        );
      },
    },
    {
      title: '优惠标签',
      key: 'promotion',
      width: 150,
      render: (_, record) => {
        const rec = record.platforms[0];
        const tags = rec?.promotion_tags || [];
        if (tags.length === 0) return <span style={{ color: '#8c8c8c', fontSize: 11 }}>—</span>;
        return (
          <Space wrap size={2}>
            {tags.slice(0, 3).map((tag, idx) => (
              <Tag
                key={idx}
                style={{ fontSize: 10 }}
                color={
                  tag.includes('包邮') ? 'green' :
                  tag.includes('折') ? 'orange' :
                  tag.includes('券') || tag.includes('减') ? 'red' :
                  'blue'
                }
              >
                {tag}
              </Tag>
            ))}
            {rec?.coupon_amount && (
              <Tag color="red" style={{ fontSize: 10 }}>券 {rec.coupon_amount}元</Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: '推荐',
      key: 'recommended',
      width: 80,
      render: (_, record) => {
        const recommended = record.platforms.find(p => p.platform_id === record.recommended_platform);
        return recommended ? (
          <Tag color="green">推荐</Tag>
        ) : null;
      },
    },
  ];

  return (
    <div className="guzi-product-page">
      <div className="page-header">
        <div className="header-left">
          <h2 className="page-title">
            <ShoppingOutlined className="page-icon" />
            谷子商品管理
          </h2>
          <div className="header-stats">
            <Tag color="blue">总计: {pagination.total}</Tag>
            <Tag color="green">上架: {products.filter(p => p.is_active).length}</Tag>
            <Tag color="default">下架: {products.filter(p => !p.is_active).length}</Tag>
          </div>
        </div>
        <div className="header-actions">
          <Space>
            {selectedRowKeys.length > 0 && (
              <Button
                type="default"
                icon={<CloudSyncOutlined />}
                onClick={() => setBatchFetchModalVisible(true)}
              >
                批量获取详情 ({selectedRowKeys.length})
              </Button>
            )}
            <Button
              type="primary"
              icon={<CloudDownloadOutlined />}
              onClick={() => setSearchModalVisible(true)}
            >
              搜索谷子商品
            </Button>
          </Space>
        </div>
      </div>

      <div className="filter-bar">
        <Space wrap size="small">
          <span>状态筛选:</span>
          <Button
            type={filterActive === undefined ? 'primary' : 'default'}
            onClick={() => setFilterActive(undefined)}
          >
            全部
          </Button>
          <Button
            type={filterActive === true ? 'primary' : 'default'}
            onClick={() => setFilterActive(true)}
          >
            上架
          </Button>
          <Button
            type={filterActive === false ? 'primary' : 'default'}
            onClick={() => setFilterActive(false)}
          >
            下架
          </Button>
          <span style={{ marginLeft: 8 }}><FilterOutlined /> 标签筛选:</span>
          <Select
            placeholder="IP标签"
            allowClear
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            style={{ width: 160 }}
            size="small"
            value={selectedIpTag}
            onChange={(val) => { setSelectedIpTag(val); setPagination(p => ({ ...p, current: 1 })); }}
            options={ipTags.map(t => ({ label: t.name, value: t._id }))}
          />
          <Select
            placeholder="类别标签"
            allowClear
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            style={{ width: 160 }}
            size="small"
            value={selectedCategoryTag}
            onChange={(val) => { setSelectedCategoryTag(val); setPagination(p => ({ ...p, current: 1 })); }}
            options={categoryTags.map(t => ({ label: t.name, value: t._id }))}
          />
          {(selectedIpTag || selectedCategoryTag) && (
            <Button
              type="link"
              size="small"
              onClick={() => {
                setSelectedIpTag(undefined);
                setSelectedCategoryTag(undefined);
                setPagination(p => ({ ...p, current: 1 }));
              }}
            >
              清空筛选
            </Button>
          )}
        </Space>
        <Space>
          <Button
            icon={<AppstoreOutlined />}
            type={viewMode === 'grid' ? 'primary' : 'default'}
            onClick={() => setViewMode('grid')}
          />
          <Button
            icon={<UnorderedListOutlined />}
            type={viewMode === 'table' ? 'primary' : 'default'}
            onClick={() => setViewMode('table')}
          />
        </Space>
      </div>

      {products.length === 0 ? (
        <div className="empty-state">
          <ShoppingOutlined className="empty-icon" />
          <p>暂无商品数据</p>
          <Button 
            type="primary" 
            icon={<CloudDownloadOutlined />}
            onClick={() => setSearchModalVisible(true)}
          >
            搜索添加商品
          </Button>
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={products}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
            selections: [
              Table.SELECTION_ALL,
              Table.SELECTION_INVERT,
              Table.SELECTION_NONE,
            ],
          }}
          pagination={{
            ...pagination,
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
          }}
          scroll={{ x: 'max-content' }}
        />
      )}

      {/* 多平台商品搜索 */}
      <Modal
        title={
          <div className="search-modal-title">
            <CloudDownloadOutlined />
            <span>搜索谷子商品</span>
          </div>
        }
        open={searchModalVisible}
        onCancel={() => {
          setSearchModalVisible(false);
          handleResetSearch();
        }}
        width={1000}
        footer={[
          <div key="footer-info" style={{ display: 'flex', alignItems: 'center', gap: 8, float: 'left' }}>
            <Tag color="blue">已选择: {selectedRows.length} 个</Tag>
            <Tag color="green">本次已添加: {addedProductTitles.size} 个</Tag>
            <Tag color="default">第 {searchPagination.current} / {Math.ceil((searchPagination.total || searchResults.length) / searchPagination.pageSize) || 1} 页</Tag>
            <Button
              type="link"
              size="small"
              disabled={searchResults.length === 0}
              onClick={() => {
                // 全选时排除已添加的商品
                const availableRows = searchResults.filter(r => !addedProductTitles.has(r.title));
                if (selectedRows.length === availableRows.length) {
                  setSelectedRows([]);
                } else {
                  setSelectedRows(availableRows);
                }
              }}
            >
              {selectedRows.length === searchResults.filter(r => !addedProductTitles.has(r.title)).length ? '取消全选' : '全选'}
            </Button>
            <Button
              type="link"
              size="small"
              disabled={selectedRows.length === 0}
              onClick={() => setSelectedRows([])}
            >
              反选
            </Button>
          </div>,
          <Button key="cancel" onClick={() => { setSearchModalVisible(false); handleResetSearch(); }}>
            取消
          </Button>,
          <Button
            key="add"
            type="primary"
            onClick={handleAddSelected}
            disabled={selectedRows.length === 0}
            loading={loading}
          >
            添加选中商品 ({selectedRows.length})
          </Button>,
        ]}
      >
        {/* 组合搜索区域 */}
        <div className="combo-search-bar">
          <div className="combo-search-row">
            <div className="combo-search-item">
              <span className="combo-label">IP标签</span>
              <Select
                placeholder="选择 IP 标签（可选）"
                allowClear
                style={{ flex: 1, minWidth: 160 }}
                size="middle"
                value={searchIpTag}
                onChange={(val) => setSearchIpTag(val)}
                options={ipTags.map(t => ({ label: t.name, value: t._id }))}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </div>
            <div className="combo-search-item">
              <span className="combo-label">类别标签</span>
              <Select
                placeholder="选择类别标签（可选）"
                allowClear
                style={{ flex: 1, minWidth: 160 }}
                size="middle"
                value={searchCategoryTag}
                onChange={(val) => setSearchCategoryTag(val)}
                options={categoryTags.map(t => ({ label: t.name, value: t._id }))}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </div>
            <div className="combo-search-item" style={{ flex: 2 }}>
              <span className="combo-label">关键词</span>
              <Input
                placeholder="补充关键词，如「正版」「限定」"
                size="middle"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onPressEnter={(e) => handleSearch((e.target as HTMLInputElement).value)}
              />
            </div>
            <Button
              type="primary"
              size="middle"
              icon={<SearchOutlined />}
              loading={searchLoading}
              onClick={() => handleSearch(searchKeyword)}
              style={{ marginTop: 0 }}
            >
              搜索
            </Button>
            <Select
              value={searchSort}
              onChange={(val) => handleSortChange(val)}
              size="middle"
              style={{ width: 140 }}
              options={[
                { label: '佣金率优先', value: 'tk_rate_des' },
                { label: '销量优先', value: 'total_sales_des' },
                { label: '价格从低到高', value: 'price_asc' },
                { label: '价格从高到低', value: 'price_des' },
              ]}
            />
          </div>

          {/* 组合搜索预览 */}
          {(searchIpTag || searchCategoryTag || searchKeyword) && (
            <div className="combo-preview">
              <span style={{ color: '#9ca3af', fontSize: 12, marginRight: 8 }}>搜索词预览：</span>
              {searchIpTag && (
                <Tag color={ipTags.find(t => t._id === searchIpTag)?.color || 'blue'}>
                  {ipTags.find(t => t._id === searchIpTag)?.name}
                </Tag>
              )}
              {searchCategoryTag && (
                <Tag color={categoryTags.find(t => t._id === searchCategoryTag)?.color || 'purple'}>
                  {categoryTags.find(t => t._id === searchCategoryTag)?.name}
                </Tag>
              )}
              {searchKeyword && (
                <Tag color="default">{searchKeyword}</Tag>
              )}
            </div>
          )}
        </div>

        <div className="search-results">
          {searchLoading ? (
            <div className="loading-container">
              <Spin size="large" />
              <p>正在搜索商品...</p>
            </div>
          ) : searchResults.length > 0 ? (
            <Table
              columns={searchColumns}
              dataSource={searchResults}
              rowKey={(record) => record.title}
              rowClassName={(record) => addedProductTitles.has(record.title) ? 'added-product-row' : ''}
              pagination={{
                current: searchPagination.current,
                pageSize: searchPagination.pageSize,
                total: searchPagination.total || searchResults.length,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条`,
                onChange: handleSearchPageChange,
              }}
              scroll={{ x: 800, y: 360 }}
              size="small"
            />
          ) : searchKeyword ? (
            <div className="no-results">
              <p>未找到相关商品，请尝试其他关键词</p>
            </div>
          ) : (
            <div className="search-hint">
              <p>请选择标签或输入关键词进行搜索</p>
              {ipTags.length > 0 || categoryTags.length > 0 ? (
                <div className="search-suggestions">
                  <span>快捷搜索（从已有标签组合）:</span>
                  {ipTags.slice(0, 4).map(ip => (
                    categoryTags.slice(0, 2).map(cat => (
                      <Tag
                        key={`${ip._id}-${cat._id}`}
                        className="suggestion-tag"
                        onClick={() => {
                          setSearchIpTag(ip._id);
                          setSearchCategoryTag(cat._id);
                          setSearchKeyword('');
                          setTimeout(() => handleSearch(''), 0);
                        }}
                      >
                        {ip.name} + {cat.name}
                      </Tag>
                    ))
                  ))}
                  {ipTags.slice(0, 6).map(ip => (
                    <Tag
                      key={ip._id}
                      className="suggestion-tag"
                      onClick={() => {
                        setSearchIpTag(ip._id);
                        setSearchCategoryTag(undefined);
                        setSearchKeyword('');
                        setTimeout(() => handleSearch(''), 0);
                      }}
                    >
                      {ip.name}
                    </Tag>
                  ))}
                </div>
              ) : (
                <div className="search-suggestions">
                  <span>热门搜索:</span>
                  <Tag className="suggestion-tag" onClick={() => handleSearch('咒术回战 吧唧')}>咒术回战 吧唧</Tag>
                  <Tag className="suggestion-tag" onClick={() => handleSearch('原神 手办')}>原神 手办</Tag>
                  <Tag className="suggestion-tag" onClick={() => handleSearch('排球少年 周边')}>排球少年 周边</Tag>
                  <Tag className="suggestion-tag" onClick={() => handleSearch('蓝色监狱 闪卡')}>蓝色监狱 闪卡</Tag>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* 多平台比价抽屉 */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarOutlined />
            <span>多平台比价</span>
          </div>
        }
        placement="right"
        width={500}
        open={compareDrawerVisible}
        onClose={() => setCompareDrawerVisible(false)}
      >
        {selectedProductForCompare && (
          <div className="compare-drawer-content">
            {/* 商品基本信息 */}
            <div className="compare-product-info">
              <Image
                src={selectedProductForCompare.image_url}
                width={80}
                height={80}
                style={{ objectFit: 'cover', borderRadius: 8 }}
                fallback="https://via.placeholder.com/80?text=No+Image"
                preview={{ mask: <span>看大图</span>, src: selectedProductForCompare.image_url }}
              />
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0 }}>{selectedProductForCompare.title}</h4>
              </div>
            </div>

            {/* 比价统计 */}
            <div className="compare-summary">
              <div className="summary-item">
                <span className="summary-label">最低价</span>
                <span className="summary-value price">
                  ¥{selectedProductForCompare.platforms?.reduce((min, p) => p.price < min ? p.price : min, selectedProductForCompare.platforms[0]?.price || 0).toFixed(2)}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">最高佣金</span>
                <span className="summary-value commission">
                  ¥{selectedProductForCompare.platforms?.reduce((max, p) => p.commission_amount > max ? p.commission_amount : max, selectedProductForCompare.platforms[0]?.commission_amount || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* 平台列表 */}
            <div className="platform-list">
              <h4 style={{ marginBottom: 12 }}>各平台价格对比</h4>
              {selectedProductForCompare.platforms?.map((platform, index) => {
                const isLowestPrice = platform.price === Math.min(...(selectedProductForCompare.platforms?.map(p => p.price) || [0]));
                const isHighestCommission = platform.commission_amount === Math.max(...(selectedProductForCompare.platforms?.map(p => p.commission_amount) || [0]));
                const isRecommended = index === 0;

                return (
                  <div 
                    key={platform.platform_id} 
                    className={`platform-card ${isRecommended ? 'recommended' : ''}`}
                  >
                    <div className="platform-header">
                      <Tag color={
                        platform.platform_id === 'alimama' ? 'orange' :
                        platform.platform_id === 'jd' ? 'red' : 'blue'
                      }>
                        {platform.platform_name}
                      </Tag>
                      {isRecommended && (
                        <Badge status="success" text="推荐" />
                      )}
                    </div>
                    
                    <div className="platform-info">
                      <div className="info-row">
                        <span className="info-label">价格</span>
                        <span className={`info-value ${isLowestPrice ? 'lowest' : ''}`}>
                          ¥{platform.price.toFixed(2)}
                          {isLowestPrice && <Tag color="green" style={{ marginLeft: 8 }}>最低价</Tag>}
                        </span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">佣金率</span>
                        <span className="info-value">{platform.commission_rate}%</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">预估佣金</span>
                        <span className={`info-value ${isHighestCommission ? 'highest' : ''}`}>
                          ¥{platform.commission_amount.toFixed(2)}
                          {isHighestCommission && <Tag color="orange" style={{ marginLeft: 8 }}>最高</Tag>}
                        </span>
                      </div>
                    </div>

                    {/* 淘口令生成 / 推广文案复制 */}
                    {(() => {
                      const tklText = platform.tkl_text;  // ₤xxx₤
                      const link = platform.short_link || platform.url;
                      const title = selectedProductForCompare.title;
                      const price = platform.price.toFixed(2);
                      const imageUrl = selectedProductForCompare.image_url;
                      const description = platform.description || '';
                      const productId = selectedProductForCompare.id;
                      const tklKey = `${productId}-${index}`;
                      const isGenerating = !!generatingTklMap[tklKey];
                      const isAlimama = platform.platform_id === 'alimama';

                      // 文案顺序：标题+口令 → 价格 → 描述 → 链接 → 图片（图片放最后）
                      const titleWithTkl = tklText
                        ? `🎁【${title}】${tklText}`
                        : `🎁【${title}】`;

                      const socialText = [
                        titleWithTkl,
                        `到手${price}元`,
                        '-',
                        description,
                        tklText ? '' : `【下单链接】${link}`,
                        '',
                        imageUrl,
                      ].filter(Boolean).join('\n');

                      const htmlText = tklText
                        ? `<p>🎁【${title}】<strong>${tklText}</strong></p><p>到手<strong>${price}元</strong></p><hr/><p>${description}</p><p><img src="${imageUrl}" style="max-width:300px;border-radius:4px" /></p>`
                        : `<p>🎁【${title}】</p><p>到手<strong>${price}元</strong></p><hr/><p>${description}</p><p>【下单链接】<a href="${link}">${link}</a></p><p><img src="${imageUrl}" style="max-width:300px;border-radius:4px" /></p>`;

                      const markdownText = [
                        titleWithTkl,
                        '',
                        `到手 **${price}元**`,
                        '',
                        description,
                        '',
                        tklText ? '' : `【下单链接】${link}`,
                        '',
                        `![](${imageUrl})`,
                      ].filter(Boolean).join('\n');

                      if (!tklText) {
                        // 尚未生成淘口令
                        return (
                          <Button
                            type="default"
                            icon={<StarOutlined />}
                            block
                            style={{ marginTop: 12 }}
                            loading={isGenerating}
                            disabled={!isAlimama}
                            onClick={() => handleGenerateTkl(productId, index, platform.platform_id)}
                          >
                            {isAlimama ? '生成淘口令' : '暂不支持该平台'}
                          </Button>
                        );
                      }

                      const menuItems: MenuProps['items'] = [
                        {
                          key: 'tao',
                          label: (
                            <div>
                              <div style={{ fontWeight: 600 }}>淘口令（粘贴到淘宝APP）</div>
                              <div style={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                {tklText}
                              </div>
                            </div>
                          ),
                          onClick: () => {
                            navigator.clipboard.writeText(tklText);
                            message.success('淘口令已复制，可直接打开淘宝');
                          },
                        },
                        {
                          key: 'social',
                          label: '📱 社交媒体（微博/朋友圈）',
                          onClick: () => {
                            navigator.clipboard.writeText(socialText);
                            message.success('推广文案已复制');
                          },
                        },
                        {
                          key: 'markdown',
                          label: '📋 Markdown 格式',
                          onClick: () => {
                            navigator.clipboard.writeText(markdownText);
                            message.success('Markdown 已复制');
                          },
                        },
                        {
                          key: 'html',
                          label: '🌐 富文本（含图片）',
                          onClick: () => {
                            navigator.clipboard.write([
                              new ClipboardItem({
                                'text/plain': new Blob([socialText], { type: 'text/plain' }),
                                'text/html': new Blob([htmlText], { type: 'text/html' }),
                              }),
                            ]).catch(() => {
                              navigator.clipboard.writeText(htmlText);
                            });
                            message.success('富文本已复制');
                          },
                        },
                      ];

                      return (
                        <>
                          {tklText && (
                            <div style={{ marginTop: 8, padding: '4px 8px', background: '#fff7e6', borderRadius: 4, fontSize: 11, color: '#ad6800', wordBreak: 'break-all' }}>
                              口令: {tklText}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            <Button
                              size="small"
                              icon={<StarOutlined />}
                              loading={isGenerating}
                              onClick={() => handleGenerateTkl(productId, index, platform.platform_id)}
                            >
                              更新
                            </Button>
                            <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="topCenter">
                              <Button
                                type="primary"
                                icon={<CopyOutlined />}
                                size="small"
                              >
                                复制
                              </Button>
                            </Dropdown>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Drawer>

      {/* 商品编辑弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EditOutlined />
            <span>编辑商品</span>
          </div>
        }
        open={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => setEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={600}
        destroyOnClose
        afterOpenChange={handleEditModalAfterOpenChange}
      >
        {editingProduct && (
          <Form form={editForm} layout="vertical" preserve={false}>
            {/* 商品基本信息展示（只读） */}
            <div style={{ display: 'flex', gap: 16, padding: 16, background: 'rgba(0, 240, 255, 0.05)', borderRadius: 8, marginBottom: 20 }}>
              <Image
                src={editingProduct.image_url}
                width={80}
                height={80}
                style={{ objectFit: 'cover', borderRadius: 8 }}
                fallback="https://via.placeholder.com/80?text=No+Image"
                preview={{ mask: <span>看大图</span>, src: editingProduct.image_url }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{editingProduct.title}</div>
                <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8 }}>
                  {editingProduct.platforms && editingProduct.platforms.length > 0 ? (
                    <>
                      最低价: <span style={{ color: '#52c41a', fontWeight: 600 }}>¥{editingProduct.platforms.reduce((min, p) => p.price < min ? p.price : min, editingProduct.platforms[0].price).toFixed(2)}</span>
                      {' | '}
                      最高佣金: <span style={{ color: '#fa8c16', fontWeight: 600 }}>¥{editingProduct.platforms.reduce((max, p) => p.commission_amount > max ? p.commission_amount : max, editingProduct.platforms[0].commission_amount).toFixed(2)}</span>
                    </>
                  ) : null}
                </div>
                <Space size="small">
                  {editingProduct.platforms?.map(p => (
                    <Tag key={p.platform_id} color={
                      p.platform_id === 'alimama' ? 'orange' :
                      p.platform_id === 'jd' ? 'red' : 'blue'
                    }>
                      {p.platform_name}
                    </Tag>
                  ))}
                </Space>
              </div>
            </div>

            <Form.Item name="ip_tags" label="IP标签" extra="标记商品所属的IP作品/角色（如：火影忍者、咒术回战）">
              <Select
                mode="multiple"
                placeholder="请选择或搜索IP标签"
                allowClear
                style={{ width: '100%' }}
                options={ipTags.map(t => ({ label: t.name, value: t._id }))}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>

            <Form.Item name="category_tags" label="类别标签" extra="标记商品周边形态/性质（如：吧唧、立牌、手办）">
              <Select
                mode="multiple"
                placeholder="请选择或搜索类别标签"
                allowClear
                style={{ width: '100%' }}
                options={categoryTags.map(t => ({ label: t.name, value: t._id }))}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>

            <Form.Item name="is_active" label="上架状态" valuePropName="checked">
              <Switch checkedChildren="上架" unCheckedChildren="下架" />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* 获取详情弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CloudSyncOutlined />
            <span>{(() => {
              const p = fetchingDetailId ? products.find(x => x.id === fetchingDetailId) : null;
              return p?.detail_fetched === true ? '商品详情' : '获取商品详情';
            })()}</span>
          </div>
        }
        open={fetchDetailModalVisible}
        onCancel={() => {
          setFetchDetailModalVisible(false);
          setFetchingDetailId(null);
          setFetchDetailResult(null);
        }}
        footer={
          fetchDetailResult ? (
            <Button onClick={() => {
              setFetchDetailModalVisible(false);
              setFetchingDetailId(null);
              setFetchDetailResult(null);
            }}>
              关闭
            </Button>
          ) : (
            [
              <Button key="cancel" onClick={() => {
                setFetchDetailModalVisible(false);
                setFetchingDetailId(null);
                setFetchDetailResult(null);
              }}>
                取消
              </Button>,
              <Button
                key="confirm"
                type="primary"
                icon={<CloudSyncOutlined />}
                loading={fetchDetailLoading}
                onClick={handleConfirmFetchDetail}
              >
                {(() => {
                  const p = fetchingDetailId ? products.find(x => x.id === fetchingDetailId) : null;
                  return p?.detail_fetched === true ? '刷新详情' : '确认获取';
                })()}
              </Button>,
            ]
          )
        }
        width={480}
      >
        {(() => {
          const product = fetchingDetailId ? products.find(p => p.id === fetchingDetailId) : null;
          const alimamaPlatform = product?.platforms?.find(p => p.platform_id === 'alimama');

          if (!product || !alimamaPlatform) return null;

          if (fetchDetailResult) {
            if (fetchDetailResult.success) {
              return (
                <div className="fetch-detail-result success">
                  <div className="result-header">
                    <span style={{ fontSize: 24, color: '#52c41a' }}>✓</span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: '#52c41a' }}>{fetchDetailResult.message}</span>
                  </div>
                  {fetchDetailResult.detail && (
                    <div className="result-fields">
                      <div className="result-row">
                        <span className="label">标题</span>
                        <span className="value">{fetchDetailResult.detail.title || '-'}</span>
                      </div>
                      {fetchDetailResult.detail.price != null && (
                        <div className="result-row">
                          <span className="label">券后价</span>
                          <span className="value" style={{ color: '#52c41a', fontWeight: 600 }}>
                            ¥{fetchDetailResult.detail.price.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {fetchDetailResult.detail.commission_rate != null && (
                        <div className="result-row">
                          <span className="label">佣金率</span>
                          <span className="value" style={{ color: '#fa8c16' }}>
                            {fetchDetailResult.detail.commission_rate}%
                          </span>
                        </div>
                      )}
                      {fetchDetailResult.detail.commission_amount != null && (
                        <div className="result-row">
                          <span className="label">预估佣金</span>
                          <span className="value" style={{ color: '#fa8c16', fontWeight: 600 }}>
                            ¥{fetchDetailResult.detail.commission_amount.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {fetchDetailResult.detail.volume != null && (
                        <div className="result-row">
                          <span className="label">30天销量</span>
                          <span className="value">{fetchDetailResult.detail.volume} 件</span>
                        </div>
                      )}
                      {fetchDetailResult.detail.shop_title && (
                        <div className="result-row">
                          <span className="label">店铺</span>
                          <span className="value">{fetchDetailResult.detail.shop_title}</span>
                        </div>
                      )}
                      {fetchDetailResult.detail.free_shipment != null && (
                        <div className="result-row">
                          <span className="label">包邮</span>
                          <span className="value">{fetchDetailResult.detail.free_shipment ? '是' : '否'}</span>
                        </div>
                      )}
                      {fetchDetailResult.detail.is_prepay != null && (
                        <div className="result-row">
                          <span className="label">花呗</span>
                          <span className="value">{fetchDetailResult.detail.is_prepay ? '支持' : '不支持'}</span>
                        </div>
                      )}
                      {fetchDetailResult.detail.promotion_tags && fetchDetailResult.detail.promotion_tags.length > 0 && (
                        <div className="result-row">
                          <span className="label">推广标签</span>
                          <Space wrap size={2}>
                            {fetchDetailResult.detail.promotion_tags.slice(0, 5).map((tag, i) => (
                              <Tag key={i} style={{ fontSize: 11 }}>{tag}</Tag>
                            ))}
                          </Space>
                        </div>
                      )}
                      {fetchDetailResult.detail.small_images_count != null && fetchDetailResult.detail.small_images_count > 0 && (
                        <div className="result-row">
                          <span className="label">小图数量</span>
                          <span className="value">{fetchDetailResult.detail.small_images_count} 张</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            } else {
              return (
                <div className="fetch-detail-result error">
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <span style={{ fontSize: 24, color: '#ff4d4f' }}>✗</span>
                    <div style={{ marginTop: 12, color: '#ff4d4f' }}>{fetchDetailResult.message}</div>
                  </div>
                </div>
              );
            }
          }

          return (
            <div className="fetch-detail-confirm">
              <div className="confirm-product">
                <Image
                  src={product.image_url}
                  width={60}
                  height={60}
                  style={{ objectFit: 'cover', borderRadius: 8 }}
                  fallback="https://via.placeholder.com/60?text=No+Image"
                />
                <div className="confirm-info">
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{product.title}</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                    商品ID: <span style={{ fontFamily: 'monospace' }}>{alimamaPlatform.platform_product_id}</span>
                  </div>
                </div>
              </div>
              <div className="confirm-desc">
                <p>将从淘宝联盟获取该商品的最新详情，包含：</p>
                <ul>
                  <li>最新价格、佣金信息</li>
                  <li>销量数据</li>
                  <li>店铺信息、包邮/花呗标识</li>
                  <li>推广标签（包邮、优惠券等）</li>
                  <li>小图列表</li>
                </ul>
                <p style={{ color: '#fa8c16', fontSize: 12, marginTop: 8 }}>
                  已有推广链接（url/short_link/淘口令）将被保留，不会被覆盖
                </p>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* 批量获取详情弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CloudSyncOutlined />
            <span>批量获取商品详情</span>
          </div>
        }
        open={batchFetchModalVisible}
        onCancel={() => {
          setBatchFetchModalVisible(false);
          setBatchFetchResults(null);
        }}
        footer={
          batchFetchResults ? (
            <Button onClick={() => {
              setBatchFetchModalVisible(false);
              setBatchFetchResults(null);
            }}>
              关闭
            </Button>
          ) : (
            [
              <Button key="cancel" onClick={() => {
                setBatchFetchModalVisible(false);
                setBatchFetchResults(null);
              }}>
                取消
              </Button>,
              <Button
                key="confirm"
                type="primary"
                icon={<CloudSyncOutlined />}
                loading={batchFetchLoading}
                onClick={handleConfirmBatchFetchDetail}
              >
                确认批量获取 ({selectedRowKeys.length} 个)
              </Button>,
            ]
          )
        }
        width={600}
      >
        {batchFetchResults ? (
          <div className="batch-fetch-results">
            {/* 结果统计 */}
            <div className="batch-summary">
              <div className="summary-stat success">
                <span className="stat-value">{batchFetchResults.success_count}</span>
                <span className="stat-label">成功</span>
              </div>
              <div className="summary-stat skipped">
                <span className="stat-value">{batchFetchResults.skipped_count}</span>
                <span className="stat-label">跳过</span>
              </div>
              <div className="summary-stat failed">
                <span className="stat-value">{batchFetchResults.failed_count}</span>
                <span className="stat-label">失败</span>
              </div>
            </div>

            {/* 失败和跳过的详情列表 */}
            {(batchFetchResults.failed_count > 0 || batchFetchResults.skipped_count > 0) && (
              <div className="batch-detail-list">
                <div style={{ fontWeight: 600, marginBottom: 8 }}>处理详情:</div>
                {batchFetchResults.results
                  .filter(r => r.status !== 'success')
                  .map(r => (
                    <div
                      key={r.product_id}
                      className={`batch-item ${r.status}`}
                    >
                      <span className="batch-item-id" title={r.product_id}>
                        {r.product_id.substring(0, 8)}...
                      </span>
                      <span className="batch-item-status">
                        {r.status === 'skipped' ? '跳过' : '失败'}
                      </span>
                      <span className="batch-item-message">
                        {r.message || (r as any).detail?.title || '-'}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : (
          <div className="batch-fetch-confirm">
            <div className="confirm-desc">
              {/* 统计信息 */}
              <div className="batch-fetch-stats">
                <div className="stat-item">
                  <span className="stat-num">{selectedRowKeys.length}</span>
                  <span className="stat-text">已选商品</span>
                </div>
                <div className="stat-item">
                  <span className="stat-num">
                    {selectedRowKeys.filter(id => {
                      const product = products.find(p => p.id === id);
                      return product?.detail_fetched === true;
                    }).length}
                  </span>
                  <span className="stat-text">已爬取</span>
                </div>
                <div className="stat-item highlight">
                  <span className="stat-num">
                    {selectedRowKeys.filter(id => {
                      const product = products.find(p => p.id === id);
                      return product?.detail_fetched !== true;
                    }).length}
                  </span>
                  <span className="stat-text">待处理</span>
                </div>
              </div>

              {/* 包含已爬取选项 */}
              <div className="batch-fetch-option">
                <Checkbox
                  checked={batchFetchIncludeFetched}
                  onChange={(e) => setBatchFetchIncludeFetched(e.target.checked)}
                >
                  包含已爬取过的数据（用于刷新最新信息）
                </Checkbox>
              </div>

              <ul style={{ marginTop: 12 }}>
                <li>从淘宝联盟获取每个商品的最新详情</li>
                <li>同时生成淘口令（保留已有链接）</li>
                <li>智能合并数据（关键字段不会被覆盖）</li>
                <li>标记 detail_fetched=True</li>
              </ul>
            </div>
          </div>
        )}
      </Modal>

      <style>{`
        .guzi-product-page {
          padding: 0;
        }
        
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }
        
        .header-left {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .page-title {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .page-icon {
          color: #00f0ff;
        }
        
        .header-stats {
          display: flex;
          gap: 8px;
        }
        
        .filter-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding: 12px 16px;
          background: rgba(17, 24, 39, 0.5);
          border-radius: 8px;
        }
        
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          text-align: center;
        }
        
        .empty-icon {
          font-size: 64px;
          color: rgba(0, 240, 255, 0.3);
          margin-bottom: 16px;
        }
        
        .empty-state p {
          color: #9ca3af;
          margin-bottom: 24px;
        }
        
        .search-modal-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .search-results {
          min-height: 300px;
        }
        
        .loading-container,
        .no-results,
        .search-hint {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          color: #9ca3af;
        }
        
        .search-suggestions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          flex-wrap: wrap;
        }
        
        .suggestion-tag {
          cursor: pointer;
        }
        
        .suggestion-tag:hover {
          background: rgba(0, 240, 255, 0.1);
        }

        .combo-search-bar {
          background: rgba(17, 24, 39, 0.4);
          border: 1px solid rgba(0, 240, 255, 0.15);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .combo-search-row {
          display: flex;
          gap: 12px;
          align-items: flex-end;
          flex-wrap: wrap;
        }

        .combo-search-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          min-width: 140px;
        }

        .combo-label {
          font-size: 12px;
          color: #9ca3af;
          font-weight: 500;
        }

        .combo-preview {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px dashed rgba(255,255,255,0.1);
        }

        .product-image-cell {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .product-title {
          font-weight: 500;
        }

        /* 比价抽屉样式 */
        .compare-drawer-content {
          padding: 0;
        }

        .compare-product-info {
          display: flex;
          gap: 16px;
          padding: 16px;
          background: rgba(0, 240, 255, 0.05);
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .compare-summary {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
        }

        .summary-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px;
          background: rgba(17, 24, 39, 0.8);
          border-radius: 8px;
        }

        .summary-label {
          font-size: 12px;
          color: #8c8c8c;
          margin-bottom: 4px;
        }

        .summary-value {
          font-size: 20px;
          font-weight: 600;
        }

        .summary-value.price {
          color: #52c41a;
        }

        .summary-value.commission {
          color: #fa8c16;
        }

        .platform-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .platform-card {
          padding: 16px;
          background: rgba(17, 24, 39, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
        }

        .platform-card.recommended {
          border-color: #00f0ff;
          box-shadow: 0 0 12px rgba(0, 240, 255, 0.2);
        }

        .platform-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .platform-info {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .info-label {
          color: #8c8c8c;
          font-size: 13px;
        }

        .info-value {
          font-weight: 500;
        }

        .info-value.lowest {
          color: #52c41a;
        }

        .info-value.highest {
          color: #fa8c16;
        }

        /* 获取详情弹窗 */
        .fetch-detail-confirm {
          padding: 8px 0;
        }

        /* 已添加商品的行样式 */
        .added-product-row {
          opacity: 0.6;
          background-color: rgba(82, 196, 26, 0.08) !important;
        }

        .added-product-row:hover td {
          background-color: rgba(82, 196, 26, 0.12) !important;
        }

        .fetch-detail-confirm .confirm-product {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: rgba(0, 240, 255, 0.05);
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .fetch-detail-confirm .confirm-info {
          flex: 1;
          min-width: 0;
        }

        .fetch-detail-confirm .confirm-desc {
          font-size: 13px;
          color: #9ca3af;
        }

        .fetch-detail-confirm .confirm-desc ul {
          margin: 8px 0;
          padding-left: 20px;
        }

        .fetch-detail-confirm .confirm-desc li {
          margin-bottom: 4px;
        }

        .fetch-detail-result {
          padding: 16px 0;
        }

        .fetch-detail-result.success .result-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }

        .fetch-detail-result .result-fields {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px;
          background: rgba(82, 196, 26, 0.05);
          border-radius: 8px;
        }

        .fetch-detail-result .result-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
        }

        .fetch-detail-result .result-row .label {
          color: #8c8c8c;
        }

        .fetch-detail-result .result-row .value {
          color: #e8e8e8;
          text-align: right;
          max-width: 280px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* 批量获取详情弹窗样式 */
        .batch-fetch-confirm .confirm-desc {
          font-size: 13px;
          color: #9ca3af;
        }

        .batch-fetch-confirm .confirm-desc ul {
          margin: 8px 0;
          padding-left: 20px;
        }

        .batch-fetch-confirm .confirm-desc li {
          margin-bottom: 4px;
        }

        .batch-fetch-results {
          padding: 8px 0;
        }

        .batch-summary {
          display: flex;
          gap: 16px;
          justify-content: center;
          margin-bottom: 20px;
          padding: 16px;
          background: rgba(17, 24, 39, 0.5);
          border-radius: 8px;
        }

        .summary-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 24px;
          border-radius: 8px;
        }

        .summary-stat.success {
          background: rgba(82, 196, 26, 0.1);
        }

        .summary-stat.skipped {
          background: rgba(250, 173, 20, 0.1);
        }

        .summary-stat.failed {
          background: rgba(255, 77, 79, 0.1);
        }

        .summary-stat .stat-value {
          font-size: 24px;
          font-weight: 700;
        }

        .summary-stat.success .stat-value {
          color: #52c41a;
        }

        .summary-stat.skipped .stat-value {
          color: #faad14;
        }

        .summary-stat.failed .stat-value {
          color: #ff4d4f;
        }

        .summary-stat .stat-label {
          font-size: 12px;
          color: #8c8c8c;
          margin-top: 4px;
        }

        .batch-detail-list {
          max-height: 200px;
          overflow-y: auto;
        }

        .batch-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 4px;
          margin-bottom: 4px;
          font-size: 12px;
        }

        .batch-item.skipped {
          background: rgba(250, 173, 20, 0.1);
        }

        .batch-item.failed {
          background: rgba(255, 77, 79, 0.1);
        }

        .batch-item-id {
          font-family: monospace;
          color: #8c8c8c;
        }

        .batch-item-status {
          font-weight: 600;
        }

        .batch-item.skipped .batch-item-status {
          color: #faad14;
        }

        .batch-item.failed .batch-item-status {
          color: #ff4d4f;
        }

        .batch-item-message {
          color: #9ca3af;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* 批量获取详情弹窗 - 确认页样式 */
        .batch-fetch-stats {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-bottom: 16px;
          padding: 12px;
          background: rgba(17, 24, 39, 0.5);
          border-radius: 8px;
        }

        .batch-fetch-stats .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px 16px;
          border-radius: 6px;
        }

        .batch-fetch-stats .stat-item.highlight {
          background: rgba(82, 196, 26, 0.15);
        }

        .batch-fetch-stats .stat-num {
          font-size: 20px;
          font-weight: 700;
          color: #00f0ff;
        }

        .batch-fetch-stats .stat-item.highlight .stat-num {
          color: #52c41a;
        }

        .batch-fetch-stats .stat-text {
          font-size: 12px;
          color: #8c8c8c;
          margin-top: 2px;
        }

        .batch-fetch-option {
          padding: 12px;
          background: rgba(0, 240, 255, 0.05);
          border: 1px solid rgba(0, 240, 255, 0.15);
          border-radius: 6px;
          margin-top: 12px;
        }
      `}</style>
    </div>
  );
}
