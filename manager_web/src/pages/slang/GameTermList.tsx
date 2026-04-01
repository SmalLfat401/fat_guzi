import { useState, useEffect } from 'react';
import { message, Modal, Radio, Space, Row, Col, Tag, Select, Input, Tabs, Alert, Badge } from 'antd';
import { ExclamationCircleOutlined, PlusOutlined, EditOutlined, DeleteOutlined, BulbOutlined, ImportOutlined, ExportOutlined, SearchOutlined, CopyOutlined, RobotOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Table, Button, Switch, Tooltip, Form } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import '../../styles/global.scss';
import { gameTermApi } from '../../api/gameTerm';
import { llmApi } from '../../api/llm';
import type { GameTerm, GameTermCreate, GameTermUpdate } from '../../types/game';

dayjs.locale('zh-cn');

type SlangTerm = GameTerm;

const categoryOptions = [
  { label: '全部分类', value: '' },
  { label: '抽卡术语', value: '抽卡术语' },
  { label: '交易术语', value: '交易术语' },
  { label: '玩法术语', value: '玩法术语' },
  { label: '角色术语', value: '角色术语' },
  { label: '社交术语', value: '社交术语' },
];

// 口播文案提示词
const DEFAULT_ASSIST_PROMPT = `你是一名二次元文化科普创作者，需要为"泛二次元用户"制作【圈内术语科普】内容，用于短视频解说。

内容覆盖领域包括：谷子、coser、游戏、漫展等。

请根据我提供的基础数据，生成一篇【高吸引力、强开头、适合短视频传播】的口播文案。

---

【核心目标】

这是一条"可能成为爆款"的视频文案：

- 开头必须抓人（决定完播率）
- 内容让新人"听得懂 + 记得住"
- 让用户产生"原来如此 / 原来我用错了"的感觉

---

【基础要求】

1、目标人群：泛二次元用户 + 新入圈用户
2、风格：轻松、有趣、有代入感
3、🎯目标时长：30s-45s（通过紧凑节奏实现，不靠删减内容）
4、表达方式：像真人在讲，不要像写文章
5、避免生硬解释，要有场景感

---

# 🔥【开头策略（爆款核心 - 必须严格执行）】

从以下5种"钩子类型"中，选择**最适合该术语的一种**来设计开头：

1、踩坑型（亏钱 / 被坑 / 后悔）【优先使用】
2、冲突型（很多人搞错 / 用错）
3、反认知型（你以为其实不是）
4、痛点型（新人一定会遇到）
5、场景型（真实对话 / 漫展瞬间）

❗不要固定使用同一种类型
❗根据术语特性判断哪种最有冲击力
❗禁止使用日常闲聊开头（如：姐妹、朋友等）

---

【开头内容要求】

- 第一句建议出现术语 {{term}}（也可以前1-2句话自然引出）
- 前2句话必须包含至少一个：
  - 冲突（很多人搞错了）
  - 情绪（懵了 / 离谱 / 太坑了）
  - 疑问（你知道为什么吗）
  - 损失（亏钱 / 被坑）

---

【开头自检机制】

生成开头后必须自检：

- 是否有"情绪 / 冲突 / 疑问"？
- 是否让人产生"想继续看"的感觉？

如果不满足，必须自动重写开头

---

# ⚡【信息密度要求（爆款节奏）】

- 前5秒内必须讲清：
  1）术语 {{term}} 是什么
  2）为什么值得听（容易踩坑 / 高频出现 / 很多人误解）

- 禁止铺垫超过2句话才进入主题
- 每3-5秒一个信息点，保持节奏紧凑

---

# 🎭【情绪与节奏要求（精炼版）】

- 至少包含2-3处情绪表达（如：懵了 / 太真实了 / 离谱）
- 多使用短句（每句不超过15字）
- 增加停顿词（例如：等等 / 重点来了 / 说白了）
- 整体要有"人说话的节奏感"
- ❗用更精炼的表达填充时长，而不是用废话填充

---

# 🚫【表达限制】

- 禁止"教科书式定义开头"（如：XXX是指……）
- 优先用"人话解释"，像讲给朋友听
- 每个解释尽量搭配一个真实场景或例子
- 禁止重复解释同一个意思
- 禁止连续举2个以上例子（最多1个核心例子）

---

# 🧠【内容结构（必须严格遵守 - 7步完整）】

1、开场（强钩子 + 引出术语）
2、快速解释（用最简单方式讲清）
3、为什么会出现（用一句话简要说明）
4、常见使用场景（重点 + 举例）
5、新人容易踩的坑（重点强化）
6、如何避免问题（给出实用建议）
7、一句话总结（必须有"记忆点"）

---

# 📌【记忆点要求】

在结尾必须给出一句：

- 简单
- 口语化
- 能被复述

示例风格：

- "说白了就是……"
- "一句话记住……"

---

# 📤【输出要求】

- 使用自然段
- 语言流畅、有节奏感
- 可直接用于口播
- 不要出现"根据数据""JSON"等提示词
- ❗通过精炼表达自然控制时长，不要刻意删减内容步骤

---

# 📦【基础数据】`;




