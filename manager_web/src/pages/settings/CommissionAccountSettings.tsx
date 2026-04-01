import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Space, message, Alert, Divider, Tag, Row, Col, Switch, Tabs, Empty, Modal } from 'antd';
import { SaveOutlined, DeleteOutlined, EyeOutlined, EyeInvisibleOutlined, EditOutlined, CloseOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { platformConfigApi, type PlatformConfig, type SupportedPlatform } from '../../api/platformConfig';
import '../../styles/global.scss';

// 默认支持的平台
const defaultPlatforms: SupportedPlatform[] = [
  {
    platform_id: 'alimama',
    platform_name: '阿里妈妈',
    icon: '🅰️',
    description: '淘宝客API，提供商品搜索、佣金查询、订单跟踪等功能',
    doc_url: 'https://pub.alimama.com/',
  },
  {
    platform_id: 'jd',
    platform_name: '京东联盟',
    icon: '🅹',
    description: '京东联盟API，提供商品推广、佣金结算、订单查询等功能',
    doc_url: 'https://union.jd.com/',
  },
  {
    platform_id: 'pdd',
    platform_name: '多多客',
    icon: '🅿️',
    description: '拼多多多多客API，提供商品推广、佣金查询、订单跟踪等功能',
    doc_url: 'https://www.pinduoduo.com/',
  },
];

// 将平台信息与配置合并
interface PlatformWithConfig extends SupportedPlatform {
  config?: PlatformConfig;
}

const PlatformCard: React.FC<{
  platform: PlatformWithConfig;
  onSave: (platformId: string, values: { app_key: string; app_secret: string; pid: string; is_active: boolean }) => Promise<void>;
  onDelete: (platformId: string) => Promise<void>;
  onToggleActive: (platformId: string, isActive: boolean) => Promise<void>;
}> = ({ platform, onSave, onDelete, onToggleActive }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasConfig, setHasConfig] = useState(!!(platform.config?.app_key && platform.config?.app_secret));

  useEffect(() => {
    if (platform.config) {
      form.setFieldsValue({
        app_key: platform.config.app_key || '',
        app_secret: platform.config.app_secret || '',
        pid: platform.config.pid || '',
        is_active: platform.config.is_active || false,
      });
      setHasConfig(!!(platform.config.app_key && platform.config.app_secret));
    }
    // 切换平台时重置编辑状态
    setIsEditing(false);
  }, [platform.config, form]);

  // 切换到编辑模式
  const handleEdit = () => {
    setIsEditing(true);
  };

  // 取消编辑
  const handleCancel = () => {
    form.setFieldsValue({
      app_key: platform.config?.app_key || '',
      app_secret: platform.config?.app_secret || '',
      pid: platform.config?.pid || '',
    });
    setIsEditing(false);
  };

  const handleSave = async (values: { app_key: string; app_secret: string; pid: string; is_active: boolean }) => {
    setLoading(true);
    try {
      await onSave(platform.platform_id, values);
      setHasConfig(!!(values.app_key && values.app_secret));
      setIsEditing(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (platformId: string) => {
    Modal.confirm({
      title: '确认清除',
      content: `确定要清除 ${platform.platform_name} 的配置吗？清除后需要重新输入才能再次使用。`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true);
        try {
          await onDelete(platformId);
          form.resetFields();
          setHasConfig(false);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const config = platform.config;
  const isActive = config?.is_active ?? false;

  return (
    <Card
      title={
        <Space>
          <span style={{ fontSize: 20 }}>{platform.icon}</span>
          <span>{platform.platform_name}</span>
        </Space>
      }
      extra={
        <Space>
          {hasConfig && isActive && (
            <Tag color="green">已启用</Tag>
          )}
          {hasConfig && !isActive && (
            <Tag color="orange">已配置</Tag>
          )}
          {!hasConfig && (
            <Tag>未配置</Tag>
          )}
        </Space>
      }
      style={{ height: '100%' }}
    >
      <p style={{ color: '#666', marginBottom: 16 }}>{platform.description}</p>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={{
          app_key: '',
          app_secret: '',
          pid: '',
          is_active: false,
        }}
      >
        <Form.Item
          label="AppKey"
          name="app_key"
          rules={[
            { required: isEditing, message: '请输入 AppKey' },
            { min: 5, message: 'AppKey 长度至少为5位' },
          ]}
        >
          <Input 
            placeholder={`请输入 ${platform.platform_name} 的 AppKey`}
            maxLength={100}
            disabled={!isEditing}
          />
        </Form.Item>

        <Form.Item
          label="AppSecret"
          name="app_secret"
          rules={[
            { required: isEditing, message: '请输入 AppSecret' },
            { min: 10, message: 'AppSecret 长度至少为10位' },
          ]}
        >
          <Input.Password
            placeholder={`请输入 ${platform.platform_name} 的 AppSecret`}
            maxLength={200}
            disabled={!isEditing}
            iconRender={(visible) => (
              visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
            )}
          />
        </Form.Item>

        <Form.Item
          label="推广位PID"
          name="pid"
          tooltip="推广位用于跟踪佣金成交，可在各平台后台创建获取"
          rules={[
            { required: isEditing && platform.platform_id === 'alimama', message: '请输入推广位PID' },
          ]}
        >
          <Input
            placeholder="请输入推广位PID（如：mm_12345678_12345678_12345678）"
            maxLength={100}
            disabled={!isEditing}
          />
        </Form.Item>

        <Form.Item
          label="启用状态"
          name="is_active"
          valuePropName="checked"
        >
          <Switch
            checkedChildren="启用"
            unCheckedChildren="禁用"
            disabled={!hasConfig}
            onChange={(checked) => onToggleActive(platform.platform_id, checked)}
          />
        </Form.Item>

        <Divider style={{ margin: '16px 0' }} />

        <Form.Item style={{ marginBottom: 0 }}>
          <Space>
            {isEditing ? (
              <>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  icon={<SaveOutlined />}
                  loading={loading}
                >
                  保存
                </Button>
                <Button 
                  icon={<CloseOutlined />}
                  onClick={handleCancel}
                >
                  取消
                </Button>
              </>
            ) : (
              <Space>
                <Button 
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={handleEdit}
                >
                  编辑
                </Button>
                <Button 
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(platform.platform_id)}
                  disabled={!hasConfig}
                >
                  清除
                </Button>
              </Space>
            )}
            <Button 
              type="link" 
              href={platform.doc_url}
              target="_blank"
              icon={<InfoCircleOutlined />}
            >
              查看文档
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

const CommissionAccountSettings: React.FC = () => {
  const [configs, setConfigs] = useState<PlatformConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // 加载配置数据
  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const data = await platformConfigApi.getConfigs();
      setConfigs(data);
    } catch (e: any) {
      message.error(e.message || '获取平台配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  // 将平台信息与配置合并
  const platformsWithConfig: PlatformWithConfig[] = defaultPlatforms.map(platform => ({
    ...platform,
    config: configs.find(c => c.platform_id === platform.platform_id),
  }));

  const activePlatforms = platformsWithConfig.filter(p => p.config?.is_active);
  const configCount = platformsWithConfig.filter(p => p.config?.app_key && p.config?.app_secret).length;

  const tabItems = [
    {
      key: 'all',
      label: (
        <Space>
          全部平台
          <Tag>{platformsWithConfig.length}</Tag>
        </Space>
      ),
    },
    {
      key: 'active',
      label: (
        <Space>
          已启用
          <Tag color="green">{activePlatforms.length}</Tag>
        </Space>
      ),
    },
    {
      key: 'configured',
      label: (
        <Space>
          已配置
          <Tag color="blue">{configCount}</Tag>
        </Space>
      ),
    },
  ];

  const filteredPlatforms = activeTab === 'all' 
    ? platformsWithConfig 
    : activeTab === 'active' 
      ? platformsWithConfig.filter(p => p.config?.is_active)
      : platformsWithConfig.filter(p => p.config?.app_key && p.config?.app_secret);

  // 保存配置
  const handleSave = async (platformId: string, values: { app_key: string; app_secret: string; pid: string; is_active: boolean }) => {
    try {
      await platformConfigApi.updateConfig(platformId, values);
      message.success('配置保存成功');
      // 直接更新本地状态
      setConfigs(prev => prev.map(c => 
        c.platform_id === platformId ? { ...c, ...values } : c
      ));
    } catch (e: any) {
      message.error(e.message || '保存失败');
      throw e;
    }
  };

  // 删除配置
  const handleDelete = async (platformId: string) => {
    try {
      await platformConfigApi.deleteConfig(platformId);
      message.success('配置已清空');
      // 直接更新本地状态
      setConfigs(prev => prev.map(c => 
        c.platform_id === platformId ? { ...c, app_key: '', app_secret: '', pid: '', is_active: false } : c
      ));
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  // 切换启用状态
  const handleToggleActive = async (platformId: string, isActive: boolean) => {
    try {
      await platformConfigApi.toggleActive(platformId, isActive);
      message.success(isActive ? '已启用' : '已禁用');
      // 直接更新本地状态，避免重新请求
      setConfigs(prev => prev.map(c => 
        c.platform_id === platformId ? { ...c, is_active: isActive } : c
      ));
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ padding: '20px 24px 16px' }}>
        <h3 className="page-title">返佣账号管理</h3>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <Alert
          message="多平台配置说明"
          description={
            <div>
              <p>在这里统一管理各大电商平台的推广API配置。配置完成后，对应的平台功能将在谷子商品模块中可用。</p>
              <p style={{ marginBottom: 0 }}>
                目前支持：阿里妈妈（淘宝客）、京东联盟、多多客（拼多多）
              </p>
            </div>
          }
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: 24 }}
        />

        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={tabItems}
          style={{ marginBottom: 24 }}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px' }}>加载中...</div>
        ) : filteredPlatforms.length === 0 ? (
          <Empty 
            description="暂无平台配置" 
            style={{ padding: '48px 0' }}
          />
        ) : (
          <Row gutter={[24, 24]}>
            {filteredPlatforms.map(platform => (
              <Col xs={24} lg={12} xl={8} key={platform.platform_id}>
                <PlatformCard
                  platform={platform}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                />
              </Col>
            ))}
          </Row>
        )}
      </div>
    </div>
  );
};

export default CommissionAccountSettings;
