import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Typography, Button, Space, Tooltip } from 'antd';
import {
  ClearOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { apiClient, API_BASE_URL } from '../../api/config';

const { Text: Txt } = Typography;

export interface LogEntry {
  ts: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'skip';
  step: string;
  message: string;
  data?: Record<string, unknown>;
}

const LEVEL_COLOR: Record<string, string> = {
  info: '#1890ff',
  warn: '#faad14',
  error: '#ff4d4f',
  success: '#52c41a',
  skip: '#888',
};

const STEP_LABEL: Record<string, string> = {
  scheduler: '调度',
  batch: '批次',
  batch_start: '批次开始',
  batch_done: '批次完成',
  batch_complete: '全部完成',
  batch_error: '批次错误',
  post_processed: '处理',
  post_error: '错误',
};

interface IntelLogPanelProps {
  onCountsChange?: (counts: { new_: number; merged: number; skip: number; error: number }) => void;
}

const IntelLogPanel: React.FC<IntelLogPanelProps> = ({ onCountsChange }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const countsRef = useRef({ new_: 0, merged: 0, skip: 0, error: 0 });

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // 解析并更新计数
  const processEntry = useCallback((entry: LogEntry) => {
    if (entry.step === 'post_processed') {
      const result = entry.data?.result as string;
      if (result === 'created') countsRef.current.new_++;
      else if (result === 'merged') countsRef.current.merged++;
      else if (result === 'not_related') countsRef.current.skip++;
      else countsRef.current.error++;
      onCountsChange?.({ ...countsRef.current });
    }
    if (entry.step === 'batch_complete' || entry.step === 'batch_done') {
      // 批次完成重置单批次计数（但保留总量）
    }
    if (entry.step === 'batch_start') {
      // 批次开始不重置，累计
    }
    return entry;
  }, [onCountsChange]);

  // 建立 SSE 连接
  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource(`${API_BASE_URL}weibo-intel/logs/stream`);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      if (!e.data || e.data.startsWith(':')) return; // 跳过注释心跳
      try {
        const entry: LogEntry = JSON.parse(e.data);
        setLogs(prev => {
          const next = [...prev, processEntry(entry)];
          // 最多保留 200 条
          return next.length > 200 ? next.slice(-200) : next;
        });
      } catch {}
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      // 断线后 3 秒重连
      setTimeout(connect, 3000);
    };
  }, [processEntry]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
    };
  }, [connect]);

  // 新日志自动滚动
  useEffect(() => {
    scrollToBottom();
  }, [logs, scrollToBottom]);

  // 清空
  const handleClear = () => {
    setLogs([]);
    countsRef.current = { new_: 0, merged: 0, skip: 0, error: 0 };
    onCountsChange?.({ ...countsRef.current });
  };

  // 导出
  const handleExport = () => {
    const text = logs
      .map(l => `[${l.ts}] [${l.level.toUpperCase()}] [${l.step}] ${l.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `intel-log-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  const visibleLogs = logs.slice(-100); // 最多显示 100 条

  return (
    <Card
      size="small"
      title={
        <Space>
          <span style={{ fontSize: 13 }}>情报调度日志</span>
          <span
            style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 4,
              background: connected ? '#f6ffed' : '#fff1f0',
              color: connected ? '#52c41a' : '#ff4d4f',
              border: `1px solid ${connected ? '#b7eb8f' : '#ffa39e'}`,
            }}
          >
            {connected ? '已连接' : '断线重连中'}
          </span>
          {logs.length > 0 && (
            <Space size={8} style={{ marginLeft: 8 }}>
              <Txt type="secondary" style={{ fontSize: 11 }}>
                <span style={{ color: '#52c41a' }}>新建 {countsRef.current.new_}</span>
                {' · '}
                <span style={{ color: '#1890ff' }}>合并 {countsRef.current.merged}</span>
                {' · '}
                <span style={{ color: '#888' }}>跳过 {countsRef.current.skip}</span>
                {' · '}
                <span style={{ color: '#ff4d4f' }}>失败 {countsRef.current.error}</span>
              </Txt>
            </Space>
          )}
        </Space>
      }
      extra={
        <Space size={4}>
          <Tooltip title="清空日志">
            <Button type="text" size="small" icon={<ClearOutlined />} onClick={handleClear} style={{ color: '#9ca3af' }} />
          </Tooltip>
          <Tooltip title="导出日志">
            <Button type="text" size="small" icon={<DownloadOutlined />} onClick={handleExport} style={{ color: '#9ca3af' }} />
          </Tooltip>
        </Space>
      }
      bodyStyle={{ padding: '8px 12px' }}
      style={{ height: '100%', margin: 0 }}
    >
      <div style={{ height: 160, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
        {visibleLogs.length === 0 ? (
          <Txt type="secondary" style={{ fontSize: 12 }}>等待日志输出...</Txt>
        ) : (
          visibleLogs.map((log, idx) => (
            <div
              key={idx}
              style={{
                padding: '1px 0',
                color: LEVEL_COLOR[log.level] || '#888',
                display: 'flex',
                gap: 6,
                lineHeight: '16px',
              }}
            >
              <span style={{ color: '#666', flexShrink: 0 }}>{formatTime(log.ts)}</span>
              <span style={{ color: '#1890ff', flexShrink: 0, minWidth: 32 }}>
                [{STEP_LABEL[log.step] || log.step}]
              </span>
              <span style={{ flex: 1, wordBreak: 'break-all' }}>{log.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </Card>
  );
};

export default IntelLogPanel;
