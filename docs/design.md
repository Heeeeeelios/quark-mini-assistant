# Design：夸克PC桌面端Mini知识助手

## 1. 系统架构

### 1.1 分层架构

```
┌─────────────────────────────────────────────────────┐
│                  渲染进程 (React UI)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ F1 文件树 │  │ F2 详情  │  │ F3/F4 AI │  Zustand  │
│  │  面板     │  │  面板    │  │ 面板+对话 │  Store    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       │              │              │                 │
│  ┌────┴──────────────┴──────────────┴─────┐          │
│  │           preload (contextBridge)       │          │
│  │  window.api.analyzeFile()               │          │
│  │  window.api.chatCompletion()            │          │
│  │  window.api.checkApiKey()               │          │
│  └────────────────────┬───────────────────┘          │
├───────────────────────┼─────────────────────────────┤
│                  主进程 (Node.js)                     │
│  ┌───────────────────┴───────────────────┐          │
│  │          IPC Handler Layer             │          │
│  │  • analyze-file → AIService           │          │
│  │  • chat-completion → AIService        │          │
│  │  • check-api-key → EnvConfig          │          │
│  └───────────────────┬───────────────────┘          │
│                      │                               │
│  ┌──────────────┐    │    ┌──────────────────┐      │
│  │ MockDataService│    │    │   AIService       │      │
│  │ (本地Mock文件) │    │    │ (DashScope HTTP) │      │
│  └──────────────┘    │    └────────┬─────────┘      │
│                      │             │                 │
│  ┌──────────────┐    │    ┌────────┴─────────┐      │
│  │ 本地文件系统  │    │    │ 外部: DashScope   │      │
│  │ (Mock JSON)  │    │    │ HTTP API (SSE)   │      │
│  └──────────────┘    │    └──────────────────┘      │
└──────────────────────┼─────────────────────────────┘
                       │
              ┌────────┴────────┐
              │   外部服务       │
              │ DashScope API   │
              └─────────────────┘
```

### 1.2 职责边界

| 层 | 职责 | 不做什么 |
|----|------|----------|
| **渲染进程 (React)** | UI渲染、用户交互、状态管理、流式响应展示 | 不直接发起HTTP请求、不读文件系统、不碰API Key |
| **preload (contextBridge)** | 安全的IPC桥接，将主进程能力暴露为 `window.api.*` | 不做业务逻辑、不存储状态 |
| **主进程 (Node.js)** | IPC路由、环境变量读取、HTTP请求（AI API）、Mock数据读取、窗口管理 | 不做UI逻辑、不直接操作React状态 |

**决策**：所有网络请求和文件系统操作在主进程完成，渲染进程通过IPC调用。
**理由**：Electron安全最佳实践（contextIsolation + sandbox），API Key 永不暴露给渲染进程。
**放弃**：渲染进程直接 fetch AI API 的简化方案 —— 虽然少一层IPC，但会暴露 Key，不符合安全规范。

### 1.3 数据流（按功能）

#### F1 文件浏览面板
```
用户操作：点击"选择文件夹"按钮 → 选择本地目录
  → React 调用 window.api.selectDirectory() [IPC invoke]
  → 主进程弹出系统目录选择对话框（dialog.showOpenDialog）
  → 用户确认选择
  → 主进程递归读取目录（fs.readdir + fs.stat，深度≤2，≤100项）
  → 文本文件读取前200行内容（fs.readFile + encoding: 'utf-8'）
  → 非文本文件只读取元信息
  → 返回 FileNode[] 数组
  → Zustand store 更新 fileTree + selectedDirectory
  → React 重新渲染文件树
```

#### F2 文件详情面板
```
用户操作：点击文件节点
  → React onClick 回调
  → 如果是文本文件，content 已在 F1 阶段读取，直接使用
  → 如果是非文本文件，调用 window.api.getFileContent(fileId) [IPC invoke]
     → 主进程读取文件元信息（fs.stat），不读取内容
  → Zustand store 设置 selectedFileId
  → store 派生 selectedFile (useMemo)
  → React 自动渲染详情面板（文本预览或"不支持预览"提示）
```

#### F3 AI文件分析
```
用户操作：点击「AI分析」按钮
  → Zustand action: triggerAnalyze(fileId)
  → window.api.analyzeFile(fileId) [IPC invoke]
  → 主进程 AIService.analyzeFile(fileId)：
      1. 检查模型是否支持 function calling
      2a. [支持] 发送 system prompt + user 请求 + tools 定义
          → 模型调用 read_file 工具 → 主进程执行工具 → 返回文件内容
          → 模型基于文件内容生成分析 → 返回 AnalysisResult
      2b. [不支持] 降级为手动拼接：直接发送文件内容到 prompt
      3. 失败 → 走降级链路（Mock → 静态兜底）
  → 渲染进程接收结果
  → Zustand store 缓存 analysisResult
  → React 渲染分析结果面板
```

