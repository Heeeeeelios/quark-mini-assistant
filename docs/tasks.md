# Tasks：夸克PC桌面端Mini知识助手

> 拆分规则：每个 task 对应一次 Claude Code 交互能完成的范围。
> Task 之间严格线性依赖。每个 task 完成后必须有可验证产出。

---

## Phase 1 — 骨架（P0）

### T1：项目初始化 — Electron + Vite + React

**前置依赖**：无（首个 task）

**优先级**：P0

**创建/修改文件**：
- `package.json` — 项目配置，devDependencies 含 electron、vite、@vitejs/plugin-react、typescript、concurrently、wait-on、electron-builder
- `tsconfig.json` — React 端 TS 配置（strict: true, target: ES2020, module: ESNext, jsx: react-jsx）
- `tsconfig.node.json` — Node.js 端 TS 配置（module: NodeNext）
- `vite.config.ts` — Vite 配置，React 插件，base: './'
- `electron/main.ts` — 主进程入口，创建 BrowserWindow，加载 Vite dev server
- `electron/preload.ts` — contextBridge，先暴露空对象 `{}`
- `src/main.tsx` — React 入口，`ReactDOM.createRoot`
- `src/App.tsx` — 根组件，静态渲染 "Hello Quark Mini Assistant"
- `index.html` — Vite 入口 HTML
- `.env.example` — 环境变量模板，仅一行 `DASHSCOPE_API_KEY=`

**验收标准**：
- [ ] `npm install` 无报错
- [ ] `npm run dev`（concurrently 启动 Vite + Electron）后出现桌面窗口
- [ ] 窗口尺寸 1200×800，最小 900×600
- [ ] 窗口内显示 "Hello Quark Mini Assistant"
- [ ] 窗口标题栏显示应用名称，无系统默认标题栏（frame: false）
- [ ] 控制台无红色报错

---

### T2：三栏布局骨架

**前置依赖**：T1

**优先级**：P0

**创建/修改文件**：
- 新建 `src/components/layout/AppLayout.tsx` — 左右分栏主布局
- 新建 `src/components/layout/TitleBar.tsx` — 自定义标题栏（应用名 + 最小化/关闭按钮）
- 新建 `src/styles/index.css` — 全局样式（CSS reset、布局 flex 规则、颜色变量）
- 修改 `src/App.tsx` — 使用 AppLayout + TitleBar
- 修改 `electron/main.ts` — 确认 frame: false，无边框窗口

**验收标准**：
- [ ] 窗口顶部有自定义标题栏（高度 ~32px），显示 "夸克 Mini 助手" 和关闭按钮
- [ ] 标题栏可拖拽移动窗口（`-webkit-app-region: drag`）
- [ ] 主体分为左右两栏：左侧 300px 固定宽度（标注 "文件列表"），右侧自适应（标注 "详情 & AI"）
- [ ] 占位文本使用浅灰色背景 + 居中标题，视觉上明确是骨架

---

## Phase 2 — 文件侧功能（P0）

### T3：F1 文件浏览面板 — 读取本地真实目录

**前置依赖**：T2

**优先级**：P0

**创建/修改文件**：
- 新建 `electron/services/file-reader.ts` — 递归读取目录（fs.readdir + fs.stat），限制深度2层、最多100项，文本文件读取前200行内容
- 新建 `electron/utils/file-classify.ts` — 按扩展名分类：text/code/data/image/binary
- 新建 `src/types/index.ts` — 所有 TypeScript 类型定义（FileNode、FileMeta、FileDetail、AnalysisResult、ChatMessage、ConversationContext）
- 新建 `src/utils/file-icon.ts` — 文件类型 → 图标/emoji 映射函数
- 新建 `src/utils/format.ts` — 文件大小格式化函数
- 新建 `src/components/file-tree/FileTree.tsx` — 文件树容器组件
- 新建 `src/components/file-tree/FileTreeNode.tsx` — 单行文件/文件夹节点组件
- 新建 `src/store/index.ts` — Zustand store，含 fileTree、selectedFileId、selectedDirectory、actions
- 修改 `electron/preload.ts` — 暴露 `selectDirectory()` 和 `checkApiKey()`
- 修改 `electron/main.ts` — 注册 `select-directory` IPC handler（dialog.showOpenDialog + file-reader）
- 修改 `src/components/layout/AppLayout.tsx` — 左侧顶部显示"选择文件夹"按钮 + 文件树

