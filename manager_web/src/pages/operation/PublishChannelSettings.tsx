import { useState } from 'react';
import { message, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Table, Button, Switch, Space, Form, Input } from 'antd';
import '../../styles/global.scss';

// ============================================================
// 静态数据
// ============================================================

interface Channel {
  id: string;
  name: string;
  icon?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const MOCK_CHANNELS: Channel[] = [
  { id: 'ch1', name: '抖音', icon: '🎵', is_active: true, created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z' },
  { id: 'ch2', name: '小红书', icon: '📕', is_active: true, created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z' },
];

// ============================================================
// 组件
// ============================================================

const PublishChannelSettings: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>(MOCK_CHANNELS);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [form] = Form.useForm();
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('');

  const handleCreate = () => {
    setEditingChannel(null);
    setFormName(''); setFormIcon('');
    setModalVisible(true);
  };

  const handleEdit = (ch: Channel) => {
    setEditingChannel(ch);
    setFormName(ch.name);
    setFormIcon(ch.icon ?? '');
    setModalVisible(true);
  };

  const handleSubmit = () => {
    if (!formName.trim()) { message.warning('请输入渠道名称'); return; }
    if (editingChannel) {
      setChannels(prev => prev.map(c =>
        c.id === editingChannel.id
          ? { ...c, name: formName.trim(), icon: formIcon.trim() || undefined, updated_at: new Date().toISOString() }
          : c
      ));
      message.success('更新成功');
    } else {
      const newCh: Channel = {
        id: 'local_' + Math.random().toString(36).slice(2, 8),
        name: formName.trim(),
        icon: formIcon.trim() || undefined,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setChannels(prev => [...prev, newCh]);
      message.success('创建成功');
    }
    setModalVisible(false);
  };

  const handleDelete = (ch: Channel) => {
    Modal.confirm({
      title: '确认删除渠道',
      content: `确定要删除发布渠道「${ch.name}」吗？`,
      okText: '删除', okType: 'danger', cancelText: '取消',
      onOk: () => {
        setChannels(prev => prev.filter(c => c.id !== ch.id));
        message.success('删除成功');
      },
    });
  };

  const columns: ColumnsType<Channel> = [
    {
      title: '渠道名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Channel) => (
        <Space>
          {record.icon && <span style={{ fontSize: 16 }}>{record.icon}</span>}
          <span>{name}</span>
        </Space>
      ),
    },
    {
      title: '图标',
      dataIndex: 'icon',
      key: 'icon',
      width: 80,
      render: (icon?: string) => icon
        ? <span style={{ fontSize: 18 }}>{icon}</span>
        : <span style={{ color: '#6b7280' }}>-</span>,
    },
    {
      title: '启用状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean, record: Channel) => (
        <Switch
          checkedChildren="启用"
          unCheckedChildren="禁用"
          checked={isActive}
          size="small"
          onChange={(checked) => {
            setChannels(prev => prev.map(c =>
              c.id === record.id ? { ...c, is_active: checked, updated_at: new Date().toISOString() } : c
            ));
            message.success(checked ? '已启用' : '已禁用');
          }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: any, record: Channel) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <div className="page-header" style={{ padding: '20px 24px 16px' }}>
        <h3 className="page-title">发布渠道配置</h3>
        <p style={{ color: '#9ca3af', fontSize: 13, margin: '4px 0 0' }}>
          配置内容发布的目标平台，新增渠道后周排期卡片将自动同步显示
        </p>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新增渠道</Button>
        </div>

        <Table
          columns={columns}
          dataSource={channels}
          rowKey="id"
          size="small"
          pagination={false}
        />
      </div>

      <Modal
        title={editingChannel ? '编辑发布渠道' : '新增发布渠道'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText={editingChannel ? '保存' : '创建'}
        cancelText="取消"
        destroyOnClose
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="渠道名称" required>
            <Input
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="如：抖音、小红书、微博"
            />
          </Form.Item>
          <Form.Item label="图标（emoji）">
            <Input
              value={formIcon}
              onChange={e => setFormIcon(e.target.value)}
              placeholder="如：🎵 📕 🐦"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PublishChannelSettings;
