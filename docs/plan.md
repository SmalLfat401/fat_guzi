# 微博情报模块重构 — 实现计划

## 核心理念

**参考 WeiboPosts 页面模式**：左侧帖子列表（带 intel_status 筛选），右侧选中帖子后触发 AI 提取并展示结果，管理确认后保存情报并标记帖子状态。

整个流程始终围绕**帖子**展开：
```
帖子列表 → 选择帖子 → AI提取 → 确认/编辑 → 保存情报 → 帖子标记完成
```

---

## 页面结构（微博情报模块）

### 微博情报侧边栏菜单

```
微博情报
├── 情报提取       → WeiboIntelList（主入口，左右布局帖子提取页）
├── 情报管理       → IntelManagement（Tab页：已提取情报 / 审核队列 / 告警中心）
├── AI 批次管理    → BatchControl
└── 关键词库       → KeywordLibrary
```

### 1. 情报提取（WeiboIntelList）— 主入口

- **左侧（55%）**：微博帖子列表
  - 顶部卡片：按情报状态分类统计（全部/未处理/已提取/提取中/不相关/失败），点击切换筛选
  - 帖子列表：状态标签 / 发布时间 / 内容摘要 / 互动数据 / 查看按钮
  - 分页

- **右侧（45%）**：帖子详情 + AI 提取
  - 选中帖子后：完整文本内容 + 互动统计
  - 「触发 AI 提取」按钮 → 调用后端单帖提取 API
  - 提取结果展示 + 可编辑表单
  - 「确认保存」→ 创建情报 + 标记帖子 intel_status=1
  - 「重新提取」/「标记不相关」

### 2. 情报管理（IntelManagement）

三个 Tab：

- **已提取情报** — 所有已创建的情报列表（可筛选已批准）
- **审核队列** — pending 状态的快速审核，支持批量批准/拒绝
- **告警中心** — 仅有告警的情报，支持快速处理

### 3. AI 批次管理（BatchControl）— 保持不变

### 4. 关键词库（KeywordLibrary）— 保持不变

### 5. 情报详情/编辑 — 保持不变

详情页、编辑页保持原有功能。

---

## 后端改动

### 新增 API

| 端点 | 方法 | 作用 |
|---|---|---|
| `/weibo-intel/posts` | GET | 帖子列表（支持 intel_status 筛选、分页、搜索） |
| `/weibo-intel/posts/count` | GET | 按情报状态统计帖子数量 |
| `/weibo-intel/extract-single` | POST | 对单个帖子触发 AI 提取，返回提取结果（不创建情报） |
| `/weibo-intel/create-from-extract` | POST | 确认提取结果，创建情报记录，标记帖子 |
| `/weibo-intel/mark-not-related` | POST | 标记帖子为不相关 |
| `/weibo-intel/extract-result/{mid}` | GET | 获取帖子的最新提取结果缓存 |

### 新增 Model

```python
class SingleExtractResult(BaseModel):
    """单帖提取结果（不持久化，前端展示用）"""
    mid: str
    is_valid: bool
    reason: Optional[str]
    category/title/date/location/price/participants/ips/tags/confidence/...

class CreateFromExtract(BaseModel):
    """从提取结果创建情报"""
    mid: str
    category: IntelCategory
    title: str
    event_start_date/...（各字段可选）
    confidence: float
```

---

## 前端改动

### 新增文件

- `pages/weiboIntel/IntelManagement.tsx` — 情报管理（Tab页）
- `pages/weiboIntel/WeiboIntelList.tsx` — **重写**为左右布局帖子提取主入口

### 删除文件

- `pages/weiboIntel/ReviewQueue.tsx` — 合并到 IntelManagement
- `pages/weiboIntel/AlertCenter.tsx` — 合并到 IntelManagement

### 修改文件

- `api/weiboIntel.ts` — 新增帖子列表、单帖提取相关 API
- `types/weibo.ts` — WeiboPost 添加 intel_status 等字段
- `types/weiboIntel.ts` — 添加 SingleExtractResult 类型
- `router/index.tsx` — 更新路由
- `App.tsx` — 更新侧边栏菜单

---

## 数据流

```
1. 打开页面 → 加载帖子列表（全部帖子，按时间倒序）

2. 点击帖子 → 右侧展示帖子内容

3. 点击「触发 AI 提取」→ POST /extract-single
   → 后端调用 AI
   → 返回 SingleExtractResult
   → 右侧展示提取结果（可编辑）

4. 点击「确认保存」→ POST /create-from-extract
   → 后端：创建 WeiboIntel（status=pending） + 标记帖子 intel_status=1
   → 刷新帖子列表（该帖状态变为"已提取"）

5. 点击「标记不相关」→ POST /mark-not-related
   → 后端：标记帖子 intel_status=3
   → 刷新帖子列表
```

---

## 去重策略

`generate_dedup_hash(title, city, year)` — 标题归一化 + 城市 + 年份生成 MD5 前16位

- 精确匹配：dedup_hash 完全一致 → 合并到已有情报
- 模糊匹配：相似度 > 0.85 → 合并
- 部分匹配：相似度 > 0.6 + 城市一致 + 日期重叠 → 合并
- 无匹配 → 创建新情报

---

## 实现顺序（已完成）

1. 后端新增 API（模型 + Service + 路由）
2. 前端 API 层补充
3. 前端类型补充
4. 重写 WeiboIntelList（左右布局）
5. 新增 IntelManagement（Tab合并）
6. 更新路由和侧边栏
