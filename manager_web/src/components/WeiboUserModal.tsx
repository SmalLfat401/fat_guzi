import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Switch, Divider, Select } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import type { WeiboUser, WeiboUserCreate, WeiboUserUpdate } from '../types/weibo';
import { categoryApi } from '../api/category';
import type { Category } from '../api/category';

interface WeiboUserModalProps {
  visible: boolean;
  user: WeiboUser | null;
  onOk: (values: WeiboUserCreate | WeiboUserUpdate) => void;
  onCancel: () => void;
}

const WeiboUserModal: React.FC<WeiboUserModalProps> = ({ visible, user, onOk, onCancel }) => {
  const [form] = Form.useForm();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载分类数据
  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      try {
        const data = await categoryApi.getCategories(0, 100, true);
        setCategories(data);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (visible) {
      if (user) {
        form.setFieldsValue(user);
      } else {
        form.resetFields();
      }
    }
  }, [visible, user, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onOk(values);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  return (
    <Modal
      title={<span><UserOutlined /> {user ? '编辑用户' : '添加新用户'}</span>}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      width={480}
    >
      <Divider />
      <Form form={form} layout="vertical" initialValues={{ is_active: true }}>
        <Form.Item
          name="uid"
          label="用户UID"
          rules={[{ required: true, message: '请输入微博用户UID' }]}
        >
          <Input placeholder="如 5675300793" disabled={!!user} />
        </Form.Item>

        <Form.Item name="nickname" label="昵称" rules={[{ required: true, message: '请输入昵称' }]}>
          <Input placeholder="用户昵称" />
        </Form.Item>

        <Form.Item name="profile_url" label="主页链接">
          <Input placeholder="https://weibo.com/u/xxx" />
        </Form.Item>

        <Form.Item name="followers_count" label="粉丝数">
          <InputNumber min={0} style={{ width: '100%' }} placeholder="粉丝数" />
        </Form.Item>

        {user && (
          <Form.Item name="is_active" label="监控状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        )}

        <Form.Item name="notes" label="备注">
          <Input.TextArea rows={3} placeholder="备注信息（可选）" maxLength={200} showCount />
        </Form.Item>

        <Form.Item name="categories" label="标签">
          <Select
            mode="multiple"
            placeholder="搜索并选择标签"
            showSearch
            filterOption={(input, option) =>
              (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
            }
            loading={loading}
            options={categories.map(cat => ({
              value: cat._id,
              label: cat.name,
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default WeiboUserModal;
