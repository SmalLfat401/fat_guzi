import { useState, useEffect } from 'react';
import { message, Modal, Tabs, Tag, Space, Row, Col, Alert, Badge, Empty, Input } from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, FolderOutlined, AppstoreOutlined,
  InfoCircleOutlined, TagOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type {
  GuziCategory,
  GuziCategoryCreate,
  GuziCategoryUpdate,
  GuziSubCategory,
  GuziSubCategoryCreate,
  GuziSubCategoryUpdate,
  GuziCategoryWithSubs,
} from '../../types/guziCategory';
import { guziCategoryApi } from '../../api/guziCategory';
import { Table, Button, Switch, Tooltip, Form, Select, InputNumber } from 'antd';
import '../../styles/global.scss';

const { TextArea } = Input;

// 默认颜色选项
const colorOptions = [
  { label: '红色', value: '#ff4d4f' },
  { label: '橙色', value: '#fa8c16' },
  { label: '金色', value: '#faad14' },
  { label: '绿色', value: '#52c41a' },
  { label: '青色', value: '#13c2c2' },
  { label: '蓝色', value: '#1890ff' },
  { label: '紫色', value: '#722ed1' },
  { label: '粉色', value: '#eb2f96' },
];

// ──────────────────────────────────────────────
//  一级分类管理组件
// ──────────────────────────────────────────────

