import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Badge, Card, Tag, Space, Button, message, Modal, Form, Input,
  Select, Tooltip, Popconfirm, Empty, Spin,
} from 'antd';
import {
  LeftOutlined, RightOutlined, PlusOutlined,
  EditOutlined, DeleteOutlined, PushpinFilled, PushpinOutlined,
  CalendarOutlined, BellOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiClient } from '../../api/config';
import { scheduleApi } from '../../api/scheduleItem';
import '../../styles/global.scss';

// ============================================================
// 情报事件类型（与 H5 保持一致）
// ============================================================

export type IntelEventType =
  | 'convention' | 'book_signing' | 'pre_order'
  | 'product_launch' | 'offline_activity' | 'online_activity' | 'other';

export interface IntelEvent {
  id: string;
  date: string;
  time?: string;
  type: IntelEventType;
  icon: string;
  name: string;
  venue?: string;
  badge: string;
  cover?: string;
  price?: string | number;
}

const INTEL_TYPE_CONFIG: Record<IntelEventType, { label: string; color: string; dot: string }> = {
  convention:      { label: '漫展',     color: '#534AB7', dot: '#7F77DD' },
  book_signing:    { label: '签售',     color: '#D4537E', dot: '#ED93B1' },
  pre_order:       { label: '预售',     color: '#E65100', dot: '#FF9800' },
  product_launch:  { label: '新谷开团', color: '#2E7D32', dot: '#66BB6A' },
  offline_activity:{ label: '线下活动', color: '#1565C0', dot: '#42A5F5' },
  online_activity: { label: '线上活动', color: '#6A1B9A', dot: '#AB47BC' },
  other:           { label: '其他',     color: '#616161', dot: '#9E9E9E' },
};

const CONTENT_TYPE_CONFIG: Record<string, {
  label: string; icon: string; color: string;
  pushTimeZh: string; recommendedDay: string;
}> = {
  activity: {
    label: '活动速递', icon: '📣', color: '#1890ff',
    pushTimeZh: '抖音 10:00 / 小红书 10:00', recommendedDay: '周一',
  },
  new_product: {
    label: '新品情报', icon: '🆕', color: '#52c41a',
    pushTimeZh: '抖音 11:00 / 小红书 11:00', recommendedDay: '周三',
  },
  slang_science: {
    label: '黑话科普', icon: '📖', color: '#722ed1',
    pushTimeZh: '抖音 16:00 / 小红书 18:00', recommendedDay: '周五',
  },
  meme_interaction: {
    label: '比价/互动/梗图', icon: '🎨', color: '#fa8c16',
    pushTimeZh: '抖音 17:00 / 小红书 19:00', recommendedDay: '周日',
  },
};

const PUBLISH_STATUS_LABELS: Record<string, string> = {
  pending: '待审核', confirmed: '已确认', published: '已发布',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'default', confirmed: 'warning', published: 'success',
};

const CHANNELS = [
  { id: 'ch1', name: '抖音', icon: '🎵' },
  { id: 'ch2', name: '小红书', icon: '📕' },
];

const SLANG_OPTIONS = [
  { label: '谷子', value: 'guzi' },
  { label: 'Coser', value: 'coser' },
  { label: '漫展', value: 'convention' },
  { label: '游戏', value: 'game' },
];

const SLANG_CATEGORY_LABELS: Record<string, string> = {
  guzi: '谷子', coser: 'Coser', convention: '漫展', game: '游戏',
};

const MOCK_SLANGS: Record<string, { slang_id: string; slang_name: string; meaning: string }[]> = {
  guzi: [
    { slang_id: 'g1', slang_name: '吧唧', meaning: '徽章周边，日文 badge 音译' },
    { slang_id: 'g2', slang_name: '立牌', meaning: '亚克力立式看板' },
    { slang_id: 'g3', slang_name: '棉花娃娃', meaning: '软绵绵的 Q 版人形娃娃' },
    { slang_id: 'g4', slang_name: '流麻', meaning: '流沙麻将牌，扁平方形，内有流沙' },
  ],
  coser: [
    { slang_id: 'c1', slang_name: 'cos', meaning: '角色扮演（costume play）' },
    { slang_id: 'c2', slang_name: '返图', meaning: '活动结束后摄影/官方发布现场照片' },
  ],
  convention: [
    { slang_id: 'cv1', slang_name: '逛展', meaning: '参观漫展' },
    { slang_id: 'cv2', slang_name: '摊位', meaning: '展会现场的售卖/展示位' },
  ],
  game: [
    { slang_id: 'gm1', slang_name: '二游', meaning: '二次元游戏的简称' },
    { slang_id: 'gm2', slang_name: '官谷', meaning: '官方周边商品' },
  ],
};

// ============================================================
// 类型
// ============================================================

interface LinkedSlang { slang_id: string; slang_type: string; slang_name: string; }
interface PlatformStatus { status: string; published_at: string | null; confirmed_at: string | null; note: string; }
interface ScheduleItem {
  id: string; week_year: string; date: string; content_type: string;
  title: string; body: string; images: string[];
  slang_category?: string; linked_slags: LinkedSlang[];
  is_pinned: boolean; platforms: Record<string, PlatformStatus>;
  created_at: string; updated_at: string;
}

// ============================================================
// 工具函数
// ============================================================

