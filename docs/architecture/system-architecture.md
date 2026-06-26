# 🏗️ 系统架构设计草案

> 版本：V0.1（初稿）
> 最后更新：2026-06-26
> 状态：**草案 — 待团队到位后评审修订**
> 编制角色：项目经理（依据需求 V1.0）

---

## 1. 架构总览

### 1.1 分层架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    应用层 (Application Layer)                  │
│  ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐    │
│  │ PC Web   │  │ App (RN) │  │ 小程序  │  │ AR 眼镜  │    │
│  │ (React)  │  │          │  │ (Taro)  │  │ (WebXR)  │    │
│  └────┬─────┘  └────┬─────┘  └────┬────┘  └────┬─────┘    │
│       │             │             │            │           │
├───────┴─────────────┴─────────────┴────────────┴───────────┤
│                  BFF 层 (Backend For Frontend)               │
│  ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐    │
│  │ PC BFF   │  │ App BFF  │  │ 小程序  │  │ AR BFF   │    │
│  │          │  │          │  │ BFF     │  │          │    │
│  └──────────┘  └──────────┘  └─────────┘  └──────────┘    │
├─────────────────────────────────────────────────────────────┤
│               API Gateway（统一入口）                         │
│          路由 / 限流 / 鉴权转发 / 日志                        │
├─────────────────────────────────────────────────────────────┤
│                   服务层 (Microservices)                      │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Auth     │ │ 地名映射  │ │ 时空可视化│ │ 多维检索     │  │
│  │ 服务     │ │ 服务     │ │ 计算服务  │ │ 服务         │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│                                                             │
│  ┌──────────┐ ┌──────────────────────┐ ┌──────────────┐  │
│  │ 文旅推荐  │ │ AI 诗词辅助服务       │ │ 数据导出     │  │
│  │ 服务     │ │ ┌────┐┌────┐┌────┐  │ │ 服务         │  │
│  └──────────┘ │ │对仗││格律││生成│  │ └──────────────┘  │
│               │ └────┘└────┘└────┘  │                    │
│               └──────────────────────┘                    │
├─────────────────────────────────────────────────────────────┤
│                   数据层 (Data Layer)                        │
│  ┌──────────────────┐ ┌──────────┐ ┌──────────────────┐    │
│  │ PG + PostGIS     │ │ES/OS     │ │ Redis            │    │
│  │ 三大核心数据库    │ │复合索引   │ │ 缓存/会话        │    │
│  │ (地名/轨迹/诗词)  │ │          │ │                  │    │
│  └──────────────────┘ └──────────┘ └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 架构核心原则

| 原则 | 说明 |
|------|------|
| **分层解耦** | 数据/服务/应用三层隔离，单一层变更不影响其他层级 |
| **标准统一** | WGS84 坐标、API 入参出参、标注规则全局标准化 |
| **多端同源** | 所有终端共用同一套后台服务，BFF 做数据裁剪 |
| **可扩展** | 预留朝代数据扩容、大模型接入、第三方渠道对接接口 |
| **可追溯** | 所有地名/诗词/轨迹数据标注来源留痕 |

---

## 2. 微服务拆分方案

### 2.1 服务清单

| 编号 | 服务名称 | 核心职责 | P0/P1 | 依赖 |
|------|----------|----------|-------|------|
| S01 | Auth 服务 | 用户认证、JWT Token 管理、三级权限控制 | P0 | - |
| S02 | 地名映射服务 | 古今地名模糊查询、坐标双向转换、地名沿革时序查询 | P0 | PG+PostGIS |
| S03 | 时空可视化计算服务 | 轨迹动画数据计算、热力图生成、交游概率批量运算 | P0 | PG+PostGIS |
| S04 | 多维检索服务 | 六维度组合检索、文本相似度计算、季节/节气模糊匹配 | P0 | ES/OS |
| S05 | 文旅推荐服务 | 主题路线生成、景点诗词推送 | P1 | PG+Redis |
| S06 | AI 对仗推荐服务 | 对仗词汇推荐、上下文情感识别 | P1 | 词库+Redis |
| S07 | AI 格律校验服务 | 格律校验、押韵校正 | P1 | 韵库+规则引擎 |
| S08 | AI 文本生成服务 | 意境框架生成、诗词解析、仿写改写、多意境融合 | P2 | 推理引擎 |
| S09 | 数据导出服务 | 时空数据/图表/轨迹 GIS 文件导出 | P2 | PG+异步任务 |