**验收标准**：
- [ ] 应用启动后左侧显示"选择文件夹"按钮
- [ ] 点击按钮弹出系统目录选择对话框
- [ ] 选择目录后文件树渲染完成，显示真实的文件夹和文件
- [ ] 文件夹可展开/收起（点击展开图标或文件夹名）
- [ ] 文件图标根据类型不同显示不同 emoji（📄 📕 📊 🖼️ 📦）
- [ ] 深度超过2层的子目录不显示或显示截断提示
- [ ] 超过100个文件时显示截断提示
- [ ] 文本文件节点已携带 content 字段（前200行）
- [ ] 控制台无类型错误

---

### T4：F2 文件详情面板

**前置依赖**：T3

**优先级**：P0

**创建/修改文件**：
- 新建 `src/components/file-detail/FileDetail.tsx` — 文件详情组件（展示元信息 + 文本预览）
- 新建 `src/components/shared/EmptyState.tsx` — 空状态组件
- 修改 `src/store/index.ts` — 新增 `selectFile` action 和 `selectedFile` 派生逻辑
- 修改 `src/components/file-tree/FileTreeNode.tsx` — 点击文件调用 `selectFile(fileId)`
- 修改 `electron/preload.ts` — 暴露 `getFileMeta()`
- 修改 `electron/main.ts` — 注册 `get-file-meta` IPC handler
- 修改 `src/components/layout/AppLayout.tsx` — 右侧顶部使用 FileDetail 组件

**验收标准**：
- [ ] 未选择目录时右侧显示空状态："请先选择一个文件夹以浏览文件"
- [ ] 未选中文件时显示空状态："请在左侧选择一个文件"
- [ ] 点击文件节点后，该节点高亮（背景色变化）
- [ ] 右侧面板立即展示：文件名、类型、大小（如 "2.3 MB"）、修改时间（如 "2026-06-10 14:30"）
- [ ] 文本文件显示内容预览（前200行），带滚动条，等宽字体
- [ ] 非文本文件显示 "该文件类型暂不支持内容预览" 提示
- [ ] 点击另一个文件，详情面板内容切换
- [ ] 点击文件夹不触发详情更新

---

## Phase 3 — AI 核心链路（P0）

### T5：DashScope API 封装层（Tool-Use 模式，含 Mock 降级）

**前置依赖**：T3（需要已缓存的文件数据供工具调用）

**优先级**：P0

**创建/修改文件**：
- 新建 `electron/config/env.ts` — 读取 .env 环境变量，验证 DASHSCOPE_API_KEY
- 新建 `electron/services/ai-service.ts` — AIService 类，**采用 Tool-Use 模式**：
  - 定义 3 个 function tools：`read_file`、`list_files`、`search_content`
  - `analyzeWithTools()` — 模型先调用 read_file 获取内容，再生成分析
  - `chatStreamWithTools()` — 模型可自主调用工具，最终流式返回回答
  - `executeReadFile()` / `executeListFiles()` / `executeSearch()` — 工具执行（主进程内）
  - `analyzeWithManualPrompt()` / `chatStreamManual()` — 降级方法（不支持 function calling）
  - `checkFunctionCallingSupport()` — 检测模型是否支持 function calling
- 新建 `electron/services/mock-analysis.ts` — Mock 分析结果数据（API降级用）
- 修改 `electron/preload.ts` — 暴露 `analyzeFile()`、`chatCompletion()`、`onChatChunk()`、`onChatDone()`
- 修改 `electron/main.ts` — 注册 `check-api-key`、`analyze-file`、`chat-completion` IPC handlers
- 修改 `electron/main.ts` — 启动时验证 API Key，发送状态到渲染进程
- 修改 `electron/services/file-reader.ts` — 确保已缓存文件路径映射（供工具执行时查找文件内容）

**验收标准**：
- [ ] `.env` 中配置有效 API Key 后，`window.api.checkApiKey()` 返回 `{ configured: true }`
- [ ] `.env` 中无 Key 时返回 `{ configured: false }`，应用不崩溃
- [ ] 调用 `window.api.analyzeFile(fileId)` 时，API 请求体中包含 `tools` 字段（3个工具定义）
- [ ] 模型调用 `read_file` 工具后，主进程返回文件内容，模型基于内容生成分析结果
- [ ] 对非文本文件调用 `analyzeFile` 返回 "该文件类型暂不支持AI分析"
- [ ] 关闭网络后调用 `analyzeFile`，自动降级为 Mock 响应（不报错）
- [ ] `chatCompletion` 发起请求后，模型可自主决定调用工具（工具调用对渲染进程透明）
- [ ] `onChatChunk` 回调能收到最终回答的文本片段

---

