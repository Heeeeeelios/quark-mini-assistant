import type { FileNode } from './file-reader';
import { getMockAnalysisResult, getFallbackAnalysisResult } from './mock-analysis';

const DASHSCOPE_API = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DEFAULT_MODEL = 'qwen-plus';
const REQUEST_TIMEOUT = 15_000; // 15s
const MAX_RETRIES = 1;

// ---- Tool definitions for function calling ----

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

// ---- Types for API communication ----

interface ApiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ApiToolCall[];
  tool_call_id?: string;
}

interface ApiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ApiResponse {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: ApiToolCall[];
    };
    delta?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
    code?: string;
  };
}

export interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  analysisTimeMs: number;
  source: 'api' | 'mock' | 'fallback';
}

export type ApiErrorCode =
  | 'NO_API_KEY'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'AUTH_FAILED'
  | 'NETWORK_ERROR'
  | 'API_ERROR';

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---- Prompt templates by file type ----

const PROMPT_TEMPLATES: Record<string, string> = {
  code: `你是一个代码审查专家。请分析以下代码文件，从以下角度进行评估：

1. **代码结构**：模块组织是否清晰，函数/类职责是否明确
2. **潜在问题**：是否存在 bug 风险、性能问题、安全漏洞
3. **改进建议**：可读性、可维护性、设计模式方面的建议

请严格按以下格式输出：

## 代码结构
（分析模块组织和职责划分）

## 潜在问题
- （问题1）
- （问题2）

## 改进建议
- （建议1）
- （建议2）`,

  text: `你是一个内容分析师。请阅读以下文档并提取关键信息：

1. **摘要**：200字以内概括文档核心内容
2. **关键信息**：3-5条要点
3. **结构梳理**：文档的组织结构、段落逻辑

请严格按以下格式输出：

## 摘要
（200字以内概括）

## 关键信息
- （要点1）
- （要点2）

## 结构梳理
（文档结构分析）`,

  data: `你是一个数据分析师。请分析以下数据文件，从以下角度进行评估：

1. **数据结构**：字段/列的含义、数据类型
2. **统计特征**：数据规模、分布特点、趋势
3. **异常值**：可能的异常数据或缺失值

请严格按以下格式输出：

## 数据结构
（字段/列含义分析）

## 统计特征
- （特征1）
- （特征2）

## 异常值
- （异常1，或"未发现明显异常"）`,
};

const DEFAULT_PROMPT = `请分析以下文件内容，给出摘要和关键信息。

请严格按以下格式输出：

## 摘要
（200字以内概括文件核心内容）

## 关键信息
- （要点1）
- （要点2）
- （要点3）`;

// ---- AIService class ----

export class AIService {
  private apiKey: string;
  private model: string;
  private fileCache: Map<string, FileNode>;
  private supportsFunctionCalling: boolean;

  constructor(apiKey: string, model = DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
    this.fileCache = new Map();
    this.supportsFunctionCalling = this.checkFunctionCallingSupport();
  }

  /**
   * Populate the file cache from the loaded directory.
   */
  setFileCache(nodes: FileNode[]): void {
    this.fileCache.clear();
    const addNodes = (n: FileNode[]) => {
      for (const node of n) {
        if (node.type === 'file' && node.content) {
          this.fileCache.set(node.id, node);
          console.log(`[setFileCache] Cached: ${node.id}, contentLength=${node.content.length}`);
        }
        if (node.children) addNodes(node.children);
      }
    };
    addNodes(nodes);
    console.log(`[setFileCache] Total files cached: ${this.fileCache.size}`);
  }

  // ---- F3: File analysis ----

  /**
   * Analyze a file using content passed directly (no fileCache dependency).
   * This is the primary entry point used by the IPC handler.
   */
  async analyzeFileWithContent(fileId: string, ext: string, content: string | null): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      if (!content) {
        // Binary file or read error — return a generic result
        return {
          summary: `该文件（${ext || '未知类型'}）暂不支持 AI 分析。目前支持文本文件（代码、文档、数据文件）的分析。`,
          keyPoints: ['该文件为二进制格式或无法读取', '支持的文件类型：.txt .md .js .ts .py .json .csv 等'],
          analysisTimeMs: 0,
          source: 'mock',
        };
      }

      const systemPrompt = this.getSystemPromptForExt(ext);

      console.log(`[analyzeFileWithContent] fileId=${fileId}, ext=${ext}, contentLength=${content.length}`);

