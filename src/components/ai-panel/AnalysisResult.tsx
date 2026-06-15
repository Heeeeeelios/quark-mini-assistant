import type { ReactElement } from 'react';
import type { AnalysisResult } from '../../types';
import './AnalysisResult.css';

interface AnalysisResultProps {
  result: AnalysisResult;
}

export default function AnalysisResult({
  result,
}: AnalysisResultProps): ReactElement {
  return (
    <div className="analysis-result">
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
        <span>AI 分析耗时 {result.analysisTimeMs > 0 ? `${(result.analysisTimeMs / 1000).toFixed(1)}s` : '—'}</span>
        {result.source === 'mock' && (
          <span className="analysis-result__mock-badge">演示模式（Mock 结果）</span>
        )}
      </div>
    </div>
  );
}