### T6：F3 AI 文件分析

**前置依赖**：T5、T4

**优先级**：P0

**创建/修改文件**：
- 新建 `src/components/shared/LoadingSpinner.tsx` — Loading 动画组件
- 新建 `src/components/ai-panel/AIPanel.tsx` — AI 面板容器（含分析结果+对话区域占位）
- 新建 `src/components/ai-panel/AnalysisResult.tsx` — 分析结果渲染（摘要 + 关键信息列表）
- 新建 `src/hooks/useAnalyze.ts` — AI 分析逻辑封装（触发→loading→结果→缓存）
- 修改 `src/store/index.ts` — 新增 analysisCache、isAnalyzing、setAnalysisResult、setAnalyzing
- 修改 `src/components/layout/AppLayout.tsx` — 右侧使用 AIPanel

**验收标准**：
- [ ] 选中文件后，AI 面板显示 "AI 分析" 按钮
- [ ] 点击按钮后显示 loading spinner
- [ ] 分析完成后展示：摘要（200字以内）+ 关键信息（3-5条 bullet）
- [ ] 标注 "AI 分析耗时 Xs"
- [ ] 同一文件重复点击按钮，不重新请求，直接展示缓存结果
- [ ] API 失败时展示 Mock 结果 + toast 提示（toast 可用浏览器 alert 临时替代）

---

### T7：F4 AI 对话问答

**前置依赖**：T6

**优先级**：P0

**创建/修改文件**：
- 新建 `src/components/ai-panel/ChatInput.tsx` — 对话输入框（textarea + 发送按钮）
- 新建 `src/components/ai-panel/ChatMessages.tsx` — 对话消息列表容器
- 新建 `src/components/ai-panel/MessageBubble.tsx` — 单条消息气泡（用户右蓝/AI左灰）
- 修改 `src/store/index.ts` — 新增 conversation、startConversation、addUserMessage、appendAssistantChunk、finishAssistantMessage
- 修改 `src/components/ai-panel/AIPanel.tsx` — 分析结果下方嵌入 ChatInput + ChatMessages
- 修改 `src/hooks/useAnalyze.ts` — 分析完成后自动初始化 conversation

**验收标准**：
- [ ] AI 分析结果下方显示对话输入框，placeholder 为 "关于这个文件，你想问什么？"
- [ ] 输入文字后点击发送，用户消息气泡立即出现在右侧（蓝色）
- [ ] AI 响应以打字机效果出现在左侧（灰色），逐字显示
- [ ] 发送第二条消息时，第一条对话历史仍在
- [ ] 输入框为空时发送按钮禁用（disabled + 灰色）
- [ ] 切换到另一个文件后，对话内容清空
- [ ] API 失败时展示错误提示，不影响已有对话历史

**P1 子目标（不阻塞核心链路，完成后显著提升展示效果）**：

- [ ] **T7-A：引用标注 + 文件片段高亮**
  - AI 回答中对引用文件内容的段落添加 `[引用: 文件名]` 标注
  - 前端在 AI 气泡内识别引用标注，高亮对应文件片段（可通过点击引用跳转到详情面板中对应位置，或在下方面板展示原文片段）
  - 需要 AI prompt 中要求返回引用标记（system prompt 追加 "引用文件内容时标注 [引用: 原文片段]"）
  - Mock 模式也返回预设的引用标注
- [ ] **T7-B：Prompt 调试面板**
  - 在 AI 面板右上角添加 "调试" 按钮（齿轮图标或 `[Debug]` 文字）
  - 点击展开可折叠面板，展示发送给 DashScope API 的完整请求体 JSON（model、messages、temperature、stream 等字段）
  - 每次对话请求的请求体追加展示，带时间戳
  - 生产模式（无 API Key 时）自动隐藏该面板
  - 需要在 IPC 层透传请求体数据（`onChatDebug` event 或在分析结果中附带）

---

## Phase 4 — 体验完善（P1）

### T8：错误处理和 Loading 状态

**前置依赖**：T7

**优先级**：P1

**创建/修改文件**：
- 新建 `src/components/shared/ErrorFallback.tsx` — Error Boundary 兜底组件
- 新建 `src/utils/error.ts` — 统一错误消息映射（API 错误 → 用户友好文案）
- 修改 `src/App.tsx` — 包裹 ErrorBoundary
- 修改 `src/components/ai-panel/MessageBubble.tsx` — error 状态消息气泡变红
- 修改 `src/components/ai-panel/ChatInput.tsx` — 发送中禁用输入框
- 修改 `electron/services/ai-service.ts` — 完善超时、重试、错误分类

