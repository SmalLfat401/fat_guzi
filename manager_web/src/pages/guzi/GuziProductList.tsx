import { useState, useEffect } from 'react';
import { message, Modal, Space, Tag, Input, Button, Dropdown, Select, Tooltip, Image } from 'antd';
import type { MenuProps } from 'antd';
import {
  CloudDownloadOutlined,
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
    } catch (error) {
      // 后端未实现时使用模拟数据
      setProducts(mockProducts);
      setPagination(prev => ({ ...prev, total: mockProducts.length }));
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
      const results = await guziProductApi.searchAlimama(finalKeyword);
      setSearchResults(results);
    } catch (error) {
      // 后端未实现时使用模拟数据
      setSearchResults(mockSearchResults);
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
        platforms: item.platforms,
        description: '从淘宝联盟搜索添加',
        ip_tags: ipTagIds,
        category_tags: categoryTagIds,
      }));

      await guziProductApi.createProducts(productsToCreate);
      message.success(`成功添加 ${selectedRows.length} 个商品`);
      setSearchModalVisible(false);
      setSelectedRows([]);
      handleResetSearch();
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
      width: 100,
      fixed: 'left',
      render: (url: string) => (
        url ? (
          <Image
            src={url}
            width={60}
            height={60}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            fallback="https://via.placeholder.com/60?text=No+Image"
            preview={{ mask: <span>看大图</span> }}
          />
        ) : null
      ),
    },
    {
      title: '商品标题',
      dataIndex: 'title',
      key: 'title',
      width: 160,
      render: (text: string) => (
        <Tooltip title={text}>
          <span className="product-title" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: '最低价',
      key: 'lowest_price',
      width: 100,
      render: (_, record: GuziProduct) => {
        if (!record.platforms || record.platforms.length === 0) return '-';
        const lowest = record.platforms.reduce((min, p) => p.price < min.price ? p : min, record.platforms[0]);
        return (
          <div>
            <span style={{ color: '#52c41a', fontWeight: 600 }}>¥{lowest.price.toFixed(2)}</span>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>{lowest.platform_name}</div>
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
      render: (_, record) => (
        <input
          type="checkbox"
          checked={selectedRows.some(r => r.title === record.title)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedRows(prev => [...prev, record]);
            } else {
              setSelectedRows(prev => prev.filter(r => r.title !== record.title));
            }
          }}
        />
      ),
    },
    {
      title: '商品图片',
      dataIndex: 'image_url',
      key: 'image_url',
      width: 100,
      render: (url: string) => (
        <Image
          src={url}
          width={60}
          height={60}
          style={{ objectFit: 'cover', borderRadius: 4 }}
          fallback="https://via.placeholder.com/60?text=No+Image"
          preview={{ mask: <span>看大图</span> }}
        />
      ),
    },
    {
      title: '商品标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
      render: (text: string) => <Tooltip title={text}>{text}</Tooltip>,
    },
    {
      title: '最低价',
      key: 'lowest_price',
      width: 100,
      render: (_, record) => (
        <div>
          <span style={{ color: '#52c41a', fontWeight: 600 }}>¥{record.lowest_price.toFixed(2)}</span>
        </div>
      ),
    },
    {
      title: '最高佣金',
      key: 'highest_commission',
      width: 100,
      render: (_, record) => (
        <div>
          <span style={{ color: '#fa8c16', fontWeight: 600 }}>¥{record.highest_commission.toFixed(2)}</span>
        </div>
      ),
    },
    {
      title: '平台',
      key: 'platforms',
      width: 150,
      render: (_, record) => (
        <Space wrap>
          {record.platforms.map(p => (
            <Tag key={p.platform_id} color={
              p.platform_id === 'alimama' ? 'orange' :
              p.platform_id === 'jd' ? 'red' : 'blue'
            }>
              {p.platform_name}
            </Tag>
          ))}
        </Space>
      ),
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
          rowKey="_id"
          loading={loading}
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
          <div key="footer-info" style={{ float: 'left' }}>
            <Tag color="blue">已选择: {selectedRows.length} 个商品</Tag>
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
            添加选中商品
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
              pagination={false}
              scroll={{ x: 800 }}
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
      `}</style>
    </div>
  );
}
