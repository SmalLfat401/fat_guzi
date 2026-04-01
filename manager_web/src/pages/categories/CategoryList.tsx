import { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, message, Popconfirm, Card, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TagOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { categoryApi, type Category, type CategoryCreate, type CategoryUpdate } from '../../api/category';
import '../../styles/global.scss';

const CategoryList: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form] = Form.useForm();

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await categoryApi.getCategories(0, 100);
      setCategories(data);
    } catch (e: any) {
      message.error(e.message || '获取标签列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAdd = () => {
    setEditingCategory(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Category) => {
    setEditingCategory(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      is_active: record.is_active,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await categoryApi.deleteCategory(id);
      message.success('标签已删除');
      fetchCategories();
    } catch (e: any) {
      message.error(e.message || '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingCategory) {
        const updateData: CategoryUpdate = {
          name: values.name,
          description: values.description,
          is_active: values.is_active,
        };
        await categoryApi.updateCategory(editingCategory._id, updateData);
        message.success('标签已更新');
      } else {
        const createData: CategoryCreate = {
          name: values.name,
          description: values.description,
        };
        await categoryApi.createCategory(createData);
        message.success('标签已创建');
      }
      setModalVisible(false);
      fetchCategories();
    } catch (e: any) {
      if (e.errorFields) return;
      message.error(e.message || '操作失败');
    }
  };

  const handleToggleActive = async (record: Category) => {
    try {
      await categoryApi.updateCategory(record._id, { is_active: !record.is_active });
      message.success(record.is_active ? '标签已禁用' : '标签已启用');
      fetchCategories();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  const columns: ColumnsType<Category> = [
    {
      title: 'ID',
      dataIndex: '_id',
      key: '_id',
      width: 200,
      render: (id: string) => <Tag color="blue">{id}</Tag>,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 120,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (isActive: boolean, record: Category) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggleActive(record)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: Category) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="确定删除此标签？"
            onConfirm={() => handleDelete(record._id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="fade-in" style={{ padding: 24 }}>
      <Card
        title={<Space><TagOutlined />标签管理</Space>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增标签
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={categories}
          rowKey="_id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={editingCategory ? '编辑标签' : '新增标签'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="标签名称"
            rules={[{ required: true, message: '请输入标签名称' }]}
          >
            <Input placeholder="如: 娱乐、科技、体育" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={2} placeholder="标签描述（可选）" />
          </Form.Item>
          {editingCategory && (
            <Form.Item
              name="is_active"
              label="状态"
              valuePropName="checked"
            >
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default CategoryList;
