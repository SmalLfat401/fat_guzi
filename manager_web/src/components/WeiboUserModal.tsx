import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Switch, Divider, Select, Button, message } from 'antd';
import { UserOutlined, BulbOutlined } from '@ant-design/icons';
import type { WeiboUser, WeiboUserCreate, WeiboUserUpdate } from '../types/weibo';
import { categoryApi } from '../api/category';
import type { Category } from '../api/category';
import { llmApi } from '../api/llm';

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
  const [aiLoading, setAiLoading] = useState(false);

  const analyzeWithAI = async () => {
    const nickname = form.getFieldValue('nickname');
    if (!nickname) {
      message.warning('请先输入昵称');
      return;
    }

    const availableCategories = categories.map(c => c.name);

    setAiLoading(true);
    try {
      const prompt = `你是一个微博账号分析专家。用户输入的是微博官方账号名称，请直接分析名称中的关键词来匹配标签，不要进行过度推测。

用户账号名称：${nickname}

系统已有标签列表：
${availableCategories.join('、')}

分析要求：
1. 根据账号名称中的关键词（如品牌名、IP名、行业领域等）直接匹配最合适的1-3个标签
2. 备注填写账号名称本身传达的基本信息（如账号所属品牌、官方身份、所属领域等，20字以内）

直接返回JSON，不要任何解释：
{"notes":"账号名称本身的关键词含义","categories":["匹配的标签1","匹配的标签2"]}`;

      const result = await llmApi.assist({ prompt, temperature: 0.3, max_tokens: 500 });
      const parsed = JSON.parse(result.content);

      const notes = parsed.notes || '';
      const catNames: string[] = parsed.categories || [];

      // 将分类名称映射为ID
      const matchedCats = categories.filter(c => catNames.includes(c.name)).map(c => c._id);

      form.setFieldsValue({
        notes: form.getFieldValue('notes') ? `${form.getFieldValue('notes')}\n${notes}` : notes,
        categories: [...new Set([...(form.getFieldValue('categories') || []), ...matchedCats])],
      });
      message.success('AI分析完成，已填充备注和标签');
    } catch (error) {
      console.error('AI分析失败:', error);
      message.error('AI分析失败，请重试');
    } finally {
      setAiLoading(false);
    }
  };

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

        <div style={{ marginTop: 8 }}>
          <Button
            icon={<BulbOutlined />}
            onClick={analyzeWithAI}
            loading={aiLoading}
            disabled={aiLoading}
          >
            AI智能分析
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default WeiboUserModal;
