import { create } from 'zustand';
import type { FileNode, AnalysisResult, ChatMessage } from '../types';

export interface ToolCallEvent {
  toolName: string;
  args: string;
  timestamp: number;
}

export interface DebugEntry {
  timestamp: number;
  request: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    tools?: Array<{ type: string; function: Record<string, unknown> }>;
  };
}

interface AppState {
  // ---- 文件相关 ----
  rootPath: string | null;
  fileTree: FileNode[];
  selectedFileId: string | null;
  collapsedFolders: Set<string>;
  isTreeLoading: boolean;
  truncated: boolean;

  // ---- AI 分析相关 ----
  analysisCache: Record<string, AnalysisResult>;
  isAnalyzing: boolean;
  analyzingFileId: string | null;
  analyzeError: string | null;
  isApiAvailable: boolean;

  // ---- 对话相关 ----
  conversationFileId: string | null; // which file the conversation is about
  conversationMessages: ChatMessage[];
  isChatLoading: boolean;
  chatError: string | null;
  toolCallEvents: ToolCallEvent[]; // track tool calls during conversation
  debugEntries: DebugEntry[]; // debug panel entries

  // ---- Actions ----
  setDirectory: (path: string, nodes: FileNode[], truncated: boolean) => void;
  selectFile: (fileId: string | null) => void;
  toggleFolder: (folderId: string) => void;
  setLoading: (loading: boolean) => void;
  setAnalysisResult: (fileId: string, result: AnalysisResult) => void;
  setAnalyzing: (analyzing: boolean, fileId?: string) => void;
  setAnalyzeError: (error: string | null) => void;
  setApiAvailability: (available: boolean) => void;
  // Conversation actions
  startConversation: (fileId: string, fileSummary: string) => void;
  clearConversation: () => void;
  addUserMessage: (content: string) => ChatMessage;
  startAssistantMessage: () => ChatMessage;
  appendAssistantChunk: (chunk: string) => void;
  finishAssistantMessage: (error?: string) => void;
  addToolCallEvent: (toolName: string, args: string) => void;
  addDebugEntry: (entry: DebugEntry) => void;
  clearToolCallEvents: () => void;
}

export const useStore = create<AppState>((set) => ({
  // 初始状态
  rootPath: null,
  fileTree: [],
  selectedFileId: null,
  collapsedFolders: new Set<string>(),
  isTreeLoading: false,
  truncated: false,

  // AI 分析初始状态
  analysisCache: {},
  isAnalyzing: false,
  analyzingFileId: null,
  analyzeError: null,
  isApiAvailable: true,

  // 对话初始状态
  conversationFileId: null,
  conversationMessages: [],
  isChatLoading: false,
  chatError: null,
  toolCallEvents: [],
  debugEntries: [],

  // Actions
  setDirectory: (dirPath, nodes, isTruncated) => set({
    rootPath: dirPath,
    fileTree: nodes,
    selectedFileId: null,
    collapsedFolders: new Set<string>(),
    analysisCache: {}, // clear analysis cache on new directory
    truncated: isTruncated,
  }),
  selectFile: (fileId) => set({ selectedFileId: fileId }),
  toggleFolder: (folderId) => set((state) => {
    const next = new Set(state.collapsedFolders);
    if (next.has(folderId)) {
      next.delete(folderId);
    } else {
      next.add(folderId);
    }
    return { collapsedFolders: next };
  }),
  setLoading: (loading) => set({ isTreeLoading: loading }),
  setAnalysisResult: (fileId, result) => set((state) => ({
    analysisCache: { ...state.analysisCache, [fileId]: result },
    isAnalyzing: false,
    analyzingFileId: null,
    analyzeError: null,
  })),
  setAnalyzing: (analyzing, fileId) => set((state) => ({
    isAnalyzing: analyzing,
    analyzingFileId: analyzing ? fileId ?? null : null,
    analyzeError: analyzing ? null : state.analyzeError,
  })),
  setAnalyzeError: (error) => set({
    isAnalyzing: false,
    analyzingFileId: null,
    analyzeError: error,
  }),
  setApiAvailability: (available) => set({ isApiAvailable: available }),

  // ---- Conversation actions ----
  startConversation: (fileId, fileSummary) => set({
    conversationFileId: fileId,
    conversationMessages: [
      { id: 'system-0', role: 'system', content: fileSummary, timestamp: Date.now(), status: 'done' },
    ],
    isChatLoading: false,
    chatError: null,
    toolCallEvents: [],
  }),
  clearConversation: () => set({
    conversationFileId: null,
    conversationMessages: [],
    toolCallEvents: [],
  }),
  addUserMessage: (content) => {
    const msg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'done',
    };
    set((state) => ({
      conversationMessages: [...state.conversationMessages, msg],
    }));
    return msg;
  },
  startAssistantMessage: () => {
    const msg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
    };
    set((state) => ({
      conversationMessages: [...state.conversationMessages, msg],
    }));
    return msg;
  },
  appendAssistantChunk: (chunk) => set((state) => {
    const msgs = [...state.conversationMessages];
    const last = msgs[msgs.length - 1];
    if (last?.role === 'assistant' && last.status === 'streaming') {
      msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
    }
    return { conversationMessages: msgs };
  }),
  finishAssistantMessage: (error) => set((state) => {
    const msgs = state.conversationMessages.map((m) =>
      m.role === 'assistant' && m.status === 'streaming'
        ? { ...m, status: error ? ('error' as const) : ('done' as const) }
        : m,
    );
    return {
      conversationMessages: msgs,
      isChatLoading: false,
      chatError: error ?? null,
    };
  }),
  addToolCallEvent: (toolName, args) => set((state) => ({
    toolCallEvents: [
      ...state.toolCallEvents,
      { toolName, args, timestamp: Date.now() },
    ],
  })),
  addDebugEntry: (entry) => set((state) => ({
    debugEntries: [...state.debugEntries, entry],
  })),
  clearToolCallEvents: () => set({ toolCallEvents: [] }),
}));

/**
 * Check if a folder should show its children.
 * Root-level folders (depth === 0) are open by default.
 */
export function isFolderOpen(node: FileNode, collapsedFolders: Set<string>): boolean {
  if (node.type !== 'folder') return false;
  if (node.depth === 0) {
    return !collapsedFolders.has(node.id); // default open
  }
  return false; // default collapsed
}

/**
 * Find a file node by ID in the tree.
 */
export function findFileNode(nodes: FileNode[], id: string): FileNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findFileNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Convenience selector: get the full FileNode for the selected file.
 * Call this inside a useMemo or selector to avoid re-searching on every render.
 */
export function getSelectedFile(state: AppState): FileNode | null {
  if (!state.selectedFileId) return null;
  return findFileNode(state.fileTree, state.selectedFileId);
}