function genId(): string { return 'local_' + Math.random().toString(36).slice(2, 10); }
function nowIso(): string { return new Date().toISOString(); }

function getWeekYear(date: string): string {
  const d = dayjs(date + 'T00:00:00');
  const year = d.year();
  const jan1 = dayjs(`${year}-01-01T00:00:00`);
  const dayOfJan1 = jan1.day();
  const daysToFirstMonday = dayOfJan1 <= 1 ? 1 - dayOfJan1 : 8 - dayOfJan1;
  const firstMonday = jan1.add(daysToFirstMonday, 'day');
  let week: number;
  if (d.isSame(firstMonday) || d.isBefore(firstMonday)) {
    const prevYear = year - 1;
    const prevJan1 = dayjs(`${prevYear}-01-01T00:00:00`);
    const prevDay = prevJan1.day();
    const prevDays = prevDay <= 1 ? 1 - prevDay : 8 - prevDay;
    const prevMonday = prevJan1.add(prevDays, 'day');
    week = Math.floor(d.diff(prevMonday, 'day') / 7) + 1;
    return `${prevYear}-W${String(week).padStart(2, '0')}`;
  }
  week = Math.floor(d.diff(firstMonday, 'day') / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function globalStatus(item: ScheduleItem): string {
  const statuses = Object.values(item.platforms).map(p => p.status);
  if (statuses.includes('published')) return 'published';
  if (statuses.includes('confirmed')) return 'confirmed';
  return 'pending';
}

function nextStatusFn(current: string): string | null {
  if (current === 'pending') return 'confirmed';
  if (current === 'confirmed') return 'published';
  return null;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  return dayjs(iso).format('MM/DD HH:mm');
}

// ============================================================
// 基础编辑弹窗（活动速递 & 新品情报共用）
// ============================================================

interface BaseEditModalProps {
  open: boolean;
  item: ScheduleItem | null;
  date: string;
  contentType: string;
  onClose: () => void;
  onSave: (item: ScheduleItem) => void;
}

const BaseEditModal: React.FC<BaseEditModalProps> = ({ open, item, date, contentType, onClose, onSave }) => {
  const [title, setTitle] = useState(item?.title ?? '');
  const [body, setBody] = useState(item?.body ?? '');
  const [images, setImages] = useState<string[]>(item?.images ?? []);

  useEffect(() => {
    if (!open) return;
    if (item) { setTitle(item.title); setBody(item.body); setImages(item.images); }
    else { setTitle(''); setBody(''); setImages([]); }
  }, [open, item]);

  const cfg = CONTENT_TYPE_CONFIG[contentType] ?? CONTENT_TYPE_CONFIG['activity'];

  const handleSave = () => {
    const payload: ScheduleItem = {
      id: item?.id ?? genId(),
      week_year: getWeekYear(date),
      date,
      content_type: contentType,
      title, body, images,
      linked_slags: item?.linked_slags ?? [],
      is_pinned: item?.is_pinned ?? false,
      platforms: item?.platforms ?? { ch1: { status: 'pending', published_at: null, confirmed_at: null, note: '' }, ch2: { status: 'pending', published_at: null, confirmed_at: null, note: '' } },
      created_at: item?.created_at ?? nowIso(),
      updated_at: nowIso(),
    };
    onSave(payload);
    onClose();
  };

  return (
    <Modal
      title={<Space><span style={{ fontSize: 18 }}>{cfg.icon}</span><span>{cfg.label}</span><span style={{ color: '#9ca3af', fontSize: 13 }}>— {item ? '编辑' : '创建于 ' + date}</span></Space>}
      open={open} onOk={handleSave} onCancel={onClose}
      okText="保存" cancelText="取消" width={640} destroyOnClose
    >
      <Form layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="内容标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="输入标题…" maxLength={200} showCount />
        </Form.Item>
        <Form.Item label="正文内容">
          <Input.TextArea value={body} onChange={e => setBody(e.target.value)} placeholder="输入正文…" rows={5} maxLength={5000} showCount />
        </Form.Item>
        <Form.Item label="图片">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {images.map((url, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6 }} />
                <Button size="small" danger type="text"
                  style={{ position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, padding: 0 }}
                  onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}>×</Button>
              </div>
            ))}
          </div>
          <Button size="small" onClick={() => {
            const url = prompt('输入图片URL：');
            if (url && url.startsWith('http')) setImages(prev => [...prev, url]);
          }}>+ 添加图片URL</Button>
        </Form.Item>
        <Form.Item label="发布平台">
          <Space wrap>
            {CHANNELS.map(ch => <Tag key={ch.id}>{ch.icon} {ch.name}</Tag>)}
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ============================================================
// 黑话科普编辑弹窗
// ============================================================

const SlangEditModal: React.FC<BaseEditModalProps> = ({ open, item, date, onClose, onSave }) => {
  const [title, setTitle] = useState(item?.title ?? '');
  const [body, setBody] = useState(item?.body ?? '');
  const [images, setImages] = useState<string[]>(item?.images ?? []);
  const [slangCategory, setSlangCategory] = useState<string>(item?.slang_category ?? '');
  const [linkedSlags, setLinkedSlags] = useState<LinkedSlang[]>(item?.linked_slags ?? []);
  const [slangSearch, setSlangSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    if (item) { setTitle(item.title); setBody(item.body); setImages(item.images); setSlangCategory(item.slang_category ?? ''); setLinkedSlags(item.linked_slags); }
    else { setTitle(''); setBody(''); setImages([]); setSlangCategory(''); setLinkedSlags([]); }
    setSlangSearch('');
  }, [open, item]);

  const slangResults = slangCategory && slangSearch
    ? (MOCK_SLANGS[slangCategory] ?? []).filter(s => s.slang_name.includes(slangSearch) || s.meaning.includes(slangSearch))
    : [];

  const handleSave = () => {
    const payload: ScheduleItem = {
      id: item?.id ?? genId(),
      week_year: getWeekYear(date),
      date,
      content_type: 'slang_science',
      title, body, images,
      slang_category: slangCategory || undefined,
      linked_slags: linkedSlags,
      is_pinned: item?.is_pinned ?? false,
      platforms: item?.platforms ?? { ch1: { status: 'pending', published_at: null, confirmed_at: null, note: '' }, ch2: { status: 'pending', published_at: null, confirmed_at: null, note: '' } },
      created_at: item?.created_at ?? nowIso(),
      updated_at: nowIso(),
    };
    onSave(payload);
    onClose();
  };

  return (
    <Modal
      title={<Space><span style={{ fontSize: 18 }}>📖</span><span>黑话科普</span><span style={{ color: '#9ca3af', fontSize: 13 }}>— {item ? '编辑' : '创建于 ' + date}</span></Space>}
      open={open} onOk={handleSave} onCancel={onClose}
      okText="保存" cancelText="取消" width={640} destroyOnClose
    >
      <Form layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="内容标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="输入标题…" maxLength={200} showCount />
        </Form.Item>
        <Form.Item label="正文内容">
          <Input.TextArea value={body} onChange={e => setBody(e.target.value)} placeholder="输入正文…" rows={5} maxLength={5000} showCount />
        </Form.Item>
        <Form.Item label="术语分类">
          <Select placeholder="选择分类" value={slangCategory || undefined}
            onChange={v => { setSlangCategory(v); setSlangSearch(''); }}
            options={SLANG_OPTIONS} style={{ width: '100%' }} />
        </Form.Item>
        {slangCategory && (
          <Form.Item label="关联术语">
            {linkedSlags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {linkedSlags.map(s => (
                  <Tag key={s.slang_id} color="purple" closable
                    onClose={() => setLinkedSlags(prev => prev.filter(l => l.slang_id !== s.slang_id))}>
                    [{SLANG_CATEGORY_LABELS[s.slang_type] ?? s.slang_type}] {s.slang_name}
                  </Tag>
                ))}
              </div>
            )}
            <Input placeholder="搜索术语…" value={slangSearch} onChange={e => setSlangSearch(e.target.value)} />
            {slangResults.length > 0 && (
              <div style={{ marginTop: 4, maxHeight: 160, overflowY: 'auto', background: '#1a2234', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: 4 }}>
                {slangResults.map(s => (
                  <div key={s.slang_id} style={{ padding: '6px 10px', cursor: 'pointer', borderRadius: 4 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => {
                      if (!linkedSlags.find(l => l.slang_id === s.slang_id)) {
                        setLinkedSlags(prev => [...prev, { slang_id: s.slang_id, slang_type: slangCategory, slang_name: s.slang_name }]);
                      }
                      setSlangSearch('');
                    }}>
                    <div style={{ color: '#e5e7eb', fontSize: 13 }}>{s.slang_name}</div>
                    <div style={{ color: '#6b7280', fontSize: 11 }}>{s.meaning}</div>
                  </div>
                ))}
              </div>
            )}
          </Form.Item>
        )}
        <Form.Item label="图片">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {images.map((url, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6 }} />
                <Button size="small" danger type="text"
                  style={{ position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, padding: 0 }}
                  onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}>×</Button>
              </div>
            ))}
          </div>
          <Button size="small" onClick={() => {
            const url = prompt('输入图片URL：');
            if (url && url.startsWith('http')) setImages(prev => [...prev, url]);
          }}>+ 添加图片URL</Button>
        </Form.Item>
        <Form.Item label="发布平台">
          <Space wrap>
            {CHANNELS.map(ch => <Tag key={ch.id}>{ch.icon} {ch.name}</Tag>)}
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ============================================================
// 比价/互动/梗图编辑弹窗
// ============================================================