#### F4 AI对话问答
```
用户操作：输入消息 → 点击发送
  → Zustand action: sendMessage(text)
  → 用户消息立即加入 messages 数组（乐观更新）
  → window.api.chatCompletion(messages, fileId) [IPC invoke]
  → 主进程 AIService.chatStream()：
      1. 构造请求（system prompt 含文件摘要 + tools 定义）
      2. 发起 API 请求（非流式，先获取工具调用决策）
      3a. [需要工具] 执行工具调用 → 将工具结果加入消息 → 再发起流式请求获取最终回答
      3b. [不需要工具] 直接流式请求获取回答
      4. 逐 chunk 通过 IPC event 推送给渲染进程
  → 渲染进程监听 onChunk：
      → 追加到当前 AI 消息的 content
      → React 流式渲染（打字机效果）
  → 流结束 → Zustand 标记消息 complete
```

#### F5 应用框架
```
应用启动：
  → 主进程读取 .env (dotenv)
  → 验证 DASHSCOPE_API_KEY 是否存在
  → 创建 BrowserWindow (1200×800)
  → 加载 Vite dev server (开发) 或 index.html (生产)
  → preload 脚本注入 window.api
  → 渲染进程 window.api.checkApiKey() 获取 Key 状态
  → 根据状态展示 toast 提示
```

---

## 2. 目录结构

```
quark-mini-assistant/
├── CLAUDE.md                 # 项目指令
├── docs/                     # OpenSpec 文档
├── devlog/                   # 开发日志
├── package.json              # 项目配置
├── tsconfig.json             # TypeScript 配置
├── tsconfig.node.json        # Node.js 端 TS 配置
├── vite.config.ts            # Vite 构建配置
├── .env                      # 环境变量（.gitignore）
├── .env.example              # 环境变量模板
├── .gitignore
├── electron-builder.json     # 打包配置
│
├── electron/                 # Electron 主进程代码
│   ├── main.ts               # 入口：窗口创建、IPC注册、生命周期
│   ├── preload.ts            # contextBridge：安全暴露 IPC 方法
│   ├── ipc/                  # IPC handler 按功能分组
│   │   ├── file-handlers.ts  # F1/F2：文件树读取、文件详情
│   │   └── ai-handlers.ts    # F3/F4：AI分析、对话流式响应
│   ├── services/             # 业务服务层（纯逻辑，无Electron依赖）
│   │   ├── ai-service.ts     # DashScope API 调用封装
│   │   └── file-reader.ts    # 本地文件系统读取（递归目录+内容读取）
│   └── config/
│       └── env.ts            # 环境变量读取与验证
│
├── src/                      # 渲染进程（React 前端）
│   ├── main.tsx              # React 入口
│   ├── App.tsx               # 根组件（布局 + ErrorBoundary）
│   ├── types/                # 全局 TypeScript 类型定义
│   │   └── index.ts          # 所有类型导出
│   ├── store/                # Zustand 状态管理
│   │   └── index.ts          # store 定义
│   ├── api/                  # IPC 调用封装（渲染进程侧）
│   │   └── index.ts          # window.api 的类型安全包装
│   ├── components/           # UI 组件（按功能模块组织）
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx       # 左右分栏主布局
│   │   │   └── TitleBar.tsx        # 自定义标题栏
│   │   ├── file-tree/
│   │   │   ├── FileTree.tsx        # 文件树容器
│   │   │   └── FileTreeNode.tsx    # 单行文件/文件夹节点
│   │   ├── file-detail/
│   │   │   └── FileDetail.tsx      # 文件信息展示
│   │   ├── ai-panel/
│   │   │   ├── AIPanel.tsx         # AI分析结果容器
│   │   │   ├── AnalysisResult.tsx  # 分析结果渲染
│   │   │   ├── ChatInput.tsx       # 对话输入框
│   │   │   ├── ChatMessages.tsx    # 对话消息列表
│   │   │   └── MessageBubble.tsx   # 单条消息气泡
│   │   └── shared/
│   │       ├── EmptyState.tsx      # 空状态组件
│   │       ├── LoadingSpinner.tsx  # Loading 动画
│   │       └── ErrorFallback.tsx   # Error Boundary 兜底
│   ├── hooks/                # 自定义 React Hooks
│   │   └── useAnalyze.ts     # AI分析逻辑封装
│   ├── utils/                # 纯函数工具
│   │   ├── format.ts         # 文件大小格式化
│   │   └── file-icon.ts      # 文件类型→图标映射
│   └── styles/               # 全局样式
│       └── index.css         # 基础重置 + 变量
```

**组织策略决策**：`src/components/` 按**功能模块**而非文件类型分目录。
**理由**：按功能模块（file-tree/、ai-panel/）组织，新增功能时只需在一个目录下工作，减少跨目录跳转。按类型（components/、hooks/、utils/）分会导致一个功能散落在多个目录。
**放弃**：按类型分目录的方案 —— 对小型项目来说，功能模块目录更易定位代码。

