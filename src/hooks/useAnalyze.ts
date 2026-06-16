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
        const raw = err instanceof Error ? err.message : '分析失败';
        // Map error code to user-friendly message
        let message = raw;
        if (raw.includes('Key') || raw.includes('key') || raw.includes('验证')) {
          message = 'API Key 验证失败，请在设置中检查 Key 是否正确';
        } else if (raw.includes('网络') || raw.includes('connect')) {
          message = '网络连接失败，请检查网络后重试';
        } else if (raw.includes('超时') || raw.includes('timeout')) {
          message = '请求超时，可能是文件过大或网络不稳定';
        } else if (raw.includes('频率') || raw.includes('额度') || raw.includes('rate')) {
          message = '请求频率过高或额度已用完，请稍后再试';
        }
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