### 2.2 通信方式

| 场景 | 通信方式 | 技术选型 |
|------|----------|----------|
| 实时查询（检索/对仗/格律） | 同步 HTTP/REST | FastAPI 直接调用 |
| AI 生成类（长耗时） | 异步 + 流式 | WebSocket / SSE |
| 数据导出（批量处理） | 异步消息 | Redis Stream / RabbitMQ |
| 服务间高频调用 | 内部 gRPC（后续优化） | 初期同进程/HTTP 直连 |

### 2.3 API Gateway 功能

- **路由分发**：按服务前缀分发到对应微服务实例
- **限流保护**：对 AI 服务、检索服务按 IP 级别限流
- **鉴权转发**：统一校验 JWT Token，解析用户角色上下文
- **请求日志**：全链路日志采集（≥90 天留存）
- **聚合文档**：自动聚合各微服务 OpenAPI/Swagger 文档

---

## 3. 数据库逻辑模型

### 3.1 古今地名映射数据库

```yaml
# 核心表：place_names（古今地名映射表）
place_names:
  description: "核心地名映射，≥60000 条"
  字段:
    place_id: uuid PK                    # 唯一标识
    ancient_name: varchar(100)            # 古地名（如"金陵""江宁"）
    modern_name: varchar(100)            # 现地名（如"南京"）
    wgs84_lon: decimal(9,6)              # WGS84 经度
    wgs84_lat: decimal(9,6)              # WGS84 纬度
    province: varchar(50)                # 省
    city: varchar(50)                    # 市
    district: varchar(50)                # 区县
    admin_level: smallint                # 行政区划级别（1=省/2=市/3=县）
    geog: geography(POINT, 4326)         # PostGIS 空间字段
    索引:
      - GIST(geog)                       # 空间索引
      - BTREE(ancient_name)              # 古地名索引
      - BTREE(modern_name)               # 现地名索引

# 关联表：place_name_changes（地名沿革变更记录）
place_name_changes:
  description: "地名历史变更时间线"
  字段:
    id: uuid PK
    place_id: uuid FK -> place_names
    change_year: varchar(10)             # 变更年份（含"约""前"等前缀）
    old_name: varchar(100)               # 旧名
    new_name: varchar(100)               # 新名
    source: varchar(100)                 # 史料来源

# 关联表：place_ambiguity_rules（歧义地名处理规则）
place_ambiguity_rules:
  description: "多义地名→诗词语境判定规则"
  字段:
    id: uuid PK
    ambiguous_name: varchar(100)         # 歧义地名（如"紫台"）
    target_place_id: uuid FK -> place_names
    dynasty_filter: varchar(50)          # 朝代过滤条件
    context_keywords: text[]              # 语境关键词（用于判定）
    priority: smallint                   # 匹配优先级
```

### 3.2 诗人轨迹时空数据库

