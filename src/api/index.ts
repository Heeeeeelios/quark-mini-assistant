import type { FileNode, AnalysisResult } from '../types';

interface ApiError {
  code: string;
  message: string;
}

interface SelectDirectoryResult {
  nodes: FileNode[];
  truncated: boolean;
}

interface WindowApi {
  checkApiKey: () => Promise<{ configured: boolean }>;
  saveApiKey: (key: string) => Promise<{ success: boolean }>;
  removeApiKey: () => Promise<void>;
  selectDirectory: () => Promise<SelectDirectoryResult | null>;
  getFileMeta: (fileId: string) => Promise<unknown>;
  analyzeFile: (fileId: string) => Promise<AnalysisResult | { error: ApiError }>;
  chatCompletion: (params: {
    messages: Array<{ role: string; content: string }>;
    fileId: string;
    fileSummary: string;
  }) => Promise<void>;
  onChatChunk: (callback: (chunk: string) => void) => () => void;
  onChatDone: (callback: (error?: string) => void) => () => void;
  onToolCall: (callback: (event: { toolName: string; args: string }) => void) => () => void;
  windowMinimize: () => Promise<void>;
  windowClose: () => Promise<void>;
}

declare global {
  interface Window {
    api: WindowApi;
  }
}

export {};
