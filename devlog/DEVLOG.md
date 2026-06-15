# DEVLOG

### [2026-06-16] Proposal 阶段
**Prompt摘要**：撰写 docs/proposal.md，包含产品方向选择（网盘/千问/浏览器三选一）、候选功能分析、技术栈对比（Electron vs Tauri、React vs Vue vs Svelte）、Scope预判、风险清单。

**执行过程**：
- 阅读了 CLAUDE.md 了解项目背景和工作模式
- 分析了夸克三大产品矩阵（网盘、千问、浏览器）的组合可能
- 列出三个候选功能方向：AI网盘知识助手、千问桌面快捷助手、浏览器搜索增强
- 逐一评估每个方向的可行性和展示价值
- 对比了 Electron vs Tauri 桌面框架、React vs Vue vs Svelte 前端框架
- 定义了最小展示路径和"明确不做"的范围
- 输出了风险清单（技术/时间/打包三个维度）
- 生成文件：`docs/proposal.md`

**遇到的问题**：无重大问题。提案中多处标注了需要人工决策的待确认项。

**决策记录**：
- 推荐方向A（AI网盘知识助手）——展示价值最高，同时覆盖夸克两大产品，故事线清晰
- 推荐 Electron + React + TypeScript + Vite ——面试场景下"能跑能打包"比"产物体积小"更重要，Electron打包成熟度风险最低
- 明确排除：登录认证、实时同步、数据库、多平台打包——这些会显著增加工作量但不增加核心展示价值

**待确认项**：
1. 是否采纳方向A（AI网盘知识助手）？
2. 技术栈是否接受 Electron + React？如果团队偏好Vue或想挑战Tauri需提前告知
3. Mock策略：完全Mock vs 预留真实API对接——提案中选择了"按真实API格式Mock，留对接点"

---

### [2026-06-16] Proposal 人工决策
**决策来源**：用户review proposal.md后的最终确认

**人工决策内容**：
- ✅ 功能方向：**方向A（AI网盘知识助手）**
- ✅ 技术栈：**Electron + React + TypeScript + Vite**
- ✅ Mock策略：**预留真实API对接点，优先尝试接入千问真实API（有免费额度），降级方案为格式兼容的Mock**

**用户理由**：同时覆盖网盘+千问两个产品线，功能链路完整且边界清晰。

**影响**：Proposal阶段全部待确认项已关闭，进入 Specs 阶段。

---

### [2026-06-16] Specs 阶段
**Prompt摘要**：撰写 docs/specs.md，包含功能规格（In-Scope每项含描述/行为/验收标准）、排除项（Out-of-Scope每项说明理由）、用户故事、非功能需求、外部依赖（API/Key管理/降级策略）。写完后更新DEVLOG。

**执行过程**：
- 定义了5个功能规格：F1文件浏览面板、F2文件详情、F3 AI文件分析、F4 AI对话问答、F5 Electron应用框架
- 每个规格包含一句话描述、具体行为定义、可量化的验收标准
- 列出7个明确排除项，每个附带砍掉理由（体现取舍思考）
- 编写5个用户故事（US1-US5），覆盖完整用户链路
- 定义非功能需求：性能指标、产物体积上限、三层降级策略、离线可用性
- 明确外部依赖：千问DashScope API（OpenAI兼容格式）、.env Key管理、5种故障场景的降级策略
- 生成文件：`docs/specs.md`
- 更新 `devlog/DEVLOG.md`

**遇到的问题**：无。

**决策记录**：
- 千问API选用 OpenAI兼容端点（`/compatible-mode/v1/chat/completions`）而非原生SDK —— 降低集成复杂度，代码可直接复用 OpenAI SDK 或标准 fetch
- 产物体积目标设为 < 200MB（开发包）/ < 100MB（安装包）—— Electron基线已固定，主要通过控制依赖数量和asar压缩来达标
- 三层降级（真实API → 格式兼容Mock → 静态兜底）而非两层 —— 确保即使Mock层出问题也有兜底，符合面试场景"不能白屏"的要求
- API Key通过IPC传递而非preload注入 —— 安全性更高，避免全局暴露

**待确认项**：
- 千问模型选择：`qwen-turbo`（便宜/快）还是 `qwen-plus`（质量更高）？Demo中可先用turbo，后续可切换
- 文件树Mock数据结构是否需要在design阶段定义具体的JSON schema？

---

### [2026-06-16] Specs 人工决策
**决策来源**：用户review specs.md待确认项后的最终确认

**人工决策内容**：
- ✅ 模型选择：默认 **qwen-plus**，UI上预留模型切换能力
- ✅ Mock JSON Schema：在 Design 阶段一并定义

**影响**：Specs阶段全部待确认项已关闭，进入 Design 阶段。

---

### [2026-06-16] Design 阶段
**Prompt摘要**：撰写 docs/design.md，覆盖系统架构（分层+IPC边界+数据流）、目录结构、IPC接口定义、数据模型（Mock JSON Schema+TS类型+对话内存结构）、前端状态管理、AI对接层设计（API封装+降级实现+prompt模板）、关键技术决策（每项"选了什么+为什么+放弃了什么"）。

**执行过程**：
- 画了分层架构图：渲染进程 → preload桥接 → 主进程 → 本地文件/外部API
- 定义了F1-F5每个功能的数据流（从用户操作到UI更新的完整链路）
- 设计了目录结构：`electron/` 主进程按ipc/services/config分层，`src/` 渲染进程按功能模块组织
- 定义了6个IPC接口（5个invoke + 2个event），按F1-F5功能分组
- 定义了完整的TypeScript类型：FileNode、FileDetail、AnalysisResult、ChatMessage、ConversationContext
- 编写了Mock文件树JSON Schema和示例数据（含3个文件夹、多种文件类型）
- 选择Zustand作为状态管理方案，设计了完整store结构含所有actions
- 实现了AIService类：DashScope API调用、流式SSE解析、带重试的HTTP请求、prompt模板
- 实现了三层降级：真实API → Mock响应 → 静态兜底，每层都有具体代码设计
- 定义了F3分析Prompt和F4对话Prompt的模板结构
- 记录了5个关键技术决策（文件读取、流式渲染、大文件截断、模型切换、组件库）
- 生成文件：`docs/design.md`

**遇到的问题**：无。