// 镜头脚本提示词
const DEFAULT_SCRIPT_PROMPT = `你是一名二次元文化科普创作者 + 短视频导演，需要为"泛二次元用户"制作【圈内术语科普】视频内容。

内容覆盖领域包括：谷子、coser、游戏、漫展等。

请根据我提供的【已生成的口播文案】，生成一份 **完整短视频脚本**，包含：
👉 分镜设计
👉 镜头机位
👉 人物动作
👉 画面内容
👉 口播文案（直接引用口播文案内容，不要重新生成）

视频时长控制在 **30s-45s（最多不超过50s）**

---

【核心目标】

这是一条"可能成为爆款"的视频：
- 开头必须抓人（决定完播率）
- 节奏清晰（每3-5秒有信息点）
- 画面有变化（避免单调）
- 让用户"听得懂 + 记得住 + 有代入感"

---

【基础要求】

1、目标人群：泛二次元用户 + 新人
2、风格：轻松、有趣、有代入感
3、表达方式：像真人在讲，而不是念稿
4、内容必须清晰易懂，避免生硬解释

---

🔥【开头强钩子规则】

必须从以下5种类型中【随机选择一种】开头：

1、踩坑型（亏钱 / 被坑 / 后悔）
2、反认知型（你以为其实不是）
3、痛点型（新人必踩）
4、冲突型（贵 / 翻车 / 极端情况）
5、场景型（真实对话 / 经历）

❗前3秒必须让人想继续看
❗禁止平淡开头

---

【输出结构（必须严格按照这个格式）】

---

# 视频标题（可选但建议生成）

一句吸引点击的话

---

# 视频总时长

30s-45s（最多不超过50s）

---

# 分镜脚本

（按时间顺序输出，每个分镜3-6秒）

---

## 分镜1（0-3s）【强钩子】

- 镜头：特写 / 推进 / 快切
- 画面：描述画面内容
- 动作：角色在做什么
- 口播：开头钩子（必须吸引人）
- 字幕：简短强化信息

---

## 分镜2（3-10s）

- 镜头：
- 画面：
- 动作：
- 口播：
- 字幕：

---

## 分镜3（10-18s）

（开始自然过渡到术语）

---

## 分镜4（18-26s）

（词语解释）

---

## 分镜5（26-34s）

（为什么会出现）

---

## 分镜6（34-42s）

（使用场景）

---

## 分镜7（42-50s）

（踩坑点 + 建议）

---

## 分镜8（42-50s）【结尾引导】

- 镜头：
- 画面：
- 动作：
- 口播：关注引导（必须自然）
- 字幕：

---

【内容逻辑必须包含】

1、开场引入（强钩子）
2、词语解释
3、为什么会出现
4、使用场景
5、新人踩坑
6、解决建议
7、总结

---

【输出要求】

- 语言口语化
- 有节奏感
- 每句不宜过长（方便配音）
- 画面描述要清晰，方便AI或剪辑执行
- 不要出现"根据数据""JSON"等提示词

---

【已生成的口播文案】：

`;

