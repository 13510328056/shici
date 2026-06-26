# 📜 中国古诗词文化互动平台 (PoetrySpace)

> **诗词时空可视化学术工具 + 文旅增值体验**
>
> 项目代号：PoetrySpace | 总周期：12 个月 | 当前阶段：S0 项目启动

---

## 项目概述

整合历史地理文献、唐宋文学编年数据与千万级诗词语料，融合 GIS 时空可视化、SLAM 增强现实、NLP 检索与可视化技术，构建**学术研究、文旅体验与大众诗词创作**三大场景一体化平台。

### 核心能力

| 模块 | 优先级 | 简述 |
|------|--------|------|
| 🗺️ 诗词时空可视化 | P0/P1 | 诗人轨迹动画、多诗人对比、交游概率、热力图 |
| 🔍 多维诗词检索 | P0 | 六维度（地理/时间/人物/意象/意境/用典）组合检索 |
| 🤖 AI 创作辅助 | P1/P2 | 对仗推荐、格律校验、意境生成、仿写改写 |
| 🏛️ 文旅交互 | P1/P2 | AR 实景、路线规划、扫码讲解、打卡分享 |

---

## 项目结构

```
├── README.md                     # 本文件
├── docs/                         # 项目文档
│   ├── wiki/index.md             # 文档中心首页
│   ├── architecture/             # 架构设计文档
│   ├── database/                 # 数据库设计文档
│   ├── api/                      # API 规范
│   ├── roles/                    # 岗位 JD
│   ├── meeting/                  # 会议记录
│   └── daily-summaries/          # 每日总结
├── backend/                      # 后端服务 (Python FastAPI)
│   ├── app/                      # 应用代码
│   ├── tests/                    # 测试
│   └── alembic.ini               # 数据库迁移
├── frontend/
│   ├── pc/                       # PC Web (React + TypeScript)
│   ├── mobile/                   # App (React Native)
│   └── miniapp/                  # 小程序 (Taro)
├── data/                         # 数据资产
│   ├── place_names/              # 古今地名数据
│   ├── poet_trajectories/        # 诗人轨迹数据
│   └── poetry_features/          # 诗词特征数据
└── scripts/                      # 工具脚本
```

---

## 文档入口

👉 [项目文档中心](docs/wiki/index.md)

| 文档 | 链接 |
|------|------|
| 需求规格说明书 V1.0 | [《中国古诗词文化互动平台》软件需求规格说明书（V1.0）.md](./《中国古诗词文化互动平台》软件需求规格说明书（V1.0）.md) |
| 项目执行规划 | [C:\Users\Administrator\.claude\plans\gentle-humming-panda.md](C:\Users\Administrator\.claude\plans\gentle-humming-panda.md) |
| 每日总结 | [docs/daily-summaries/](docs/daily-summaries/) |

---

## 技术栈

| 层面 | 技术选择 |
|------|----------|
| 后端框架 | Python FastAPI |
| 时空数据库 | PostgreSQL + PostGIS |
| 搜索引擎 | Elasticsearch / OpenSearch |
| PC 前端 | React + TypeScript + Leaflet.js/OpenLayers |
| 移动端 | React Native (App) + Taro (小程序) |
| AI 推理 | 本地模型 + LLM API 混合 |

---

## 当前阶段

**S0 — 项目启动**（2026-06-26 ~ 第1周）

- ✅ 项目执行规划审批通过
- ✅ Git 仓库 + 项目结构初始化
- ✅ 5 份关键技术岗位 JD 输出
- ✅ 架构设计草案输出
- ✅ FastAPI + PostGIS PoC 原型
- ⬜ 技术 PoC 验证
- ⬜ 团队招募启动
