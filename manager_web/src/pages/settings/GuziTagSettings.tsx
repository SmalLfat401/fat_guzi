import { useState, useEffect } from 'react';
import { message, Modal, Tabs, Tag, Space, Row, Col, Alert } from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { GuziTag, GuziTagCreate, GuziTagUpdate, TagType } from '../../types/guziTag';
import { guziTagApi } from '../../api/guziTag';
import { Table, Button, Switch, Tooltip, Form, Input, Select } from 'antd';
import dayjs from 'dayjs';
import '../../styles/global.scss';

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

// IP标签说明
const ipTagDescriptions = [
  'IP标签用于标记商品所属的作品/角色/游戏',
  '示例：火影忍者、EVA、原神、蓝色监狱、孤独摇滚',
  '一个商品可以打多个IP标签（如：蓝色监狱 + 吧唧）',
];

// IP标签颜色分类标准
const ipTagColorCategories = [
  { color: '#ff4d4f', label: '日本热血少年', examples: '鬼灭、咒术、海贼王、火影等' },
  { color: '#1890ff', label: '日本运动竞技', examples: '排球少年、蓝锁、灌篮高手等' },
  { color: '#52c41a', label: '日本治愈/萌系', examples: 'Chiikawa、三丽鸥、魔卡少女樱等' },
  { color: '#faad14', label: '日本经典长篇', examples: 'EVA、高达、犬夜叉等' },
  { color: '#eb2f96', label: '日本乙女/女性向', examples: '偶像梦幻祭、歌王子、黑执事' },
  { color: '#722ed1', label: '日本虚拟偶像', examples: '初音未来' },
  { color: '#13c2c2', label: '国产动画', examples: '天官赐福、魔道祖师、时光代理人等' },
  { color: '#fa8c16', label: '国产乙女游戏', examples: '光夜、恋与深空、未定事件簿等' },
  { color: '#2f54eb', label: '欧美大IP', examples: '迪士尼、哈利波特、小马宝莉' },
  // 游戏类
  { color: '#722ed1', label: '米哈游系', examples: '原神、崩铁、绝区零、崩坏3等' },
  { color: '#1890ff', label: '腾讯系', examples: '王者荣耀、和平精英、光与夜之恋、英雄联盟等' },
  { color: '#fa8c16', label: '网易系', examples: '第五人格、蛋仔派对、阴阳师、永劫无间等' },
  { color: '#eb2f96', label: '叠纸系', examples: '恋与深空、恋与制作人、闪耀暖暖' },
  { color: '#13c2c2', label: '鹰角/库洛', examples: '明日方舟、鸣潮' },
  { color: '#52c41a', label: '其他国产', examples: '代号鸢、重返未来1999、光遇、黑神话悟空等' },
  { color: '#ff4d4f', label: '日本游戏', examples: '精灵宝可梦、塞尔达传说、最终幻想等' },
  { color: '#2f54eb', label: '欧美游戏', examples: '艾尔登法环、赛博朋克2077' },
];

// 类别标签说明
const categoryTagDescriptions = [
  '类别标签用于标记商品的周边形态/性质',
  '示例：吧唧（徽章）、立牌、挂件、手办、棉花娃娃、亚克力',
  '一个商品通常只打一个类别标签',
];

// 类别标签颜色分类标准
const categoryTagColorCategories = [
  { color: '#ff4d4f', label: '徽章类', examples: '吧唧' },
  { color: '#1890ff', label: '亚克力类', examples: '立牌、流麻、挂件、亚克力砖、相框、PP夹、手机支架、卡套、摇摇乐' },
  { color: '#52c41a', label: '纸制品类', examples: '色纸、镭射票、拍立得、明信片、小卡、透卡、海报、杯垫、便签、胶带' },
  { color: '#eb2f96', label: '毛绒纺织类', examples: '棉花娃娃、趴趴、团子、毛绒挂件、手偶、零钱包、fufu' },
  { color: '#722ed1', label: '立体模型类', examples: '手办、粘土人、景品、盒蛋、可动手办、BJD娃娃' },
  { color: '#fa8c16', label: '实用周边类', examples: '痛包、谷美、收纳类、服饰配件、扇子' },
  { color: '#13c2c2', label: '卡牌收藏类', examples: '收藏卡、闪卡、透卡' },
];

