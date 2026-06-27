# 📜 中国古诗词文化互动平台 (PoetrySpace)

> **诗词时空可视化学术工具 + 文旅增值体验**
>
> 项目代号：PoetrySpace | 当前阶段：S2 生产准备

---

## 项目概述

整合历史地理文献、唐宋文学编年数据与千万级诗词语料，融合 GIS 时空可视化、SLAM 增强现实、NLP 检索与可视化技术，构建**学术研究、文旅体验与大众诗词创作**三大场景一体化平台。

### 核心能力

| 模块 | 状态 | 简述 |
|------|------|------|
| 🗺️ 诗词时空可视化 | ✅ 已完成 | 诗人轨迹动画、多诗人对比、交游概率、热力图、围栏查询 |
| 🔍 多维诗词检索 | ✅ 已完成 | 六维度（地理/时间/人物/意象/意境/用典）组合检索 + 统一搜索 |
| 🤖 AI 创作辅助 | ✅ 已完成 | 对仗推荐、格律校验、意境生成、风格仿写/扩写/改写 |
| 📊 数据导出 | ✅ 已完成 | CSV / Excel / Shapefile 多格式导出 |
| 🐳 Docker 部署 | ✅ 已完成 | PostGIS + Redis + API + Web 完整服务栈 |
| 🏛️ 文旅交互 | ⏳ 待开发 | AR 实景、路线规划、扫码讲解、打卡分享 |

---

## 快速开始

### 开发环境（SQLite）

```bash
# 后端
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 前端
cd frontend/pc
npm install
npm run dev
```

前端默认运行在 http://localhost:15173，API 文档在 http://localhost:8000/api/docs。

### Docker 部署（完整服务栈）

```bash
cd deploy
docker compose up -d
```

启动后访问 http://localhost 即可使用。

---

## 项目结构

```
├── README.md                     # 本文件
├── .env.example                  # 环境变量配置模板
├── .github/workflows/ci.yml      # CI 工作流
├── docs/                         # 项目文档
│   ├── architecture/             # 架构设计文档
│   ├── database/                 # 数据库设计文档
│   ├── api/                      # API 规范
│   └── meeting/                  # 会议记录
├── backend/                      # 后端服务 (Python FastAPI)
│   ├── app/                      # 应用代码
│   │   ├── main.py               # FastAPI 入口
│   │   ├── core/                 # 配置、数据库、兼容层
│   │   ├── api/v1/endpoints/     # 诗人、地名、搜索、AI、导出
│   │   ├── models/               # SQLAlchemy 模型 (8表)
│   │   ├── schemas/              # Pydantic 模式
│   │   └── services/             # 搜索、空间、AI 服务
│   ├── tests/                    # pytest 测试 (15个)
│   ├── alembic/                  # 数据库迁移
│   └── Dockerfile                # 后端容器镜像
├── frontend/
│   ├── pc/                       # PC Web (React + TypeScript + Leaflet)
│   │   ├── src/components/       # PoetryMap, AIToolsPanel, 浮层
│   │   └── Dockerfile            # 前端容器镜像
│   ├── mobile/                   # App (React Native) [预留]
│   └── miniapp/                  # 小程序 (Taro) [预留]
├── data/                         # 种子数据
│   ├── place_names/              # 古今地名数据 (~200条)
│   ├── poet_trajectories/        # 诗人轨迹数据 (~50位)
│   └── poetry_features/          # 诗词特征数据 (~300首)
└── deploy/                       # Docker Compose + nginx
```

---

## 技术栈

| 层面 | 技术选择 |
|------|----------|
| 后端框架 | Python FastAPI + uvicorn |
| 时空数据库 | PostgreSQL + PostGIS（生产）/ SQLite（开发）|
| ORM | SQLAlchemy 2.0 Async + Alembic 迁移 |
| PC 前端 | React 18 + TypeScript + Vite + Leaflet |
| 地图 | 高德地图瓦片 (Gaode) |
| AI 工具 | 规则引擎（平仄韵部/对仗库/模板引擎）|
| 容器化 | Docker Compose (PostGIS + Redis + API + Nginx) |
| CI | GitHub Actions |
| 测试 | pytest + pytest-asyncio + httpx |

---

## API 概览 (23 端点)

| 前缀 | 端点 | 功能 |
|------|------|------|
| `/api/v1/poets` | 5 | 诗人列表、轨迹、作品、交游概率、热力图 |
| `/api/v1/places` | 3 | 地名搜索、围栏查询、沿革时间线 |
| `/api/v1/search` | 2 | 六维组合检索、统一搜索 |
| `/api/v1/ai` | 7 | 对仗、格律、意境、仿写/扩写/改写 |
| `/api/v1/export` | 6 | 地名/诗人/轨迹/诗词/交游的 CSV/Excel/shp 导出 |

---

## 路线图

| 阶段 | 状态 | 内容 |
|------|------|------|
| **S0** 项目启动 | ✅ | 架构设计、PoC 原型 |
| **S1** 关键修复 | ✅ | 地名搜索/沿革存根、密钥硬化、防抖、类型对齐 |
| **S2** 生产准备 | ✅ | Alembic、Docker 完整栈、错误处理、API 测试 |
| **S3** 质量重构 | ✅ | 组件拆分、加载状态 |
| **S4** 性能数据 | ⏳ | 空间索引、数据扩充 |
| **S5** 收尾 | ✅ | CI/CD、README、清理 |
| **未来** | ⏳ | LLM 集成、文旅模块、移动端 |

---

## 文档入口

- [项目文档中心](docs/wiki/index.md)
- [需求规格说明书 V1.0](./《中国古诗词文化互动平台》软件需求规格说明书（V1.0）.md)
- [每日总结](docs/daily-summaries/)

## 测试

```bash
cd backend
python -m pytest tests/ -v
# 15 tests passed
```