```yaml
# 核心表：poets（诗人基础信息）
poets:
  description: "诗人基础信息"
  字段:
    poet_id: uuid PK
    name: varchar(50)                    # 姓名
    birth_year: varchar(20)              # 出生年（含"约"）
    death_year: varchar(20)              # 卒年
    dynasty: varchar(30)                 # 朝代：唐/宋/...
    tags: varchar(50)[]                  # 身份标签（诗人/词人/政治家等）

# 核心表：poet_trajectories（诗人时空轨迹）
poet_trajectories:
  description: "诗人一生轨迹事件表，主体数据源为唐宋文学编年"
  字段:
    id: uuid PK
    poet_id: uuid FK -> poets
    event_year: varchar(20)              # 事件年份
    event_date_precision: enum           # 精确度：年/月/日
    ancient_place: varchar(100)          # 古地名
    place_id: uuid FK -> place_names     # 关联地名
    wgs84_lon: decimal(9,6)              # 坐标
    wgs84_lat: decimal(9,6)
    geog: geography(POINT, 4326)
    event_type: enum                     # 出生/科举/仕宦/贬谪/游览/创作
    stay_duration_days: integer          # 停留天数（估计）
    source: varchar(100)                 # 数据来源
  索引:
    - GIST(geog)
    - BTREE(poet_id)
    - BTREE(event_year)
    - BTREE(event_type)

# 关联表：poet_encounters（诗人交游关联 - 预计算）
poet_encounters:
  description: "诗人时空交游匹配表，支撑交游概率查询"
  字段:
    id: uuid PK
    poet_a_id: uuid FK -> poets
    poet_b_id: uuid FK -> poets
    overlap_start_year: varchar(20)
    overlap_end_year: varchar(20)
    overlap_location_lon: decimal(9,6)   # 重叠区域中心点
    overlap_location_lat: decimal(9,6)
    encounter_probability: decimal(5,4)  # 交游概率 P（0-1）
    period_overlap_days: integer         # 重叠时间（天）
    area_overlap_km2: decimal(10,2)      # 重叠面积
    related_poetry_ids: uuid[]
```

### 3.3 诗词多维特征标注数据库

```yaml
# 核心表：poetry（诗词作品表）
poetry:
  description: "诗词作品基础信息"
  字段:
    poetry_id: uuid PK
    title: varchar(200)                  # 标题
    author_id: uuid FK -> poets          # 作者
    dynasty: varchar(30)
    content: text                        # 正文
    genre: varchar(30)                   # 体裁：五绝/七律/词牌名/古风
    rhythm_pattern: varchar(100)         # 平仄格式（若适用）
    rhyme_category: varchar(30)          # 韵部

# 特征表：poetry_features（六维度标注）
poetry_features:
  description: "诗词六维度结构化标注"
  字段:
    id: uuid PK
    poetry_id: uuid FK -> poetry
    # 地理特征
    geo_creation_place_id: uuid FK -> place_names
    geo_description_place_ids: uuid[]     # 描写地点
    # 时间特征
    creation_year: varchar(20)
    season: varchar(5)[]                  # 四季
    solar_term: varchar(20)[]             # 节气
    festival: varchar(50)[]               # 节日
    # 人物特征
    character_names: varchar(100)[]       # 描写人物/典故人物
    # 意象特征
    imagery_items: varchar(50)[]          # 自然/建筑/器物意象
    # 意境特征
    mood_tags: varchar(30)[]              # 送别/思乡/边塞/田园/怀古/闺怨
    # 用典特征
    allusion_names: varchar(100)[]
    allusion_sources: varchar(200)[]
    allusion_targets: varchar(100)[]
```

### 3.4 搜索引擎索引设计（Elasticsearch / OpenSearch）

```yaml
索引：poetry_index
维度映射：
  - 地理：location (geo_point)
  - 时间：creation_year (integer)
  - 季节：season (keyword)
  - 节气：solar_term (keyword)
  - 意境：mood_tags (keyword[])
  - 意象：imagery_items (keyword[])
  - 用典：allusion_names (keyword[])
  - 全文：content (text, 中文分词)
查询约束：
  - 复合检索 ≤500ms（10万条规模）
  - 时空联合过滤（地理位置 + 时间范围 + 主题筛选）
排序策略：
  - 多维度匹配度加权排序
  - 支持相关度 + 时间 + 地理距离混合排序
```

---

## 4. API 设计规范

### 4.1 通用约定

