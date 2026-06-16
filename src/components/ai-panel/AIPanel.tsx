import type { ReactElement } from 'react';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import type { FileNode, AnalysisResult } from '../../types';
import { useStore, findFileNode } from '../../store';
import { useAnalyze } from '../../hooks/useAnalyze';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import SettingsModal from '../shared/SettingsModal';
import AnalysisResultView from './AnalysisResult';
import ChatInput from './ChatInput';
import ChatMessages from './ChatMessages';
import PromptDebugPanel from './PromptDebugPanel';
import './AIPanel.css';

// ---- Error code mapping for user-friendly messages ----
const ERROR_MESSAGES: Record<string, string> = {
  'AUTH_FAILED': 'API Key 验证失败，请在设置中检查 Key 是否正确',
  'RATE_LIMIT': '请求频率过高或额度已用完，请稍后再试',
  'TIMEOUT': '请求超时，可能是文件过大或网络不稳定',
  'NETWORK_ERROR': '网络连接失败，请检查网络后重试',
  'API_ERROR': '服务端异常，请稍后再试',
};

function getErrorMessage(raw: string): string {
  for (const [code, msg] of Object.entries(ERROR_MESSAGES)) {
    if (raw.includes(code) || raw.toLowerCase().includes(code.toLowerCase().replace('_', ' '))) {
      return msg;
    }
  }
  // Check for specific patterns
  if (raw.includes('Key') || raw.includes('key') || raw.includes('验证')) return ERROR_MESSAGES.AUTH_FAILED!;
  if (raw.includes('网络') || raw.includes('connect') || raw.includes('fetch')) return ERROR_MESSAGES.NETWORK_ERROR!;
  if (raw.includes('超时') || raw.includes('timeout')) return ERROR_MESSAGES.TIMEOUT!;
  if (raw.includes('频率') || raw.includes('额度') || raw.includes('rate') || raw.includes('limit')) return ERROR_MESSAGES.RATE_LIMIT!;
  return raw || '对话失败，请重试';
}

interface AIPanelProps {
  fileTree: FileNode[];
  selectedFileId: string | null;
}