// 单个标签管理组件（IP 或 类别）
const TagManager: React.FC<{
  tagType: TagType;
  tagTypeLabel: string;
  tagTypeColor: string;
  descriptions: string[];
}> = ({ tagType, tagTypeLabel, tagTypeColor, descriptions }) => {
  const [tags, setTags] = useState<GuziTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTag, setEditingTag] = useState<GuziTag | null>(null);
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [pageInfo, setPageInfo] = useState({ page: 1, pageSize: 20 });
  const [form] = Form.useForm();

  const fetchTags = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        skip: (pageInfo.page - 1) * pageInfo.pageSize,
        limit: pageInfo.pageSize,
        tag_type: tagType,
      };
      if (isActiveFilter !== undefined) {
        params.is_active = isActiveFilter;
      }
      if (searchText) {
        params.search = searchText;
      }
      const data = await guziTagApi.getTags(params);
      setTags(data.items);
      setTotal(data.total);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, [isActiveFilter, searchText, pageInfo]);

  // 不再需要 formFields 受控字段，Form 实例持久化即可

  const handleCreate = () => {
    setEditingTag(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (tag: GuziTag) => {
    setEditingTag(tag);
    setModalVisible(true);
  };

  const handleModalAfterOpenChange = (open: boolean) => {
    if (open && editingTag) {
      form.setFieldsValue({
        name: editingTag.name,
        color: editingTag.color ?? undefined,
        remark: editingTag.remark ?? undefined,
        is_active: editingTag.is_active,
      });
    }
    if (!open) {
      setEditingTag(null);
      form.resetFields();
    }
  };

  const handleDelete = (tag: GuziTag) => {
    Modal.confirm({
      title: `确认删除${tagTypeLabel}标签`,
      content: `确定要删除标签「${tag.name}」吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await guziTagApi.deleteTag(tag._id);
          message.success('删除成功');
          fetchTags();
        } catch (err) {
          message.error(err instanceof Error ? err.message : '删除失败');
        }
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: GuziTagCreate | GuziTagUpdate = editingTag
        ? { ...values }
        : { tag_type: tagType, ...values };

      if (editingTag) {
        await guziTagApi.updateTag(editingTag._id, payload as GuziTagUpdate);
        message.success('更新成功');
      } else {
        await guziTagApi.createTag(payload as GuziTagCreate);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchTags();
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    }
  };

  const columns: ColumnsType<GuziTag> = [
    {
      title: '标签名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: GuziTag) => (
        <Space>
          <Tag color={record.color || tagTypeColor}>{name}</Tag>
        </Space>
      ),
    },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      width: 100,
      render: (color: string | undefined) =>
        color ? (
          <Space>
            <div style={{
              width: 16, height: 16, borderRadius: 4,
              backgroundColor: color, display: 'inline-block',
            }} />
            <span style={{ color: '#9ca3af', fontSize: 12 }}>{color}</span>
          </Space>
        ) : (
          <span style={{ color: '#9ca3af', fontSize: 12 }}>默认</span>
        ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      render: (remark: string | undefined) =>
        remark ? (
          <Tooltip title={remark}>
            <span style={{ color: '#9ca3af', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
              {remark}
            </span>
          </Tooltip>
        ) : (
          <span style={{ color: '#4b5563' }}>-</span>
        ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 90,
      render: (isActive: boolean, record: GuziTag) => (
        <Switch
          checkedChildren="启用"
          unCheckedChildren="禁用"
          checked={isActive}
          size="small"
          onChange={(checked) => {
            guziTagApi.updateTag(record._id, { is_active: checked })
              .then(() => {
                message.success(checked ? '已启用' : '已禁用');
                fetchTags();
              })
              .catch((err) => message.error(err.message));
          }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: GuziTag) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          />
        </Space>
      ),
    },
  ];

  const activeCount = tags.filter((t) => t.is_active).length;

  return (
    <div>
      <Alert
        message={`${tagTypeLabel}标签说明`}
        description={
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {descriptions.map((d, i) => (
              <li key={i} style={{ color: '#9ca3af', fontSize: 12 }}>{d}</li>
            ))}
          </ul>
        }
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 16 }}
      />

      {/* IP标签颜色分类说明 */}
      {tagType === 'ip' && (
        <div style={{
          marginBottom: 16,
          padding: 12,
          background: 'rgba(17, 24, 39, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 8
        }}>
          <div style={{ marginBottom: 8, color: '#9ca3af', fontSize: 13, fontWeight: 500 }}>IP标签颜色分类标准</div>

          <Tabs
            size="small"
            tabBarStyle={{ marginBottom: 8 }}
            items={[
              {
                key: 'animation',
                label: '动画类',
                children: (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ipTagColorCategories.slice(0, 9).map((cat, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: 4,
                      }}>
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          backgroundColor: cat.color,
                          flexShrink: 0
                        }} />
                        <span style={{ color: '#fff', fontSize: 11, fontWeight: 500 }}>{cat.label}</span>
                        <span style={{ color: '#6b7280', fontSize: 10 }}>{cat.examples}</span>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                key: 'game',
                label: '游戏类',
                children: (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ipTagColorCategories.slice(9).map((cat, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: 4,
                      }}>
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          backgroundColor: cat.color,
                          flexShrink: 0
                        }} />
                        <span style={{ color: '#fff', fontSize: 11, fontWeight: 500 }}>{cat.label}</span>
                        <span style={{ color: '#6b7280', fontSize: 10 }}>{cat.examples}</span>
                      </div>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* 类别标签颜色分类说明 */}
      {tagType === 'category' && (
        <div style={{
          marginBottom: 16,
          padding: 16,
          background: 'rgba(17, 24, 39, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 8
        }}>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#9ca3af', fontSize: 13, fontWeight: 500 }}>类别标签颜色分类标准</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {categoryTagColorCategories.map((cat, idx) => (
              <div key={idx} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: 6,
                minWidth: 180
              }}>
                <div style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: cat.color,
                  flexShrink: 0
                }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>{cat.label}</span>
                  <span style={{ color: '#6b7280', fontSize: 11 }}>{cat.examples}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <Row gutter={16} align="middle">
          <Col flex="none">
            <Space>
              <span style={{ color: '#9ca3af', fontSize: 13 }}>
                共 <strong style={{ color: '#00f0ff' }}>{total}</strong> 个标签，
                已启用 <strong style={{ color: '#52c41a' }}>{activeCount}</strong> 个
              </span>
            </Space>
          </Col>
          <Col flex="auto" style={{ textAlign: 'right' }}>
            <Space wrap>
              <Select
                placeholder="状态筛选"
                allowClear
                style={{ width: 110 }}
                size="small"
                value={isActiveFilter}
                onChange={(val) => { setIsActiveFilter(val); setPageInfo(p => ({ ...p, page: 1 })); }}
                options={[
                  { label: '全部', value: undefined },
                  { label: '已启用', value: true },
                  { label: '已禁用', value: false },
                ]}
              />
              <Input
                placeholder="搜索标签名称"
                prefix={<SearchOutlined />}
                allowClear
                style={{ width: 180 }}
                size="small"
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setPageInfo(p => ({ ...p, page: 1 })); }}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                size="small"
                onClick={handleCreate}
              >
                新增{tagTypeLabel}标签
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Table
        columns={columns}
        dataSource={tags}
        rowKey="_id"
        loading={loading}
        size="small"
        pagination={{
          current: pageInfo.page,
          pageSize: pageInfo.pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (page, pageSize) => setPageInfo({ page, pageSize }),
        }}
      />

      <Modal
        title={editingTag ? `编辑${tagTypeLabel}标签` : `新增${tagTypeLabel}标签`}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText={editingTag ? '保存' : '创建'}
        cancelText="取消"
        destroyOnClose
        afterOpenChange={handleModalAfterOpenChange}
      >
        <Form form={form} layout="vertical" preserve={false}>
          {!editingTag && (
            <Form.Item label="标签类型">
              <Tag color={tagTypeColor}>{tagTypeLabel}</Tag>
            </Form.Item>
          )}
          <Form.Item
            name="name"
            label="标签名称"
            rules={[
              { required: true, message: '请输入标签名称' },
              { max: 100, message: '最多100个字符' },
            ]}
          >
            <Input placeholder={`如：${tagType === 'ip' ? '火影忍者、EVA' : '吧唧、立牌、棉花娃娃'}`} />
          </Form.Item>
          <Form.Item name="color" label="标签颜色">
            <Select
              placeholder="选择颜色（可选）"
              allowClear
              options={colorOptions}
            />
          </Form.Item>
          <Form.Item name="remark" label="备注说明">
            <Input.TextArea
              placeholder="可选，如：蓝色监狱是一部体育类动漫"
              rows={2}
              maxLength={500}
              showCount
            />
          </Form.Item>
          {editingTag && (
            <Form.Item name="is_active" label="启用状态" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

const GuziTagSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('ip');

  return (
    <div className="fade-in">
      <div className="page-header" style={{ padding: '20px 24px 16px' }}>
        <h3 className="page-title">谷子标签管理</h3>
        <p style={{ color: '#9ca3af', fontSize: 13, margin: '4px 0 0' }}>
          管理谷子商品的 IP 标签和类别标签，用于商品分类和快速过滤
        </p>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'ip',
              label: (
                <Space>
                  IP标签
                  <Tag color="blue">作品/角色</Tag>
                </Space>
              ),
              children: (
                <TagManager
                  tagType="ip"
                  tagTypeLabel="IP"
                  tagTypeColor="blue"
                  descriptions={ipTagDescriptions}
                />
              ),
            },
            {
              key: 'category',
              label: (
                <Space>
                  类别标签
                  <Tag color="purple">周边形态</Tag>
                </Space>
              ),
              children: (
                <TagManager
                  tagType="category"
                  tagTypeLabel="类别"
                  tagTypeColor="purple"
                  descriptions={categoryTagDescriptions}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
};

export default GuziTagSettings;