const MemeEditModal: React.FC<BaseEditModalProps> = ({ open, item, date, onClose, onSave }) => {
  const [title, setTitle] = useState(item?.title ?? '');
  const [body, setBody] = useState(item?.body ?? '');
  const [images, setImages] = useState<string[]>(item?.images ?? []);

  useEffect(() => {
    if (!open) return;
    if (item) { setTitle(item.title); setBody(item.body); setImages(item.images); }
    else { setTitle(''); setBody(''); setImages([]); }
  }, [open, item]);

  const handleSave = () => {
    const payload: ScheduleItem = {
      id: item?.id ?? genId(),
      week_year: getWeekYear(date),
      date,
      content_type: 'meme_interaction',
      title, body, images,
      linked_slags: item?.linked_slags ?? [],
      is_pinned: item?.is_pinned ?? false,
      platforms: item?.platforms ?? { ch1: { status: 'pending', published_at: null, confirmed_at: null, note: '' }, ch2: { status: 'pending', published_at: null, confirmed_at: null, note: '' } },
      created_at: item?.created_at ?? nowIso(),
      updated_at: nowIso(),
    };
    onSave(payload);
    onClose();
  };

  return (
    <Modal
      title={<Space><span style={{ fontSize: 18 }}>🎨</span><span>比价/互动/梗图</span><span style={{ color: '#9ca3af', fontSize: 13 }}>— {item ? '编辑' : '创建于 ' + date}</span></Space>}
      open={open} onOk={handleSave} onCancel={onClose}
      okText="保存" cancelText="取消" width={640} destroyOnClose
    >
      <Form layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="内容标题" rules={[{ required: true, message: '请输入标题' }]}>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="输入标题…" maxLength={200} showCount />
        </Form.Item>
        <Form.Item label="正文内容">
          <Input.TextArea value={body} onChange={e => setBody(e.target.value)} placeholder="输入正文或比价信息…" rows={5} maxLength={5000} showCount />
        </Form.Item>
        <Form.Item label="图片/素材">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {images.map((url, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6 }} />
                <Button size="small" danger type="text"
                  style={{ position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, padding: 0 }}
                  onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}>×</Button>
              </div>
            ))}
          </div>
          <Button size="small" onClick={() => {
            const url = prompt('输入图片URL：');
            if (url && url.startsWith('http')) setImages(prev => [...prev, url]);
          }}>+ 添加图片URL</Button>
        </Form.Item>
        <Form.Item label="发布平台">
          <Space wrap>
            {CHANNELS.map(ch => <Tag key={ch.id}>{ch.icon} {ch.name}</Tag>)}
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ============================================================
// 新建内容类型选择弹窗
// ============================================================

