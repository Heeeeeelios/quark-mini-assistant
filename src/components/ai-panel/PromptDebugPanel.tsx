import type { ReactElement } from 'react';
import { useState } from 'react';
import type { DebugEntry } from '../../store';
import './PromptDebugPanel.css';

interface PromptDebugPanelProps {
  entries: DebugEntry[];
  visible: boolean;
}

export default function PromptDebugPanel({
  entries,
  visible,
}: PromptDebugPanelProps): ReactElement {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!visible) return <></>;

  return (
    <div className="prompt-debug-panel">
      <div className="prompt-debug-panel__header">
        <span>🔧 Prompt 调试</span>
        <span className="prompt-debug-panel__count">
          {entries.length} 条请求
        </span>
      </div>
      <div className="prompt-debug-panel__entries">
        {entries.length === 0 ? (
          <p className="prompt-debug-panel__empty">暂无请求记录</p>
        ) : (
          entries.map((entry, i) => (
            <div
              key={i}
              className={`prompt-debug-panel__entry ${expandedIndex === i ? 'prompt-debug-panel__entry--expanded' : ''}`}
              onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
            >
              <div className="prompt-debug-panel__entry-header">
                <span className="prompt-debug-panel__entry-time">
                  {new Date(entry.timestamp).toLocaleTimeString('zh-CN')}
                </span>
                <span className="prompt-debug-panel__entry-model">
                  {entry.request.model}
                </span>
                <span className="prompt-debug-panel__entry-chevron">
                  {expandedIndex === i ? '▾' : '▸'}
                </span>
              </div>
              {expandedIndex === i && (
                <pre className="prompt-debug-panel__entry-body">
                  {JSON.stringify(entry.request, null, 2)}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
