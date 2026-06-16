import type { ReactElement } from 'react';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import type { FileNode } from '../../types';
import type { AnalysisResult } from '../../types';
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
  } = useStore();

  const {
    analyze,
    isAnalyzing,
    analyzingFileId,
    analyzeError,
    getCachedResult,
  } = useAnalyze();

  const [showDebug, setShowDebug] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // For mock streaming: track the streamed content
  const mockStreamRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedFile = useMemo(
    () => (selectedFileId ? findFileNode(fileTree, selectedFileId) : null),
    [fileTree, selectedFileId],
  );

  const cachedResult = selectedFileId ? getCachedResult(selectedFileId) : null;
  const isLoading = isAnalyzing && analyzingFileId === selectedFileId;
  const isAnalyzable = selectedFile && ['text', 'code', 'data'].includes(selectedFile.fileType);

  // Check API key on mount
  useEffect(() => {
    window.api.checkApiKey().then(({ configured }) => {
      setApiAvailability(configured);
    });
  }, [setApiAvailability]);

  // Cleanup mock stream on unmount
  useEffect(() => {
    return () => {
      if (mockStreamRef.current) {
        clearTimeout(mockStreamRef.current);
      }
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

  // Wrap analyze to add mock streaming effect
  const handleAnalyze = useCallback(
    async (fileId: string) => {
      if (!isAnalyzable) return;

      // If no API key configured, simulate mock analysis with streaming
      if (!isApiAvailable) {
        simulateMockAnalysis(fileId, selectedFile);
        return;
      }

      // Real API call
      await analyze(fileId);
    },
    [isAnalyzable, isApiAvailable, analyze, selectedFile],
  );

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
            finishAssistantMessage(error);
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
        finishAssistantMessage(err instanceof Error ? err.message : '对话失败');
      }
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
        <EmptyState icon="🤖" message="请先选择一个文件夹" hint="AI 功能需要先选择包含文件的目录" />
      </div>
    );
  }

  // No file selected
  if (!selectedFile) {
    return (
      <div className="ai-panel">
        <EmptyState icon="🤖" message="请在左侧选择一个文件" hint="选择文件后可进行 AI 分析" />
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
            disabled={isLoading || !isAnalyzable}
          >
            {isLoading ? '分析中...' : '🔍 AI 分析'}
          </button>
        </div>
      </header>

      {/* Analysis result area */}
      {isLoading ? (
        <div className="ai-panel__analysis-area ai-panel__analysis-area--loading">
          <LoadingSpinner label="AI 正在分析文件内容..." />
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
          onSend={handleSend}
          isLoading={isChatLoading || isAnalyzing}
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

/**
 * Simulate mock analysis with streaming-like typing effect.
 * Shows loading for 1.5s, then streams the mock result character by character.
 */
function simulateMockAnalysis(fileId: string, file?: FileNode | null) {
  // Import store actions directly for mock streaming
  const { useStore } = require('../../store');
  const store = useStore.getState();

  // Step 1: Show loading
  store.setAnalyzing(true, fileId);
  store.setAnalyzeError(null);

  // Step 2: After 1.5s delay, start streaming mock result
  const timeout = setTimeout(() => {
    const mockTexts: Record<string, AnalysisResult> = {
      code: {
        summary: `这是一份代码文件（${file?.ext || '未知类型'}）。整体结构清晰，函数职责划分基本明确。建议增加注释说明关键逻辑，并考虑添加单元测试覆盖。`,
        keyPoints: [
          '代码结构基本清晰，函数职责划分合理',
          '建议增加关键逻辑的注释说明',
          '考虑添加单元测试覆盖核心功能',
          '部分边界条件处理可以更加完善',
        ],
        analysisTimeMs: 1500,
        source: 'mock',
      },
      text: {
        summary: `这是一份文本文档。内容结构完整，逻辑清晰。文档涵盖了主要主题的核心信息，建议补充更多细节以增强可读性。`,
        keyPoints: [
          '文档结构完整，逻辑清晰',
          '核心主题表达明确',
          '建议补充更多细节和示例',
          '可考虑增加目录或索引便于导航',
        ],
        analysisTimeMs: 1500,
        source: 'mock',
      },
      data: {
        summary: `这是一份数据文件（${file?.ext || '未知格式'}）。数据结构规范，字段定义明确。建议检查是否有缺失值或异常数据，并考虑增加数据字典说明。`,
        keyPoints: [
          '数据结构规范，字段定义明确',
          '数据格式一致性良好',
          '建议检查缺失值和异常数据',
          '可考虑增加数据字典说明各字段含义',
        ],
        analysisTimeMs: 1500,
        source: 'mock',
      },
    };

    const fileType = file?.fileType ?? 'text';
    const result = mockTexts[fileType] ?? mockTexts.text;

    // Step 3: Set the result directly (instant, no streaming needed for mock)
    store.setAnalysisResult(fileId, result);
  }, 1500);

  return timeout;
}

function getFileIcon(node: FileNode): string {
  if (node.type === 'folder') return '📁';
  const map: Record<string, string> = {
    code: '📕', text: '📄', data: '📊', image: '🖼️', binary: '📦',
  };
  return map[node.fileType] ?? '📦';
}
