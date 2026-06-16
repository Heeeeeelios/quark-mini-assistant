import type { ReactElement } from 'react';
import type { AnalysisResult } from '../../types';
import './AnalysisResult.css';

interface AnalysisResultProps {
  result: AnalysisResult;
}

export default function AnalysisResult({
  result,
}: AnalysisResultProps): ReactElement {
  const isMock = result.source === 'mock';

  return (
    <div className="analysis-result">
      {/* Mode label in header area */}
      <div className="analysis-result__header">
        <span className={`analysis-result__mode-badge ${isMock ? 'analysis-result__mode-badge--mock' : 'analysis-result__mode-badge--api'}`}>
          {isMock ? '演示模式' : 'AI 分析'}
        </span>
      </div>

      {/* Summary card */}
      <div className="analysis-result__card">
        <h3 className="analysis-result__card-title">📝 摘要</h3>
        <p className="analysis-result__card-content">{result.summary}</p>
      </div>

      {/* Key points card */}
      {result.keyPoints.length > 0 && (
        <div className="analysis-result__card">
          <h3 className="analysis-result__card-title">💡 关键发现</h3>
          <ul className="analysis-result__card-list">
            {result.keyPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Timing footer */}
      <div className="analysis-result__footer">
        <span>分析耗时 {result.analysisTimeMs > 0 ? `${(result.analysisTimeMs / 1000).toFixed(1)}s` : '—'}</span>
      </div>
    </div>
  );
}