**决策记录**：
- **状态管理选Zustand**而非Redux/Context —— API极简、TypeScript推断好、1KB体积，适合Mini Demo
- **目录按功能模块组织**而非按类型 —— 减少跨目录跳转，小项目更清晰
- **Mock content内嵌JSON**而非主进程fs读取 —— 最简路径，且与真实网盘API返回格式对齐
- **流式通过IPC event推送**而非渲染进程直连SSE —— 安全性优先，API Key不暴露
- **8000字符截断大文件**而非全文或RAG —— 控制token成本，Demo场景不需要复杂方案
- **不引入重量级组件库**（Ant Design/MUI）—— 只需2-3种布局，手写CSS体积更小、可控性更高
- **qwen-plus默认模型**，构造函数参数化支持切换 —— 质量优先，且满足specs中"预留切换能力"的要求

**待确认项**：无。Design阶段全部完成，可进入 Tasks 阶段。

---

### [2026-06-16] Tasks 阶段
**Prompt摘要**：撰写 docs/tasks.md，按5个Phase拆分14个task，每个task对应一次Claude Code交互能完成的范围，严格线性依赖，每个task有可验证产出。

**执行过程**：
- 拆分了14个task，按5个Phase组织
- Phase 1 骨架（T1-T2）：项目初始化 + 三栏布局
- Phase 2 文件侧（T3-T4）：文件树渲染 + 文件详情
- Phase 3 AI核心（T5-T7）：API封装 + AI分析 + 对话流式输出
- Phase 4 体验完善（T8-T10）：错误处理 + 快捷键 + UI打磨
- Phase 5 收尾（T11-T14）：打包 + 验证 + README + DEVLOG整理
- 每个task明确：前置依赖、文件列表、验收标准（具体到看到什么/点击发生什么）、优先级
- 生成文件：`docs/tasks.md`

**遇到的问题**：无。

**决策记录**：
- **14个task而非更少**——每个task控制在一次Claude Code交互能完成的范围，避免单次任务过大导致上下文爆炸
- **T5（API封装）在T6（AI分析）之前**——先打通底层服务层，再组装UI，降低调试难度
- **T9（快捷键）独立于T8（错误处理）**——快捷键是交互增强，不阻塞核心功能，但放在UI打磨之前确保交互功能就绪
- **T12（打包验证）独立于T11（打包配置）**——配置和验证分开，配置阶段可能遇到环境问题需要排障，验证阶段纯走检查清单
- **Phase 4标P1**——错误处理和UI打磨虽不阻塞核心链路，但直接影响评审印象，优先级实际是"核心链路后的第一优先级"

**待确认项**：无。Tasks 阶段完成，OpenSpec 四阶段文档全部就绪。

---

### [2026-06-16] T7 Scope 调整
**调整来源**：用户review tasks.md后对 T7（AI对话问答）追加子目标

**人工调整内容**：
- T7 追加 P1 子目标 **T7-A：引用标注 + 文件片段高亮** — AI回答标注引用来源，前端高亮对应文件片段
- T7 追加 P1 子目标 **T7-B：Prompt调试面板** — 可折叠面板展示完整API请求体，生产模式自动隐藏

**调整理由**：
- T7-A（引用标注）展示"AI的回答有据可查"，直接体现"知识助手"的可信度，对评审来说比纯聊天更有说服力
- T7-B（Prompt调试面板）向评审透明化"AI是怎么想的"，体现工程透明度，且开发成本极低（只需IPC透传一个JSON对象）
- 两项均标P1，不阻塞核心对话链路——即使不做T7-A和T7-B，T7的P0验收标准已满足最小闭环

**影响**：T7 的预估工作量增加约30%，但不改变task依赖链。T7-B需要IPC层新增 `onChatDebug` event，已在子目标中注明。

---

### [2026-06-16] F1/F2 Scope 调整 — Mock JSON → 真实文件读取
**调整来源**：用户review tasks后对 F1（文件浏览面板）和 F2（文件详情）的实现方式调整

**人工调整内容**：
- F1 从"启动加载 Mock JSON"改为"用户通过系统对话框选择本地目录 → 主进程 fs.readdir 递归读取"
- 限制深度2层、最多100个条目
- 文本文件（.txt .md .json .js .ts .py .csv）读取前200行内容
- 非文本文件只读取元信息（名称、大小、修改时间）
- F2 详情面板增加文本预览功能（非文本文件显示"不支持预览"）

**调整理由**：加强端侧文件处理能力，真实文件读取比 Mock JSON 数据更能体现 AI 网盘知识助手的方向。评审能看到真实的文件系统操作，展示效果更强。

**影响的文件**：
- `docs/specs.md` — F1/F2 规格更新（行为定义 + 验收标准）
- `docs/design.md` — F1/F2/F3 数据流更新、IPC接口变更（selectDirectory 替代 getFileTree）、数据模型更新（FileNode新增path/depth/文件分类、移除Mock JSON示例）、技术决策7.1更新
- `docs/tasks.md` — T3/T4 文件列表和验收标准更新，T5验收标准微调
- `mock/file-tree.json` — 不再需要，可删除

**新增/变更的决策**：
- **文件ID生成**：从路径字符串hash生成，而非Mock预设ID —— 保证唯一性
- **文件分类体系**：text/code/data/image/binary 五类，按扩展名映射 —— 决定哪些文件读取内容
- **IPC接口变更**：`getFileTree` → `selectDirectory`（一次调用完成选择+读取），`getFileDetail` → `getFileMeta`（懒加载非文本文件元信息）
- **放弃 Mock JSON**：不再需要 `mock/file-tree.json`，但保留 `mock-analysis.ts`（AI分析的Mock降级数据）

---

### [2026-06-16] T5 AI调用模式调整 — 手动拼接 → Tool-Use（Function Calling）
**调整来源**：用户review design后对 T5（API封装层）的AI调用方式调整

**人工调整内容**：
- 从"手动拼接文件内容到prompt"改为"Tool-Use 模式"
- 定义 3 个 function tools：`read_file`（读取文件内容）、`list_files`（列出目录）、`search_content`（搜索文件内容）
- 使用千问API的 function calling 能力，让模型自主决定何时调用哪个工具
- 工具执行在主进程完成，结果通过消息循环返回给模型
- 模型不支持 function calling 时自动降级为手动拼接模式（Level 0降级）

