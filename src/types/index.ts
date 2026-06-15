// ---- 文件相关 ----
export interface FileNode {
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

export interface FileMeta {
  id: string;
  name: string;
  ext: string;
  fileType: 'binary' | 'image';
  sizeBytes: number;
  modifiedAt: string;
}

export interface FileDetail {
  id: string;
  name: string;
  fileType: string;
  ext: string;
  sizeFormatted: string;
  modifiedAt: string;
  content?: string;
  contentTruncated?: boolean;
  hasContent: boolean;
}

// ---- AI分析结果 ----
export interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  analysisTimeMs: number;
  source: 'api' | 'mock' | 'fallback';
}

// ---- 对话相关 ----
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  status: 'sending' | 'streaming' | 'done' | 'error';
}

export interface ConversationContext {
  fileId: string;
  fileSummary: string;
  messages: ChatMessage[];
}
