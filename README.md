# 盲文点字学习训练器

纯前端盲文点字学习与练习工具，支持点阵字符卡片、听写练习、错题本和学习进度统计，数据存 IndexedDB。志愿者可在断网社区教学，回场后把练习会话、答题记录与课程进度合并回主设备。

## 快速启动

```bash
cp .env.example .env && docker compose up -d
```

## 访问地址或 CLI 示例

前端：<http://localhost:20111>

本地跑测试：

```bash
cd frontend && npm install && npm test
```

## 离线教学与回场合并（核心流程）

1. 志愿者在社区断网教学：练习会话、答题记录、课程进度先写入**本机 IndexedDB**，同时进入本机 outbox 批次。
2. 同步失败（断网/传输错误）后**批次保留在本机**，状态置为 FAILED 并累计尝试次数；恢复网络后自动重试，也可在「同步中心」手动重试。
3. 回场后批次通过汇聚端（本地用第二个 IndexedDB 库模拟主设备）送达主设备并合并：
   - **幂等**：已应用批次号账本 + `(uuid, source, revision)` 双重判重，**重复合并不多算**。
   - **双源冲突**：同一答题记录两边都改过且内容不同，两份来源副本都保留并登记 PENDING 冲突；**冲突未处理前不计入掌握等级**。
   - **冲突解决**：志愿者在「同步中心」选择保留的来源，败方副本软删除（错题本/历史仍可查询），学习进度按合并后的有效答题重算。
   - **课程进度**：`completed_symbol_ids` 按集合并集做 CRDT 合并，`last_practiced_at` 取最新，永不冲突。
4. 升级：IndexedDB v1 → v2 迁移对缺少来源(`source`)和修订号(`revision`)的旧数据按确定性谱系 `lin:<实体>:<旧id>` 回填，旧练习与错题本仍可查。

页面左下角提供「布置离线练习 / 布置双源冲突」演示按钮，配合「同步中心」的模拟断网开关可在单浏览器复现完整流程。

## 本地开发方式

- 前端：`cd frontend && npm install && npm run dev`
- 测试：`cd frontend && npm test`（Vitest + fake-indexeddb，含合并引擎纯函数测试与端到端同步流程测试）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Material UI + Zustand + IndexedDB |
| 后端 | 无（汇聚端以第二个 IndexedDB 库本地模拟，可替换为服务端接口） |
| 数据库 | IndexedDB（v2 含同步队列/批次账本/冲突/掌握度快照 store） |
| 部署 | Docker Compose |

## 项目目录结构

```text
frontend/src/
├── api/                  # 按模型分文件封装 async API（含 Sync/Practice/Conflict）
├── controllers/          # syncController/practiceController/conflictController 分层包装异常
├── services/             # repository / mergeService / practiceService / syncService / appContext / demoScenario
├── stores/               # Zustand store：SyncStore 及各实体 store
├── types/                # BrailleSymbol/Lesson/PracticeSession/AnswerRecord/Sync* 类型
├── constants/            # 枚举、日志模板、错误码/错误消息、同步状态、掌握度阈值
├── constructors/         # 默认对象/表单/响应对象/同步批次构造器
├── db/                   # IndexedDB 建库升级、v1→v2 迁移、汇聚端 hub 库
├── components/common/    # BrailleCell/LessonProgress/PracticePanel/ResultBadge/ChartPanel/StatusBadge 等
├── hooks/                # useBraillePattern/usePracticeSession/useIndexedDbStore/useOnlineSync/useMastery/useMistakes
├── pages/                # /learn /practice /mistakes /progress /sync
├── router/
├── utils/                # 合并引擎、掌握度、冲突解决、同步元数据、连通性、日志、错误、格式化
├── mocks/
└── __tests__/            # 回填/合并/冲突/掌握度/升级/端到端测试
```

## 环境变量说明

- `COMPOSE_PROJECT_NAME`: Compose 项目名，默认 `braille-trainer`
- `FRONTEND_PORT`: 前端端口，默认 `20111`

## Docker 部署说明

- 根 Compose 文件不写 `version`，顶层 `name: braille-trainer`。
- 容器名均使用 `${COMPOSE_PROJECT_NAME:-braille-trainer}` 前缀。
- 数据库为浏览器内 IndexedDB，无服务端命名卷；Nginx 仅托管静态产物。
- 常见问题：端口占用时修改 `.env` 中端口后重启；需要重置本机数据时清理站点 IndexedDB 或执行 `docker compose down -v`。

## 枚举/常量出现位置清单

- PracticeMode: constants/PracticeMode、types/PracticeMode、constructors(PracticeSessionConstructor)、logTemplates、errorMessages、练习模式页、PracticePanel。
- SymbolCategory: constants/SymbolCategory、types/SymbolCategory、constructors(BrailleSymbolConstructor)、logTemplates、学习卡片筛选、StatusBadge/展示。
- MasteryLevel: constants/MasteryLevel、constants/masteryRules、types/MasteryLevel、utils/mastery、hooks/useMastery、学习进度页、错题相关、格式化。
- BatchStatus（PENDING/FAILED/SYNCED）与 ConflictStatus（PENDING/RESOLVED）: constants/SyncStatus、types/SyncBatch/SyncConflict、stores 常量、syncService/mergeService、同步中心页、errorMessages/logTemplates。

## 为什么会牵一发动全身

实体字段、枚举、日志模板、错误消息、构造器、服务、控制器、store、页面与数据库升级被刻意拆散到多个目录；同步元数据(uuid/lineage_id/source/revision)更是贯穿类型、构造器、IndexedDB v2 迁移、合并引擎、冲突解决、掌握度重算、outbox 与页面，任一字段调整都会触达 3-5 个以上文件。

## License

MIT