---

## 3. IPC 接口定义

所有 IPC 接口定义在 `preload.ts`，通过 `contextBridge.exposeInMainWorld` 暴露为 `window.api.*`。

### 3.1 类型声明（渲染进程可见）

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // F5: 检查API Key是否配置
  checkApiKey: (): Promise<{ configured: boolean }> =>
    ipcRenderer.invoke('check-api-key'),

  // F1: 选择目录并返回文件树
  selectDirectory: (): Promise<FileNode[] | null> =>
    ipcRenderer.invoke('select-directory'),

  // F2: 获取非文本文件的元信息（文本文件内容已在 selectDirectory 时读取）
  getFileMeta: (fileId: string): Promise<FileMeta | null> =>
    ipcRenderer.invoke('get-file-meta', fileId),

  // F3: AI文件分析（非流式，一次性返回）
  analyzeFile: (fileId: string): Promise<AnalysisResult> =>
    ipcRenderer.invoke('analyze-file', fileId),

  // F4: AI对话（流式，通过event推送chunk）
  chatCompletion: (messages: ChatMessage[], fileId: string): Promise<void> =>
    ipcRenderer.invoke('chat-completion', { messages, fileId }),

  // F4: 监听流式chunk（渲染进程侧）
  onChatChunk: (callback: (chunk: string) => void) => {
    const listener = (_event: any, chunk: string) => callback(chunk);
    ipcRenderer.on('chat-chunk', listener);
    return () => ipcRenderer.removeListener('chat-chunk', listener);
  },

  // F4: 监听流式结束
  onChatDone: (callback: (error?: string) => void) => {
    const listener = (_event: any, error?: string) => callback(error);
    ipcRenderer.on('chat-done', listener);
    return () => ipcRenderer.removeListener('chat-done', listener);
  },
});
```

### 3.2 IPC 接口清单

| 功能 | 方向 | 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|------|------|
| F5 | 渲染→主 | `check-api-key` | 无 | `{ configured: boolean }` | 启动时检查Key状态 |
| F1 | 渲染→主 | `select-directory` | 无 | `FileNode[] \| null` | 弹出系统对话框+读取目录 |
| F2 | 渲染→主 | `get-file-meta` | `fileId: string` | `FileMeta \| null` | 获取非文本文件元信息 |
| F3 | 渲染→主 | `analyze-file` | `fileId: string` | `AnalysisResult` | AI分析（非流式） |
| F4 | 渲染→主 | `chat-completion` | `{ messages, fileId }` | `void` | 发起流式对话 |
| F4 | 主→渲染 | `chat-chunk` (event) | `chunk: string` | — | 流式文本推送 |
| F4 | 主→渲染 | `chat-done` (event) | `error?: string` | — | 流结束通知 |

---

## 4. 数据模型

### 4.1 文件节点类型定义（从真实文件系统读取）

```typescript
// FileNode — 主进程通过 fs.readdir + fs.stat 递归读取生成
interface FileNode {
  id: string;              // 自动生成：文件绝对路径的 hash，如 "sha256(/path/to/file)"
  name: string;            // 文件名（不含路径）
  type: 'folder' | 'file'; // 节点类型
  path: string;            // 绝对路径（主进程持有，不暴露给渲染进程）
  children?: FileNode[];   // 子节点（仅 folder 有）
  depth: number;           // 目录深度（从选择的根目录算起，0起始）
  // 仅 file 有
  ext?: string;            // 扩展名（如 ".ts"，小写）
  fileType: 'text' | 'code' | 'data' | 'binary' | 'image'; // 文件分类
  sizeBytes: number;       // 文件大小
  modifiedAt: string;      // ISO 8601 日期
  content?: string;        // 仅文本文件有，前200行内容
  contentTruncated?: boolean; // content 是否被截断
}

// 非文本文件的元信息（F2 懒加载）
interface FileMeta {
  id: string;
  name: string;
  ext: string;
  fileType: 'binary' | 'image';
  sizeBytes: number;
  modifiedAt: string;
}
```

**文件分类规则**（按扩展名）：
- `text`: `.txt` `.md`
- `code`: `.json` `.js` `.ts` `.py`
- `data`: `.csv`
- `image`: `.png` `.jpg` `.jpeg` `.gif` `.svg`
- `binary`: 其他（`.pdf` `.xlsx` `.docx` `.zip` 等）

文本文件和代码文件读取内容（前200行），其他分类只读取元信息。

### 4.2 TypeScript 类型定义

```typescript
// src/types/index.ts

// ---- 文件相关 ----
interface FileNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  path: string;            // 绝对路径（仅主进程持有）
  children?: FileNode[];
  depth: number;
  ext?: string;
  fileType: 'text' | 'code' | 'data' | 'binary' | 'image';
  sizeBytes: number;
  modifiedAt: string;
  content?: string;        // 仅文本文件
  contentTruncated?: boolean;
}

