import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Modal, Button, Space, Typography, Tag, Divider, message,
  Input, Empty, Tooltip, Switch,
} from 'antd';
import {
  BulbOutlined, CopyOutlined, CheckOutlined, DeleteOutlined,
  SyncOutlined, EditOutlined, EyeOutlined, PlusOutlined,
  HolderOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { IntelEvent, IntelEventType } from './constants';
import { INTEL_TYPE_CONFIG, CONTENT_TYPE_CONFIG } from './constants';
import { llmApi } from '../../../api/llm';

const { TextArea } = Typography;

// ============================================================
// 类型定义
// ============================================================

/** AI 生成后的卡片数据结构（按地区分组） */
export interface BroadcastCard {
  region: string;         // 地区，如 "上海"
  items: BroadcastItem[];
}

export interface BroadcastItem {
  title: string;           // 事件标题
  date: string;            // 日期
  time?: string;           // 时间（可选）
  type: string;            // 类型标签
  typeColor: string;       // 类型颜色
  venue?: string;          // 地点/场馆
  cover?: string;          // 封面图 URL（可选）
  price?: string;          // 价格（可选）
  highlight?: string;      // 亮点一句话（可选）
}

interface BroadcastGenerateModalProps {
  open: boolean;
  selectedIntel: IntelEvent[];   // 从 WeeklyBroadcastModal 传来的已选情报
  contentType: string;            // 当前选中的内容类型
  onClose: () => void;
  onSave: (cards: BroadcastCard[], contentType: string) => void;  // 保存 JSON
}

// ============================================================
// 提示词模版
// ============================================================
function buildPrompt(intelEvents: IntelEvent[], contentType: string): string {
  const typeLabel = contentType === 'activity' ? '活动速递' : '新品情报';
  const typeColor = contentType === 'activity' ? '#1890ff' : '#52c41a';

  const eventsText = intelEvents.map(e => {
    const tcfg = INTEL_TYPE_CONFIG[e.type as IntelEventType] ?? INTEL_TYPE_CONFIG['other'];
    return [
      `- ${e.date}${e.time ? ' ' + e.time : ''} | ${tcfg.label} | ${e.name}`,
      e.venue ? `  地点：${e.venue}` : '',
      e.price !== undefined ? `  价格：${e.price}` : '',
      e.badge ? `  标签：${e.badge}` : '',
      e.cover ? `  封面：${e.cover}` : '',
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  return `你是一位资深二次元内容运营专家，擅长整理活动情报并生成面向平台（抖音/小红书）的图文发布内容。

## 任务
根据以下原始情报数据，整理生成 ${typeLabel} 播报内容，按**地区**归类。

## 原始数据
${eventsText}

## 输出要求
请返回 JSON 数组，每个元素代表一张卡片（一个地区），格式如下：
\`\`\`json
[
  {
    "region": "地区名称，如：上海 / 全国",
    "items": [
      {
        "title": "事件标题",
        "date": "日期，如：04/30",
        "time": "时间，如：10:00（可选）",
        "type": "类型标签，如：漫展",
        "typeColor": "${typeColor}",
        "venue": "地点场馆（可选）",
        "cover": "封面图URL（可选，没有则不填）",
        "price": "价格（可选，没有则不填）",
        "highlight": "一句话亮点介绍（可选）"
      }
    ]
  }
]
\`\`\`

## 注意事项
1. 严格按照 JSON 格式返回，不要包含任何其他文字说明
2. 按日期排序，日期在前的排前面
3. 地区合并归类，同一地区的多个事件放在同一个 region 下
4. highlight 字段用一句话吸引用户注意力
5. 只返回有效的 JSON，不要包裹 markdown 代码块`;
}

// ============================================================
// 活动速递模版
// ============================================================
function ActivityCard({ card }: { card: BroadcastCard }) {
  return (
    <div style={{
      width: 320, minHeight: 568,
      background: 'linear-gradient(135deg, #0f1923 0%, #1a2535 100%)',
      borderRadius: 16, padding: 20, boxSizing: 'border-box',
      fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
      position: 'relative', overflow: 'hidden',
    }}>
      {/* 背景装饰 */}
      <div style={{
        position: 'absolute', top: -30, right: -30,
        width: 120, height: 120, borderRadius: '50%',
        background: 'rgba(24,144,255,0.15)',
      }} />
      <div style={{
        position: 'absolute', bottom: -20, left: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: 'rgba(24,144,255,0.08)',
      }} />

      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, position: 'relative' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #1890ff, #40a9ff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: '#fff', flexShrink: 0,
        }}>
          📣
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>
            活动速递
          </div>
          <div style={{ color: '#6b7280', fontSize: 11 }}>
            {dayjs().format('YYYY.MM.DD')} · {card.region}
          </div>
        </div>
        <div style={{
          marginLeft: 'auto', fontSize: 10, color: '#1890ff',
          background: 'rgba(24,144,255,0.15)', padding: '3px 8px', borderRadius: 20,
        }}>
          {card.items.length} 场活动
        </div>
      </div>

      <Divider style={{ margin: '0 0 14px', borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* 活动列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
        {card.items.map((item, idx) => (
          <div key={idx} style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{
                minWidth: 44, textAlign: 'center',
                background: 'rgba(24,144,255,0.12)',
                borderRadius: 8, padding: '6px 4px',
              }}>
                <div style={{ color: '#1890ff', fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>
                  {item.date.split('/')[1] || item.date}
                </div>
                <div style={{ color: '#6b7280', fontSize: 10 }}>
                  {item.date.split('/')[0] || ''}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </span>
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 10,
                    background: `${item.typeColor}22`, color: item.typeColor,
                    flexShrink: 0,
                  }}>
                    {item.type}
                  </span>
                </div>
                {item.venue && (
                  <div style={{ color: '#9ca3af', fontSize: 11, marginBottom: 2 }}>
                    📍 {item.venue}
                  </div>
                )}
                {item.highlight && (
                  <div style={{
                    fontSize: 11, color: '#e5e7eb',
                    background: 'rgba(24,144,255,0.08)',
                    borderRadius: 6, padding: '4px 8px',
                    lineHeight: 1.5,
                  }}>
                    {item.highlight}
                  </div>
                )}
                {item.price && (
                  <div style={{ color: '#f97316', fontSize: 11, marginTop: 4, fontWeight: 600 }}>
                    💰 {item.price}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 底部 */}
      <div style={{
        position: 'absolute', bottom: 16, left: 20, right: 20,
        textAlign: 'center', color: '#4b5563', fontSize: 10,
      }}>
        @二次元情报站 · 内容整理自官方渠道
      </div>
    </div>
  );
}

// ============================================================
// 新品情报模版
// ============================================================
function ProductCard({ card }: { card: BroadcastCard }) {
  return (
    <div style={{
      width: 320, minHeight: 568,
      background: 'linear-gradient(135deg, #0d1f0d 0%, #152415 100%)',
      borderRadius: 16, padding: 20, boxSizing: 'border-box',
      fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -30, right: -30,
        width: 120, height: 120, borderRadius: '50%',
        background: 'rgba(82,196,26,0.12)',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, position: 'relative' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #52c41a, #73d13d)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: '#fff', flexShrink: 0,
        }}>
          🆕
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>
            新品情报
          </div>
          <div style={{ color: '#6b7280', fontSize: 11 }}>
            {dayjs().format('YYYY.MM.DD')} · {card.region}
          </div>
        </div>
        <div style={{
          marginLeft: 'auto', fontSize: 10, color: '#52c41a',
          background: 'rgba(82,196,26,0.15)', padding: '3px 8px', borderRadius: 20,
        }}>
          {card.items.length} 件新品
        </div>
      </div>

      <Divider style={{ margin: '0 0 14px', borderColor: 'rgba(255,255,255,0.06)' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
        {card.items.map((item, idx) => (
          <div key={idx} style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12, padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{
                minWidth: 44, textAlign: 'center',
                background: 'rgba(82,196,26,0.1)',
                borderRadius: 8, padding: '6px 4px',
              }}>
                <div style={{ color: '#52c41a', fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>
                  {item.date.split('/')[1] || item.date}
                </div>
                <div style={{ color: '#6b7280', fontSize: 10 }}>
                  {item.date.split('/')[0] || ''}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {item.title}
                  </span>
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 10,
                    background: `${item.typeColor}22`, color: item.typeColor,
                    flexShrink: 0,
                  }}>
                    {item.type}
                  </span>
                </div>
                {item.venue && (
                  <div style={{ color: '#9ca3af', fontSize: 11, marginBottom: 2 }}>📍 {item.venue}</div>
                )}
                {item.highlight && (
                  <div style={{ fontSize: 11, color: '#52c41a', fontWeight: 500, marginBottom: 2 }}>
                    ✨ {item.highlight}
                  </div>
                )}
                {item.price && (
                  <div style={{ color: '#f97316', fontSize: 11, fontWeight: 600 }}>💰 {item.price}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        position: 'absolute', bottom: 16, left: 20, right: 20,
        textAlign: 'center', color: '#4b5563', fontSize: 10,
      }}>
        @二次元情报站 · 内容整理自官方渠道
      </div>
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================
const BroadcastGenerateModal: React.FC<BroadcastGenerateModalProps> = ({
  open, selectedIntel, contentType, onClose, onSave,
}) => {
  const typeCfg = CONTENT_TYPE_CONFIG[contentType] ?? CONTENT_TYPE_CONFIG['activity'];

  // ---- 左侧：情报列表 ----
  const [intelList, setIntelList] = useState<IntelEvent[]>([]);
  useEffect(() => { setIntelList(selectedIntel); }, [selectedIntel]);

  const removeIntel = (id: string) => setIntelList(prev => prev.filter(i => i.id !== id));

  // ---- 中间：提示词 & AI 流式 ----
  const [prompt, setPrompt] = useState('');
  const [streamOutput, setStreamOutput] = useState('');       // 流式输出文本
  const [jsonText, setJsonText] = useState('');               // 最终 JSON（可编辑）
  const [generating, setGenerating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const streamEndRef = useRef<HTMLDivElement>(null);

  // ---- 右侧：卡片预览 ----
  const [parsedCards, setParsedCards] = useState<BroadcastCard[]>([]);
  const [parseError, setParseError] = useState('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  // 同步预览（jsonText 变化时重新解析）
  useEffect(() => {
    if (!jsonText.trim()) { setParsedCards([]); setParseError(''); return; }
    try {
      // 去掉可能的 markdown 代码块包裹
      let text = jsonText.trim();
      if (text.startsWith('```')) {
        text = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '');
      }
      const parsed = JSON.parse(text) as BroadcastCard[];
      if (!Array.isArray(parsed)) throw new Error('需要是数组');
      setParsedCards(parsed);
      setParseError('');
    } catch (e: any) {
      setParseError(`JSON 解析失败: ${e.message}`);
      setParsedCards([]);
    }
  }, [jsonText]);

  // 流式滚动到底部
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamOutput]);

  // 初始化提示词
  useEffect(() => {
    if (open && selectedIntel.length > 0) {
      setPrompt(buildPrompt(selectedIntel, contentType));
      setStreamOutput('');
      setJsonText('');
      setParsedCards([]);
      setEditMode(false);
      setSaved(false);
    }
  }, [open, selectedIntel, contentType]);

  // ---- AI 生成 ----
  const handleGenerate = useCallback(async () => {
    if (intelList.length === 0) { message.warning('请先在左侧选择情报事件'); return; }
    if (!prompt.trim()) { message.warning('提示词不能为空'); return; }

    setGenerating(true);
    setStreamOutput('');
    setJsonText('');
    setEditMode(false);
    setParsedCards([]);

    try {
      const response = await llmApi.assistStream({ prompt, temperature: 0.3, max_tokens: 4000 });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as any).detail || `请求失败: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let fullText = '';

      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          fullText += chunk;
          setStreamOutput(fullText);
        }
      }

      // 流结束后，从输出中提取 JSON
      // 尝试在输出中找到 JSON 数组部分
      let jsonCandidate = fullText.trim();
      if (jsonCandidate.startsWith('```')) {
        jsonCandidate = jsonCandidate.replace(/^```json?\s*/i, '').replace(/\s*```$/, '');
      }
      // 也尝试找最后一个 [...] 部分
      const lastBracket = jsonCandidate.lastIndexOf('[');
      const lastClose = jsonCandidate.lastIndexOf(']');
      if (lastBracket !== -1 && lastClose > lastBracket) {
        jsonCandidate = jsonCandidate.slice(lastBracket, lastClose + 1);
      }

      setJsonText(jsonCandidate);
      setEditMode(false);
    } catch (e: any) {
      message.error(e.message || '生成失败');
    } finally {
      setGenerating(false);
    }
  }, [prompt, intelList]);

  // ---- 确认 JSON（进入编辑/确认模式）----
  const handleConfirmJson = () => {
    if (parseError) { message.error(parseError); return; }
    if (parsedCards.length === 0) { message.warning('没有可预览的卡片数据'); return; }
    setEditMode(true);
    message.success('数据已确认，可切换到右侧预览');
  };

  // ---- 复制 JSON ----
  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ---- 保存 ----
  const handleSave = () => {
    if (parseError) { message.error('JSON 数据有误，请修正后保存'); return; }
    if (parsedCards.length === 0) { message.warning('没有数据可保存'); return; }
    onSave(parsedCards, contentType);
    setSaved(true);
    message.success('已保存 JSON 数据');
  };

  const handleClose = () => {
    setIntelList([]);
    setStreamOutput('');
    setJsonText('');
    setParsedCards([]);
    setEditMode(false);
    setSaved(false);
    onClose();
  };

  const renderPreview = () => {
    if (parsedCards.length === 0) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<span style={{ color: '#6b7280', fontSize: 12 }}>
              {parseError || '点击「确认 JSON」后在右侧预览'}
            </span>}
          />
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', padding: '8px 0' }}>
        {parsedCards.map((card, idx) => (
          <div key={idx} className="broadcast-card">
            {contentType === 'product' || contentType === 'new_product'
              ? <ProductCard card={card} />
              : <ActivityCard card={card} />
            }
          </div>
        ))}
      </div>
    );
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🎨</span>
          <span style={{ fontWeight: 600 }}>广播生成器</span>
          <Tag style={{ margin: 0, background: `${typeCfg.color}22`, color: typeCfg.color, border: 'none', fontSize: 11 }}>
            {typeCfg.label}
          </Tag>
          <Tag style={{ margin: 0, background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: 'none', fontSize: 11 }}>
            {intelList.length} 条情报
          </Tag>
        </div>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={1100}
      destroyOnClose
      bodyStyle={{ padding: 0, height: 620, display: 'flex' }}
    >
      {/* ================================================ */}
      {/* 左侧：情报数据                         */}
      {/* ================================================ */}
      <div style={{
        width: 240, flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        background: 'rgba(255,255,255,0.01)',
      }}>
        <div style={{
          padding: '10px 12px 8px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
            情报数据（{intelList.length}）
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {intelList.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span style={{ color: '#6b7280', fontSize: 11 }}>无情报数据</span>}
              style={{ padding: '24px 0' }}
            />
          ) : (
            intelList.map(evt => {
              const tcfg = INTEL_TYPE_CONFIG[evt.type as IntelEventType] ?? INTEL_TYPE_CONFIG['other'];
              return (
                <div key={evt.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 6,
                  padding: '7px 8px', marginBottom: 4,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>{evt.icon || '📌'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: '#e5e7eb', fontSize: 11, fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {evt.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <span style={{ color: '#6b7280', fontSize: 10 }}>{evt.date}</span>
                      <span style={{ fontSize: 10, color: tcfg.color, background: `${tcfg.color}18`, padding: '0 4px', borderRadius: 4 }}>
                        {tcfg.label}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeIntel(evt.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#6b7280', fontSize: 12, padding: '0 2px', flexShrink: 0,
                      lineHeight: 1,
                    }}
                    title="移除"
                  >
                    ×
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ================================================ */}
      {/* 中间：提示词 + AI 输出 + JSON 编辑      */}
      {/* ================================================ */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* 提示词编辑区 */}
        <div style={{
          padding: '10px 12px 8px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#6b7280' }}>AI 提示词</span>
            <Button
              size="small"
              type="text"
              icon={<SyncOutlined />}
              onClick={() => setPrompt(buildPrompt(intelList, contentType))}
              style={{ fontSize: 11, color: '#6b7280', padding: '0 4px', height: 'auto' }}
            >
              重置
            </Button>
          </div>
          <TextArea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={6}
            style={{ fontSize: 11, fontFamily: 'monospace', resize: 'none', background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: '#e5e7eb' }}
            placeholder="提示词内容…"
          />
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              icon={<BulbOutlined />}
              onClick={handleGenerate}
              loading={generating}
              size="small"
              style={{ fontSize: 12, background: typeCfg.color, borderColor: typeCfg.color }}
            >
              {generating ? '生成中…' : '生成文案'}
            </Button>
          </div>
        </div>

        {/* AI 流式输出 */}
        {(streamOutput || generating) && (
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
            maxHeight: 160, overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#6b7280' }}>AI 输出</span>
              {generating && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <HolderOutlined style={{ color: '#1890ff', fontSize: 10 }} />
                  <span style={{ fontSize: 10, color: '#1890ff' }}>生成中…</span>
                </div>
              )}
            </div>
            <pre style={{
              margin: 0, fontSize: 11, color: '#a3e6a3',
              fontFamily: 'monospace', whiteSpace: 'pre-wrap',
              wordBreak: 'break-all', lineHeight: 1.6,
            }}>
              {streamOutput}
              {generating && <span style={{ display: 'inline-block', width: 6, height: 12, background: '#1890ff', marginLeft: 2, verticalAlign: 'middle', animation: 'blink 1s step-end infinite' }} />}
            </pre>
            <div ref={streamEndRef} />
          </div>
        )}

        {/* JSON 编辑区 */}
        {jsonText && (
          <div style={{
            flex: 1, padding: '8px 12px',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>JSON 数据</span>
                {parseError ? (
                  <Tag color="error" style={{ margin: 0, fontSize: 10 }}>{parseError}</Tag>
                ) : (
                  <Tag color="success" style={{ margin: 0, fontSize: 10 }}>
                    {parsedCards.length} 张卡片
                  </Tag>
                )}
              </div>
              <Space size={4}>
                <Tooltip title="复制 JSON">
                  <Button size="small" type="text" icon={copied ? <CheckOutlined /> : <CopyOutlined />} onClick={handleCopy} style={{ fontSize: 11, color: copied ? '#52c41a' : '#6b7280', padding: '0 4px', height: 'auto' }} />
                </Tooltip>
                {!editMode && !parseError && parsedCards.length > 0 && (
                  <Button size="small" type="text" icon={<EditOutlined />} onClick={handleConfirmJson} style={{ fontSize: 11, color: '#1890ff', padding: '0 4px', height: 'auto' }}>
                    确认 JSON
                  </Button>
                )}
                {editMode && (
                  <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => setEditMode(false)} style={{ fontSize: 11, color: '#6b7280', padding: '0 4px', height: 'auto' }}>
                    预览模式
                  </Button>
                )}
              </Space>
            </div>
            {editMode ? (
              <TextArea
                value={jsonText}
                onChange={e => setJsonText(e.target.value)}
                style={{
                  flex: 1, fontSize: 11, fontFamily: 'monospace',
                  resize: 'none', background: 'rgba(255,255,255,0.04)',
                  borderColor: parseError ? '#ff4d4f' : 'rgba(255,255,255,0.08)',
                  color: '#e5e7eb',
                }}
              />
            ) : (
              <pre style={{
                flex: 1, margin: 0, overflowY: 'auto',
                fontSize: 11, fontFamily: 'monospace',
                color: parseError ? '#ff7875' : '#a3e6a3',
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 6, padding: '8px 10px',
                border: `1px solid ${parseError ? '#ff4d4f40' : 'rgba(255,255,255,0.06)'}`,
              }}>
                {jsonText}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* ================================================ */}
      {/* 右侧：模版预览                        */}
      {/* ================================================ */}
      <div style={{
        width: 360, flexShrink: 0,
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 12px 8px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: '#6b7280' }}>
            模版预览 — {typeCfg.label}
          </span>
          {!saved && parsedCards.length > 0 && (
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleSave}
              style={{ fontSize: 11, height: 22, background: typeCfg.color, borderColor: typeCfg.color }}
            >
              保存
            </Button>
          )}
          {saved && (
            <Tag color="success" style={{ margin: 0, fontSize: 10 }}>
              ✓ 已保存
            </Tag>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          {renderPreview()}
        </div>
      </div>
    </Modal>
  );
};

export default BroadcastGenerateModal;
