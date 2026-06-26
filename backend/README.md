# PoetrySpace 后端服务

FastAPI + PostGIS + Elasticsearch 微服务集群。

## 快速开始

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 配置环境变量（或使用 .env）
export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/poetry_space"
export ELASTICSEARCH_URL="http://localhost:9200"

# 3. 初始化数据库（先确保 PostgreSQL + PostGIS 已安装）
#    PostgreSQL 需启用 PostGIS 扩展:
#    CREATE EXTENSION IF NOT EXISTS postgis;
alembic upgrade head

# 4. 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 5. 查看 API 文档
#    http://localhost:8000/api/docs
```

## 项目结构

```
backend/
├── app/
│   ├── main.py              # FastAPI 入口
│   ├── core/
│   │   ├── config.py        # 环境配置
│   │   └── database.py      # 数据库引擎 + 会话
│   ├── models/
│   │   ├── place_name.py    # 古今地名映射模型
│   │   ├── poet.py          # 诗人轨迹模型
│   │   └── poetry.py        # 诗词六维度标注模型
│   ├── schemas/
│   │   ├── search.py        # 多维检索请求/响应
│   │   └── ai.py            # AI 服务请求/响应
│   ├── services/
│   │   └── spatial.py       # 时空查询服务
│   └── api/v1/
│       ├── router.py        # 路由聚合
│       └── endpoints/
│           ├── places.py    # 地名映射 API
│           ├── poets.py     # 诗人轨迹 API
│           ├── search.py    # 多维检索 API
│           └── ai.py        # AI 辅助 API
├── tests/
│   └── test_spatial.py      # 空间查询测试
├── alembic.ini              # 数据库迁移配置
├── requirements.txt         # Python 依赖
└── pytest.ini               # 测试配置
```

## 架构原则

- **分层解耦**：数据/服务/应用三层隔离
- **多端同源**：PC/App/小程序/AR 共用同一套 API
- **标准统一**：WGS84 坐标、RESTful API、统一错误格式