const CategoryManager: React.FC<{ onNeedRefresh: () => void }> = ({ onNeedRefresh }) => {
  const [categories, setCategories] = useState<GuziCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<GuziCategory | null>(null);
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [pageInfo, setPageInfo] = useState({ page: 1, pageSize: 20 });
  const [form] = Form.useForm();

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        skip: (pageInfo.page - 1) * pageInfo.pageSize,
        limit: pageInfo.pageSize,
      };
      if (isActiveFilter !== undefined) params.is_active = isActiveFilter;
      if (searchText) params.search = searchText;
      const data = await guziCategoryApi.getCategories(params);
      setCategories(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, [isActiveFilter, searchText, pageInfo]);

  const handleCreate = () => {
    setEditingCategory(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (cat: GuziCategory) => {
    setEditingCategory(cat);
    setModalVisible(true);
  };

  const handleModalAfterOpenChange = (open: boolean) => {
    if (open && editingCategory) {
      form.setFieldsValue({
        name: editingCategory.name,
        color: editingCategory.color ?? undefined,
        order: editingCategory.order,
        is_active: editingCategory.is_active,
      });
    }
    if (!open) {
      setEditingCategory(null);
      form.resetFields();
    }
  };

  const handleDelete = (cat: GuziCategory) => {
    Modal.confirm({
      title: '确认删除一级分类',
      content: (
        <div>
          <p>确定要删除分类「{cat.name}」吗？</p>
          <p style={{ color: '#ff4d4f', fontSize: 12 }}>该分类下的所有二级分类也会被一并删除！</p>
        </div>
      ),
      okText: '删除', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        try {
          await guziCategoryApi.deleteCategory(cat._id);
          message.success('删除成功');
          fetchCategories();
          onNeedRefresh();
        } catch (err) {
          message.error(err instanceof Error ? err.message : '删除失败');
        }
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingCategory) {
        await guziCategoryApi.updateCategory(editingCategory._id, values as GuziCategoryUpdate);
        message.success('更新成功');
      } else {
        await guziCategoryApi.createCategory(values as GuziCategoryCreate);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchCategories();
      onNeedRefresh();
    } catch (err) {
      if (err instanceof Error) message.error(err.message);
    }
  };

  const columns: ColumnsType<GuziCategory> = [
    {
      title: '分类名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: GuziCategory) => (
        <Space>
          <Tag color={record.color || '#1890ff'}>{name}</Tag>
        </Space>
      ),
    },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      width: 80,
      render: (color: string | undefined) => color ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: color }} />
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{color}</span>
        </div>
      ) : <span style={{ color: '#4b5563' }}>默认</span>,
    },
    {
      title: '排序',
      dataIndex: 'order',
      key: 'order',
      width: 70,
      render: (order: number) => <span style={{ color: '#9ca3af', fontFamily: 'monospace' }}>{order}</span>,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 90,
      render: (isActive: boolean, record: GuziCategory) => (
        <Switch
          checkedChildren="启用" unCheckedChildren="禁用"
          checked={isActive} size="small"
          onChange={(checked) => {
            guziCategoryApi.updateCategory(record._id, { is_active: checked })
              .then(() => { message.success(checked ? '已启用' : '已禁用'); fetchCategories(); })
              .catch((err: any) => message.error(err.message));
          }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: GuziCategory) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Row gutter={16} align="middle">
          <Col flex="none">
            <Space>
              <span style={{ color: '#9ca3af', fontSize: 13 }}>
                共 <strong style={{ color: '#00f0ff' }}>{total}</strong> 个一级分类
              </span>
            </Space>
          </Col>
          <Col flex="auto" style={{ textAlign: 'right' }}>
            <Space>
              <Select placeholder="状态筛选" allowClear style={{ width: 110 }} size="small"
                value={isActiveFilter}
                onChange={(val) => { setIsActiveFilter(val); setPageInfo(p => ({ ...p, page: 1 })); }}
                options={[{ label: '全部', value: undefined }, { label: '已启用', value: true }, { label: '已禁用', value: false }]}
              />
              <Input placeholder="搜索分类名称" prefix={<SearchOutlined />} allowClear style={{ width: 160 }} size="small"
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setPageInfo(p => ({ ...p, page: 1 })); }}
              />
              <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleCreate}>新增一级分类</Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Table columns={columns} dataSource={categories} rowKey="_id" loading={loading} size="small"
        pagination={{
          current: pageInfo.page, pageSize: pageInfo.pageSize, total,
          showSizeChanger: true, showQuickJumper: true, showTotal: (t) => `共 ${t} 条`,
          onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
        }}
      />

      <Modal
        title={editingCategory ? '编辑一级分类' : '新增一级分类'}
        open={modalVisible} onOk={handleSubmit} onCancel={() => setModalVisible(false)}
        okText={editingCategory ? '保存' : '创建'} cancelText="取消" destroyOnClose afterOpenChange={handleModalAfterOpenChange}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }, { max: 50, message: '最多50个字符' }]}>
            <Input placeholder="如：纸片类、亚克力类、毛绒类" />
          </Form.Item>
          <Form.Item name="color" label="分类颜色">
            <Select placeholder="选择颜色（可选）" allowClear options={colorOptions} />
          </Form.Item>
          <Form.Item name="order" label="排序权重" extra="数字越小排越前">
            <InputNumber min={0} max={9999} style={{ width: 120 }} />
          </Form.Item>
          {editingCategory && (
            <Form.Item name="is_active" label="启用状态" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

// ──────────────────────────────────────────────
//  二级分类管理组件
// ──────────────────────────────────────────────

const SubCategoryManager: React.FC<{ categoriesWithSubs: GuziCategoryWithSubs[] }> = ({ categoriesWithSubs }) => {
  const [allSubs, setAllSubs] = useState<GuziSubCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSub, setEditingSub] = useState<GuziSubCategory | null>(null);
  const [parentFilter, setParentFilter] = useState<string | undefined>(undefined);
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [pageInfo, setPageInfo] = useState({ page: 1, pageSize: 20 });
  const [form] = Form.useForm();

  const fetchSubs = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        skip: (pageInfo.page - 1) * pageInfo.pageSize,
        limit: pageInfo.pageSize,
      };
      if (parentFilter) params.parent_id = parentFilter;
      if (isActiveFilter !== undefined) params.is_active = isActiveFilter;
      if (searchText) params.search = searchText;
      const data = await guziCategoryApi.getSubCategories(params);
      setAllSubs(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSubs(); }, [parentFilter, isActiveFilter, searchText, pageInfo]);

  const handleCreate = () => {
    setEditingSub(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (sub: GuziSubCategory) => {
    setEditingSub(sub);
    setModalVisible(true);
  };

  const handleModalAfterOpenChange = (open: boolean) => {
    if (open && editingSub) {
      form.setFieldsValue({
        parent_id: editingSub.parent_id,
        name: editingSub.name,
        color: editingSub.color ?? undefined,
        order: editingSub.order,
        is_active: editingSub.is_active,
        taobao_search_terms: editingSub.taobao_search_terms,
        aliases: editingSub.aliases,
        match_weight: editingSub.match_weight,
        exclude: editingSub.exclude,
        material_tags: editingSub.material_tags,
        remark: editingSub.remark ?? undefined,
      });
    }
    if (!open) {
      setEditingSub(null);
      form.resetFields();
    }
  };

  const handleDelete = (sub: GuziSubCategory) => {
    Modal.confirm({
      title: '确认删除二级分类',
      content: `确定要删除二级分类「${sub.name}」吗？`,
      okText: '删除', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        try {
          await guziCategoryApi.deleteSubCategory(sub._id);
          message.success('删除成功');
          fetchSubs();
        } catch (err) {
          message.error(err instanceof Error ? err.message : '删除失败');
        }
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingSub) {
        await guziCategoryApi.updateSubCategory(editingSub._id, values as GuziSubCategoryUpdate);
        message.success('更新成功');
      } else {
        await guziCategoryApi.createSubCategory(values as GuziSubCategoryCreate);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchSubs();
    } catch (err) {
      if (err instanceof Error) message.error(err.message);
    }
  };

  const getParentName = (parentId: string) => {
    const cat = categoriesWithSubs.find(c => c._id === parentId);
    return cat?.name || parentId;
  };

  const columns: ColumnsType<GuziSubCategory> = [
    {
      title: '二级分类',
      key: 'name',
      render: (_: any, record: GuziSubCategory) => (
        <Space>
          <Tag color={record.color || '#722ed1'}>{record.name}</Tag>
        </Space>
      ),
    },
    {
      title: '所属一级分类',
      dataIndex: 'parent_id',
      key: 'parent_id',
      width: 120,
      render: (pid: string) => (
        <Tag color="blue">{getParentName(pid)}</Tag>
      ),
    },
    {
      title: '别名（搜索词）',
      key: 'aliases',
      width: 260,
      render: (_: any, record: GuziSubCategory) => (
        <Space wrap size={2}>
          {record.aliases.length > 0
            ? record.aliases.map(a => <Tag key={a} style={{ fontSize: 11 }}>{a}</Tag>)
            : <span style={{ color: '#4b5563' }}>-</span>
          }
        </Space>
      ),
    },
    {
      title: '排除词',
      key: 'exclude',
      width: 160,
      render: (_: any, record: GuziSubCategory) => (
        <Space wrap size={2}>
          {record.exclude.length > 0
            ? record.exclude.map(e => <Tag key={e} color="red" style={{ fontSize: 11 }}>{e}</Tag>)
            : <span style={{ color: '#4b5563' }}>-</span>
          }
        </Space>
      ),
    },
    {
      title: '权重',
      dataIndex: 'match_weight',
      key: 'match_weight',
      width: 60,
      render: (w: number) => <span style={{ color: '#fa8c16', fontFamily: 'monospace' }}>{w}</span>,
    },
    {
      title: '淘宝搜索词',
      key: 'taobao_search_terms',
      width: 200,
      render: (_: any, record: GuziSubCategory) => (
        <Tooltip title={record.taobao_search_terms.join('、 ') || '无'}>
          <span style={{ color: '#9ca3af', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
            {record.taobao_search_terms.length > 0 ? record.taobao_search_terms.join('、 ') : '-'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 90,
      render: (isActive: boolean, record: GuziSubCategory) => (
        <Switch
          checkedChildren="启用" unCheckedChildren="禁用"
          checked={isActive} size="small"
          onChange={(checked) => {
            guziCategoryApi.updateSubCategory(record._id, { is_active: checked })
              .then(() => { message.success(checked ? '已启用' : '已禁用'); fetchSubs(); })
              .catch((err: any) => message.error(err.message));
          }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: GuziSubCategory) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
        </Space>
      ),
    },
  ];

  const categoryOptions = categoriesWithSubs.map(c => ({
    label: c.name,
    value: c._id,
  }));

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Row gutter={16} align="middle">
          <Col flex="none">
            <Space>
              <span style={{ color: '#9ca3af', fontSize: 13 }}>
                共 <strong style={{ color: '#00f0ff' }}>{total}</strong> 个二级分类
              </span>
            </Space>
          </Col>
          <Col flex="auto" style={{ textAlign: 'right' }}>
            <Space>
              <Select placeholder="所属分类" allowClear style={{ width: 140 }} size="small"
                value={parentFilter}
                onChange={(val) => { setParentFilter(val); setPageInfo(p => ({ ...p, page: 1 })); }}
                options={categoryOptions}
              />
              <Select placeholder="状态筛选" allowClear style={{ width: 110 }} size="small"
                value={isActiveFilter}
                onChange={(val) => { setIsActiveFilter(val); setPageInfo(p => ({ ...p, page: 1 })); }}
                options={[{ label: '全部', value: undefined }, { label: '已启用', value: true }, { label: '已禁用', value: false }]}
              />
              <Input placeholder="搜索名称或别名" prefix={<SearchOutlined />} allowClear style={{ width: 180 }} size="small"
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setPageInfo(p => ({ ...p, page: 1 })); }}
              />
              <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleCreate} disabled={categoriesWithSubs.length === 0}>
                新增二级分类
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Table columns={columns} dataSource={allSubs} rowKey="_id" loading={loading} size="small"
        pagination={{
          current: pageInfo.page, pageSize: pageInfo.pageSize, total,
          showSizeChanger: true, showQuickJumper: true, showTotal: (t) => `共 ${t} 条`,
          onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
        }}
      />

      <Modal
        title={editingSub ? '编辑二级分类' : '新增二级分类'}
        open={modalVisible} onOk={handleSubmit} onCancel={() => setModalVisible(false)}
        okText={editingSub ? '保存' : '创建'} cancelText="取消" destroyOnClose
        width={680} afterOpenChange={handleModalAfterOpenChange}
      >
        <Form form={form} layout="vertical" preserve={false}>
          {!editingSub && (
            <Form.Item
              name="parent_id" label="所属一级分类"
              rules={[{ required: true, message: '请选择所属一级分类' }]}
            >
              <Select placeholder="请先选择一个一级分类" options={categoryOptions} />
            </Form.Item>
          )}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="name" label="二级分类名称" rules={[{ required: true, message: '请输入名称' }, { max: 50, message: '最多50字符' }]}>
                <Input placeholder="如：镭射票、拍立得卡、流麻" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="order" label="排序权重" extra="越小越前">
                <InputNumber min={0} max={9999} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="match_weight" label="匹配权重" extra="0-100">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="aliases" label="别名（搜索词）" extra="逗号分隔，如：徽章, 吧唧, 马口铁, 双闪, 镭射">
            <Select mode="tags" placeholder="输入后回车添加别名" style={{ width: '100%' }} tokenSeparators={[',', '，']} />
          </Form.Item>

          <Form.Item name="exclude" label="排除词" extra="逗号分隔，如：吧唧托, 卡套, 流沙立牌">
            <Select mode="tags" placeholder="输入后回车添加排除词" style={{ width: '100%' }} tokenSeparators={[',', '，']} />
          </Form.Item>

          <Form.Item name="taobao_search_terms" label="淘宝搜索关键词" extra="逗号分隔，用于向用户展示该分类搜什么">
            <Select mode="tags" placeholder="输入后回车添加搜索词" style={{ width: '100%' }} tokenSeparators={[',', '，']} />
          </Form.Item>

          <Form.Item name="material_tags" label="材质标签" extra="逗号分隔，如：马口铁, 亚克力, 相纸">
            <Select mode="tags" placeholder="输入后回车添加材质标签" style={{ width: '100%' }} tokenSeparators={[',', '，']} />
          </Form.Item>

          <Form.Item name="remark" label="备注说明">
            <TextArea placeholder="可选，如：该分类包含各种纸制周边小物件" rows={2} maxLength={500} showCount />
          </Form.Item>

          {editingSub && (
            <Form.Item name="is_active" label="启用状态" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

// ──────────────────────────────────────────────
//  二级分类预览组件（树形结构）
// ──────────────────────────────────────────────

const SubCategoryTree: React.FC<{ categories: GuziCategoryWithSubs[] }> = ({ categories }) => {
  if (categories.length === 0) {
    return <Empty description="暂无分类数据，请先添加一级分类" style={{ marginTop: 40 }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {categories
        .filter(c => c.is_active)
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
        .map(cat => (
          <div key={cat._id} style={{
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            overflow: 'hidden',
            background: 'rgba(17,24,39,0.4)',
          }}>
            {/* 一级分类头 */}
            <div style={{
              padding: '10px 16px',
              background: cat.color ? `${cat.color}22` : 'rgba(24,144,255,0.15)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <FolderOutlined style={{ color: cat.color || '#1890ff' }} />
              <span style={{ fontWeight: 600, color: cat.color || '#1890ff', fontSize: 14 }}>{cat.name}</span>
              <Tag style={{ marginLeft: 4, fontSize: 11 }}>{cat.sub_categories?.filter(s => s.is_active).length || 0} 个子类</Tag>
            </div>

            {/* 二级分类网格 */}
            {cat.sub_categories && cat.sub_categories.filter(s => s.is_active).length > 0 ? (
              <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {cat.sub_categories
                  .filter(s => s.is_active)
                  .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
                  .map(sub => (
                    <Tooltip
                      key={sub._id}
                      title={
                        <div style={{ fontSize: 12 }}>
                          <div style={{ marginBottom: 4 }}>
                            <strong>别名：</strong>{sub.aliases.length > 0 ? sub.aliases.join('、') : '无'}
                          </div>
                          <div style={{ marginBottom: 4 }}>
                            <strong>排除词：</strong>{sub.exclude.length > 0 ? sub.exclude.join('、') : '无'}
                          </div>
                          <div style={{ marginBottom: 4 }}>
                            <strong>材质：</strong>{sub.material_tags.length > 0 ? sub.material_tags.join('、') : '无'}
                          </div>
                          <div>
                            <strong>权重：</strong>{sub.match_weight}
                          </div>
                          {sub.taobao_search_terms.length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              <strong>淘宝搜：</strong>{sub.taobao_search_terms.join('、')}
                            </div>
                          )}
                          {sub.remark && <div style={{ marginTop: 4, color: '#faad14' }}>备注：{sub.remark}</div>}
                        </div>
                      }
                      overlayStyle={{ maxWidth: 360 }}
                    >
                      <Tag
                        color={sub.color || '#722ed1'}
                        style={{ cursor: 'pointer', fontSize: 12, padding: '2px 8px' }}
                      >
                        {sub.name}
                        <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>
                          [{sub.aliases.length}个别名]
                        </span>
                      </Tag>
                    </Tooltip>
                  ))
                }
              </div>
            ) : (
              <div style={{ padding: '16px', color: '#4b5563', fontSize: 13, textAlign: 'center' }}>
                暂无启用的二级分类
              </div>
            )}
          </div>
        ))
      }
    </div>
  );
};

// ──────────────────────────────────────────────
//  主页面
// ──────────────────────────────────────────────

const GuziCategorySettings: React.FC = () => {
  const [categoriesWithSubs, setCategoriesWithSubs] = useState<GuziCategoryWithSubs[]>([]);
  const [activeTab, setActiveTab] = useState('list');

  const fetchAll = async () => {
    try {
      const data = await guziCategoryApi.getCategoriesWithSubs();
      setCategoriesWithSubs(data.items);
    } catch (err) {
      console.error('加载分类数据失败', err);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const totalSubs = categoriesWithSubs.reduce((acc, c) => acc + (c.sub_categories?.length || 0), 0);

  return (
    <div className="fade-in">
      <div className="page-header" style={{ padding: '20px 24px 16px' }}>
        <h3 className="page-title">
          <AppstoreOutlined style={{ color: '#00f0ff' }} />
          <span style={{ marginLeft: 8 }}>谷子分类管理</span>
        </h3>
        <p style={{ color: '#9ca3af', fontSize: 13, margin: '4px 0 0' }}>
          管理谷子商品的类别结构（一级分类 → 二级分类）。搜索时用「IP名称 + 二级分类别名」拼接搜索词。
        </p>
        <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
          <Badge status="processing" text={<span style={{ color: '#9ca3af', fontSize: 12 }}>一级分类 <strong style={{ color: '#00f0ff' }}>{categoriesWithSubs.length}</strong> 个</span>} />
          <Badge status="processing" text={<span style={{ color: '#9ca3af', fontSize: 12 }}>二级分类 <strong style={{ color: '#00f0ff' }}>{totalSubs}</strong> 个</span>} />
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <Alert
          message="搜索词拼接规则"
          description={
            <div>
              <div style={{ marginBottom: 6, color: '#9ca3af', fontSize: 12 }}>
                搜索时，搜索词 = <strong style={{ color: '#00f0ff' }}>IP名称</strong> + <strong style={{ color: '#fa8c16' }}>二级分类的 aliases（逗号拼接）</strong>
              </div>
              <div style={{ color: '#6b7280', fontSize: 12, fontFamily: 'monospace' }}>
                例如：火影忍者 + 徽章, 吧唧, 马口铁, 双闪, 镭射 → 搜索词 = "火影忍者 徽章, 吧唧, 马口铁, 双闪, 镭射"
              </div>
              <div style={{ marginTop: 4, color: '#6b7280', fontSize: 12 }}>
                匹配度 = 命中 aliases 次数 × match_weight − 命中 exclude 次数 × 10，按匹配度排序展示给用户
              </div>
            </div>
          }
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: 16 }}
        />

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'list',
              label: '分类结构预览',
              children: <SubCategoryTree categories={categoriesWithSubs} />,
            },
            {
              key: 'manage-category',
              label: (
                <Space>
                  <FolderOutlined />一级分类
                  <Tag style={{ fontSize: 10 }}>{categoriesWithSubs.length}</Tag>
                </Space>
              ),
              children: <CategoryManager onNeedRefresh={fetchAll} />,
            },
            {
              key: 'manage-sub',
              label: (
                <Space>
                  <TagOutlined />二级分类
                  <Tag style={{ fontSize: 10 }}>{totalSubs}</Tag>
                </Space>
              ),
              children: <SubCategoryManager categoriesWithSubs={categoriesWithSubs} />,
            },
          ]}
        />
      </div>
    </div>
  );
};

export default GuziCategorySettings;