interface FileMeta {
  id: string;
  name: string;
  ext: string;
  fileType: 'binary' | 'image';
  sizeBytes: number;
  modifiedAt: string;
}

interface FileDetail {
  id: string;
  name: string;
  fileType: string;
  ext: string;
  sizeFormatted: string;  // "2.3 MB"
  modifiedAt: string;     // "2026-06-10 14:30"
  content?: string;       // 文本预览
  contentTruncated?: boolean;
  hasContent: boolean;    // 是否可读内容
}

// ---- AI分析结果 ----
interface AnalysisResult {
  summary: string;       // 200字以内摘要
  keyPoints: string[];   // 3-5条要点
  analysisTimeMs: number; // 分析耗时（真实或Mock）
  source: 'api' | 'mock' | 'fallback'; // 数据来源标记（不展示给用户）
}

// ---- 对话相关 ----
interface ChatMessage {
  id: string;            // 前端生成的UUID
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;     // Date.now()
  status: 'sending' | 'streaming' | 'done' | 'error';
}

interface ConversationContext {
  fileId: string;        // 关联的文件ID
  fileSummary: string;   // 文件摘要（注入system prompt）
  messages: ChatMessage[]; // 对话历史（不含system）
}
```

### 4.3 对话上下文内存结构

```
Zustand Store:
{
  conversation: {
    fileId: "file-doc-1",
    fileSummary: "Q2季度报告显示用户增长15%...",
    messages: [
      { id: "u1", role: "user", content: "这份报告的核心结论是什么？", status: "done", ... },
      { id: "a1", role: "assistant", content: "核心结论有三：...", status: "done", ... },
      { id: "u2", role: "user", content: "用户增长数据来源？", status: "done", ... },
      { id: "a2", role: "assistant", content: "", status: "streaming", ... }, // 正在流式输出
    ]
  }
}

切换文件时：conversation 整体替换为新的空结构
```

---

## 5. 前端状态管理

### 5.1 方案选择

**选择：Zustand**
**理由**：
- API极简（`create()` 一个函数），无 boilerplate，比 Redux 轻量得多
- 原生 TypeScript 支持，类型推断优于 Context
- 支持 selector 细粒度更新，避免 Context 的全局重渲染问题
- 体积仅 ~1KB，对打包产物几乎无影响
**放弃**：
- Redux Toolkit —— 对Mini Demo来说过重，slice/action/reducer模板代码太多
- React Context —— 多状态源时需要嵌套Provider，且无法做细粒度更新
- Jotai —— atom模型适合简单场景，但本项目有结构化store（文件树+分析结果+对话），Zustand的集中式store更清晰

### 5.2 Store 结构

```typescript
// src/store/index.ts
import { create } from 'zustand';

interface AppState {
  // ---- 文件相关 ----
  fileTree: FileNode[];
  selectedFileId: string | null;
  analysisCache: Record<string, AnalysisResult>; // fileId → 分析结果
  isApiAvailable: boolean;

  // ---- 对话相关 ----
  conversation: ConversationContext | null;

  // ---- UI状态 ----
  isAnalyzing: boolean;
  isChatLoading: boolean;