| 项目 | 规范 |
|------|------|
| 协议 | HTTPS 强制 |
| 根路径 | `/api/v1/{service_name}` |
| 数据格式 | JSON (request/response) |
| 字符编码 | UTF-8 |
| 认证方式 | JWT (Bearer Token) |
| 分页 | 统一 `page`/`page_size`，响应含 `total`/`has_next` |

### 4.2 统一响应格式

```json
{
  "code": 0,
  "message": "success",
  "data": { ... },
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 156,
    "has_next": true
  },
  "request_id": "uuid"
}
```

### 4.3 错误响应

```json
{
  "code": 40001,
  "message": "参数错误：经纬度格式无效",
  "details": { ... },
  "request_id": "uuid"
}
```

### 4.4 典型 API 示例

```yaml
# 地名映射服务
GET /api/v1/places/search?q=金陵&dynasty=唐
  -> 返回古地名匹配结果列表

# 时空可视化服务
GET /api/v1/trajectory/poets/{poet_id}?year_start=725&year_end=755
  -> 返回诗人某时段轨迹点列表
POST /api/v1/trajectory/encounter-probability
  -> body: {poet_a_id, poet_b_id}
  -> 返回交游概率计算结果

# 多维检索服务
POST /api/v1/search/poetry
  -> body: {location, year_start, year_end, mood_tags, ...}
  -> 返回匹配诗词列表 + 地图点位数据

# AI 对仗推荐
POST /api/v1/ai/antithesis/recommend
  -> body: {input_text, position, genre}
  -> 返回对仗推荐列表
GET /api/v1/ai/rhythm/check?content=...&genre=七律&rhyme=平水韵
  -> 返回格律校验结果
```

---

## 5. 数据流：典型业务场景

### 5.1 用户检索诗词 → 全流程

```
用户输入(地点=金陵, 意境=怀古, 季节=秋)
  ↓
PC Web / App
  ↓ (调用 BFF → API Gateway)
多维检索服务
  ↓ (查询 ES 时空复合索引)
ES poetry_index（地理筛 → 意境筛 → 季节筛 → 相关度排序）
  ↓
返回匹配诗词列表 + 地图点位
  ↓
PC Web 同时渲染：列表 + 地图标注
```

### 5.2 AI 对仗推荐 → 全流程

```
用户输入"白日依山尽"中的"依"字（处于对仗位置）
  ↓
PC Web 编辑器自动识别对仗位置
  ↓ (调用 BFF → API Gateway)
AI 对仗推荐服务
  ↓
265 万对仗词库 → 词根拆解 → 上下文情感匹配 → 意境过滤
  ↓ (≤500ms)
实时返回对仗候选列表（工对/宽对/流水对标注 + 历代例句）
  ↓
编辑器下拉展示推荐结果
```

---

## 6. 待决策项

| 决策项 | 选项 | 建议 |
|--------|------|------|
| API Gateway 选型 | Kong / Apache APISIX / Nginx + Lua | 建议 APISIX（轻量、K8s 原生） |
| 消息队列 | Redis Stream / RabbitMQ | 初期用 Redis Stream（架构简化） |
| 容器编排 | K8s / Docker Compose / 云托管 | 建议 K8s（K3s 轻量级） |
| CI/CD | GitHub Actions / GitLab CI / Jenkins | 建议 GitHub Actions（仓库集成） |
| 前端组件库 | Ant Design / Semi Design / 自研 | 建议 Ant Design（生态成熟） |
| 监控体系 | Prometheus + Grafana / 云厂商方案 | 建议 Prometheus + Grafana |

---

## 7. 下一步安排

1. **技术栈选型论证 PoC**（本周启动）
   - FastAPI + PostGIS 时空查询性能测试
   - Leaflet.js/OpenLayers 千点位渲染测试
   
2. **架构设计评审**（核心团队到位后）
   - 架构师到位后主导微服务细节方案
   - GIS 工程师到位后评审空间索引方案
   - AI 工程师到位后评审 AI 服务集成方案

3. **细化文档**
   - 数据库物理模型 DDL 初稿
   - API 接口详细定义文档
   - 部署架构文档
