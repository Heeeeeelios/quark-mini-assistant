import type { ReactElement } from 'react';
import { useEffect, useMemo, useState, useCallback } from 'react';
import type { FileNode } from '../../types';
import { useStore, findFileNode } from '../../store';
import { useAnalyze } from '../../hooks/useAnalyze';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import SettingsModal from '../shared/SettingsModal';
import AnalysisResult from './AnalysisResult';
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
    analysisCache: _analysisCache,
    conversationFileId,
    conversationMessages,
    isChatLoading,
    chatError: _chatError,
    toolCallEvents,
    debugEntries,
    setApiAvailability,
    startConversation,
    clearConversation,
    addUserMessage,
    startAssistantMessage,
    appendAssistantChunk,
    finishAssistantMessage,
    addToolCallEvent: _addToolCallEvent,
    addDebugEntry,
    clearToolCallEvents,
  } = useStore();

  const { analyze, isAnalyzing, analyzingFileId, analyzeError, getCachedResult } = useAnalyze();
  const [showDebug, setShowDebug] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  // Auto-start conversation when file is selected (if different from current)
  useEffect(() => {
    if (selectedFileId && selectedFileId !== conversationFileId && selectedFile) {
      const summary = selectedFile.content
        ? selectedFile.content.slice(0, 500)
        : `${selectedFile.name} (${selectedFile.fileType})`;
      startConversation(selectedFileId, summary);
      clearToolCallEvents();
    }
    // Clear conversation when no file is selected
    if (!selectedFileId && conversationFileId) {
      clearConversation();
    }
  }, [selectedFileId, conversationFileId, selectedFile, startConversation, clearConversation, clearToolCallEvents]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!selectedFileId) return;

      // Add user message to store
      addUserMessage(text);
      startAssistantMessage();

      // Build messages for API (exclude system message from store, we'll add it)
      const apiMessages: Array<{ role: string; content: string }> = [];
      for (const msg of conversationMessages) {
        if (msg.role === 'system') continue; // skip stored system msg
        apiMessages.push({ role: msg.role, content: msg.content });
      }
      // Add the new user message
      apiMessages.push({ role: 'user', content: text });

      // Build debug entry
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

      // Clear previous tool events
      clearToolCallEvents();

      try {
        // Set up streaming listeners
        const cleanupChunk = window.api.onChatChunk((chunk: string) => {
          appendAssistantChunk(chunk);
        });

        const cleanupDone = window.api.onChatDone((error?: string) => {
          cleanupChunk();
          cleanupDone();
          if (error) {
            // Replace streaming message with error
            finishAssistantMessage(error);
          } else {
            finishAssistantMessage();
          }
        });

        // Send chat request
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

  // ---- Render based on state ----

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
      {/* Header: file name + analyze button + debug toggle */}
      <header className="ai-panel__header">
        <div className="ai-panel__file-name" title={selectedFile.name}>
          {getFileIcon(selectedFile)} {selectedFile.name}
        </div>
        <div className="ai-panel__header-actions">
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
            onClick={() => selectedFileId && analyze(selectedFileId)}
            disabled={isLoading || !isAnalyzable}
          >
            {isLoading ? '分析中...' : '🔍 AI 分析'}
          </button>
        </div>
      </header>

      {/* Analysis result area */}
      {isLoading ? (
        <div className="ai-panel__analysis-area">
          <LoadingSpinner label="AI 正在分析文件内容..." />
        </div>
      ) : analyzeError ? (
        <div className="ai-panel__analysis-area ai-panel__error">
          <EmptyState icon="⚠️" message={analyzeError} hint="点击 AI 分析按钮重试" />
        </div>
      ) : cachedResult ? (
        <div className="ai-panel__analysis-area">
          <AnalysisResult result={cachedResult} />
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
        {!isApiAvailable && (
          <button className="ai-panel__no-api-hint" onClick={handleOpenSettings}>
            ⚙️ 未配置 API Key，点击设置
            <br />
            <span className="ai-panel__no-api-hint-detail">
              点击此处粘贴你的 DashScope API Key
            </span>
          </button>
        )}
      </div>

      {/* Settings modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveApiKey}
        hasExistingKey={false}
      />
    </div>
  );
}

function getFileIcon(node: FileNode): string {
  if (node.type === 'folder') return '📁';
  const map: Record<string, string> = {
    code: '📕', text: '📄', data: '📊', image: '🖼️', binary: '📦',
  };
  return map[node.fileType] ?? '📦';
}