  // ---- Actions ----
  setFileTree: (tree: FileNode[]) => void;
  selectFile: (fileId: string) => void;
  setAnalysisResult: (fileId: string, result: AnalysisResult) => void;
  setApiAvailability: (available: boolean) => void;
  startConversation: (fileId: string, fileSummary: string) => void;
  clearConversation: () => void;
  addUserMessage: (content: string) => void;
  appendAssistantChunk: (chunk: string) => void;
  finishAssistantMessage: (error?: string) => void;
  setAnalyzing: (loading: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  // 初始状态
  fileTree: [],
  selectedFileId: null,
  analysisCache: {},
  isApiAvailable: true,
  conversation: null,
  isAnalyzing: false,
  isChatLoading: false,

  // Actions
  setFileTree: (tree) => set({ fileTree: tree }),
  selectFile: (fileId) => set((state) => {
    const isSameFile = state.selectedFileId === fileId;
    return {
      selectedFileId: fileId,
      // 切换文件时清空对话
      conversation: isSameFile ? state.conversation : null,
    };
  }),
  setAnalysisResult: (fileId, result) => set((state) => ({
    analysisCache: { ...state.analysisCache, [fileId]: result },
  })),
  setApiAvailability: (available) => set({ isApiAvailable: available }),
  startConversation: (fileId, fileSummary) => set({
    conversation: { fileId, fileSummary, messages: [] },
  }),
  clearConversation: () => set({ conversation: null }),
  addUserMessage: (content) => set((state) => {
    if (!state.conversation) return state;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'done',
    };
    return {
      conversation: {
        ...state.conversation,
        messages: [...state.conversation.messages, userMsg],
      },
    };
  }),
  appendAssistantChunk: (chunk) => set((state) => {
    if (!state.conversation) return state;
    const msgs = [...state.conversation.messages];
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg?.role === 'assistant' && lastMsg.status === 'streaming') {
      lastMsg.content += chunk;
    } else {
      msgs.push({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: chunk,
        timestamp: Date.now(),
        status: 'streaming',
      });
    }
    return { conversation: { ...state.conversation, messages: msgs } };
  }),
  finishAssistantMessage: (error) => set((state) => {
    if (!state.conversation) return state;
    const msgs = state.conversation.messages.map((m) =>
      m.role === 'assistant' && m.status === 'streaming'
        ? { ...m, status: error ? 'error' as const : 'done' as const }
        : m
    );
    return { conversation: { ...state.conversation, messages: msgs } };
  }),
  setAnalyzing: (loading) => set({ isAnalyzing: loading }),
}));
```

---

## 6. AI 对接层设计

### 6.1 Tool-Use 模式（Function Calling）

**核心思路**：不再手动拼接文件内容到 prompt，而是定义工具列表，让模型自主决定何时调用哪个工具。参考 MCP（Model Context Protocol）理念——让模型主动选择工具而非被动接收上下文。

#### 定义 3 个 Function Tools

```typescript
// electron/services/ai-service.ts — 工具定义

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description: '读取指定文件的内容。当用户需要了解某个文件的具体内容时调用。',
      parameters: {
        type: 'object',
        properties: {
          file_id: { type: 'string', description: '文件的唯一标识（id字段）' },
          max_lines: { type: 'number', description: '最多读取的行数，默认200' },
        },
        required: ['file_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_files',
      description: '列出当前目录下的文件和文件夹。当用户想了解目录结构时调用。',
      parameters: {
        type: 'object',
        properties: {
          folder_id: { type: 'string', description: '文件夹的唯一标识（id字段），为空则列根目录' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_content',
      description: '在已加载的文件内容中搜索关键词。当用户提到"查找""搜索"或提到文件中可能存在的特定内容时调用。',
      parameters: {
        type: 'object',
        properties: {
          file_id: { type: 'string', description: '要搜索的文件id' },
          keyword: { type: 'string', description: '搜索关键词' },
        },
        required: ['file_id', 'keyword'],
      },
    },
  },
];
```

#### AIService 类设计

```typescript
// electron/services/ai-service.ts

class AIService {
  private apiKey: string;
  private model: string;
  private fileCache: Map<string, FileNode>; // fileId → FileNode（由主进程注入）
  private supportsFunctionCalling: boolean; // 启动时检测

  constructor(apiKey: string, model = DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
    this.fileCache = new Map();
    this.supportsFunctionCalling = this.checkFunctionCallingSupport();
  }

  // ---- F3: 文件分析 ----

  async analyzeFile(fileId: string): Promise<AnalysisResult> {
    if (this.supportsFunctionCalling) {
      return this.analyzeWithTools(fileId);
    }
    // 降级：手动拼接
    return this.analyzeWithManualPrompt(fileId);
  }

  // Tool-Use 模式：模型先调用 read_file 获取内容，再生成分析
  private async analyzeWithTools(fileId: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: '你是一个文件知识助手。你可以使用工具来读取文件内容。' },
      { role: 'user', content: '请分析这个文件的内容，给出摘要和关键信息。' },
    ];

    const response = await this.callAPI({ messages, tools: TOOLS });

    // 如果模型决定调用工具
    if (response.tool_calls) {
      for (const toolCall of response.tool_calls) {
        if (toolCall.function.name === 'read_file') {
          const args = JSON.parse(toolCall.function.arguments);
          const content = this.executeReadFile(args.file_id, args.max_lines ?? 200);

          messages.push(response); // assistant 的 tool_call 响应
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: content ?? '无法读取该文件内容',
          });
        }
      }

      // 再次调用获取分析结果（不再次传 tools）
      const finalResponse = await this.callAPI({ messages });
      return this.parseAnalysisResponse(finalResponse.content ?? '');
    }

    // 模型直接返回分析（无需工具）
    return this.parseAnalysisResponse(response.content ?? '');

    // 统一计算耗时
    const result = /* ...上述分析结果... */;
    result.analysisTimeMs = Date.now() - startTime;
    return result;
  }

  // ---- F4: 对话问答（流式） ----

  async *chatStream(
    messages: ChatMessage[],
    fileId: string,
    fileSummary: string,
  ): AsyncGenerator<string> {
    if (this.supportsFunctionCalling) {
      yield* this.chatStreamWithTools(messages, fileId, fileSummary);
    } else {
      yield* this.chatStreamManual(messages, fileId, fileSummary);
    }
  }

  // Tool-Use 流式对话：支持模型在对话中自主调用工具
  private async *chatStreamWithTools(
    messages: ChatMessage[],
    fileId: string,
    fileSummary: string,
  ): AsyncGenerator<string> {
    const systemMsg: ChatCompletionMessageParam = {
      role: 'system',
      content: `你是一个文件知识助手。你可以使用工具来读取和搜索文件内容。当前分析的文件摘要：${fileSummary}`,
    };

    const apiMessages: ChatCompletionMessageParam[] = [
      systemMsg,
      ...messages.map((m) => ({ role: m.role, content: m.content } as ChatCompletionMessageParam)),
    ];

    const response = await this.callAPI({ messages: apiMessages, tools: TOOLS, stream: false });

    // 处理工具调用
    if (response.tool_calls) {
      for (const toolCall of response.tool_calls) {
        const result = this.executeToolCall(toolCall);
        apiMessages.push(response);
        apiMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // 获取最终回答（流式）
      yield* this.getFinalStream(apiMessages);
    } else {
      // 直接流式返回
      yield* this.streamContent(response.content ?? '');
    }
  }

  // ---- 工具执行（在主进程中执行） ----

  private executeToolCall(toolCall: ToolCall): string {
    switch (toolCall.function.name) {
      case 'read_file': {
        const args = JSON.parse(toolCall.function.arguments);
        return this.executeReadFile(args.file_id, args.max_lines ?? 200)
          ?? '无法读取该文件内容';
      }
      case 'list_files': {
        const args = JSON.parse(toolCall.function.arguments);
        return this.executeListFiles(args.folder_id);
      }
      case 'search_content': {
        const args = JSON.parse(toolCall.function.arguments);
        return this.executeSearch(args.file_id, args.keyword);
      }
      default:
        return `未知工具: ${toolCall.function.name}`;
    }
  }

  private executeReadFile(fileId: string, maxLines = 200): string | null {
    const node = this.fileCache.get(fileId);
    if (!node?.content) return null;
    const lines = node.content.split('\n');
    const truncated = lines.slice(0, maxLines);
    const result = truncated.join('\n');
    if (lines.length > maxLines) {
      return `${result}\n\n[文件过长，已截断。共 ${lines.length} 行，仅展示前 ${maxLines} 行]`;
    }
    return result;
  }

  private executeListFiles(folderId?: string): string {
    const rootNodes = folderId
      ? this.fileCache.get(folderId)?.children ?? []
      : [...this.fileCache.values()].filter((n) => n.depth === 0);

    return rootNodes.map((n) => {
      const icon = n.type === 'folder' ? '📁' : this.getFileIcon(n.ext);
      return `${icon} ${n.name}${n.sizeBytes ? ` (${this.formatSize(n.sizeBytes)})` : ''}`;
    }).join('\n');
  }

  private executeSearch(fileId: string, keyword: string): string {
    const node = this.fileCache.get(fileId);
    if (!node?.content) return '无法搜索该文件内容';

    const lines = node.content.split('\n');
    const matches = lines
      .map((line, i) => ({ line: i + 1, text: line }))
      .filter(({ text }) => text.toLowerCase().includes(keyword.toLowerCase()))
      .slice(0, 10); // 最多返回10条匹配

    if (matches.length === 0) return `未找到包含 "${keyword}" 的内容`;

    return matches.map(({ line, text }) => `L${line}: ${text}`).join('\n');
  }

  // ---- API 调用封装 ----

  private async callAPI(params: {
    messages: ChatCompletionMessageParam[];
    tools?: typeof TOOLS;
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
  }): Promise<ChatCompletionResponse> {
    return this.fetchWithRetry({
      model: this.model,
      messages: params.messages,
      tools: params.tools,
      stream: params.stream ?? false,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.max_tokens,
    });
  }

  private async fetchWithRetry(body: object, retries = MAX_RETRIES): Promise<ChatCompletionResponse> {
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(DASHSCOPE_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        });

        if (!response.ok) throw new Error(`API_ERROR:${response.status}`);
        return await response.json();
      } catch (err) {
        if (i === retries) throw err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    throw new Error('UNREACHABLE');
  }

  // ---- 降级策略 ----

  // 检测模型是否支持 function calling
  private checkFunctionCallingSupport(): boolean {
    // qwen-plus 支持，qwen-turbo 也支持。硬编码已知支持的模型列表。
    const supportedModels = ['qwen-plus', 'qwen-turbo', 'qwen-max'];
    return supportedModels.includes(this.model);
  }

  // 降级：手动拼接模式（模型不支持 function calling 时）
  private async analyzeWithManualPrompt(fileId: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    const content = this.executeReadFile(fileId, 200) ?? '无法读取文件';
    const response = await this.fetchWithRetry({
      model: this.model,
      messages: [
        { role: 'system', content: '你是一个专业的文件分析助手。' },
        { role: 'user', content: `请分析以下文件内容：\n\n${content}` },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });
    const result = this.parseAnalysisResponse(response.content ?? '');
    result.analysisTimeMs = Date.now() - startTime;
    return result;
  }

  private async *chatStreamManual(
    messages: ChatMessage[],
    fileId: string,
    fileSummary: string,
  ): AsyncGenerator<string> {
    const systemMsg = {
      role: 'system' as const,
      content: `你是一个文件知识助手。以下是你正在分析的文件摘要：\n${fileSummary}\n请基于文件内容回答用户问题。`,
    };
    const apiMessages = [systemMsg, ...messages.map((m) => ({ role: m.role, content: m.content }))];

    // 直接流式调用，无工具支持
    yield* this.getFinalStream(apiMessages);
  }

  // ... parseAnalysisResponse / getMockAnalysisResult / getFallbackResult 保持不变 ...
}
```

### 6.2 降级策略

降级链路保持三层，增加一个前置降级（模型不支持 function calling → 手动拼接）：

```
Level 0: 模型不支持 function calling → 降级为手动拼接 prompt（上述 analyzeWithManualPrompt）
Level 1: 真实 API 失败 → Mock 分析结果（与之前相同）
Level 2: Mock 数据也未加载 → 静态兜底文案
```

| 故障场景 | 降级行为 |
|----------|----------|
| 模型不支持 function calling | Level 0：自动切换为手动拼接 prompt 模式，无需用户干预 |
| API Key 未配置或无效 | Level 1：启动时 toast 提示，全自动 Mock |
| API 超时（> 15s） | 第1次自动重试，仍失败则 Level 1 Mock |
| API 返回非 200 | 同超时降级 |
| 完全断网 | 同超时降级 |
| Mock 数据也未加载 | Level 2：静态兜底文案 |

### 6.3 Tool 设计说明

#### 工具选择理由

**为什么定义 3 个工具**：
- `read_file` — 基础能力，模型需要了解文件内容时调用。对应 F3 分析和 F4 对话的基础路径。
- `list_files` — 上下文扩展，模型需要了解目录结构时调用。为未来"多文件分析"功能预留。
- `search_content` — 精准定位，模型需要查找特定内容时调用。对应 T7-A 引用标注子目标——模型可以通过搜索找到原文位置。

**工具数量决策**：
- 3个工具足够覆盖 Demo 场景的全部交互需求
- 过多工具会增加 token 消耗（每个工具的 schema 都要发送），且可能降低模型选择准确度
**放弃**：
- 定义更多工具（如 `summarize_file`、`compare_files`）——增加复杂度但 Demo 中用不到
- 使用 OpenAI SDK 封装而非直接 HTTP —— 增加一个依赖包，直接 fetch 更轻量

### 6.4 按文件类型分支的 Prompt 模板

F3 文件分析的 system prompt 按文件类型分支，让模型以不同角色和视角分析内容：

#### 代码文件（.js / .ts / .py）

```
系统消息：
你是一个代码审查专家。请分析以下代码文件，从以下角度进行评估：