export default function AIPanel({
  fileTree,
  selectedFileId,
}: AIPanelProps): ReactElement {
  const {
    isApiAvailable,
    conversationFileId,
    conversationMessages,
    isChatLoading,
    toolCallEvents,
    debugEntries,
    setApiAvailability,
    startConversation,
    clearConversation,
    addUserMessage,
    startAssistantMessage,
    appendAssistantChunk,
    finishAssistantMessage,
    addDebugEntry,
    clearToolCallEvents,
    addToolCallEvent,
    setAnalysisResult,
    setAnalyzing,
    setAnalyzeError,
  } = useStore();

  const {
    isAnalyzing: isAnalyzeLoading,
    analyzingFileId,
    analyzeError,
    getCachedResult,
  } = useAnalyze();

  const [showDebug, setShowDebug] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [streamedAnalysis, setStreamedAnalysis] = useState<Partial<AnalysisResult> | null>(null);

  const inputRef = useRef<{ focus: () => void; reset: () => void } | null>(null);
  const mockIntervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

  const selectedFile = useMemo(
    () => (selectedFileId ? findFileNode(fileTree, selectedFileId) : null),
    [fileTree, selectedFileId],
  );

  const cachedResult = selectedFileId ? getCachedResult(selectedFileId) : null;
  const isLoading = (isAnalyzeLoading && analyzingFileId === selectedFileId) || !!streamedAnalysis;
  const isChatting = isChatLoading;
  const isAnalyzable = selectedFile && ['text', 'code', 'data'].includes(selectedFile.fileType);
  const isAnyLoading = isLoading || isChatting;

  // Check API key on mount
  useEffect(() => {
    window.api.checkApiKey().then(({ configured }) => {
      setApiAvailability(configured);
    });
  }, [setApiAvailability]);

  // Set up tool call listener
  useEffect(() => {
    const cleanup = window.api.onToolCall((event) => {
      addToolCallEvent(event.toolName, event.args || '');
    });
    return cleanup;
  }, [addToolCallEvent]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      mockIntervalsRef.current.forEach(clearInterval);
    };
  }, []);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const handleSaveApiKey = useCallback(
    async (key: string): Promise<boolean> => {
      const result = await window.api.saveApiKey(key);
      if (result.success) {
        setApiAvailability(true);
      }
      return result.success;
    },
    [setApiAvailability],
  );

  // ---- AI Analysis with streaming ----
  const handleAnalyze = useCallback(
    async (fileId: string) => {
      if (!isAnalyzable) return;

      // Clear previous streamed state
      setStreamedAnalysis(null);

      // If no API key configured, simulate mock analysis with streaming
      if (!isApiAvailable) {
        simulateMockAnalysis(fileId, selectedFile, setStreamedAnalysis, setAnalyzing, setAnalyzeError, mockIntervalsRef);
        return;
      }

      // Real API call with existing useAnalyze hook
      // (loading state handled by isAnalyzeLoading from useAnalyze)
      try {
        const response = await window.api.analyzeFile(fileId);

        if (response && typeof response === 'object' && 'error' in response) {
          setAnalyzeError(getErrorMessage(response.error.message || ''));
          return;
        }

        if (response && typeof response === 'object' && 'summary' in response) {
          setAnalysisResult(fileId, response as AnalysisResult);
          return;
        }

        setAnalyzeError('响应格式异常');
      } catch {
        setAnalyzeError('分析失败，请重试');
      }
    },
    [isAnalyzable, isApiAvailable, selectedFile, setAnalysisResult, setAnalyzing, setAnalyzeError],
  );

  // Clear analysis cache when file changes
  useEffect(() => {
    setStreamedAnalysis(null);
  }, [selectedFileId]);

  // Auto-start conversation when file is selected
  useEffect(() => {
    if (selectedFileId && selectedFileId !== conversationFileId && selectedFile) {
      const summary = selectedFile.content
        ? selectedFile.content.slice(0, 500)
        : `${selectedFile.name} (${selectedFile.fileType})`;
      startConversation(selectedFileId, summary);
      clearToolCallEvents();
    }
    if (!selectedFileId && conversationFileId) {
      clearConversation();
    }
  }, [selectedFileId, conversationFileId, selectedFile, startConversation, clearConversation, clearToolCallEvents]);

  // ---- Chat send ----
  const handleSend = useCallback(
    async (text: string) => {
      if (!selectedFileId) return;

      addUserMessage(text);
      startAssistantMessage();

      const apiMessages: Array<{ role: string; content: string }> = [];
      for (const msg of conversationMessages) {
        if (msg.role === 'system') continue;
        apiMessages.push({ role: msg.role, content: msg.content });
      }
      apiMessages.push({ role: 'user', content: text });

      const debugEntry = {
        timestamp: Date.now(),
        request: {
          model: 'qwen-plus',
          messages: apiMessages,
          tools: [
            {
              type: 'function',
              function: {
                name: 'read_file',
                parameters: { type: 'object', properties: { file_id: { type: 'string' }, max_lines: { type: 'number' } }, required: ['file_id'] },
              },
            },
            {
              type: 'function',
              function: {
                name: 'list_files',
                parameters: { type: 'object', properties: { folder_id: { type: 'string' } }, required: [] },
              },
            },
            {
              type: 'function',
              function: {
                name: 'search_content',
                parameters: { type: 'object', properties: { file_id: { type: 'string' }, keyword: { type: 'string' } }, required: ['file_id', 'keyword'] },
              },
            },
          ],
        },
      };
      addDebugEntry(debugEntry);
      clearToolCallEvents();

      try {
        const cleanupChunk = window.api.onChatChunk((chunk: string) => {
          appendAssistantChunk(chunk);
        });

        const cleanupDone = window.api.onChatDone((error?: string) => {
          cleanupChunk();
          cleanupDone();
          if (error) {
            finishAssistantMessage(getErrorMessage(error));
          } else {
            finishAssistantMessage();
          }
        });

        const fileSummary = selectedFile?.content
          ? selectedFile.content.slice(0, 500)
          : '';

        await window.api.chatCompletion({
          messages: apiMessages,
          fileId: selectedFileId,
          fileSummary,
        });
      } catch (err) {
        const raw = err instanceof Error ? err.message : '对话失败';
        finishAssistantMessage(getErrorMessage(raw));
      }

      // Focus input after sending
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    },
    [
      selectedFileId,
      conversationMessages,
      selectedFile,
      addUserMessage,
      startAssistantMessage,
      appendAssistantChunk,
      finishAssistantMessage,
      addDebugEntry,
      clearToolCallEvents,
    ],
  );

  // ---- Render ----

  // No directory selected
  if (fileTree.length === 0) {
    return (
      <div className="ai-panel">
        <EmptyState
          icon="🤖"
          message="请先选择一个文件夹"
          hint="AI 功能需要先选择包含文件的目录"
        />
      </div>
    );
  }

  // No file selected
  if (!selectedFile) {
    return (
      <div className="ai-panel">
        <EmptyState
          icon="💡"
          message="请先在左侧选择一个文件"
          hint="选择文件后即可进行 AI 分析和对话"
        />
      </div>
    );
  }

  // Folder selected
  if (selectedFile.type === 'folder') {
    return (
      <div className="ai-panel">
        <EmptyState icon="📁" message="文件夹不支持 AI 分析" hint="请选择具体的文件进行分析" />
      </div>
    );
  }

  return (
    <div className="ai-panel">
      {/* Header: file name + analyze button + settings */}
      <header className="ai-panel__header">
        <div className="ai-panel__file-name" title={selectedFile.name}>
          {getFileIcon(selectedFile)} {selectedFile.name}
        </div>
        <div className="ai-panel__header-actions">
          {/* Settings gear - always visible */}
          <button
            className="ai-panel__settings-btn"
            onClick={handleOpenSettings}
            title={isApiAvailable ? '修改 API Key' : '配置 API Key'}
          >
            {isApiAvailable ? '⚙️' : '🔑'}
          </button>
          {/* Debug toggle - only when API is available */}
          {isApiAvailable && (
            <button
              className={`ai-panel__debug-toggle ${showDebug ? 'ai-panel__debug-toggle--active' : ''}`}
              onClick={() => setShowDebug(!showDebug)}
              title="Prompt 调试面板"
            >
              🔧
            </button>
          )}
          <button
            className="ai-panel__analyze-btn"
            onClick={() => selectedFileId && handleAnalyze(selectedFileId)}
            disabled={isAnyLoading || !isAnalyzable}
          >
            {isLoading ? '分析中...' : '🔍 AI 分析'}
          </button>
        </div>
      </header>

      {/* Analysis result area */}
      {isLoading ? (
        <div className="ai-panel__analysis-area ai-panel__analysis-area--loading">
          <LoadingSpinner label="🔍 AI 正在分析..." />
          {streamedAnalysis && (
            <div className="ai-panel__streaming-preview">
              {streamedAnalysis.summary && (
                <p className="ai-panel__streaming-text">{streamedAnalysis.summary}</p>
              )}
            </div>
          )}
        </div>
      ) : analyzeError ? (
        <div className="ai-panel__analysis-area ai-panel__error">
          <EmptyState icon="⚠️" message={analyzeError} hint="点击 AI 分析按钮重试" />
        </div>
      ) : cachedResult ? (
        <div className="ai-panel__analysis-area">
          <AnalysisResultView result={cachedResult} />
        </div>
      ) : !isAnalyzable ? (
        <div className="ai-panel__analysis-area">
          <EmptyState icon="🚫" message="该文件类型暂不支持 AI 分析" hint={`文件类型：${selectedFile.ext || '未知'}`} />
        </div>
      ) : (
        <div className="ai-panel__analysis-area">
          <EmptyState icon="💡" message="点击「AI 分析」开始分析" hint="分析结果将展示摘要、关键发现和建议" />
        </div>
      )}

      {/* Debug panel */}
      <PromptDebugPanel entries={debugEntries} visible={showDebug && isApiAvailable} />

      {/* Chat area */}
      <div className="ai-panel__chat-area">
        <ChatMessages
          messages={conversationMessages}
          toolCallEvents={toolCallEvents}
        />
        <ChatInput
          ref={inputRef}
          onSend={handleSend}
          isLoading={isAnyLoading}
          disabled={!isApiAvailable}
        />
      </div>

      {/* API Key hint - always visible at bottom */}
      {!isApiAvailable && (
        <button className="ai-panel__no-api-hint" onClick={handleOpenSettings}>
          🔑 未配置 API Key，点击设置
          <br />
          <span className="ai-panel__no-api-hint-detail">
            点击此处粘贴你的 DashScope API Key
          </span>
        </button>
      )}

      {/* Settings modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveApiKey}
        hasExistingKey={isApiAvailable}
      />
    </div>
  );
}

// ---- Mock analysis with streaming simulation ----
interface MockAnalysisRefs {
  current: ReturnType<typeof setInterval>[];
}

function simulateMockAnalysis(
  fileId: string,
  file: FileNode | null,
  setStreamed: React.Dispatch<React.SetStateAction<Partial<AnalysisResult> | null>>,
  setAnalyzing: (loading: boolean, id?: string) => void,
  setAnalyzeError: (error: string | null) => void,
  intervalsRef: MockAnalysisRefs,
) {
  setAnalyzing(true, fileId);
  setAnalyzeError(null);

  const mockData: Record<string, { summary: string; keyPoints: string[] }> = {
    code: {
      summary: `这是一份代码文件（${file?.ext || '未知类型'}）。整体结构清晰，函数职责划分基本明确。`,
      keyPoints: [
        '代码结构基本清晰，函数职责划分合理',
        '建议增加关键逻辑的注释说明',
        '考虑添加单元测试覆盖核心功能',
        '部分边界条件处理可以更加完善',
      ],
    },
    text: {
      summary: `这是一份文本文档。内容结构完整，逻辑清晰。`,
      keyPoints: [
        '文档结构完整，逻辑清晰',
        '核心主题表达明确',
        '建议补充更多细节和示例',
        '可考虑增加目录或索引便于导航',
      ],
    },
    data: {
      summary: `这是一份数据文件（${file?.ext || '未知格式'}）。数据结构规范，字段定义明确。`,
      keyPoints: [
        '数据结构规范，字段定义明确',
        '数据格式一致性良好',
        '建议检查缺失值和异常数据',
        '可考虑增加数据字典说明各字段含义',
      ],
    },
  };

  const fileType = file?.fileType ?? 'text';
  const data = mockData[fileType] ?? mockData.text;

  // Safety check (TypeScript strict mode)
  if (!data) return null;

  // Simulate streaming: show loading for 1s, then stream summary + keyPoints
  const loadTimeout = setTimeout(() => {
    // Start streaming the summary sentence by sentence
    const sentences = data.summary.split('。').filter(Boolean).map(s => s + '。');
    let summaryIndex = 0;
    let currentSummary = '';
    let keyPointIndex = 0;
    let currentKeyPoints: string[] = [];

    const interval = setInterval(() => {
      // Stream summary first
      if (summaryIndex < sentences.length) {
        currentSummary += sentences[summaryIndex]!;
        summaryIndex++;
        setStreamed({ summary: currentSummary, keyPoints: [...currentKeyPoints], source: 'mock' });
        return;
      }

      // Then stream key points one by one
      if (keyPointIndex < data.keyPoints.length) {
        currentKeyPoints.push(data.keyPoints[keyPointIndex]!);
        keyPointIndex++;
        setStreamed({ summary: currentSummary, keyPoints: [...currentKeyPoints], source: 'mock' });
        return;
      }

      // Done streaming
      clearInterval(interval);
      const result: AnalysisResult = {
        summary: currentSummary,
        keyPoints: currentKeyPoints,
        analysisTimeMs: 2000,
        source: 'mock',
      };
      setStreamed(null);
      setAnalyzing(false);
      // We need to cache this result - but we can't call setAnalysisResult here
      // Instead, we'll let the component handle it via the streamedAnalysis state
      // For now, store it via a side effect
      const { useStore } = require('../../store');
      useStore.getState().setAnalysisResult(fileId, result);
    }, 400);

    intervalsRef.current.push(interval);
  }, 1000);

  intervalsRef.current.push(loadTimeout);
}

function getFileIcon(node: FileNode): string {
  if (node.type === 'folder') return '📁';
  const map: Record<string, string> = {
    code: '📕', text: '📄', data: '📊', image: '🖼️', binary: '📦',
  };
  return map[node.fileType] ?? '📦';
}