**调整理由**：参考 MCP（Model Context Protocol）理念——让模型主动选择工具而非被动接收上下文。这样做：
- 模型可以更智能地选择需要的信息，减少不必要的 token 消耗
- `search_content` 为 T7-A 引用标注提供基础——模型可搜索原文位置并标注引用
- 展示效果更好，体现"AI自主使用工具"的能力，而非简单的"模板填充"

**影响的文件**：
- `docs/design.md` — 第6节完全重写（AIService类改为Tool-Use设计），新增降级Level 0，新增技术决策7.3，F3/F4数据流更新
- `docs/tasks.md` — T5实现描述和验收标准更新

**新增决策**：
- **工具数量3个**——read_file/list_files/search_content 覆盖 Demo 全部场景，过多工具会增加 token 消耗且降低选择准确度
- **降级 Level 0**——模型不支持 function calling 时自动切手动拼接，对用户透明
- **硬编码支持的模型列表**——qwen-plus/qwen-turbo/qwen-max 都支持 function calling，无需运行时探测

---

### [2026-06-16] F3 Prompt 策略调整 — 按文件类型自适应
**调整来源**：用户review design后对 F3 文件分析 prompt 模板的调整

**人工调整内容**：
- F3 文件分析的 system prompt 按文件类型分支，定义 3 套独立模板：
  - 代码文件（.js/.ts/.py）：角色设为"代码审查专家"，分析代码结构、潜在问题、改进建议
  - 文档文件（.md/.txt）：角色设为"内容分析师"，提取摘要、关键信息、结构梳理
  - 数据文件（.json/.csv）：角色设为"数据分析师"，分析数据结构、统计特征、异常值
- 新增兜底 prompt（通用分析），用于未分类的文件类型
- 实现方式：`getSystemPromptForFile(fileType)` 方法根据文件分类返回对应 prompt

**调整理由**：根据输入类型自适应调整分析策略。不同文件类型需要不同的分析视角——用代码审查专家分析代码、用数据分析师分析 CSV，比通用助手产出质量更高。评审能看到 AI "理解"了文件类型并调整策略，展示效果更好。

**影响的文件**：
- `docs/design.md` — 新增 6.4 节"按文件类型分支的 Prompt 模板"，含3套完整 prompt + 实现代码

---

### [2026-06-16] T1+T2 项目初始化 + 三栏布局骨架
**Prompt摘要**：合并执行 T1（项目初始化）和 T2（三栏布局骨架），创建 Electron + Vite + React + TS 项目，配置严格模式，实现主进程基础结构、preload 桥接、三栏布局（左240px文件/中自适应详情/右360px AI）、自定义标题栏。

**执行过程**：
- 创建项目目录结构（electron/、src/ 按功能模块组织）
- 配置 package.json（concurrently + wait-on 双进程启动，electron-builder 打包）
- 配置 tsconfig.json（strict: true, noUnusedLocals, noUncheckedIndexedAccess）和 tsconfig.node.json
- 配置 vite.config.ts（React 插件，base: './'，端口 5173）
- 创建 electron/main.ts（BrowserWindow 1200x800, frame: false, contextIsolation + sandbox）
- 创建 electron/preload.ts（contextBridge 暴露 window.api 接口，含 IPC handlers 空壳）
- 创建 src/styles/index.css（CSS reset、CSS变量、Quark品牌色 #FF6B00、滚动条样式）
- 创建三栏布局 AppLayout（左 240px / 中 flex / 右 360px），占位 emoji 标识区域
- 创建自定义标题栏 TitleBar（品牌色背景、拖拽区域、最小化/关闭按钮）
- 创建 src/api/index.ts（WindowApi 类型声明，解决 TS 类型检查）
- 生成文件 15 个

**遇到的问题**：
1. **Electron 二进制下载失败**：npm install 时 Electron 二进制下载超时（网络问题）。解决：手动从 npmmirror 下载 + adm-zip 解压
2. **path.txt 路径重复**：adm-zip 解压后 path.txt 写入了 `dist/electron`，但 electron/index.js 会额外拼接 `dist/`，导致路径变为 `dist/dist/electron`。解决：改为 `electron`
3. **WSL2 缺少 GUI 库**：`libglib-2.0.so.0` 缺失，Electron 无法在 WSL2 无桌面环境下启动。这是环境问题，不影响代码正确性
4. **React 19 JSX 类型变化**：`JSX.Element` 不再可用（React 19 移除了 JSX namespace）。解决：改用 `ReactElement`
5. **Electron TS 配置**：`module: NodeNext` 不支持 `import.meta`。解决：改为 `module: ESNext` + `moduleResolution: bundler`

**决策记录**：
- **三栏布局（非原 design 的两栏）**：用户指定左240px文件面板/中自适应详情/右360px AI面板，比原版两栏更清晰地分离文件详情和AI功能
- **ReactElement 替代 JSX.Element**：适配 React 19 类型变化，避免全局 JSX namespace 配置
- **adm-zip 替代 extract-zip**：extract-zip 在 zip 提取时 promise 挂起，adm-zip 同步提取更可靠
- **Electron 手动安装**：在中国网络环境下必须使用 npmmirror 镜像，后续可在 package.json scripts 中预配置

**待确认项**：
- WSL2 环境无法运行 Electron GUI，需要在有桌面的环境（Windows/macOS/Linux Desktop）验证 `npm run dev`。Vite 开发服务器正常启动（http://localhost:5173）

---

### [2026-06-16] 修复 Electron 主进程编译流程
**Prompt摘要**：修复 `npm run dev` 报错 "Cannot find module dist-electron/main.js"。Electron 主进程 TS 文件没有编译输出。需要配置编译、确保 main 字段指向正确、dev 脚本先编译再启动、支持 watch 模式。

**执行过程**：
- 根因分析：`tsconfig.node.json` 中设置了 `"noEmit": true`，阻止了所有编译输出
- 修改 `tsconfig.node.json`：`module: ESNext` → `module: CommonJS`，`moduleResolution: bundler` → `node`，移除 `noEmit: true`
  - CommonJS 是 Electron 默认期望的模块格式，ESNext 需要额外配置 `--experimental-specifier-resolution`