1. **代码结构**：模块组织是否清晰，函数/类职责是否明确
2. **潜在问题**：是否存在 bug 风险、性能问题、安全漏洞
3. **改进建议**：可读性、可维护性、设计模式方面的建议

【文件内容】
{fileContent}

【输出格式】
## 代码结构
（分析模块组织和职责划分）

## 潜在问题
- （问题1）
- （问题2）

## 改进建议
- （建议1）
- （建议2）
```

#### 文档文件（.md / .txt）

```
系统消息：
你是一个内容分析师。请阅读以下文档并提取关键信息：

1. **摘要**：200字以内概括文档核心内容
2. **关键信息**：3-5条要点
3. **结构梳理**：文档的组织结构、段落逻辑

【文件内容】
{fileContent}

【输出格式】
## 摘要
（200字以内概括）

## 关键信息
- （要点1）
- （要点2）

## 结构梳理
（文档结构分析）
```

#### 数据文件（.json / .csv）

```
系统消息：
你是一个数据分析师。请分析以下数据文件，从以下角度进行评估：

1. **数据结构**：字段/列的含义、数据类型
2. **统计特征**：数据规模、分布特点、趋势
3. **异常值**：可能的异常数据或缺失值

【文件内容】
{fileContent}

【输出格式】
## 数据结构
（字段/列含义分析）

