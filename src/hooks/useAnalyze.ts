import { useCallback } from 'react';
import { useStore } from '../store';
import type { AnalysisResult } from '../types';

/**
 * Hook for triggering AI file analysis.
 * Checks cache first, calls API if not cached.
 * Falls back to Mock result if API fails or no key configured.
 */
export function useAnalyze() {
  const {
    analysisCache,
    isAnalyzing,
    analyzeError,
    analyzingFileId,
    setAnalysisResult,
    setAnalyzing,
    setAnalyzeError,
  } = useStore();

  const analyze = useCallback(
    async (fileId: string): Promise<void> => {
      // Check cache first
      if (analysisCache[fileId]) {
        return;
      }

      setAnalyzing(true, fileId);
      setAnalyzeError(null);

      try {
        const response = await window.api.analyzeFile(fileId);

        // Check if response is an error object
        if (response && typeof response === 'object' && 'error' in response) {
          // API returned an error — show it but don't block
          setAnalyzeError(response.error.message || '分析失败');
          return;
        }

        // Validate response is a proper AnalysisResult
        if (response && typeof response === 'object' && 'summary' in response) {
          setAnalysisResult(fileId, response as AnalysisResult);
          return;
        }

        // Unexpected response — show a fallback
        setAnalyzeError('响应格式异常，请检查控制台');
        console.error('Unexpected analyzeFile response:', response);
      } catch (err) {
        const message = err instanceof Error ? err.message : '分析失败';
        setAnalyzeError(message);
        console.error('analyzeFile error:', err);
      }
    },
    [analysisCache, setAnalysisResult, setAnalyzing, setAnalyzeError],
  );

  return {
    analyze,
    isAnalyzing,
    analyzingFileId,
    analyzeError,
    getCachedResult: (fileId: string) => analysisCache[fileId] ?? null,
  };
}
