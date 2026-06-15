# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 项目：夸克PC桌面端Mini知识助手

## 工作模式
本项目遵循 OpenSpec 流程：proposal → specs → design → tasks → 实现。
每个阶段的产出物存放在 /docs 目录下。

## DEVLOG规则（必须遵守）
每完成一个阶段或task后，你必须自动追加内容到 devlog/DEVLOG.md，格式如下：

### [时间戳] 阶段/Task名称
**Prompt摘要**：我收到的指令概要
**执行过程**：我做了什么，生成了哪些文件
**遇到的问题**：执行中发现的技术问题或需要人工决策的地方
**决策记录**：这个环节涉及的技术/产品取舍，选了什么，理由是什么
**待确认项**：需要人工review或决定的事项

## 代码规范
- 所有代码使用 TypeScript，严格类型
- 组件拆分粒度适中，单文件不超过200行
- 错误处理不能省略
- 注释只写"为什么"，不写"是什么"