## 统计特征
- （特征1）
- （特征2）

## 异常值
- （异常1，或"未发现明显异常"）
```

#### 实现方式

```typescript
// AIService.analyzeWithTools() 中按文件类型选择 prompt

private getSystemPromptForFile(fileType: string): string {
  switch (fileType) {
    case 'code':
      return this.CODE_REVIEW_PROMPT;
    case 'text':
      return this.CONTENT_ANALYSIS_PROMPT;
    case 'data':
      return this.DATA_ANALYSIS_PROMPT;
    default:
      return this.GENERAL_ANALYSIS_PROMPT; // 兜底：通用分析
  }
}
```

**设计理由**：
- 不同文件类型需要不同的分析视角——用代码审查专家分析代码、用数据分析师分析 CSV，比通用助手产出质量更高
- Tool-Use 模式下 system prompt 是工具调用的"上下文指导"，不同角色设定影响模型对工具的调用策略
- 评审能看到 AI "理解"了文件类型并调整分析策略，展示效果更好
**放弃**：
- 单一通用 prompt 处理所有文件类型 —— 实现最简单，但分析结果缺乏针对性，评审时"不够智能"
- 为每种文件类型定义独立工具 —— 工具过多增加 token 消耗，且 model 选择准确度下降

---

## 7. 关键技术决策

### 7.1 文件内容读取方案

**选：主进程 `fs.readdir` 递归读取用户选择的本地目录，文本文件读取前200行内容。**
**理由**：
- 真实文件读取比 Mock JSON 更能体现端侧文件处理能力，评审能看到真实的文件目录操作
- 主进程持有路径信息，渲染进程只拿到节点 ID 和内容，符合安全边界
- 文本文件在前200行截断，控制内存和传输量，避免大文件拖慢渲染
- 与真实网盘 API 对接时平滑过渡：只需将 `fs.readdir` 替换为网盘 API 调用，FileNode 结构不变
**放弃**：
- Mock JSON 内嵌 content —— 开发最快但展示效果弱，无法体现文件系统操作能力
- 渲染进程 `FileReader` —— 违反安全边界（渲染进程不应直接读文件），且Electron sandbox模式下不可用
- 全量读取所有内容 —— 大文件（>1MB 的日志文件等）会阻塞 IPC 传输

### 7.2 流式响应渲染方案

**选：主进程逐 chunk 通过 `ipcRenderer.send('chat-chunk')` 推送，渲染进程追加到当前 assistant 消息的 `content` 字段，React 自动重渲染。**
**理由**：
- 最简单的跨进程流式方案：IPC event 推送字符串，渲染端 `content += chunk` 即可
- React 对字符串变更的重渲染是自动的，无需手动 DOM 操作
- 打字机效果天然形成（每次 chunk 到达触发一次 render）
**放弃**：
- 主进程攒满一条完整消息再一次性返回 —— 无流式效果，用户等待时间长
- 渲染进程直接 fetch SSE 流 —— 暴露 API Key，不安全
- 使用第三方流式UI库（如 react-markdown-stream）—— 增加依赖，且当前场景只需纯文本流式

### 7.3 AI 调用模式 — Tool-Use vs 手动拼接

**选：Tool-Use（Function Calling）模式，定义 `read_file`、`list_files`、`search_content` 三个工具，让模型自主决定何时调用。**
**理由**：
- 参考 MCP（Model Context Protocol）理念——让模型主动选择工具而非被动接收上下文，展示效果更好
- 模型可以更智能地选择需要的信息（只读需要的文件、精准搜索），减少不必要的 token 消耗
- `search_content` 工具为 T7-A 引用标注提供基础——模型可以通过搜索找到原文位置并标注引用
- qwen-plus 原生支持 function calling，DashScope 使用 OpenAI 兼容格式
**放弃**：
- 手动拼接文件内容到 prompt —— 文件内容全部发送，token 浪费，且模型无法自主选择信息
- 固定"先读文件再分析"的单一路径 —— 缺乏灵活性，无法展示 AI 的工具使用能力

### 7.4 大文件处理策略

**选：对发送给AI的文件内容进行 token 截断，上限 8000 字符（约6000 token）。**
**理由**：
- qwen-plus 上下文窗口 32K token，8000字符绰绰有余，且控制API费用
- 超过8000字符的文件（如长篇小说）对Demo场景不现实——Mock数据中的文件内容均控制在2000字以内
- 截断策略简单：`content.slice(0, 8000) + '\n\n[文件过长，已截断...]'`
**放弃**：
- 全文发送 —— 不经济，且长文件可能超出token限制导致API报错
- RAG分块检索 —— 过度工程，Mini Demo不需要向量数据库
- 提取前N段/前N页 —— 对纯文本文件来说截断字符数等效，更简单

### 7.5 模型切换实现

**选：默认 `qwen-plus`，在 `AIService` 构造函数接受 `model` 参数，UI 提供下拉切换。**
**理由**：
- qwen-plus 质量高于 turbo，Demo展示效果更好
- 构造函数参数化使模型切换零成本——只需 new 新实例
- UI 下拉框绑定 Zustand store 的 `selectedModel`，变更时重建 AIService
**放弃**：
- 硬编码模型名 —— 不符合 specs 中"预留切换能力"的要求
- 启动时固定模型不可更改 —— 评审时可能需要切换模型对比效果

### 7.6 组件库选择

**选：不使用重量级组件库（Ant Design / MUI），手写轻量样式。**
**理由**：
- 本项目只需 2-3 种布局组件（面板、列表、输入框、气泡），不需要完整组件库
- 手写 CSS 可控性高，产物体积小（Ant Design 全量引入 ~300KB）
- 面试评审更看重 UI 实现质量而非"用了什么库"
**放弃**：
- Ant Design —— 体积大，引入过多不需要的组件
- 如果引入，也只按需 import 个别组件（如 Button、Input），但增加配置复杂度