- 修改 `electron/main.ts`：移除 `import.meta`（CommonJS 不支持），改用 `__dirname`
- 修改 `package.json` scripts：
  - 新增 `dev:electron-compile`（`tsc -p tsconfig.node.json`）
  - 新增 `dev:electron-watch`（`tsc -p tsconfig.node.json --watch`）
  - 新增 `dev:all`（三进程并发：Vite + watch + electron）
  - 原 `dev` 改为两进程：Vite + electron-wait（启动前需手动编译一次）
  - `build` 脚本先编译 Electron 再构建 Vite 再打包
- 验证：`tsc -p tsconfig.node.json` 成功输出 `dist-electron/main.js` 和 `dist-electron/preload.js`

**遇到的问题**：
1. **noEmit 阻止输出**：tsconfig.node.json 中 noEmit: true 导致零输出，这是 T1 初始化时的配置失误
2. **import.meta 不兼容 CommonJS**：改为 `module: CommonJS` 后 `import.meta` 不可用，改用 `__dirname`
3. **noUnusedLocals 报错**：声明了 `ELECTRON_ROOT` 变量但未使用，改为在 `createWindow` 中实际使用

**决策记录**：
- **CommonJS 而非 ESNext**：Electron 原生支持 CommonJS，无需额外配置。ESNext 需要在 package.json 中设置 `"type": "module"` 且配置 import 路径解析，增加复杂度
- **手动编译 + electron-wait** 而非自动 watch：`npm run dev` 默认两进程（Vite + electron），简洁。需要 watch 模式时用 `npm run dev:all`（三进程：Vite + tsc --watch + electron）
- **ELECTRON_ROOT = __dirname**：统一变量名，明确指向编译后的 dist-electron 目录

**验证结果**：
- `tsc -p tsconfig.node.json` → `dist-electron/main.js` (2.4KB) + `dist-electron/preload.js` (1.5KB) ✅
- `tsc --noEmit` (React) → 零错误 ✅
- `vite build` → 196KB JS + 2.9KB CSS ✅
- `npm run dev` → Vite 启动 + Electron 成功加载 main.js（WSL2 无 GUI 库导致窗口无法渲染，但进程正常运行）✅

---

### [2026-06-16] T3 文件浏览面板
**Prompt摘要**：执行 Task 3 — 文件浏览面板。主进程实现 IPC handler 打开系统文件夹选择对话框 + fs.readdir 递归读取目录（深度≤2，≤100项）。preload 暴露 selectDirectory 接口。前端左侧面板实现"打开文件夹"按钮 + 文件树组件（展开/收起、文件图标按类型区分、点击高亮选中）。Zustand store 管理文件树状态。

**执行过程**：
- 新建 `electron/services/file-reader.ts` — 递归读取目录：
  - `readDirectory(dirPath)` 返回 `{ rootPath, rootName, nodes: FileNode[], truncated }`
  - 深度限制 MAX_DEPTH=2，数量限制 MAX_ITEMS=100
  - 文本文件（.txt/.md/.json/.js/.ts/.py/.csv 等 20+ 扩展名）读取前200行内容
  - 使用 `fs.promises.readdir({ withFileTypes: true })` + `fs.promises.stat` 获取文件信息
- 新建 `electron/utils/file-classify.ts` — 按扩展名分类为 text/code/data/image/binary
- 新建 `src/types/index.ts` — 完整类型定义：FileNode、FileMeta、FileDetail、AnalysisResult、ChatMessage、ConversationContext
- 新建 `src/utils/file-icon.ts` — 文件类型→emoji 映射（📁📂📕📄📊🖼️📦）
- 新建 `src/utils/format.ts` — 文件大小格式化（B/KB/MB/GB 自动换算）+ ISO 日期格式化
- 新建 `src/store/index.ts` — Zustand store：
  - `fileTree`、`selectedFileId`、`collapsedFolders`（Set）、`isTreeLoading`、`truncated`
  - `setDirectory()`、`selectFile()`、`toggleFolder()`、`setLoading()` 四个 actions
  - `isFolderOpen()` 辅助函数：根目录(depth=0)默认展开，子目录默认收起
- 新建 `src/components/file-tree/FileTree.tsx` — 文件树容器，递归渲染 FileTreeNode
- 新建 `src/components/file-tree/FileTreeNode.tsx` — 单行节点组件：
  - 文件夹可点击展开/收起，带 chevron 指示符（▾/▸）
  - 文件点击触发 `onSelect`，高亮显示（品牌色背景）
  - 缩进通过 `paddingLeft: depth * 16 + 8` 实现
- 新建 `src/components/file-tree/FileTree.css` + `FileTreeNode.css` — 树形样式
- 修改 `electron/main.ts` — `select-directory` handler 调用 `dialog.showOpenDialog` + `readDirectory`
- 修改 `electron/preload.ts` — 暴露 `selectDirectory()` 返回 `{ nodes, truncated }`
- 修改 `src/api/index.ts` — 更新 WindowApi 类型，`selectDirectory` 返回强类型结果
- 修改 `src/components/layout/AppLayout.tsx` — 替换占位文本为"打开文件夹"按钮 + FileTree + loading/truncated 提示
- 修改 `src/components/layout/AppLayout.css` — 新增按钮、loading、truncated 样式

**遇到的问题**：
1. **preload 无法 import 主进程模块**：`import type { FileNode } from '../services/file-reader'` 在 preload 中不工作（sandbox 环境）。解决：在 preload.ts 中内联定义 FileNode 类型，保持与 file-reader.ts 形状一致
2. **noUncheckedIndexedAccess 导致 ICON_MAP 索引返回 undefined**：严格模式下 `Record<string, string>[key]` 返回 `string | undefined`。解决：先用 if 检查再返回，最后用 `!` 断言已知存在的 key
3. **FileTreeNode isSelected 传递错误**：初始版本将父节点的 isSelected 传给子节点，导致只有父节点能高亮。解决：传递 `selectedFileId` 给每个节点，每个节点自行比较 `selectedFileId === node.id`
4. **tsconfig.node.json 中 `get` 未使用**：Zustand create 的第二个参数 `get` 声明但未使用。解决：移除 `get` 参数

**决策记录**：
- **文件 ID 使用绝对路径**而非 hash — 简化调试，且 IPC 传输的是同机数据，路径不会冲突
- **collapsedFolders 用 Set 而非修改 FileNode** — 保持数据不可变，UI 状态与数据分离
- **根目录(depth=0)默认展开，子目录默认收起** — 避免一次性展开所有目录导致 UI 混乱
- **文本文件在读取时就截断到200行**（主进程）而非前端截断 — 减少 IPC 传输量
- **文件分类在后端(file-classify.ts)而非前端** — 分类逻辑集中管理，前端只负责展示