**验收标准**：
- [ ] 无 API Key 时启动出现 toast 提示 "已切换至演示模式"
- [ ] API 超时后展示友好提示（不暴露 HTTP 状态码）
- [ ] React 组件报错时不白屏，展示 ErrorFallback + "重新加载" 按钮
- [ ] 发送消息时输入框禁用，防止重复发送
- [ ] 网络断开时对话不崩溃，展示错误气泡

---

### T9：交互增强 — 键盘快捷键

**前置依赖**：T8

**优先级**：P1

**创建/修改文件**：
- 修改 `src/components/ai-panel/ChatInput.tsx` — Enter 发送，Shift+Enter 换行
- 修改 `src/components/file-tree/FileTreeNode.tsx` — 键盘上下键浏览文件列表
- 修改 `electron/main.ts` — 注册 CmdOrCtrl+R 刷新（开发模式），禁用 CmdOrCtrl+Shift+I（可选）

**验收标准**：
- [ ] 输入框中按 Enter 发送消息（与点击发送按钮效果一致）
- [ ] Shift+Enter 在输入框中插入换行
- [ ] 上下键可切换文件树中选中项（视觉反馈）

---

### T10：UI 视觉打磨

**前置依赖**：T9

**优先级**：P1

**创建/修改文件**：
- 修改 `src/styles/index.css` — 全局颜色方案、字体、间距统一
- 修改 `src/components/layout/TitleBar.tsx` — 标题栏视觉优化（夸克品牌色）
- 修改所有组件样式 — 统一圆角、阴影、hover 效果
- 可选：新增 `src/components/shared/Toast.tsx` — 轻量 toast 提示组件

**验收标准**：
- [ ] 整体视觉风格统一（颜色、圆角、间距一致）
- [ ] 标题栏使用夸克品牌色（橙色 #FF6B00 或近似）
- [ ] hover 状态有视觉反馈（文件行、按钮）
- [ ] 消息气泡圆角合理，区分用户/AI 的左右布局清晰
- [ ] 无突兀的样式问题（文字溢出、重叠等）

---

## Phase 5 — 收尾（P0）

### T11：Electron 打包配置

**前置依赖**：T10

**优先级**：P0

**创建/修改文件**：
- 新建 `electron-builder.json` — 打包配置（appId、productName、files、extraResources、asar）
- 修改 `package.json` — 新增 `build` 脚本（`electron-builder`）、main 字段指向编译后的 main.js
- 修改 `vite.config.ts` — 生产模式输出配置
- 修改 `electron/main.ts` — 生产模式加载 `join(__dirname, '../dist/index.html')`
- 新增 `.gitignore` — 排除 node_modules、dist、release、.env

**验收标准**：
- [ ] `npm run build` 成功执行，无报错
- [ ] 在 `release/` 或 `dist/` 目录下生成可执行文件（.exe / .app / 可执行二进制）
- [ ] 安装包体积 < 150MB
- [ ] 双击安装包完成安装（或解压即用 portable 模式）

---

### T12：打包产物验证

**前置依赖**：T11

**优先级**：P0

**创建/修改文件**：
- 无新建文件，纯验证操作

**验收标准**：
- [ ] 在打包产物所在机器上运行应用，能正常启动
- [ ] 文件树正常显示（Mock 数据随 asar 打包）
- [ ] 配置 `.env` 后 AI 分析功能正常工作
- [ ] 无 `.env` 时自动降级为 Mock，不白屏
- [ ] 无控制台红色报错

---

### T13：README 编写

**前置依赖**：T12

**优先级**：P0

**创建/修改文件**：
- 新建 `README.md` — 项目介绍

**README 内容要求**：
- 项目一句话描述
- 功能特性列表
- 技术栈
- 快速开始（clone → install → dev）
- 环境变量配置
- 打包说明
- 项目结构概览
- OpenSpec 文档链接

**验收标准**：
- [ ] 按 README 步骤执行能成功启动开发服务器
- [ ] 按 README 步骤执行能成功打包

---

### T14：DEVLOG 整理和格式化

**前置依赖**：T13

**优先级**：P0

**创建/修改文件**：
- 修改 `devlog/DEVLOG.md` — 整理已有记录，确保格式一致、无冗余

**验收标准**：
- [ ] 每个阶段记录完整（Prompt摘要、执行过程、遇到的问题、决策记录、待确认项）
- [ ] 时间戳按时间顺序排列
- [ ] 格式统一（标题层级、加粗、列表风格一致）
- [ ] 所有待确认项都已关闭（标注已决策）