      const messages: ApiMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `【文件内容】\n${content}` },
      ];

      console.log('[analyzeFileWithContent] Request messages:', JSON.stringify(messages.map(m => ({
        role: m.role,
        content: m.content.length > 100 ? m.content.slice(0, 100) + '...' : m.content,
      }))));

      const response = await this.fetchWithRetry({
        model: this.model,
        messages,
        temperature: 0.3,
        max_tokens: 800,
      });

      console.log('[analyzeFileWithContent] Response received, content length:', response.choices?.[0]?.message?.content?.length ?? 0);

      const result = this.parseAnalysisResponse(response.choices?.[0]?.message?.content ?? '');
      result.analysisTimeMs = Date.now() - startTime;
      return result;
    } catch (err) {
      console.error('[ai-service] analyzeFileWithContent error:', err);
      return this.fallbackAnalysis();
    }
  }

  /**
   * Legacy method: analyze from fileCache (kept for compatibility).
   */
  async analyzeFile(fileId: string): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      // Direct approach: embed file content in prompt (more reliable than tool calls)
      const result = await this.analyzeWithContent(fileId);
      result.analysisTimeMs = Date.now() - startTime;
      return result;
    } catch (err) {
      console.error('[ai-service] analyzeFile error:', err);
      return this.fallbackAnalysis();
    }
  }

  // ---- Direct analysis: embed file content in prompt ----

  private async analyzeWithContent(fileId: string): Promise<AnalysisResult> {
    const node = this.fileCache.get(fileId);
    console.log(`[analyzeWithContent] fileId lookup: "${fileId}"`);
    console.log(`[analyzeWithContent] Cache size: ${this.fileCache.size}`);
    console.log(`[analyzeWithContent] Cache keys: ${Array.from(this.fileCache.keys()).join(', ')}`);
    console.log(`[analyzeWithContent] Found node: ${node ? 'yes' : 'no'}`);
    console.log(`[analyzeWithContent] Node content length: ${node?.content?.length ?? 'undefined'}`);

    const systemPrompt = this.getSystemPromptForFile(node);
    const content = node?.content ?? '（无法读取文件内容，文件可能为二进制格式）';

    console.log(`[ai-service] analyzeWithContent: fileType=${node?.fileType}, contentLength=${content.length}`);

    const messages: ApiMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `【文件名】${node?.name ?? '未知'}\n【文件内容】\n${content}` },
    ];

    // Log the request for debugging
    console.log('[ai-service] Request messages:', JSON.stringify(messages.map(m => ({
      role: m.role,
      content: m.content.length > 100 ? m.content.slice(0, 100) + '...' : m.content,
    }))));

    const response = await this.fetchWithRetry({
      model: this.model,
      messages,
      temperature: 0.3,
      max_tokens: 800,
    });

    console.log('[ai-service] Response received, content length:', response.choices?.[0]?.message?.content?.length ?? 0);

    return this.parseAnalysisResponse(response.choices?.[0]?.message?.content ?? '');
  }

  // ---- F4: Streaming chat ----

  async *chatStream(
    messages: Array<{ role: string; content: string }>,
    fileId: string,
    fileSummary: string,
  ): AsyncGenerator<string> {
    if (this.supportsFunctionCalling) {
      yield* this.chatStreamWithTools(messages, fileId, fileSummary);
    } else {
      yield* this.chatStreamManual(messages, fileSummary);
    }
  }

  // ---- Check function calling support ----

  private checkFunctionCallingSupport(): boolean {
    const supportedModels = ['qwen-plus', 'qwen-turbo', 'qwen-max'];
    return supportedModels.includes(this.model);
  }

  // ---- Fallback analysis ----

  private fallbackAnalysis(): AnalysisResult {
    try {
      const mock = getMockAnalysisResult();
      return { ...mock, analysisTimeMs: 0, source: 'mock' };
    } catch {
      const fallback = getFallbackAnalysisResult();
      return { ...fallback, analysisTimeMs: 0, source: 'fallback' };
    }
  }

  // ---- Tool-Use streaming chat ----

  private async *chatStreamWithTools(
    messages: Array<{ role: string; content: string }>,
    _fileId: string,
    fileSummary: string,
  ): AsyncGenerator<string> {
    const systemMsg: ApiMessage = {
      role: 'system',
      content: `你是一个文件知识助手。你可以使用工具来读取和搜索文件内容。当前分析的文件摘要：${fileSummary}`,
    };

    const apiMessages: ApiMessage[] = [
      systemMsg,
      ...messages.map((m) => ({ role: m.role as ApiMessage['role'], content: m.content })),
    ];

    const response = await this.fetchWithRetry({
      model: this.model,
      messages: apiMessages,
      tools: TOOLS,
      temperature: 0.7,
    });

    // If the model calls tools
    if (response.choices?.[0]?.message?.tool_calls) {
      for (const toolCall of response.choices[0].message.tool_calls) {
        const result = this.executeToolCall(toolCall);
        apiMessages.push({
          role: 'assistant',
          content: '',
          tool_calls: [toolCall],
        });
        apiMessages.push({
          role: 'tool',
          content: result,
          tool_call_id: toolCall.id,
        });
      }

      // Get final answer (streaming)
      yield* this.getFinalStream(apiMessages);
    } else {
      // Direct streaming response
      yield* this.getFinalStream(apiMessages);
    }
  }

  // ---- Manual streaming chat ----

  private async *chatStreamManual(
    messages: Array<{ role: string; content: string }>,
    fileSummary: string,
  ): AsyncGenerator<string> {
    const apiMessages: ApiMessage[] = [
      {
        role: 'system',
        content: `你是一个文件知识助手。以下是你正在分析的文件摘要：\n${fileSummary}\n请基于文件内容回答用户问题。`,
      },
      ...messages.map((m) => ({ role: m.role as ApiMessage['role'], content: m.content })),
    ];

    yield* this.getFinalStream(apiMessages);
  }

  // ---- Tool execution ----

  private executeToolCall(toolCall: ApiToolCall): string {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      switch (toolCall.function.name) {
        case 'read_file':
          return this.executeReadFile(args.file_id, args.max_lines ?? 200);
        case 'list_files':
          return this.executeListFiles(args.folder_id);
        case 'search_content':
          return this.executeSearch(args.file_id, args.keyword);
        default:
          return `未知工具: ${toolCall.function.name}`;
      }
    } catch {
      return '工具参数解析失败';
    }
  }

  private executeReadFile(fileId: string, maxLines = 200): string {
    const node = this.fileCache.get(fileId);
    if (!node?.content) return '无法读取该文件内容（非文本文件或文件不存在）';
    const lines = node.content.split('\n');
    if (lines.length > maxLines) {
      const truncated = lines.slice(0, maxLines).join('\n');
      return `${truncated}\n\n[文件过长，已截断。共 ${lines.length} 行，仅展示前 ${maxLines} 行]`;
    }
    return node.content;
  }

  private executeListFiles(_folderId?: string): string {
    const items: string[] = [];
    for (const node of this.fileCache.values()) {
      if (node.depth === 0) {
        const icon = node.type === 'folder' ? '📁' : this.getFileIcon(node.ext);
        const size = node.sizeBytes ? ` (${this.formatSize(node.sizeBytes)})` : '';
        items.push(`${icon} ${node.name}${size}`);
      }
    }
    return items.join('\n') || '目录为空';
  }

  private executeSearch(fileId: string, keyword: string): string {
    const node = this.fileCache.get(fileId);
    if (!node?.content) return '无法搜索该文件内容';

    const lines = node.content.split('\n');
    const matches = lines
      .map((line, i) => ({ line: i + 1, text: line }))
      .filter(({ text }) => text.toLowerCase().includes(keyword.toLowerCase()))
      .slice(0, 10);

    if (matches.length === 0) return `未找到包含 "${keyword}" 的内容`;
    return matches.map(({ line, text }) => `L${line}: ${text}`).join('\n');
  }

  // ---- System prompt by file type ----

  /**
   * Get system prompt based on file extension (used when content is passed directly).
   */
  private getSystemPromptForExt(ext: string): string {
    const codeExts = new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.py', '.java', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.c', '.cpp', '.h', '.cs', '.dart', '.lua', '.pl', '.sh', '.bash', '.zsh', '.fish', '.ps1']);
    const textExts = new Set(['.txt', '.md', '.log', '.markdown', '.rst', '.adoc', '.xml', '.html', '.css', '.scss', '.less', '.ini', '.cfg', '.conf', '.env', '.properties', '.yaml', '.yml', '.toml', '.graphql', '.proto', '.thrift', '.svg']);
    const dataExts = new Set(['.json', '.csv', '.sql', '.tsv', '.parquet']);

    if (codeExts.has(ext)) return PROMPT_TEMPLATES.code;
    if (textExts.has(ext)) return PROMPT_TEMPLATES.text;
    if (dataExts.has(ext)) return PROMPT_TEMPLATES.data;
    return DEFAULT_PROMPT;
  }

  /**
   * Get system prompt based on FileNode (legacy, uses fileType from cache).
   */
  private getSystemPromptForFile(node?: FileNode): string {
    if (!node) return DEFAULT_PROMPT;
    return PROMPT_TEMPLATES[node.fileType] ?? DEFAULT_PROMPT;
  }

  // ---- Parse analysis response ----

  private parseAnalysisResponse(text: string): AnalysisResult {
    const summaryMatch = text.match(/## 摘要\n([\s\S]*?)\n##/);
    const keyPointsMatch = text.match(/## 关键信息\n([\s\S]*)/);

    const summary = summaryMatch?.[1]?.trim() || text.slice(0, 200);
    const keyPoints = keyPointsMatch
      ? keyPointsMatch[1]
          .split('\n')
          .filter((l) => l.startsWith('- '))
          .map((l) => l.slice(2).trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];

    return {
      summary,
      keyPoints: keyPoints.length > 0 ? keyPoints : ['暂无关键信息'],
      analysisTimeMs: 0,
      source: 'api',
    };
  }

  // ---- Streaming response ----

  private async *getFinalStream(messages: ApiMessage[]): AsyncGenerator<string> {
    const response = await this.fetchStreamWithRetry({
      model: this.model,
      messages,
      stream: true,
      temperature: 0.7,
    });

    for await (const chunk of response) {
      yield chunk;
    }
  }

  // ---- HTTP helpers ----

  private async fetchWithRetry(params: {
    model: string;
    messages: ApiMessage[];
    tools?: typeof TOOLS;
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
  }): Promise<ApiResponse> {
    for (let i = 0; i <= MAX_RETRIES; i++) {
      try {
        const response = await fetch(DASHSCOPE_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(params),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        });

        if (!response.ok) {
          throw this.mapHttpError(response.status, await response.text());
        }

        return (await response.json()) as ApiResponse;
      } catch (err) {
        if (err instanceof ApiError && i < MAX_RETRIES) {
          // Retry only on transient errors
          if (err.code === 'TIMEOUT' || err.code === 'NETWORK_ERROR' || err.code === 'RATE_LIMIT') {
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
        }
        throw err;
      }
    }
    throw new ApiError('NETWORK_ERROR', '请求失败，已达最大重试次数');
  }

  private async *fetchStreamWithRetry(params: {
    model: string;
    messages: ApiMessage[];
    stream: boolean;
    temperature?: number;
  }): AsyncGenerator<string> {
    for (let i = 0; i <= MAX_RETRIES; i++) {
      try {
        const response = await fetch(DASHSCOPE_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(params),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        });

        if (!response.ok) {
          throw this.mapHttpError(response.status, await response.text());
        }

        const reader = response.body?.getReader();
        if (!reader) throw new ApiError('NETWORK_ERROR', '无法读取响应流');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data) as ApiResponse;
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) yield content;
            } catch {
              // Ignore unparseable SSE lines
            }
          }
        }
        return;
      } catch (err) {
        if (err instanceof ApiError && i < MAX_RETRIES) {
          if (err.code === 'TIMEOUT' || err.code === 'NETWORK_ERROR') {
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
        }
        throw err;
      }
    }
  }

  // ---- Error mapping ----

  private mapHttpError(status: number, _body: string): ApiError {
    switch (status) {
      case 401:
      case 403:
        return new ApiError('AUTH_FAILED', 'API Key 无效');
      case 429:
        return new ApiError('RATE_LIMIT', 'API 调用频率过高，请稍后重试');
      case 500:
      case 502:
      case 503:
        return new ApiError('API_ERROR', '服务端异常');
      default:
        return new ApiError('API_ERROR', `API 异常 (${status})`);
    }
  }

  // ---- Helpers ----

  private getFileIcon(ext?: string): string {
    const map: Record<string, string> = {
      '.js': '📕', '.ts': '📕', '.py': '📕', '.jsx': '📕', '.tsx': '📕',
      '.txt': '📄', '.md': '📄',
      '.json': '📊', '.csv': '📊',
      '.png': '🖼️', '.jpg': '🖼️', '.jpeg': '🖼️', '.gif': '🖼️', '.svg': '🖼️',
    };
    return map[ext?.toLowerCase() ?? ''] ?? '📦';
  }

  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const idx = Math.min(i, units.length - 1);
    return `${(bytes / Math.pow(1024, idx)).toFixed(1)} ${units[idx]}`;
  }
}
