import { contextBridge, ipcRenderer } from 'electron';

// Mirror of FileNode type for preload bridge
interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'folder' | 'file';
  children?: FileNode[];
  depth: number;
  ext?: string;
  fileType: 'text' | 'code' | 'data' | 'binary' | 'image';
  sizeBytes: number;
  modifiedAt: string;
  content?: string;
  contentTruncated?: boolean;
}

// Mirror of AnalysisResult type
interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  analysisTimeMs: number;
  source: 'api' | 'mock' | 'fallback';
}

// Mirror of ApiError type
interface ApiError {
  code: string;
  message: string;
}

contextBridge.exposeInMainWorld('api', {
  // F5: 检查API Key是否配置
  checkApiKey: (): Promise<{ configured: boolean }> =>
    ipcRenderer.invoke('check-api-key'),

  // F5: 保存API Key（到 userData/config.json）
  saveApiKey: (key: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('save-api-key', key),

  // F5: 移除API Key
  removeApiKey: (): Promise<void> =>
    ipcRenderer.invoke('remove-api-key'),

  // F1: 选择目录并返回文件树
  selectDirectory: (): Promise<{ nodes: FileNode[]; truncated: boolean } | null> =>
    ipcRenderer.invoke('select-directory'),

  // F2: 获取非文本文件的元信息
  getFileMeta: (fileId: string): Promise<unknown> =>
    ipcRenderer.invoke('get-file-meta', fileId),

  // F3: AI文件分析（非流式，一次性返回）
  analyzeFile: (fileId: string): Promise<AnalysisResult | { error: ApiError }> =>
    ipcRenderer.invoke('analyze-file', fileId),

  // F4: AI对话（流式）
  chatCompletion: (params: {
    messages: Array<{ role: string; content: string }>;
    fileId: string;
    fileSummary: string;
  }): Promise<void> => ipcRenderer.invoke('chat-completion', params),

  // F4: 监听流式chunk
  onChatChunk: (callback: (chunk: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, chunk: string) => callback(chunk);
    ipcRenderer.on('chat-chunk', listener);
    return () => ipcRenderer.removeListener('chat-chunk', listener);
  },

  // F4: 监听流式结束
  onChatDone: (callback: (error?: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, error?: string) => callback(error);
    ipcRenderer.on('chat-done', listener);
    return () => ipcRenderer.removeListener('chat-done', listener);
  },

  // F4: 监听工具调用事件
  onToolCall: (callback: (event: { toolName: string; args: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, event: { toolName: string; args: string }) => callback(event);
    ipcRenderer.on('chat-tool-call', listener);
    return () => ipcRenderer.removeListener('chat-tool-call', listener);
  },

  // F5: 窗口控制
  windowMinimize: (): Promise<void> => ipcRenderer.invoke('window-minimize'),
  windowClose: (): Promise<void> => ipcRenderer.invoke('window-close'),
});
