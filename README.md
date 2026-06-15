# 夸克 Mini 助手

夸克 PC 桌面端 Mini 知识助手 — 基于 Electron + React 的文件 AI 分析与问答应用。

## 功能特性

- 📁 **本地文件浏览** — 选择本地目录，树形展示文件结构
- 📄 **文件详情预览** — 元信息 + 文本内容预览（带行号）
- 🤖 **AI 文件分析** — 按文件类型智能分析（代码审查/内容摘要/数据分析）
- 💬 **AI 对话问答** — 基于文件上下文的多轮对话，流式输出
- 🔧 **Tool-Use 模式** — AI 自主调用工具（read_file / list_files / search_content）
- 🎨 **三栏布局** — 文件树 / 详情 / AI 面板，夸克品牌色设计

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Electron 33 |
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 6 |
| 状态管理 | Zustand 5 |
| AI 服务 | 千问 DashScope API（OpenAI 兼容端点） |
| 打包 | electron-builder |

## 快速开始

### 1. 环境要求

- Node.js >= 20
- npm >= 10

### 2. 安装依赖

```bash
npm install
```

### 3. 配置 API Key（可选）

复制环境变量模板并填写 API Key：

```bash
cp .env.example .env
```

在 `.env` 文件中设置：

```
DASHSCOPE_API_KEY=your-api-key-here
```

API Key 获取地址：https://bailian.console.aliyun.com/

> **注意**：不配置 API Key 也可以使用，AI 功能会返回 Mock 结果。

### 4. 启动开发模式

```bash
npm run dev
```

这将同时启动 Vite 开发服务器（端口 5173）和 Electron 窗口。

### 5. 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Enter` | 发送消息 |
| `Shift + Enter` | 输入换行 |
| `Ctrl + O` | 打开文件夹 |

## 打包构建

### 当前平台

```bash
npm run build
```

生成 AppImage（Linux）或对应平台安装包。

### 全平台打包（推荐）

本项目使用 GitHub Actions 进行全平台自动构建：

- **Windows x64**：NSIS 安装包（`.exe`）
- **macOS**：DMG 安装包
- **Linux**：AppImage

推送代码到 `main` 分支或创建 `v*` 标签时自动触发构建。

### 本地交叉编译

如需在 Linux 上构建 Windows 安装包，需要安装 Wine：

```bash
# Ubuntu/Debian
sudo apt install wine64

# 然后执行
npx electron-builder --win nsis
```

## 项目结构

```
quark-mini-assistant/
├── electron/               # Electron 主进程
│   ├── main.ts             # 入口：窗口创建 + IPC
│   ├── preload.ts          # contextBridge 桥接
│   ├── config/env.ts       # 环境变量读取
│   ├── services/
│   │   ├── ai-service.ts   # DashScope AI 服务（Tool-Use）
│   │   ├── file-reader.ts  # 本地文件读取
│   │   └── mock-analysis.ts# Mock 分析结果
│   └── utils/file-classify.ts # 文件类型分类
├── src/                    # React 渲染进程
│   ├── components/
│   │   ├── layout/         # 主布局、标题栏
│   │   ├── file-tree/      # 文件树组件
│   │   ├── file-detail/    # 文件详情面板
│   │   ├── ai-panel/       # AI 分析 + 对话面板
│   │   └── shared/         # 通用组件（EmptyState, ErrorFallback 等）
│   ├── store/index.ts      # Zustand 状态管理
│   ├── hooks/              # 自定义 Hooks
│   ├── utils/              # 纯函数工具
│   └── types/index.ts      # TypeScript 类型定义
├── docs/                   # OpenSpec 文档
├── devlog/                 # 开发日志
├── .env.example            # 环境变量模板
└── electron-builder.json   # 打包配置
```

## OpenSpec 文档

- [Proposal](docs/proposal.md) — 产品方向与技术选型
- [Specs](docs/specs.md) — 功能规格与非功能需求
- [Design](docs/design.md) — 系统架构与技术设计
- [Tasks](docs/tasks.md) — 实现任务拆分

## License

Copyright © 2026 Quark
