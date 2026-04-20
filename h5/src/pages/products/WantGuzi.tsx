/**
 * 求谷表单页面
 * 用户可以提交想要的谷子信息
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, Form, Input, TextArea, Button, Selector, Toast } from 'antd-mobile';
import { fetchTags, submitWantGuzi } from '@/api';
import type { GuziTag } from '@/types';
import './index.scss';

const WantGuziPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [categoryTags, setCategoryTags] = useState<GuziTag[]>([]);
  const [form] = Form.useForm();

  // 加载类别标签
  React.useEffect(() => {
    loadCategoryTags();
  }, []);

  const loadCategoryTags = async () => {
    try {
      const data = await fetchTags('category');
      setCategoryTags(data);
    } catch (error) {
      console.error('Failed to load category tags:', error);
    }
  };

  // 提交表单
  const handleSubmit = async (values: { ipName: string; category?: string[]; remark?: string }) => {
    setLoading(true);
    try {
      // 调用后端API提交表单
      await submitWantGuzi({
        ip_name: values.ipName,
        category_tags: values.category || [],
        remark: values.remark,
      });

      Toast.show({
        content: '谷菌收到了你的需求，马上开始找',
        icon: 'success',
      });

      // 延迟返回
      setTimeout(() => {
        navigate(-1);
      }, 1500);
    } catch (error) {
      Toast.show({
        content: '提交失败，请重试',
        icon: 'fail',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="want-guzi-page">
      <NavBar onBack={() => navigate(-1)}>
        求谷表单
      </NavBar>

      <div className="want-guzi-content">
        <div className="form-intro">
          <div className="intro-icon">🎁</div>
          <h2>没有谷？告诉我！</h2>
          <p>说出你想要的谷子，我来帮你找~</p>
        </div>

        <Form
          form={form}
          layout='vertical'
          onFinish={handleSubmit}
          className="want-guzi-form"
          footer={
            <Button
              block
              color='primary'
              size='large'
              loading={loading}
              className="submit-btn"
              type="submit"
            >
              提交求谷
            </Button>
          }
        >
          <Form.Item
            name='ipName'
            label='IP名称'
            rules={[
              { required: true, message: '请输入想要的IP名称' },
              { min: 1, max: 50, message: 'IP名称不超过50个字符' }
            ]}
          >
            <Input
              placeholder='例如：咒术回战、蓝色监狱...'
              maxLength={50}
              clearable
            />
          </Form.Item>

          <Form.Item
            name='category'
            label='谷子类别（可不填）'
          >
            <Selector
              multiple
              options={categoryTags.map(tag => ({
                label: tag.name,
                value: tag._id,
              }))}
              style={{ '--border-radius': '20px' } as React.CSSProperties}
            />
          </Form.Item>

          <Form.Item
            name='remark'
            label='备注（可不填）'
          >
            <TextArea
              placeholder='可以说说具体想要什么类型的周边、预算等...'
              maxLength={200}
              rows={3}
              showCount
            />
          </Form.Item>
        </Form>
      </div>
    </div>
  );
};

export default WantGuziPage;
