# 盲文点字学习训练器

纯前端盲文点字学习与练习工具，支持点阵字符卡片、听写练习、错题本和学习进度统计，数据存 IndexedDB。**支持断网练习、回场合并**：志愿者去社区教学时进度先存本机，回场后合并练习会话、答题记录与课程进度到主设备；冲突保留两份来源，未处理前不计入掌握等级；同步失败保留本机批次，恢复网络重试，重复合并不多算；升级时自动回填来源与修订号。

## 快速启动

```bash
cp .env.example .env && docker compose up -d
```

## 访问地址或 CLI 示例

前端：<http://localhost:20111>

## 离线同步与合并

| 能力 | 说明 |
|---|---|
| 本机优先 | 断网时练习会话、答题记录以 `source=设备id`、`revision=1`、`sync_status=local` 写入 IndexedDB |
| 回场合并 | 联网后在「同步中心」推送本机批次；远程批次按 `(id, source)` 合并：同来源按修订号更新，同 id 不同来源判为冲突 |
| 冲突保留两份来源 | 同一答题记录被两边改过时保留两份副本（复合主键 `id::source`），标记 `sync_status=conflict`，未解决前不计入掌握等级 |
| 失败重试 | 同步失败保留本机批次（状态 `failed`），恢复网络后一键重试，记录仍为 `local` 不丢失 |
| 幂等 | 已处理批次记入 `processedBatches` 日志，重复合并不多算 |
| 升级回填 | 启动时扫描旧数据，缺 `source` 补 `legacy`、缺 `revision` 补 `1`，错题本/历史仍可查，进度按合并后有效答题重算 |

核心模块：`utils/merge`（合并/冲突判定）、`utils/backfill`（回填）、`utils/mastery`（掌握重算）、`utils/idempotency`（幂等）、`services/SyncService`（推送/重试/拉取/解决冲突）、`services/MergeService`（远程批次合并）、`services/BackfillService`、`services/MasteryService`、`stores/SyncStore`。



## 本地开发方式

- 前端：`cd frontend && npm install && npm run dev`



## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Material UI + Zustand + IndexedDB |
| 后端 | - |
| 数据库 | 本地模拟数据 |
| 部署 | Docker Compose |

## 项目目录结构

```text
frontend/src/
├── api/                  # 本地模拟 async API；init 负责种子写入 IndexedDB，Sync 模拟网络推送/拉取
├── stores/               # Zustand 独立 store；SyncStore 管理批次、冲突、在线状态
├── types/                # 数据模型类型：AnswerRecord/PracticeSession 含 source/revision/sync_status
├── constants/            # 枚举、日志模板、错误信息、状态文案；新增 SyncStatus/SyncBatchStatus/ConflictResolution
├── constructors/         # 默认对象、表单对象、导入数据构造器；SyncBatch/ConflictRecord 构造器
├── components/common/    # 共享组件：SyncStatusBadge、ConflictResolver、SyncBatchList、MasteryBadge 等
├── hooks/                # useOnlineStatus、usePendingSync、useConflictResolver
├── pages/                # 学习卡片、练习模式、错题本、学习进度、同步中心
├── router/
├── services/             # SyncService（推送/重试/拉取/解决冲突）、MergeService、BackfillService、MasteryService
├── utils/                # storage(IndexedDB 封装)、merge、backfill、mastery、idempotency、device、logger
├── mocks/                # 种子数据（含旧数据/已同步/冲突对）
└── workers/              # 耗时合并/回填计算（预留）
```

## 环境变量说明

- `COMPOSE_PROJECT_NAME`: Compose 项目名，默认 `braille-trainer`
- `FRONTEND_PORT`: 前端端口，默认 `20111`


## Docker 部署说明

- 根 Compose 文件不写 `version`，顶层 `name: braille-trainer`。
- 容器名均使用 `${COMPOSE_PROJECT_NAME:-braille-trainer}` 前缀。
- 数据库使用命名卷，避免绑定中文路径。
- 常见问题：端口占用时修改 `.env` 中端口后重启；需要重置数据时执行 `docker compose down -v`。

## 枚举/常量出现位置清单

- PracticeMode: constants/PracticeMode、types/PracticeMode、constructors、logTemplates、errorMessages、筛选器、展示组件/控制器均有引用。
- SymbolCategory: constants/SymbolCategory、types/SymbolCategory、constructors、logTemplates、errorMessages、筛选器、展示组件/控制器均有引用。
- MasteryLevel: constants/MasteryLevel、types/MasteryLevel、constructors、logTemplates、errorMessages、筛选器、展示组件/控制器均有引用。
- SyncStatus: constants/SyncStatus、types/SyncStatus、constants/statusText、utils/merge、utils/backfill、stores/SyncStore、components/common/SyncStatusBadge、pages/SyncPage、pages/MistakesPage 均有引用。
- SyncBatchStatus: constants/SyncBatchStatus、types/SyncBatchStatus、constants/statusText、services/SyncService、components/common/SyncBatchList、pages/SyncPage 均有引用。
- ConflictResolution: constants/ConflictResolution、types/ConflictRecord、constants/statusText、services/SyncService、components/common/ConflictResolver、pages/SyncPage 均有引用。
- 同步日志模板：constants/logTemplates 的 Sync 分组（创建/推送/成功/失败保留/重试/幂等跳过/冲突检测/冲突解决/回填/掌握重算），由 utils/logger 统一出口，services 各写操作调用。
- 同步错误码：constants/errorCodes 的 SYNC_OFFLINE/SYNC_BATCH_FAILED/SYNC_CONFLICT_UNRESOLVED/SYNC_DUPLICATE_BATCH/SYNC_BACKFILL_FAILED/SYNC_MERGE_FAILED，constants/errorMessages 提供文案，api/Sync 与 services/SyncService 分别包装。

## 为什么会牵一发动全身

实体字段、枚举、日志模板、错误消息、构造器、筛选器和展示组件被刻意拆散到多个目录；修改一个状态值通常需要同步类型、构造器、服务、控制器、store、页面、README 与数据库种子。

## License

MIT
