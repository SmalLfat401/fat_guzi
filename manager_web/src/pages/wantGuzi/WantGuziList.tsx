import { useState, useEffect } from 'react';
import { message, Modal, Space, Tag, Input, Button, Select, Drawer, Form, Row, Col, Card } from 'antd';
import {
  ShoppingOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { WantGuzi, WantGuziStats } from '../../api/wantGuzi';
import type { GuziTag } from '../../types/guziTag';
import { wantGuziApi } from '../../api/wantGuzi';
import { guziTagApi } from '../../api/guziTag';
import { Table } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import '../../styles/global.scss';

dayjs.locale('zh-cn');

const statusConfig = {
  pending: { color: 'orange', text: '待处理', icon: <ClockCircleOutlined /> },
  processing: { color: 'blue', text: '处理中', icon: <SyncOutlined /> },
  completed: { color: 'green', text: '已完成', icon: <CheckCircleOutlined /> },
  closed: { color: 'default', text: '不处理', icon: <CloseCircleOutlined /> },
};

export default function WantGuziList() {
  const [list, setList] = useState<WantGuzi[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<WantGuziStats | null>(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [statusFilter, setStatusFilter] = useState<'pending' | 'processing' | 'completed' | 'closed' | undefined>(undefined);
  const [searchKeyword, setSearchKeyword] = useState('');

  // 类别标签映射 (id -> name)
  const [tagMap, setTagMap] = useState<Record<string, string>>({});

  // 详情抽屉状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailItem, setDetailItem] = useState<WantGuzi | null>(null);
  const [detailForm] = Form.useForm();

  // 加载标签映射
  const loadTagMap = async () => {
    try {
      const data = await guziTagApi.getTags({ limit: 500 });
      const map: Record<string, string> = {};
      data.items.forEach((tag: GuziTag) => {
        map[tag._id] = tag.name;
      });
      setTagMap(map);
    } catch (error) {
      console.error('获取标签失败:', error);
    }
  };

  // 获取列表
  const fetchList = async () => {
    setLoading(true);
    try {
      const data = await wantGuziApi.getList({
        page: pagination.current,
        page_size: pagination.pageSize,
        status: statusFilter,
        search: searchKeyword || undefined,
      });
      setList(data.items);
      setPagination(prev => ({ ...prev, total: data.total }));
    } catch (error) {
      message.error('获取列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取统计
  const fetchStats = async () => {
    try {
      const data = await wantGuziApi.getStats();
      setStats(data);
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  };

  useEffect(() => {
    loadTagMap();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchList();
  }, [pagination.current, pagination.pageSize, statusFilter]);

  // 搜索
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchList();
  };

  // 删除
  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条求谷记录吗？',
      onOk: async () => {
        try {
          await wantGuziApi.delete(id);
          message.success('删除成功');
          fetchList();
          fetchStats();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  // 打开详情抽屉
  const handleOpenDetail = (item: WantGuzi) => {
    setDetailItem(item);
    detailForm.setFieldsValue({
      status: item.status,
    });
    setDetailDrawerVisible(true);
  };

  // 保存状态更新
  const handleSaveDetail = async () => {
    if (!detailItem) return;
    try {
      const values = await detailForm.validateFields();
      await wantGuziApi.update(detailItem.id, { status: values.status });
      message.success('状态已更新');
      setDetailDrawerVisible(false);
      setDetailItem(null);
      detailForm.resetFields();
      fetchList();
      fetchStats();
    } catch (error) {
      message.error('更新失败');
    }
  };

  // 表格列
  const columns: ColumnsType<WantGuzi> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 220,
      render: (id: string) => id ? (
        <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{id.substring(0, 16)}...</span>
      ) : '-',
    },
    {
      title: 'IP名称',
      dataIndex: 'ip_name',
      key: 'ip_name',
      width: 150,
      render: (name: string) => (
        <span style={{ fontWeight: 600, color: '#00f0ff' }}>{name}</span>
      ),
    },
    {
      title: '类别标签',
      dataIndex: 'category_tags',
      key: 'category_tags',
      width: 200,
      render: (tags: string[]) => (
        <Space wrap size={2}>
          {tags && tags.length > 0 ? tags.map(tag => (
            <Tag key={tag} color="purple">{tagMap[tag] || tag}</Tag>
          )) : <span style={{ color: '#8c8c8c' }}>-</span>}
        </Space>
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 180,
      render: (remark: string | null) => (
        remark ? (
          <span style={{
            color: '#8c8c8c',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'inline-block',
            maxWidth: 160,
          }}>
            {remark}
          </span>
        ) : <span style={{ color: '#8c8c8c' }}>-</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: 'pending' | 'processing' | 'completed' | 'closed') => {
        const config = statusConfig[status] || statusConfig.pending;
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, record: WantGuzi) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleOpenDetail(record)}
          >
            查看详情
          </Button>
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="want-guzi-page">
      <div className="page-header">
        <div className="header-left">
          <h2 className="page-title">
            <ShoppingOutlined className="page-icon" />
            求谷管理
          </h2>
          {stats && (
            <div className="header-stats">
              <Tag color="default">总计: {stats.total}</Tag>
              <Tag color="orange">待处理: {stats.pending}</Tag>
              <Tag color="blue">处理中: {stats.processing}</Tag>
              <Tag color="green">已完成: {stats.completed}</Tag>
              <Tag color="default">不处理: {stats.closed}</Tag>
            </div>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <Space wrap size="small">
          <span>状态筛选:</span>
          <Button
            type={statusFilter === undefined ? 'primary' : 'default'}
            onClick={() => setStatusFilter(undefined)}
          >
            全部
          </Button>
          <Button
            type={statusFilter === 'pending' ? 'primary' : 'default'}
            onClick={() => setStatusFilter('pending')}
          >
            待处理
          </Button>
          <Button
            type={statusFilter === 'processing' ? 'primary' : 'default'}
            onClick={() => setStatusFilter('processing')}
          >
            处理中
          </Button>
          <Button
            type={statusFilter === 'completed' ? 'primary' : 'default'}
            onClick={() => setStatusFilter('completed')}
          >
            已完成
          </Button>
          <Button
            type={statusFilter === 'closed' ? 'primary' : 'default'}
            onClick={() => setStatusFilter('closed')}
          >
            不处理
          </Button>
        </Space>
        <Space>
          <Input.Search
            placeholder="搜索IP名称"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 200 }}
            allowClear
          />
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
        }}
        scroll={{ x: 1200 }}
        size="small"
      />

      {/* 详情抽屉 */}
      <Drawer
        title="求谷详情"
        placement="right"
        width={480}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setDetailItem(null);
          detailForm.resetFields();
        }}
        extra={
          <Button type="primary" onClick={handleSaveDetail}>
            保存
          </Button>
        }
      >
        {detailItem && (
          <div className="detail-drawer-content">
            <Card size="small" title="用户提交信息" style={{ marginBottom: 16 }}>
              <div className="info-item">
                <span className="label">IP名称：</span>
                <span className="value" style={{ color: '#00f0ff', fontWeight: 600 }}>{detailItem.ip_name}</span>
              </div>
              {detailItem.category_tags && detailItem.category_tags.length > 0 && (
                <div className="info-item">
                  <span className="label">类别标签：</span>
                  <Space wrap size={2}>
                    {detailItem.category_tags.map(tag => (
                      <Tag key={tag} color="purple">{tagMap[tag] || tag}</Tag>
                    ))}
                  </Space>
                </div>
              )}
              {detailItem.remark && (
                <div className="info-item">
                  <span className="label">备注：</span>
                  <span className="value" style={{ color: '#8c8c8c' }}>{detailItem.remark}</span>
                </div>
              )}
              <div className="info-item">
                <span className="label">提交时间：</span>
                <span className="value">{dayjs(detailItem.created_at).format('YYYY-MM-DD HH:mm:ss')}</span>
              </div>
            </Card>

            <Form form={detailForm} layout="vertical" preserve={false}>
              <Form.Item
                name="status"
                label="处理进度"
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select
                  options={[
                    { label: '待处理', value: 'pending' },
                    { label: '处理中', value: 'processing' },
                    { label: '已完成', value: 'completed' },
                    { label: '不处理', value: 'closed' },
                  ]}
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Drawer>

      <style>{`
        .want-guzi-page {
          padding: 0;
        }

        .detail-drawer-content .info-item {
          display: flex;
          margin-bottom: 8px;
        }

        .detail-drawer-content .info-item .label {
          color: #8c8c8c;
          min-width: 80px;
        }

        .detail-drawer-content .info-item .value {
          flex: 1;
        }
      `}</style>
    </div>
  );
}
