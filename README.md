# Fat OpenClaw

> 二次元展会 + 谷子（ACG周边）情报聚合平台

**核心功能**：谷子黑话术语库 + 谷子商品返佣 + 微博 KOL 爬虫 + AI 文案生成

**变现路径**：社群情报引流 → 小程序（CPS + 增值服务）

---

## 目录结构

```
fat_openclaw_crawler/
├── server/          # 后端服务（Python FastAPI）
│   ├── main.py     # FastAPI 入口
│   ├── app/        # Python 代码包
│   ├── docs/       # 项目文档
│   └── start.sh    # 启动脚本
└── web/            # 前端管理后台（React + Ant Design）
```

## 快速启动

### 后端服务

```bash
cd server
chmod +x start.sh
./start.sh
```

> 端口 8879，启动命令：`uvicorn main:app`

### 前端管理后台

```bash
cd web
npm install
npm run dev
```

> 端口 3000

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.10+ / FastAPI / MongoDB / Playwright |
| 前端 | React 18 / TypeScript / Vite / Ant Design 5 |
| 小程序 | Taro 4.x（规划中） |

## 相关文档

- [后端服务说明](./server/README.md)
- [开发计划](./server/DEVELOPMENT_PLAN.md)
- [产品定位与合规边界](./server/docs/必读.md)
