# Backend 服务

> FastAPI 后端服务，含微博爬虫、谷子知识库、阿里妈妈返佣等核心能力。

## 快速启动

```bash
# 方式一：使用脚本
chmod +x start.sh
./start.sh

# 方式二：手动启动（从 server/ 目录运行）
uvicorn main:app --host 0.0.0.0 --port 8879 --reload
```

## 环境依赖

- Python 3.10+
- MongoDB（连接配置见 `app/config/settings.py`）
- Playwright + Chrome（用于浏览器自动化）

## 目录结构

```
server/
├── main.py               # FastAPI 入口
├── requirements.txt
├── start.sh              # 启动脚本
├── browser_state.json    # 浏览器状态文件
├── weibo_cookies.json    # 微博登录态
├── app/                  # Python 代码包
│   ├── app_state.py      # 全局状态管理
│   ├── browser_state.py  # 浏览器状态模块
│   ├── api/              # API 路由层
│   │   ├── routes.py     # 浏览器控制 / 微博抓取
│   │   ├── weibo_users.py  # 微博用户管理
│   │   ├── weibo_crawler_task.py  # 爬虫任务
│   │   ├── guzi_terms.py # 谷子黑话
│   │   ├── coser_terms.py # Coser黑话
│   │   ├── convention_terms.py  # 漫展黑话
│   │   ├── game_terms.py # 游戏黑话
│   │   ├── guzi_products.py  # 谷子商品
│   │   ├── guzi_tags.py  # 标签管理
│   │   ├── platform_configs.py  # 平台配置
│   │   ├── categories.py # 分类管理
│   │   └── llm.py       # LLM 对接
│   ├── crawler/          # 爬虫核心
│   │   ├── playwright_client.py
│   │   ├── scraper.py
│   │   ├── weibo_crawler.py
│   │   └── weibo_auto_crawler.py
│   ├── database/         # 数据访问层
│   ├── models/           # 数据模型
│   ├── services/         # 业务逻辑
│   │   ├── llm_service.py
│   │   └── crawler_task_service.py
│   ├── integrations/     # 第三方集成
│   │   └── alimama/      # 阿里妈妈 API
│   ├── config/           # 配置管理
│   └── utils/            # 工具函数
├── docs/                 # 项目文档
├── DEVELOPMENT_PLAN.md
├── 必读.md
└── env_template.txt
```

## API 端口

- 后端：http://localhost:8879
- 管理后台：http://localhost:3000（需先启动 `web/`）

## 相关文档

- [开发计划](./DEVELOPMENT_PLAN.md)
- [产品定位与合规边界](./docs/必读.md)