interface CreateItemModalProps {
  open: boolean;
  selectedDate: string;
  onClose: () => void;
  onCreate: (contentType: string) => void;
}

const CreateItemModal: React.FC<CreateItemModalProps> = ({ open, selectedDate, onClose, onCreate }) => {
  const [selectedType, setSelectedType] = useState('');

  const handleOk = () => {
    if (!selectedType) { message.warning('请选择内容类型'); return; }
    onCreate(selectedType);
    onClose();
    setSelectedType('');
  };

  return (
    <Modal
      title={<Space><CalendarOutlined /><span>选择内容类型</span><span style={{ color: '#9ca3af', fontSize: 13 }}>— {selectedDate}</span></Space>}
      open={open} onOk={handleOk} onCancel={onClose}
      okText="下一步" cancelText="取消" width={520}
      okButtonProps={{ disabled: !selectedType }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
        {Object.entries(CONTENT_TYPE_CONFIG).map(([key, cfg]) => (
          <Card
            key={key} hoverable
            onClick={() => setSelectedType(key)}
            style={{
              border: selectedType === key ? `2px solid ${cfg.color}` : '1px solid rgba(255,255,255,0.1)',
              background: selectedType === key ? `${cfg.color}22` : 'rgba(17,24,39,0.8)',
              borderRadius: 10, cursor: 'pointer',
            }}
            styles={{ body: { padding: '12px 16px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 20 }}>{cfg.icon}</span>
              <span style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>{cfg.label}</span>
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>推荐：{cfg.recommendedDay}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{cfg.pushTimeZh}</div>
          </Card>
        ))}
      </div>
    </Modal>
  );
};

// ============================================================
// 日历格子
// ============================================================

interface CalendarCellProps {
  dateStr: string;
  dayLabel: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  scheduleItems: ScheduleItem[];
  intelTypes: IntelEventType[];
  onSelectDate: (date: string) => void;
  onCreate: (date: string) => void;
}

const CalendarCell: React.FC<CalendarCellProps> = ({
  dateStr, dayLabel, isCurrentMonth, isToday, isSelected,
  scheduleItems, intelTypes, onSelectDate, onCreate,
}) => {
  const hasSchedule = scheduleItems.length > 0;
  const hasIntel = intelTypes.length > 0;
  const hasContent = hasSchedule || hasIntel;

  return (
    <div
      onClick={() => onSelectDate(dateStr)}
      style={{
        height: 100,
        borderRight: '1px solid rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        padding: '6px 8px',
        cursor: 'pointer',
        background: isSelected
          ? 'rgba(212, 83, 126, 0.15)'
          : isToday
          ? 'rgba(0, 240, 255, 0.05)'
          : 'transparent',
        opacity: isCurrentMonth ? 1 : 0.3,
        transition: 'background 0.15s',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      {/* 日期数字 */}
      <div style={{
        fontSize: 14,
        fontWeight: isToday ? 700 : 400,
        color: isToday ? '#00f0ff' : isSelected ? '#D4537E' : isCurrentMonth ? '#e5e7eb' : '#6b7280',
        lineHeight: 1,
        marginBottom: 2,
      }}>
        {dayLabel}
      </div>

      {/* 情报圆点行 */}
      {intelTypes.length > 0 && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          {intelTypes.map(t => (
            <Tooltip key={t} title={`情报：${INTEL_TYPE_CONFIG[t].label}`}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: INTEL_TYPE_CONFIG[t].dot,
                display: 'inline-block',
              }} />
            </Tooltip>
          ))}
        </div>
      )}

      {/* 排期标签 */}
      {scheduleItems.map(item => {
        const cfg = CONTENT_TYPE_CONFIG[item.content_type] ?? CONTENT_TYPE_CONFIG['activity'];
        const gs = globalStatus(item);
        return (
          <Tooltip key={item.id} title={`${cfg.icon} ${item.title || '(无标题)'} · ${PUBLISH_STATUS_LABELS[gs]}`}>
            <div style={{
              background: `${cfg.color}22`,
              border: `1px solid ${cfg.color}44`,
              borderLeft: `2px solid ${cfg.color}`,
              borderRadius: 4,
              padding: '1px 5px',
              fontSize: 11,
              color: '#e5e7eb',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}>
              <span style={{ fontSize: 9 }}>{cfg.icon}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.title || '(无标题)'}
              </span>
              {item.is_pinned && <span style={{ color: '#00f0ff', fontSize: 9 }}>📌</span>}
            </div>
          </Tooltip>
        );
      })}

      {/* 空内容时的 + 按钮 */}
      {!hasContent && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
          <Button type="text" size="small" icon={<PlusOutlined />}
            style={{ color: '#374151', fontSize: 12, padding: 0, height: 20 }}
            onClick={(e) => { e.stopPropagation(); onCreate(dateStr); }} />
        </div>
      )}
    </div>
  );
};

// ============================================================
// 右侧固定面板
// ============================================================

interface RightPanelProps {
  selectedDate: string;
  scheduleItems: ScheduleItem[];
  intelEvents: IntelEvent[];
  onCreate: (date: string) => void;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (id: string) => void;
  onStatusChange: (item: ScheduleItem, chId: string) => void;
  onTogglePinned: (item: ScheduleItem) => void;
}

const RightPanel: React.FC<RightPanelProps> = ({
  selectedDate, scheduleItems, intelEvents,
  onCreate, onEdit, onDelete, onStatusChange, onTogglePinned,
}) => {
  const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekday = WEEKDAY[dayjs(selectedDate).day()];
  const isToday = selectedDate === dayjs().format('YYYY-MM-DD');

  return (
    <div style={{
      width: 340,
      flexShrink: 0,
      background: 'rgba(17, 24, 39, 0.9)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      maxHeight: 'calc(100vh - 160px)',
      overflow: 'hidden',
    }}>
      {/* 面板头部 */}
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 15 }}>
              {dayjs(selectedDate).format('MM月DD日')}
            </span>
            <span style={{ color: '#9ca3af', fontSize: 13 }}>{weekday}</span>
            {isToday && <Tag color="cyan" style={{ margin: 0 }}>今天</Tag>}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            {scheduleItems.length > 0 && <span>{scheduleItems.length}条排期</span>}
            {scheduleItems.length > 0 && intelEvents.length > 0 && <span> · </span>}
            {intelEvents.length > 0 && <span>{intelEvents.length}条情报</span>}
            {scheduleItems.length === 0 && intelEvents.length === 0 && <span>暂无内容</span>}
          </div>
        </div>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => onCreate(selectedDate)}>
          新建
        </Button>
      </div>

      {/* 面板内容（可滚动） */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* 情报事件 */}
        {intelEvents.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <BellOutlined style={{ color: '#9ca3af', fontSize: 12 }} />
              <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>情报事件</span>
            </div>
            {intelEvents.map(evt => {
              const tcfg = INTEL_TYPE_CONFIG[evt.type] ?? INTEL_TYPE_CONFIG['other'];
              return (
                <div key={evt.id} style={{
                  background: `${tcfg.color}15`,
                  border: `1px solid ${tcfg.color}30`,
                  borderLeft: `3px solid ${tcfg.color}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{evt.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 500, marginBottom: 3 }}>
                        {evt.name}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                        {evt.time && <span style={{ fontSize: 11, color: '#9ca3af' }}>{evt.time}</span>}
                        {evt.venue && <span style={{ fontSize: 11, color: '#9ca3af' }}>· {evt.venue}</span>}
                        <Tag style={{ fontSize: 10, padding: '0 4px', margin: 0, background: `${tcfg.color}25`, color: tcfg.color, border: 'none' }}>
                          {tcfg.label}
                        </Tag>
                      </div>
                      {evt.price !== undefined && (
                        <div style={{ color: '#52c41a', fontSize: 12, marginTop: 3 }}>
                          {typeof evt.price === 'number' ? `¥${evt.price}` : evt.price}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 排期内容 */}
        {scheduleItems.length > 0 ? (
          <div>
            {scheduleItems.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <CalendarOutlined style={{ color: '#9ca3af', fontSize: 12 }} />
                <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>发布排期</span>
              </div>
            )}
            {scheduleItems.map(item => {
              const cfg = CONTENT_TYPE_CONFIG[item.content_type] ?? CONTENT_TYPE_CONFIG['activity'];
              const gs = globalStatus(item);
              return (
                <div key={item.id} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid rgba(255,255,255,0.06)`,
                  borderRadius: 10,
                  padding: '12px',
                  marginBottom: 10,
                }}>
                  {/* 标题行 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Space>
                      <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                      <span style={{ color: '#e5e7eb', fontWeight: 500, fontSize: 13 }}>
                        {item.title || '(无标题)'}
                      </span>
                    </Space>
                    <Tag color={STATUS_COLORS[gs]} style={{ marginRight: 0, fontSize: 11 }}>{PUBLISH_STATUS_LABELS[gs]}</Tag>
                  </div>

                  {/* 正文预览 */}
                  {item.body && (
                    <div style={{ color: '#9ca3af', fontSize: 12, lineHeight: 1.5, marginBottom: 8, maxHeight: 40, overflow: 'hidden' }}>
                      {item.body.length > 60 ? item.body.slice(0, 60) + '…' : item.body}
                    </div>
                  )}

                  {/* 术语标签 */}
                  {item.linked_slags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                      {item.linked_slags.map(s => (
                        <Tag key={s.slang_id} color="purple" style={{ fontSize: 11, margin: 0 }}>
                          {s.slang_name}
                        </Tag>
                      ))}
                    </div>
                  )}

                  {/* 平台状态 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {CHANNELS.map(ch => {
                      const ps = item.platforms[ch.id];
                      if (!ps) return null;
                      const ns = nextStatusFn(ps.status);
                      return (
                        <div key={ch.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Space>
                            <span style={{ fontSize: 12 }}>{ch.icon}</span>
                            <span style={{ color: '#9ca3af', fontSize: 12 }}>{ch.name}</span>
                            <Tag color={STATUS_COLORS[ps.status]} style={{ marginRight: 0, fontSize: 10, padding: '0 4px' }}>
                              {PUBLISH_STATUS_LABELS[ps.status]}
                            </Tag>
                          </Space>
                          {ns ? (
                            <Button size="small" type={ns === 'published' ? 'primary' : 'default'}
                              style={{ fontSize: 11, padding: '0 8px', height: 22 }}
                              onClick={() => onStatusChange(item, ch.id)}>
                              {ns === 'confirmed' ? '确认' : '发布'}
                            </Button>
                          ) : (
                            ps.published_at && (
                              <span style={{ fontSize: 11, color: '#6b7280' }}>{formatDate(ps.published_at)}</span>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 操作按钮 */}
                  <div style={{ display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                    <Button size="small" icon={<EditOutlined />} style={{ fontSize: 12 }} onClick={() => onEdit(item)}>编辑</Button>
                    <Button size="small" icon={item.is_pinned ? <PushpinFilled /> : <PushpinOutlined />}
                      style={{ fontSize: 12, color: item.is_pinned ? '#00f0ff' : undefined }}
                      onClick={() => onTogglePinned(item)}>
                      {item.is_pinned ? '取消锚定' : '锚定'}
                    </Button>
                    <Popconfirm title="确定删除？" onConfirm={() => onDelete(item.id)}>
                      <Button size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 12 }}>删除</Button>
                    </Popconfirm>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<span style={{ color: '#6b7280', fontSize: 12 }}>该日期暂无排期内容</span>}
            style={{ margin: '20px 0' }}
          />
        )}
      </div>
    </div>
  );
};

