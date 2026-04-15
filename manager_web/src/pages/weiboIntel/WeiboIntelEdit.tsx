import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  message, Card, Row, Col, Button, Space, Form, Input,
  Select, DatePicker, Alert,
} from 'antd';
import {
  CheckOutlined, CloseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import '../../styles/global.scss';
import { weiboIntelApi } from '../../api/weiboIntel';
import type { WeiboIntelDetail, WeiboIntelUpdate } from '../../types/weiboIntel';
import {
  INTEL_CATEGORY_MAP,
} from '../../types/weiboIntel';

dayjs.locale('zh-cn');

const categoryOptions = Object.entries(INTEL_CATEGORY_MAP).map(([value, label]) => ({ value, label }));

const WeiboIntelEditPage: React.FC = () => {
  const navigate = useNavigate();
  const [item, setItem] = useState<WeiboIntelDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const editId = new URLSearchParams(window.location.search).get('id');

  const fetchDetail = async () => {
    if (!editId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await weiboIntelApi.getDetail(editId);
      setItem(data);
      form.setFieldsValue({
        title: data.title,
        category: data.category,
        description: data.description,
        event_start_date: data.event_start_date ? dayjs(data.event_start_date) : undefined,
        event_end_date: data.event_end_date ? dayjs(data.event_end_date) : undefined,
        event_start_time: data.event_start_time,
        event_location: data.event_location,
        event_city: data.event_city,
        price_info: data.price_info,
        purchase_url: data.purchase_url,
        participants: data.participants?.join(', '),
        related_ips: data.related_ips?.join(', '),
        tags: data.tags?.join(', '),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetail(); }, [editId]);

  const handleSave = async () => {
    if (!item) return;
    try {
      const values = await form.validateFields();
      const updateData: WeiboIntelUpdate = {
        title: values.title,
        category: values.category,
        description: values.description,
        event_start_date: values.event_start_date?.format('YYYY-MM-DD'),
        event_end_date: values.event_end_date?.format('YYYY-MM-DD'),
        event_start_time: values.event_start_time,
        event_location: values.event_location,
        event_city: values.event_city,
        price_info: values.price_info,
        purchase_url: values.purchase_url,
        participants: values.participants ? (values.participants as string).split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
        related_ips: values.related_ips ? (values.related_ips as string).split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
        tags: values.tags ? (values.tags as string).split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
      };
      setSaving(true);
      await weiboIntelApi.update(item.id, updateData);
      message.success('保存成功');
      navigate(`/weibo-intel/detail/${item.id}`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;
  if (error) return (
    <div style={{ padding: 24 }}>
      <Alert message={error} type="error" showIcon />
      <Button style={{ marginTop: 16 }} onClick={() => navigate('/weibo-intel')}>返回列表</Button>
    </div>
  );
  if (!item) return null;

  return (
    <div className="fade-in" style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <Button onClick={() => navigate(`/weibo-intel/detail/${item.id}`)}>
          返回详情
        </Button>
      </div>

      <Card
        title={`编辑情报 - ${item.title}`}
        extra={
          <Space>
            {item.status === 'pending' && (
              <>
                <Button type="primary" icon={<CheckOutlined />} style={{ background: '#52c41a', borderColor: '#52c41a' }}
                  onClick={async () => {
                    await weiboIntelApi.approve(item.id);
                    message.success('已批准');
                    navigate('/weibo-intel');
                  }}>
                  批准
                </Button>
                <Button danger icon={<CloseOutlined />} onClick={async () => {
                  await weiboIntelApi.reject(item.id);
                  message.success('已拒绝');
                  navigate('/weibo-intel');
                }}>
                  拒绝
                </Button>
              </>
            )}
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
                <Input placeholder="活动/商品标题" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="类别" rules={[{ required: true, message: '请选择类别' }]}>
                <Select options={categoryOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="event_start_date" label="开始日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="event_end_date" label="结束日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="event_start_time" label="开始时间">
                <Input placeholder="如 14:00" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="event_city" label="城市">
                <Input placeholder="如 上海" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="event_location" label="详细地点">
                <Input placeholder="场馆名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="price_info" label="价格/票务信息">
                <Input placeholder="如 早鸟票 68元" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="purchase_url" label="购买/预约链接">
                <Input placeholder="https://..." />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="participants" label="嘉宾/参与者（逗号分隔）">
                <Input placeholder="嘉宾A, 嘉宾B" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="related_ips" label="相关IP（逗号分隔）">
                <Input placeholder="IP名1, IP名2" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="tags" label="标签（逗号分隔）">
                <Input placeholder="标签1, 标签2" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="description" label="描述">
                <Input.TextArea rows={3} placeholder="补充描述" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" className="btn-primary" onClick={handleSave} loading={saving}>
                保存修改
              </Button>
              <Button onClick={() => navigate(`/weibo-intel/detail/${item.id}`)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default WeiboIntelEditPage;