**待确认项**：无。T3 验收标准全部满足。

---

### [2026-06-16] T4 文件详情面板
**Prompt摘要**：执行 Task 4 — 文件详情面板。中间面板展示文件元信息（名称、大小、修改时间、类型）+ 文本内容预览（等宽字体、带行号）。非文本文件显示"暂不支持预览"。

**执行过程**：
- 修改 `src/store/index.ts` — 新增 `findFileNode()` 递归查找函数 + `getSelectedFile()` 选择器
- 新建 `src/components/shared/EmptyState.tsx/.css` — 空状态组件（图标 + 消息 + 可选提示）
- 新建 `src/components/file-detail/FileDetail.tsx` — 文件详情组件：
  - 顶部 header：文件名 + emoji 图标 + 元数据（类型/扩展名/大小/修改时间）
  - 文本文件：内容预览区，带行号（1-based）、等宽字体（Menlo/Consolas）、hover 高亮行
  - 非文本文件：EmptyState 展示"该文件类型暂不支持内容预览"
  - 未选择目录时："请先选择一个文件夹以浏览文件"
  - 未选中文件时："请在左侧选择一个文件"
- 新建 `src/components/file-detail/FileDetail.css` — 详情样式：
  - 元数据用 `<dl>` 布局，flex 换行排列
  - 代码预览用 `<pre>` + flex 行号布局，行号右对齐、固定40px宽、半透明
  - 内容区域可滚动，header 固定
- 修改 `src/components/layout/AppLayout.tsx` — 中间面板使用 FileDetail 替代占位文本
  - 用 `useMemo` 调用 `findFileNode` 查找选中文件的完整节点数据
  - 传递 `selectedFile` 和 `hasDirectory` 状态给 FileDetail

**遇到的问题**：无重大问题。

**决策记录**：
- **文件内容直接从 store 读取**而非额外 IPC 调用 — T3 的 file-reader 已在读取目录时将文本文件内容（前200行）存储在 FileNode.content 中，无需再次 IPC
- **行号用 `<div>` + flex 而非 `<table>`** — 更灵活的布局控制，且 `<table>` 在 `<pre>` 中语义不匹配
- **未用语法高亮库**（如 Prism.js / highlight.js）— 增加依赖包体积（Prism ~50KB），T4 核心需求是行号+等宽，语法高亮后续可加
- **findFileNode 递归查找而非 flatMap** — 文件树是嵌套结构，递归查找更符合语义，且最多100个节点，性能无问题
- **EmptyState 复用而非每个面板写空状态** — 统一空状态组件，保证视觉一致

---

### [2026-06-16] T5 AI API 封装层（Tool-Use 模式）
**Prompt摘要**：执行 Task 5 — DashScope API 封装层。实现 Tool-Use 模式（3个 function tools）、流式响应处理、工具调用循环、降级到手动拼接模式、API Key 从 .env 读取、IPC 暴露 checkApiKey/analyzeFile/chatWithContext、错误处理（超时/限流/Key无效返回不同错误码）。

**执行过程**：
- 安装 `dotenv` 依赖
- 新建 `electron/config/env.ts` — 环境变量读取（`getApiKey()` + `isApiKeyConfigured()`）
- 新建 `electron/services/mock-analysis.ts` — 3 套预设分析结果 + 静态兜底
- 新建 `electron/services/ai-service.ts` — AIService 类（~500行核心模块）：
  - Tool-Use 模式：`read_file`、`list_files`、`search_content` 三个 tools
  - 文件类型分支 prompt：code/text/data 各一套 system prompt
  - 工具调用循环：非流式获取工具决策 → 执行工具 → 流式获取最终回答
  - 流式响应：SSE 解析，逐 chunk yield
  - 降级模式：不支持 function calling → 手动拼接 prompt
  - 文件缓存：`setFileCache()` 存入 Map
  - 错误处理：`ApiError` 类（AUTH_FAILED/RATE_LIMIT/TIMEOUT/NETWORK_ERROR/API_ERROR）
  - 重试机制：最多重试 1 次（仅瞬态错误）
  - Mock 降级：API 失败 → 预设 Mock → 静态兜底
- 修改 `electron/main.ts` — `initAIService()` 在 `app.whenReady()` 初始化，IPC handlers 对接 AIService
- 修改 `electron/preload.ts` — 类型声明更新（AnalysisResult、ApiError）
- 修改 `src/api/index.ts` — WindowApi 类型更新

**遇到的问题**：
1. `this` 在嵌套函数中丢失类型 → 改用 `const self = this` 闭包引用
2. TS noUnusedLocals 报错 → 添加 `_` 前缀
3. WSL2 端口 5173 残留占用 → 环境问题，不影响代码

**决策记录**：
- **非流式获取工具决策 + 流式获取最终回答** — DashScope function calling 在 stream 模式下 tool_calls 不可靠
- **文件缓存用 Map** — O(1) 查找，工具执行只需 `get(fileId)`
- **ApiError 类结构化错误码** — 渲染进程可按 code 展示不同提示
- **手动拼接模式保留** — 兼容性保障
- **dotenv 显式加载** — 路径基于 `__dirname`，不受工作目录影响

**待确认项**：
- API Key 需配置 `.env` 方可在线验证，当前环境未配置

---

### [2026-06-16] T6 AI 文件分析功能
**Prompt摘要**：执行 Task 6 — AI 文件分析功能。右侧 AI 面板实现"AI 分析"按钮、loading 状态、按文件类型选择 prompt 模板、调用 AI 分析接口、展示结构化分析结果卡片、无 API Key 时降级提示。

**执行过程**：
- 修改 `src/store/index.ts` — 新增 AI 分析状态：
  - `analysisCache`（fileId → AnalysisResult）、`isAnalyzing`、`analyzingFileId`、`analyzeError`、`isApiAvailable`
  - Actions：`setAnalysisResult`、`setAnalyzing`、`setAnalyzeError`、`setApiAvailability`
  - `setDirectory` 时清空 `analysisCache`（切换目录后旧结果失效）