// ============================================================
// 主页面
// ============================================================

const MonthScheduleOverview: React.FC = () => {
  const [currentYear, setCurrentYear] = useState(dayjs().year());
  const [currentMonth, setCurrentMonth] = useState(dayjs().month()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));

  // 情报数据
  const [intelEvents, setIntelEvents] = useState<IntelEvent[]>([]);
  const [intelLoading, setIntelLoading] = useState(false);

  // 排期数据
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // 弹窗状态
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creatingType, setCreatingType] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ScheduleItem | null>(null);
  const [editDate, setEditDate] = useState('');

  // 加载情报数据
  const loadIntelEvents = useCallback(async () => {
    setIntelLoading(true);
    try {
      const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${lastDay}`;
      const res: any = await apiClient.get('/h5/intel/events', {
        params: { start_date: startDate, end_date: endDate, mode: 'calendar' },
      });
      const data: any = res?.data ?? res ?? {};
      const rawItems: any[] = Array.isArray(data?.items) ? data.items : [];
      setIntelEvents(rawItems.map((e: any) => ({
        id: e.id || e._id || String(Math.random()),
        date: e.date || e.start_date || '',
        time: e.time,
        type: (e.type as IntelEventType) || 'other',
        icon: e.icon || '📌',
        name: e.name || e.title || '',
        venue: e.venue,
        badge: e.badge || '',
        cover: e.cover,
        price: e.price,
      })));
    } catch {
      setIntelEvents([]);
    } finally {
      setIntelLoading(false);
    }
  }, [currentYear, currentMonth]);

  // 加载排期数据
  const loadScheduleItems = useCallback(async () => {
    setScheduleLoading(true);
    try {
      const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${lastDay}`;
      const response = await scheduleApi.listItems({ skip: 0, limit: 200 });
      const allItems: ScheduleItem[] = response?.items || [];
      // 过滤当月
      setItems(allItems.filter(i => i.date >= startDate && i.date <= endDate));
    } catch {
      setItems([]);
    } finally {
      setScheduleLoading(false);
    }
  }, [currentYear, currentMonth]);

  useEffect(() => { loadIntelEvents(); loadScheduleItems(); }, [loadIntelEvents, loadScheduleItems]);

  // 月份切换
  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentYear(y => y - 1); setCurrentMonth(11); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentYear(y => y + 1); setCurrentMonth(0); }
    else setCurrentMonth(m => m + 1);
  };
  const goToCurrentMonth = () => {
    setCurrentYear(dayjs().year());
    setCurrentMonth(dayjs().month());
    setSelectedDate(dayjs().format('YYYY-MM-DD'));
  };

  const isCurrentMonth = currentYear === dayjs().year() && currentMonth === dayjs().month();

  // 构建日历格子数据
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
    const today = dayjs().format('YYYY-MM-DD');

    // intel events 按日期分组
    const intelByDate: Record<string, IntelEventType[]> = {};
    intelEvents.forEach(e => {
      if (!intelByDate[e.date]) intelByDate[e.date] = [];
      if (!intelByDate[e.date].includes(e.type)) intelByDate[e.date].push(e.type);
    });

    // schedule items 按日期分组
    const scheduleByDate: Record<string, ScheduleItem[]> = {};
    items.forEach(i => {
      if (!scheduleByDate[i.date]) scheduleByDate[i.date] = [];
      scheduleByDate[i.date].push(i);
    });

    const days: Array<{
      label: number; dateStr: string; isCurrentMonth: boolean;
      isToday: boolean; isSelected: boolean;
      intelTypes: IntelEventType[]; scheduleItems: ScheduleItem[];
    }> = [];

    // 上月补齐
    for (let i = 0; i < firstDay; i++) {
      const d = daysInPrevMonth - firstDay + 1 + i;
      const prevMonthIdx = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYear}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ label: d, dateStr, isCurrentMonth: false, isToday: false, isSelected: false, intelTypes: [], scheduleItems: [] });
    }

    // 当月
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        label: d, dateStr,
        isCurrentMonth: true,
        isToday: dateStr === today,
        isSelected: dateStr === selectedDate,
        intelTypes: intelByDate[dateStr] ?? [],
        scheduleItems: scheduleByDate[dateStr] ?? [],
      });
    }

    // 下月补齐 6 行 = 42 格
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonthIdx = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nextYear}-${String(nextMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ label: d, dateStr, isCurrentMonth: false, isToday: false, isSelected: false, intelTypes: [], scheduleItems: [] });
    }

    return days;
  }, [currentYear, currentMonth, selectedDate, intelEvents, items]);

  // 右侧面板数据
  const selectedDayItems = useMemo(() => items.filter(i => i.date === selectedDate), [items, selectedDate]);
  const selectedDayIntel = useMemo(() => intelEvents.filter(e => e.date === selectedDate), [intelEvents, selectedDate]);

  // 选中日期时更新显示的月份
  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    const d = dayjs(date);
    if (d.year() !== currentYear || d.month() !== currentMonth) {
      setCurrentYear(d.year());
      setCurrentMonth(d.month());
    }
  };

  // 保存（新建或更新）
  const handleSave = async (saved: ScheduleItem) => {
    try {
      if (saved.id.startsWith('local_')) {
        // 本地新建 → 调用 create API
        const created = await scheduleApi.createItem({
          week_year: saved.week_year,
          date: saved.date,
          content_type: saved.content_type,
          title: saved.title,
          body: saved.body,
          images: saved.images,
          slang_category: saved.slang_category,
          linked_slags: saved.linked_slags,
          is_pinned: saved.is_pinned,
        });
        setItems(prev => {
          const idx = prev.findIndex(i => i.id === saved.id);
          if (idx >= 0) return prev.map(i => i.id === saved.id ? created : i);
          return [...prev, created];
        });
        message.success('创建成功');
      } else {
        // 已存在 → 调用 update API
        const updated = await scheduleApi.updateItem(saved.id, {
          title: saved.title,
          body: saved.body,
          images: saved.images,
          slang_category: saved.slang_category,
          linked_slags: saved.linked_slags,
          is_pinned: saved.is_pinned,
        });
        setItems(prev => prev.map(i => i.id === saved.id ? updated : i));
        message.success('更新成功');
      }
    } catch {
      // API 失败时保留本地数据
      setItems(prev => {
        const idx = prev.findIndex(i => i.id === saved.id);
        if (idx >= 0) return prev.map(i => i.id === saved.id ? saved : i);
        return [...prev, saved];
      });
      message.success('已保存（离线模式）');
    }
  };

  // 删除
  const handleDelete = async (id: string) => {
    try {
      if (!id.startsWith('local_')) {
        await scheduleApi.deleteItem(id);
      }
      setItems(prev => prev.filter(i => i.id !== id));
      message.success('已删除');
    } catch {
      setItems(prev => prev.filter(i => i.id !== id));
      message.success('已删除（离线模式）');
    }
  };

  // 状态变更
  const handleStatusChange = async (item: ScheduleItem, chId: string) => {
    const ps = item.platforms[chId];
    const ns = nextStatusFn(ps?.status ?? 'pending');
    if (!ns) return;
    try {
      if (!item.id.startsWith('local_')) {
        const updated = await scheduleApi.updateStatus(item.id, { platform_id: chId, status: ns });
        setItems(prev => prev.map(i => i.id === item.id ? updated : i));
      } else {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, platforms: { ...i.platforms, [chId]: { ...(i.platforms[chId] ?? { status: 'pending', published_at: null, confirmed_at: null, note: '' }), status: ns, published_at: ns === 'published' ? nowIso() : i.platforms[chId]?.published_at ?? null }, }, updated_at: nowIso() } : i));
      }
      const ch = CHANNELS.find(c => c.id === chId);
      message.success(`${ch?.name ?? chId} 已${PUBLISH_STATUS_LABELS[ns]}`);
    } catch {
      message.error('状态更新失败');
    }
  };

  // 锚定
  const handleTogglePinned = async (item: ScheduleItem) => {
    try {
      if (!item.id.startsWith('local_')) {
        const updated = await scheduleApi.togglePinned(item.id);
        setItems(prev => prev.map(i => i.id === item.id ? updated : i));
      } else {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_pinned: !i.is_pinned, updated_at: nowIso() } : i));
      }
      message.success(item.is_pinned ? '已取消锚定' : '已锚定');
    } catch {
      message.error('锚定操作失败');
    }
  };

  // 打开编辑弹窗
  const openEdit = (item: ScheduleItem) => {
    setSelectedDate(item.date);
    setEditItem(item);
    setEditDate(item.date);
    setEditModalOpen(true);
  };

  // 新建
  const handleCreate = (contentType: string) => {
    setCreatingType(contentType);
    setEditItem(null);
    setEditModalOpen(true);
  };

  // 渲染编辑弹窗
  const renderEditModal = () => {
    const ct = editItem?.content_type ?? creatingType;
    const commonProps = { open: editModalOpen, item: editItem, date: editDate, onClose: () => setEditModalOpen(false), onSave: handleSave };
    if (ct === 'slang_science') return <SlangEditModal {...commonProps} />;
    if (ct === 'meme_interaction') return <MemeEditModal {...commonProps} />;
    return <BaseEditModal {...commonProps} contentType={ct} />;
  };

  const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 页头 */}
      <div className="page-header" style={{ padding: '20px 24px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 className="page-title">内容日历</h3>
            <p style={{ color: '#9ca3af', fontSize: 13, margin: '4px 0 0' }}>
              情报事件（彩色圆点）+ 发布排期（彩色标签） · 点击日期查看详情
            </p>
          </div>
          <Space>
            <Button icon={<LeftOutlined />} onClick={prevMonth} />
            <span style={{ color: '#e5e7eb', fontWeight: 600, minWidth: 160, textAlign: 'center', fontSize: 15 }}>
              {currentYear}年 {MONTH_NAMES[currentMonth]}
            </span>
            <Button icon={<RightOutlined />} onClick={nextMonth} />
            <Button type={isCurrentMonth ? 'primary' : 'default'} onClick={goToCurrentMonth}>本月</Button>
          </Space>
        </div>
      </div>

      {/* 内容类型图例 */}
      <div style={{ padding: '0 24px 12px', display: 'flex', gap: 16, flexWrap: 'wrap', flexShrink: 0 }}>
        {Object.entries(CONTENT_TYPE_CONFIG).map(([key, cfg]) => (
          <Space key={key} style={{ fontSize: 12, color: '#9ca3af' }}>
            <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.icon}</span>
            <span>{cfg.label}</span>
          </Space>
        ))}
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
        {Object.entries(INTEL_TYPE_CONFIG).map(([key, cfg]) => (
          <Space key={key} style={{ fontSize: 12, color: '#9ca3af' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
            <span>{cfg.label}</span>
          </Space>
        ))}
      </div>

      {/* 日历 + 右侧面板 */}
      <div style={{ padding: '0 24px 24px', display: 'flex', gap: 16, flex: 1, alignItems: 'flex-start' }}>
        {/* 日历主体 */}
        <Spin spinning={intelLoading}>
          <div style={{
            flex: 1,
            background: 'rgba(17, 24, 39, 0.6)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            {/* 星期头 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              background: 'rgba(255,255,255,0.03)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                <div key={d} style={{
                  padding: '8px 0', textAlign: 'center',
                  fontSize: 12, color: '#6b7280', fontWeight: 500,
                  borderRight: '1px solid rgba(255,255,255,0.04)',
                }}>周{d}</div>
              ))}
            </div>

            {/* 日历格子 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {calendarDays.map((day, idx) => (
                <CalendarCell
                  key={idx}
                  dateStr={day.dateStr}
                  dayLabel={day.label}
                  isCurrentMonth={day.isCurrentMonth}
                  isToday={day.isToday}
                  isSelected={day.isSelected}
                  scheduleItems={day.scheduleItems}
                  intelTypes={day.intelTypes}
                  onSelectDate={handleSelectDate}
                  onCreate={(date) => { setSelectedDate(date); setCreateModalOpen(true); }}
                />
              ))}
            </div>
          </div>
        </Spin>

        {/* 右侧固定面板 */}
        <RightPanel
          selectedDate={selectedDate}
          scheduleItems={selectedDayItems}
          intelEvents={selectedDayIntel}
          onCreate={(date) => { setSelectedDate(date); setCreateModalOpen(true); }}
          onEdit={openEdit}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          onTogglePinned={handleTogglePinned}
        />
      </div>

      {/* 新建选择弹窗 */}
      <CreateItemModal
        open={createModalOpen}
        selectedDate={selectedDate}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreate}
      />

      {/* 编辑弹窗 */}
      {renderEditModal()}
    </div>
  );
};

export default MonthScheduleOverview;