const GameTermList: React.FC = () => {
  const [terms, setTerms] = useState<SlangTerm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [statsTotal, setStatsTotal] = useState(0);
  const [statsActive, setStatsActive] = useState(0);
  const [statsInactive, setStatsInactive] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTerm, setEditingTerm] = useState<SlangTerm | null>(null);
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [pageInfo, setPageInfo] = useState({ page: 1, pageSize: 20 });
  const [form] = Form.useForm();

  // AI 助写相关状态
  const [assistModalVisible, setAssistModalVisible] = useState(false);
  const [assistTerm, setAssistTerm] = useState<SlangTerm | null>(null);
  const [contextData, setContextData] = useState('');
  const [assistLoading, setAssistLoading] = useState(false);
  // AI 口播文案内容（流式回填）
  const [aiContent, setAiContent] = useState('');
  // AI 镜头脚本内容（流式回填）
  const [scriptContent, setScriptContent] = useState('');
  // 原始流内容（用于调试）
  const [rawContent, setRawContent] = useState('');
  const [scriptRawContent, setScriptRawContent] = useState('');
  // 镜头脚本加载状态
  const [scriptLoading, setScriptLoading] = useState(false);

  // 打开 AI 助写弹窗
  const handleAIGenerate = (term: SlangTerm) => {
    setAssistTerm(term);
    const contextJson = JSON.stringify({
      术语: term.term,
      含义: term.meaning,
      使用场景: term.usage_scenario,
      分类: term.category || '',
      示例: term.example || '',
    }, null, 2);
    setContextData(contextJson);
    // 回显已保存的 AI 内容（如果有）
    setAiContent(term.ai_copywriting || '');
    setRawContent('');
    setScriptContent(term.ai_script || '');
    setScriptRawContent('');
    setAssistModalVisible(true);
  };

  // 保存 AI 内容到数据库
  const handleSaveContent = async (field: 'ai_copywriting' | 'ai_script', content: string) => {
    if (!assistTerm || !content.trim()) return;
    try {
      await gameTermApi.updateAiContent(assistTerm.id, { [field]: content });
      message.success('已自动保存到数据库');
      // 回填到列表中对应 term 的数据，减少不必要的列表请求
      setTerms(prevTerms =>
        prevTerms.map(term =>
          term.id === assistTerm.id ? { ...term, [field]: content } : term
        )
      );
    } catch (err) {
      message.error('保存失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  // 助写（流式接口）
  const handleAssistWrite = async () => {
    if (!DEFAULT_ASSIST_PROMPT.trim()) { message.warning('提示词模板不能为空'); return; }
    setAssistLoading(true);
    setAiContent('');
    setRawContent('');
    try {
      const fullPrompt = DEFAULT_ASSIST_PROMPT + '\n\n' + contextData;
      const response = await llmApi.assistStream({ prompt: fullPrompt });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as any).detail || `请求失败: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulated = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          for (const line of chunk.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.error) throw new Error(data.error);
              if (data.token) {
                accumulated += data.token;
                setRawContent(accumulated);
                setAiContent(accumulated);
              }
              if (data.done) done = true;
            } catch { /* ignore parse errors */ }
          }
        }
      }
      // 生成完成后自动保存到数据库
      await handleSaveContent('ai_copywriting', accumulated);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '助写失败');
    } finally {
      setAssistLoading(false);
    }
  };

  // 镜头脚本生成（流式接口）
  const handleScriptWrite = async () => {
    if (!DEFAULT_SCRIPT_PROMPT.trim()) { message.warning('镜头脚本提示词模板未设置'); return; }
    if (!aiContent.trim()) { message.warning('请先生成口播文案，再生成镜头脚本'); return; }
    setScriptLoading(true);
    setScriptContent('');
    setScriptRawContent('');
    try {
      // 使用已生成的口播文案来生成镜头脚本
      const fullPrompt = DEFAULT_SCRIPT_PROMPT + aiContent;
      const response = await llmApi.assistStream({ prompt: fullPrompt });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as any).detail || `请求失败: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulated = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          for (const line of chunk.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.error) throw new Error(data.error);
              if (data.token) {
                accumulated += data.token;
                setScriptRawContent(accumulated);
                setScriptContent(accumulated);
              }
              if (data.done) done = true;
            } catch { /* ignore parse errors */ }
          }
        }
      }
      // 生成完成后自动保存到数据库
      await handleSaveContent('ai_script', accumulated);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '脚本生成失败');
    } finally {
      setScriptLoading(false);
    }
  };

  // 重新生成口播文案
  const handleRegenerate = () => {
    setAiContent('');
    setRawContent('');
    handleAssistWrite();
  };

  // 重新生成镜头脚本
  const handleRegenerateScript = () => {
    setScriptContent('');
    setScriptRawContent('');
    handleScriptWrite();
  };

  // 将 AI 结果应用回主表单
  const handleApplyToForm = (content?: string) => {
    if (!assistTerm) return;
    form.setFieldsValue({
      meaning: content || aiContent,
    });
    setModalVisible(true);
    setAssistModalVisible(false);
    message.success('已应用至表单，请检查后确认保存');
  };

  // 加载数据
  const fetchTerms = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await gameTermApi.getTerms({
        skip: (pageInfo.page - 1) * pageInfo.pageSize,
        limit: pageInfo.pageSize,
        is_active: isActiveFilter,
        category: categoryFilter || undefined,
        search: searchText || undefined,
      });
      setTerms(data.items);
      setTotal(data.total);

      // 获取统计数据
      const stats = await gameTermApi.getTermStats(categoryFilter || undefined);
      setStatsTotal(stats.total);
      setStatsActive(stats.active);
      setStatsInactive(stats.inactive);
    } catch (error) {
      setError(error instanceof Error ? error.message : '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTerms();
  }, [isActiveFilter, categoryFilter, searchText, pageInfo]);

  const handleCreate = () => {
    setEditingTerm(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (term: SlangTerm) => {
    setEditingTerm(term);
    form.setFieldsValue({
      term: term.term,
      meaning: term.meaning,
      usage_scenario: term.usage_scenario,
      category: term.category,
      example: term.example,
      is_active: term.is_active,
      video_generated: term.video_generated ?? false,
      video_published: term.video_published ?? false,
    });
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除术语"${terms.find(t => t.id === id)?.term}"吗？此操作不可恢复。`,
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await gameTermApi.deleteTerm(id);
          setTerms(prev => prev.filter(t => t.id !== id));
          setStatsTotal(prev => prev - 1);
          const termToDelete = terms.find(t => t.id === id);
          if (termToDelete?.is_active) {
            setStatsActive(prev => prev - 1);
          } else {
            setStatsInactive(prev => prev - 1);
          }
          message.success('删除成功');
        } catch (err) {
          message.error(err instanceof Error ? err.message : '删除失败');
        }
      },
    });
  };

  const handleStatusChange = async (id: string, checked: boolean) => {
    try {
      await gameTermApi.updateTerm(id, { is_active: checked });
      setTerms(prev => prev.map(t =>
        t.id === id ? { ...t, is_active: checked } : t
      ));
      setStatsActive(prev => checked ? prev + 1 : prev - 1);
      setStatsInactive(prev => checked ? prev - 1 : prev + 1);
      message.success(checked ? '已启用' : '已禁用');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '状态更新失败');
    }
  };

  const handleVideoGeneratedChange = async (id: string) => {
    try {
      const updated = await gameTermApi.toggleVideoGenerated(id);
      setTerms(prev => prev.map(t =>
        t.id === id ? { ...t, video_generated: updated.video_generated } : t
      ));
      message.success(updated.video_generated ? '已标记为已生成' : '已取消生成标记');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '状态更新失败');
    }
  };

  const handleVideoPublishedChange = async (id: string) => {
    try {
      const updated = await gameTermApi.toggleVideoPublished(id);
      setTerms(prev => prev.map(t =>
        t.id === id ? { ...t, video_published: updated.video_published } : t
      ));
      message.success(updated.video_published ? '已标记为已发布' : '已取消发布标记');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '状态更新失败');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      if (editingTerm) {
        const updateData: GameTermUpdate = {
          term: values.term,
          meaning: values.meaning,
          usage_scenario: values.usage_scenario,
          category: values.category,
          example: values.example,
          is_active: values.is_active,
        };
        const updated = await gameTermApi.updateTerm(editingTerm.id, updateData);
        setTerms(prev => prev.map(t =>
          t.id === editingTerm.id ? updated : t
        ));
        // 如果启用状态变化了，更新统计
        if (editingTerm.is_active !== updated.is_active) {
          if (updated.is_active) {
            setStatsActive(prev => prev + 1);
            setStatsInactive(prev => prev - 1);
          } else {
            setStatsActive(prev => prev - 1);
            setStatsInactive(prev => prev + 1);
          }
        }
        message.success('更新成功');
      } else {
        const createData: GameTermCreate = {
          term: values.term,
          meaning: values.meaning,
          usage_scenario: values.usage_scenario,
          category: values.category,
          example: values.example,
        };
        const created = await gameTermApi.createTerm(createData);
        setTerms(prev => [created, ...prev]);
        setStatsTotal(prev => prev + 1);
        if (created.is_active) {
          setStatsActive(prev => prev + 1);
        } else {
          setStatsInactive(prev => prev + 1);
        }
        message.success('创建成功');
      }
      setModalVisible(false);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleFilterChange = (e: any) => {
    const value = e.target.value;
    if (value === 'all') setIsActiveFilter(undefined);
    else if (value === 'active') setIsActiveFilter(true);
    else setIsActiveFilter(false);
  };

  const handleImport = () => {
    Modal.info({
      title: '批量导入',
      content: '批量导入功能开发中，敬请期待...',
      onOk() {},
    });
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(terms, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `游戏圈黑话术语_${dayjs().format('YYYY-MM-DD')}.json`;
    link.click();
    URL.revokeObjectURL(url);
    message.success('导出成功');
  };

  const columns: ColumnsType<SlangTerm> = [
    {
      title: '术语',
      dataIndex: 'term',
      key: 'term',
      width: 120,
      fixed: 'left',
      render: (term: string) => (
        <span style={{ fontWeight: 600, color: '#00f0ff' }}>{term}</span>
      ),
    },
    {
      title: '文案',
      key: 'ai_copywriting',
      width: 70,
      align: 'center',
      render: (_: unknown, record: SlangTerm) => (
        <Tooltip title={record.ai_copywriting ? '已生成口播文案' : '未生成口播文案'}>
          <span style={{ fontSize: 16 }}>
            {record.ai_copywriting
              ? <Badge status="success" />
              : <Badge status="default" />}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '脚本',
      key: 'ai_script',
      width: 70,
      align: 'center',
      render: (_: unknown, record: SlangTerm) => (
        <Tooltip title={record.ai_script ? '已生成镜头脚本' : '未生成镜头脚本'}>
          <span style={{ fontSize: 16 }}>
            {record.ai_script
              ? <Badge status="success" />
              : <Badge status="default" />}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean, record: SlangTerm) => (
        <Switch
          checked={isActive}
          onChange={(checked) => handleStatusChange(record.id, checked)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          size="small"
        />
      ),
    },
    {
      title: '生成',
      key: 'video_generated',
      width: 70,
      align: 'center' as const,
      render: (_: unknown, record: SlangTerm) => (
        <Switch
          checked={record.video_generated || false}
          onChange={() => handleVideoGeneratedChange(record.id)}
          size="small"
        />
      ),
    },
    {
      title: '发布',
      key: 'video_published',
      width: 70,
      align: 'center' as const,
      render: (_: unknown, record: SlangTerm) => (
        <Switch
          checked={record.video_published || false}
          onChange={() => handleVideoPublishedChange(record.id)}
          size="small"
        />
      ),
    },
    {
      title: '含义',
      dataIndex: 'meaning',
      key: 'meaning',
      width: 180,
      render: (meaning: string) => (
        <Tooltip title={meaning}>
          <span>{meaning}</span>
        </Tooltip>
      ),
    },
    {
      title: '使用场景',
      dataIndex: 'usage_scenario',
      key: 'usage_scenario',
      width: 180,
      render: (scenario: string) => (
        <Tooltip title={scenario}>
          <span style={{ color: '#9ca3af' }}>{scenario}</span>
        </Tooltip>
      ),
    },
    {
      title: '示例',
      dataIndex: 'example',
      key: 'example',
      width: 200,
      ellipsis: true,
      render: (example: string) => (
        <Tooltip title={example}>
          <span style={{ fontStyle: 'italic', color: '#10b981' }}>{example || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category: string) => (
        <Tag color="orange">{category || '-'}</Tag>
      ),
    },
    {
      title: '添加时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_: unknown, record: SlangTerm) => (
        <Space size="small">
          <Tooltip title="AI 助写">
            <Button
              type="link"
              size="small"
              icon={<RobotOutlined />}
              onClick={() => handleAIGenerate(record)}
              style={{ color: '#722ed1' }}
            />
          </Tooltip>
          <Tooltip title="复制术语数据">
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => {
                const dataToCopy = {
                  term: record.term,
                  meaning: record.meaning,
                  usage_scenario: record.usage_scenario,
                  category: record.category,
                  example: record.example,
                };
                navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
                message.success('已复制术语数据');
              }}
            />
          </Tooltip>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
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
    <div className="fade-in">
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ padding: '20px 24px 0' }}>
        <Col xs={24} sm={8}>
          <div className="stats-card">
            <div className="stats-title">术语总数</div>
            <div className="stats-value">{statsTotal}</div>
            <BulbOutlined className="stats-icon" />
          </div>
        </Col>
        <Col xs={24} sm={8}>
          <div className="stats-card stats-success">
            <div className="stats-title">启用</div>
            <div className="stats-value">{statsActive}</div>
            <BulbOutlined className="stats-icon" />
          </div>
        </Col>
        <Col xs={24} sm={8}>
          <div className="stats-card stats-warning">
            <div className="stats-title">禁用</div>
            <div className="stats-value">{statsInactive}</div>
            <BulbOutlined className="stats-icon" />
          </div>
        </Col>
      </Row>

      <div className="page-header" style={{ padding: '20px 24px 16px' }}>
        <h3 className="page-title">游戏圈/二游黑话术语库</h3>
        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} closable onClose={() => setError(null)} />}
        <Space wrap>
          <Input
            placeholder="搜索术语或含义..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="选择分类"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categoryOptions}
            style={{ width: 140 }}
            allowClear
          />
          <Radio.Group onChange={handleFilterChange} defaultValue="all" size="small">
            <Radio.Button value="all">全部</Radio.Button>
            <Radio.Button value="active">已启用</Radio.Button>
            <Radio.Button value="inactive">已禁用</Radio.Button>
          </Radio.Group>
          <Button icon={<ImportOutlined />} onClick={handleImport}>
            批量导入
          </Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            导出数据
          </Button>
          <Button type="primary" className="btn-primary" icon={<PlusOutlined />} onClick={handleCreate}>
            添加术语
          </Button>
        </Space>
      </div>

      <div style={{ padding: '0 24px 24px' }} className="data-table">
        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} closable onClose={() => setError(null)} />}
        <Table
          columns={columns}
          dataSource={terms}
          rowKey="id"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{
            total,
            current: pageInfo.page,
            pageSize: pageInfo.pageSize,
            showTotal: (total) => `共 ${total} 条记录`,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            size: 'small',
            onChange: (page, pageSize) => setPageInfo({ page, pageSize })
          }}
          size="small"
        />
      </div>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingTerm ? '编辑术语' : '添加术语'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
        width={700}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            is_active: true,
          }}
        >
          <Form.Item
            name="term"
            label="术语名称"
            rules={[{ required: true, message: '请输入术语名称' }]}
          >
            <Input placeholder="如：保底、井、初始号等" />
          </Form.Item>

          <Form.Item
            name="meaning"
            label="含义解释"
            rules={[{ required: true, message: '请输入含义解释' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="详细解释该术语的含义和来源"
            />
          </Form.Item>

          <Form.Item
            name="usage_scenario"
            label="使用场景"
            rules={[{ required: true, message: '请输入使用场景' }]}
          >
            <Input.TextArea
              rows={2}
              placeholder="说明在什么情况下使用这个术语"
            />
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
          >
            <Select
              placeholder="选择分类"
              options={categoryOptions.filter(o => o.value !== '')}
            />
          </Form.Item>

          <Form.Item
            name="example"
            label="使用示例"
          >
            <Input.TextArea
              rows={2}
              placeholder="给出一个实际使用该术语的例子"
            />
          </Form.Item>

          {editingTerm && (
            <Form.Item
              name="is_active"
              label="状态"
              valuePropName="checked"
            >
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          )}

          {editingTerm && (
            <>
              <Form.Item
                name="video_generated"
                label="视频生成"
                valuePropName="checked"
              >
                <Switch checkedChildren="已生成" unCheckedChildren="未生成" />
              </Form.Item>
              <Form.Item
                name="video_published"
                label="视频发布"
                valuePropName="checked"
              >
                <Switch checkedChildren="已发布" unCheckedChildren="未发布" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* AI 助写弹窗 */}
      <Modal
        title={
          <Space>
            <RobotOutlined style={{ color: '#722ed1' }} />
            <span>AI 助写 - {assistTerm?.term}</span>
          </Space>
        }
        open={assistModalVisible}
        onCancel={() => setAssistModalVisible(false)}
        footer={null}
        width={900}
        destroyOnClose
      >
        {/* 术语上下文一行展示 */}
        <div style={{
          border: '1px solid #e8e8e8',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Tag color="orange" style={{ margin: 0 }}>{assistTerm?.term}</Tag>
            <Tag color="purple">{assistTerm?.category || '未分类'}</Tag>
            <span style={{ color: '#888', fontSize: 12 }}>{assistTerm?.meaning || '暂无含义'}</span>
          </div>
          {assistTerm?.usage_scenario && (
            <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
              <span style={{ color: '#aaa', marginRight: 4 }}>场景：</span>{assistTerm.usage_scenario}
            </div>
          )}
        </div>

        {/* Tabs：口播文案 + 镜头脚本 */}
        <Tabs
          defaultActiveKey="copywriting"
          size="small"
          items={[
            {
              key: 'copywriting',
              label: (
                <span>
                  <RobotOutlined /> 口播文案
                </span>
              ),
              children: (
                <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #91d5ff', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontWeight: 500, color: '#0050b3' }}>生成内容</span>
                    {assistLoading && <span style={{ color: '#888', fontSize: 12 }}>正在生成...</span>}
                  </div>
                  <Input.TextArea
                    value={aiContent}
                    onChange={(e) => setAiContent(e.target.value)}
                    rows={18}
                    placeholder="点击「开始助写」，AI 将根据术语信息生成短视频口播文案..."
                    style={{ fontSize: 14, lineHeight: 1.8 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                    <Button
                      type="primary"
                      className="btn-primary"
                      icon={<RobotOutlined />}
                      onClick={handleAssistWrite}
                      loading={assistLoading}
                    >
                      {assistLoading ? '生成中...' : '开始助写'}
                    </Button>
                    {aiContent && (
                      <>
                        <Button icon={<ThunderboltOutlined />} onClick={handleRegenerate} loading={assistLoading}>
                          重写
                        </Button>
                        <Button icon={<EditOutlined />} onClick={() => handleApplyToForm(aiContent)}>
                          应用到表单
                        </Button>
                      </>
                    )}
                  </div>
                  {rawContent && (
                    <details style={{ marginTop: 12 }}>
                      <summary style={{ cursor: 'pointer', color: '#aaa', fontSize: 12 }}>原始返回</summary>
                      <pre style={{ backgroundColor: '#fafafa', border: '1px solid #e8e8e8', borderRadius: 4, padding: 8, fontSize: 11, fontFamily: 'monospace', maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{rawContent}</pre>
                    </details>
                  )}
                </div>
              ),
            },
            {
              key: 'script',
              label: (
                <span>
                  <ThunderboltOutlined /> 镜头脚本
                </span>
              ),
              children: (
                <div style={{ backgroundColor: '#fff7e6', border: '1px solid #ffd591', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontWeight: 500, color: '#d46b08' }}>镜头脚本</span>
                    {scriptLoading && <span style={{ color: '#888', fontSize: 12 }}>正在生成...</span>}
                  </div>
                  <Input.TextArea
                    value={scriptContent}
                    onChange={(e) => setScriptContent(e.target.value)}
                    rows={18}
                    placeholder="点击「生成脚本」，AI 将基于口播文案生成对应的镜头分镜脚本..."
                    style={{ fontSize: 14, lineHeight: 1.8 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                    <Button
                      type="primary"
                      className="btn-primary"
                      icon={<ThunderboltOutlined />}
                      onClick={handleScriptWrite}
                      loading={scriptLoading}
                    >
                      {scriptLoading ? '生成中...' : '生成脚本'}
                    </Button>
                    {scriptContent && (
                      <>
                        <Button icon={<ThunderboltOutlined />} onClick={handleRegenerateScript} loading={scriptLoading}>
                          重写
                        </Button>
                      </>
                    )}
                  </div>
                  {scriptRawContent && (
                    <details style={{ marginTop: 12 }}>
                      <summary style={{ cursor: 'pointer', color: '#aaa', fontSize: 12 }}>原始返回</summary>
                      <pre style={{ backgroundColor: '#fafafa', border: '1px solid #e8e8e8', borderRadius: 4, padding: 8, fontSize: 11, fontFamily: 'monospace', maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{scriptRawContent}</pre>
                    </details>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default GameTermList;