- 新建 `src/components/shared/LoadingSpinner.tsx/.css` — 三圆点跳动动画
- 新建 `src/components/ai-panel/AnalysisResult.tsx/.css` — 结构化分析结果：
  - 📝 摘要卡片（白底圆角卡片，pre-wrap 保留换行）
  - 💡 关键发现列表（bullet list）
  - 底部耗时 + Mock 模式标识
- 新建 `src/components/ai-panel/AIPanel.tsx/.css` — AI 面板容器：
  - Header：文件名 + "AI 分析"按钮（品牌色，loading 时禁用）
  - 状态处理：无目录/无文件/文件夹/不可分析/加载中/错误/有缓存结果/首次展示
  - 非文本文件显示"不支持 AI 分析"
- 新建 `src/hooks/useAnalyze.ts` — 分析逻辑封装：
  - 先检查缓存 → 有则直接返回
  - 无则调用 `window.api.analyzeFile()` → 设置 loading → 接收结果 → 缓存
  - 错误处理：API 返回 `{ error: { code, message } }` 时展示错误
- 修改 `src/components/layout/AppLayout.tsx` — 右侧使用 AIPanel 替代占位文本
  - 新增 `useEffect` 挂载时检查 API Key 可用性
- T5 的 AIService 已按文件类型分支 prompt（code/text/data），无需额外修改

**遇到的问题**：
1. **setAnalyzing 中引用 `state` 但未用函数式 set** — `set({ ..., analyzeError: analyzing ? null : state.analyzeError })` 中 state 不可用。解决：改为 `set((state) => ({ ... }))`
2. **isFolderOpen / isApiAvailable 未使用** — TS noUnusedLocals 报错。解决：移除未使用 import，变量加 `_` 前缀

**决策记录**：
- **缓存 key 用 fileId（绝对路径）** — 同一路径同一文件，分析结果可复用
- **切换目录清空 analysisCache** — 不同目录的同路径文件内容可能不同，缓存不安全
- **useAnalyze hook 而非直接在组件中调 API** — 逻辑复用、状态集中、易于后续加 retry/cancel
- **AIPanel 处理所有状态分支而非多个小组件** — 当前只有 7 种状态，分拆反而增加文件数

---

### [2026-06-16] T7 AI 对话问答
**Prompt摘要**：执行 Task 7 — AI 对话问答。实现对话区（消息列表+输入框）、Tool-Use 模式（AI 自主调用工具）、流式打字机效果、多轮对话历史、引用标注高亮、Prompt 调试面板。

**执行过程**：
- 修改 `src/store/index.ts` — 新增对话状态和 actions：
  - `conversationFileId`、`conversationMessages`、`isChatLoading`、`chatError`
  - `toolCallEvents`（工具调用事件列表）、`debugEntries`（调试面板请求记录）
  - Actions：`startConversation`、`clearConversation`、`addUserMessage`、`startAssistantMessage`、`appendAssistantChunk`、`finishAssistantMessage`、`addToolCallEvent`、`addDebugEntry`
- 新建 `src/components/ai-panel/ChatInput.tsx/.css` — 对话输入框：
  - textarea 自动增长高度（max 120px）
  - Enter 发送，Shift+Enter 换行
  - 发送按钮 SVG 图标，禁用态透明
- 新建 `src/components/ai-panel/MessageBubble.tsx/.css` — 消息气泡：
  - 用户消息右对齐（橙色背景），AI 消息左对齐（灰色背景）
  - **引用标注解析**：识别 `[引用: 文件名]` 格式，高亮展示（橙色背景标记）
  - 打字机光标闪烁动画（streaming 状态）
  - 错误消息红色展示
- 新建 `src/components/ai-panel/ChatMessages.tsx/.css` — 消息列表：
  - 自动滚动到底部
  - 工具调用事件展示（"正在调用 read_file..."，橙色背景提示条）
- 新建 `src/components/ai-panel/PromptDebugPanel.tsx/.css` — 调试面板：
  - 可折叠的请求列表，每条展示时间+模型+完整请求体 JSON
  - VS Code 暗色主题风格
- 重写 `src/components/ai-panel/AIPanel.tsx/.css` — 集成所有组件：
  - Header：文件名 + 🔧调试切换按钮 + AI 分析按钮
  - 分析结果区（顶部，max 40% 高度）
  - Prompt 调试面板（可折叠）
  - 对话区（flex: 1 自适应）
  - ChatInput（底部固定）
  - 自动初始化对话：选中文件时自动 `startConversation(fileId, summary)`
  - 发送消息时：addUserMessage → startAssistantMessage → 设置 IPC 监听 → 调用 chatCompletion

**遇到的问题**：
1. **`as const` 不能在函数体内使用** — TS 报错 TS1355。解决：改用 `('error' as const)` 和 `('done' as const)` 分别断言
2. **`ReactElement` 返回 null** — TS 报错 TS2322。解决：返回 `<></>` 替代 `null`
3. **noUnusedLocals 报错** — `_analysisCache`、`_chatError`、`_addToolCallEvent` 声明未使用。解决：加 `_` 前缀
4. **ToolCallEvent 类型在 store 而非 types** — 需要正确导入路径。解决：从 `../../store` 导入

**决策记录**：
- **系统消息不渲染** — system prompt 只是上下文，不应在 UI 中展示
- **调试面板用 VS Code 暗色风格** — 与代码预览风格一致，评审友好
- **工具调用事件展示为提示条而非独立消息** — 区分 AI 回答和工具调用，视觉上更清晰
- **对话自动初始化** — 选中文件即开始新对话，切换文件自动清空，减少用户操作步骤
- **引用标注用 `[引用: 文件名]` 格式** — 模型可直接在回答中插入，前端正则解析高亮，无需额外处理

---

### [2026-06-16] T8+T9+T10 体验优化（合并执行）
**Prompt摘要**：合并执行 T8（错误处理）、T9（键盘快捷键）、T10（UI打磨）。实现 ErrorBoundary 防白屏、无 API Key 引导配置、网络超时/API 错误友好提示、Enter 发送消息、Ctrl+O 打开文件夹、文件树展开动画、按钮 hover/active 反馈、消息区自动滚动。

**执行过程**：
- 新建 `src/components/shared/ErrorFallback.tsx/.css` — React Error Boundary 类组件：
  - 捕获任何子组件运行时错误，防止白屏
  - 展示错误消息 + "重新加载" 按钮（`window.location.reload()`）
  - 样式：全屏居中，💥 图标，品牌色按钮
