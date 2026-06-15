import { useCallback } from 'react';
import { useStore } from '../store';

/**
 * Hook for triggering AI file analysis.
 * Checks cache first, calls API if not cached.
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

        // Check if response is an error
        if (response && 'error' in response) {
          setAnalyzeError(response.error.message);
          return;
        }

        // Store result
        setAnalysisResult(fileId, response);
      } catch (err) {
        setAnalyzeError(err instanceof Error ? err.message : '分析失败');
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