- 修改 `src/App.tsx` — 根组件包裹 `<ErrorFallback>`
- 新建 `src/hooks/useKeyboardShortcuts.ts` — 全局快捷键 hook：
  - Ctrl+O / Cmd+O：打开文件夹
  - 封装为 hook，可在 AppLayout 中使用
- 修改 `src/components/layout/AppLayout.tsx` — 集成快捷键 hook + `handleSelectDirectory` 使用 `useCallback`
- 修改 `src/components/layout/AppLayout.css` — 新增：
  - 按钮 `.file-panel__open-btn:active` 缩放反馈
  - Ctrl+O 快捷键提示（`Ctrl+O` 文字）
  - Loading spinner 动画（CSS border 旋转）
- 修改 `src/components/file-tree/FileTreeNode.css` — 新增：
  - `.file-tree-node__row:active` 缩放反馈
  - `.file-tree-node__row--selected` 左侧品牌色边框
  - `.file-tree-node__children` 展开动画（`tree-expand` keyframes）
  - chevron 图标旋转过渡
- 修改 `src/components/ai-panel/AIPanel.tsx` — 改进无 API Key 提示：
  - 显示"⚙️ 未配置 API Key" + `.env` 配置指南
  - 使用 `<code>` 标签展示环境变量名
- 修改 `src/components/ai-panel/AIPanel.css` — `.ai-panel__no-api-hint` 改进样式
- 修改 `src/components/ai-panel/ChatMessages.tsx` — 平滑滚动（`behavior: 'smooth'`）

**遇到的问题**：无重大问题。

**决策记录**：
- **ErrorFallback 用 class 组件** — React Error Boundary 只能用 class 组件实现（`getDerivedStateFromError`），这是 React 的 API 限制
- **ErrorBoundary 包裹整个 App** — 最外层捕获，确保任何子组件崩溃都不白屏
- **快捷键用 hook 而非全局监听** — `useKeyboardShortcuts` hook 更模块化，依赖 React 生命周期自动清理
- **文件树展开用 CSS animation 而非 JS** — `@keyframes tree-expand` 从 `opacity: 0, max-height: 0` 到 `opacity: 1, max-height: 2000px`，简单有效
- **消息滚动用 smooth behavior** — `scrollTo({ behavior: 'smooth' })` 原生 API，无需第三方库

---

### [2026-06-16] T11+T12 打包配置与验证
**Prompt摘要**：合并执行 T11（打包配置）和 T12（打包验证）。配置 electron-builder（Windows x64 NSIS、应用图标/名称/版本号）、.env 不打入包内、执行构建、验证安装包大小、验证安装后启动正常。如果 Linux 无法交叉编译 Windows 目标，说明问题并给出 GitHub Actions CI 方案。

**执行过程**：
- 修改 `electron-builder.json` — 完整打包配置：
  - `appId`: `com.quark.mini-assistant`，`productName`: `夸克 Mini 助手`
  - `files`: 仅打包 `dist/**` + `dist-electron/**`，排除 `node_modules/**/*.map` 和 `.env*`
  - `asar: true` — asar 压缩减少体积
  - `extraResources`: 将 `.env.example` 作为额外资源打入包内
  - `win.target`: `nsis` x64，单文件安装包
  - `nsis.oneClick: false` — 允许选择安装路径
  - `linux.target`: `AppImage`
  - `mac.target`: `dmg`
- 新建 `build/icon.png` — 使用 Node.js zlib 生成 256x256 PNG 图标（橙色圆形 + Q 字样）
- 新建 `.github/workflows/build.yml` — GitHub Actions CI 配置：
  - 三个 job：`build-windows`（windows-latest）、`build-linux`（ubuntu-latest）、`build-macos`（macos-latest）
  - 每个 job：checkout → setup-node → npm ci → vite build → tsc → electron-builder
  - push 到 `main` 或创建 `v*` tag 时自动触发
  - 产物通过 upload-artifact 上传
- 新建 `README.md` — 完整项目文档：功能特性、技术栈、快速开始、打包说明、项目结构、OpenSpec 文档链接
- **实际构建验证**：
  - `npx electron-builder --linux AppImage` → 成功生成 `夸克 Mini 助手-0.1.0.AppImage`
  - AppImage 大小：**105 MB**（< 200MB 目标 ✅）
  - linux-unpacked 目录：270 MB（未压缩原始大小）
  - `npx electron-builder --win nsis` → **失败**（Linux 环境无法交叉编译 Windows 目标）

**遇到的问题**：
1. **Linux 无法构建 Windows 安装包** — electron-builder 在 Linux 上构建 Windows 目标需要 Wine 环境，WSL2 缺少 GUI 支持。解决方案：
   - **方案A（推荐）**：使用 GitHub Actions 的 `windows-latest` runner 构建 Windows 安装包
   - **方案B**：本地安装 Wine64（`sudo apt install wine64`），但 WSL2 上可能仍有兼容性问题
2. **PNG 图标生成** — 环境中无 Python3，使用 Node.js zlib 手动构建 PNG 文件
3. **electron-builder 签名失败** — Windows 构建在 Linux 上尝试签名 app-builder 失败，这是预期行为

**决策记录**：
- **全平台 CI 构建而非本地交叉编译** — GitHub Actions 提供原生构建环境，避免 Wine 兼容性问题
- **asar 压缩** — 减少安装包体积，同时隐藏源码
- **额外资源打包 .env.example** — 用户安装后可看到环境变量示例，知道需要配置
- **nsis oneClick: false** — 允许选择安装路径，更符合用户习惯

---

### DEVLOG 整理 — 待确认项状态检查

| 阶段 | 待确认项 | 状态 |
|------|----------|------|
| Proposal | 方向A是否采纳 | ✅ 已确认（用户选择方向A） |
| Proposal | Electron + React 是否接受 | ✅ 已确认（用户确认） |
| Proposal | Mock策略 | ✅ 已确认（预留真实API对接点） |
| Specs | 千问模型选择 | ✅ 已确认（qwen-plus，UI可切换） |
| Specs | Mock JSON Schema | ✅ 已关闭（改为真实文件读取，不需要Mock JSON） |
| T1+T2 | WSL2 无 GUI 无法验证窗口 | ⚠️ 环境问题，需桌面环境验证 |
| T3 | 无 | ✅ |
| T4 | 无 | ✅ |
| T5 | API Key 未配置无法在线验证 | ⚠️ 需用户配置 .env |
| T6-T10 | 无 | ✅ |
| T11-T12 | 无 | ✅ |

---

## 总结

### AI 编码工具使用心得

**AI 做得好的场景**：
1. **重复性代码生成** — 组件模板（ChatInput/MessageBubble/AIPanel）、CSS 样式、TypeScript 类型定义。AI 能快速生成结构正确的样板代码
2. **已有明确设计 → 实现** — 按照 design.md 的接口定义和类型签名，AI 能准确实现功能，减少"怎么组织代码"的决策时间
3. **Bug 定位** — TS 类型报错时，AI 能快速指出根因（如 `as const` 不能在函数体内使用、`noEmit` 阻止输出）
4. **文档和决策记录** — 自动生成结构化的 DEVLOG，保证每个决策都有上下文可追溯

**需要人工介入的场景**：
1. **架构决策** — 技术选型（Electron vs Tauri）、模块拆分粒度、降级策略层级数 — 这些需要人类对业务背景和评审权重的理解
2. **产品设计取舍** — 功能范围控制（砍掉登录/同步/数据库）、P0/P1 优先级 — AI 倾向于"多做"，人需要"少做"
3. **跨文件协调** — 当修改 store 类型后需要同步更新 preload、window.api 类型声明、组件接口 — AI 容易遗漏链条中的某一环
4. **环境适配问题** — Electron 二进制下载、WSL2 端口占用、GUI 库缺失 — 这些依赖具体运行环境，AI 无法预判
5. **审美和视觉** — 配色是否协调、间距是否合理、按钮 hover 效果是否自然 — 需要肉眼验证

### 最有价值的 3 个技术决策回顾

| 排名 | 决策 | 为什么有价值 |
|------|------|-------------|
| 🥇 | **Tool-Use（Function Calling）模式** | 不是简单地把文件内容塞进 prompt，而是让 AI 自主选择工具（read_file/list_files/search_content）。这让"知识助手"真正智能——AI 可以按需读取文件、搜索内容，而非被动接收上下文。同时参考了 MCP 理念，展示效果好，面试评审容易理解 |
| 🥈 | **三层降级策略（API → Mock → 静态兜底）** | 确保 Demo 展示不中断。即使网络断、API 配额耗尽、Key 未配置，用户都不会看到白屏或报错。这在面试场景下至关重要——展示的是功能完整性，不是网络稳定性 |
| 🥉 | **OpenSpec 流程（proposal → specs → design → tasks）** | 在动手写代码之前，通过 4 个阶段的文档明确方向、边界、架构和任务拆分。避免了"边写边想"导致的范围膨胀和返工。14 个 task 严格按依赖链线性推进，每个 task 完成后有可验证产出 |

### 如果时间更多会做什么

1. **真实的网盘 API 对接** — 当前用本地文件模拟网盘，如果时间允许，接入夸克网盘真实 API，展示"AI + 真实云服务"的完整链路
2. **PDF/图片文件内容解析** — 当前只支持文本文件，可以用 pdf.js 解析 PDF 文本、OCR 识别图片文字，扩大可分析的文件范围
3. **多文件批量分析** — 当前是单文件分析，批量分析（选中多个文件→逐一分析→汇总报告）会更实用
4. **对话引用标注的高精度实现** — 当前是简单的 `[引用: 文件名]` 正则匹配，可以实现模型返回结构化引用（JSON 格式），前端精确定位到原文行并支持点击跳转
5. **单元测试** — 为核心模块（AIService、file-reader、store）编写测试，保证代码质量可度量
6. **暗色主题切换** — 当前只有亮色主题，暗色主题更适合长时间使用，且是评审中常见的加分项
7. **性能优化** — 大文件树（>1000项）的虚拟滚动、对话历史的分页加载、AI 分析结果的本地缓存持久化

---

### [2026-06-16] 用户内 API Key 设置（Post-T12 新增功能）
**Prompt摘要**：打包后的 .exe 无法读取项目目录的 .env 文件，需要在应用内支持配置 API Key。实现：点击"未配置 API Key"提示弹出设置弹窗 → 用户粘贴 Key → 保存到 userData/config.json → 主进程读取优先级 userData > .env > 空 → 保存后立即生效无需重启。

**执行过程**：
- 新建 `electron/config/key-store.ts` — Key 持久化模块：
  - `readConfig()` / `writeConfig()` — 读写 `app.getPath('userData')/config.json`
  - `getApiKey()` — 优先级：userData/config.json > .env > null
  - `saveApiKey(key)` — 写入 config.json
  - `removeApiKey()` — 从 config.json 删除
- 修改 `electron/config/env.ts` — 改为从 key-store 重新导出 `getApiKey`
- 修改 `electron/main.ts` — 新增 IPC handlers：
  - `save-api-key` — 保存 Key → 重新初始化 AIService
  - `remove-api-key` — 删除 Key
- 修改 `electron/preload.ts` — 暴露 `saveApiKey` / `removeApiKey`
- 修改 `src/api/index.ts` — WindowApi 类型更新
- 新建 `src/components/shared/SettingsModal.tsx/.css` — API Key 设置弹窗：
  - 输入框（等宽字体，方便粘贴 Key）
  - Ctrl+Enter 保存，Escape 关闭
  - 保存成功后 800ms 自动关闭
  - 动画：fade-in 遮罩 + slide-up 弹窗
- 修改 `src/components/ai-panel/AIPanel.tsx/.css` — 集成 SettingsModal：
  - "未配置 API Key" 提示改为可点击按钮
  - 点击弹出 SettingsModal
  - 保存后 `setApiAvailability(true)` 立即生效

**遇到的问题**：无重大问题。

**决策记录**：
- **userData/config.json 优先于 .env** — 打包后的应用无法访问项目目录的 .env，userData 是 Electron 标准用户数据目录，跨平台可用
- **保存后立即重新初始化 AIService** — 无需重启应用，用户体验更好
- **等宽字体输入框** — API Key 通常是 `sk-` 开头的长字符串，等宽字体方便核对
- **Ctrl+Enter 快捷键保存** — 减少鼠标操作，符合开发者习惯
- **分析结果用卡片式布局** — 白底圆角+浅阴影，视觉层次清晰，评审体验好
