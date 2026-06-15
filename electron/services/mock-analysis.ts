export interface MockAnalysisResult {
  summary: string;
  keyPoints: string[];
}

const MOCK_ANALYSES: MockAnalysisResult[] = [
  {
    summary: '这是一份代码文件。文件包含了主要的业务逻辑，函数和类职责划分较为清晰。整体结构合理，但存在一些可以改进的地方。',
    keyPoints: [
      '代码包含多个函数/类，职责划分基本清晰',
      '存在潜在的边界条件处理不完善问题',
      '建议增加单元测试覆盖',
      '部分函数可以进一步拆分以提高可读性',
    ],
  },
  {
    summary: '这是一份文档文件。文档描述了一个项目或功能的背景、目标和实施方案，内容结构完整，逻辑清晰。',
    keyPoints: [
      '文档包含背景、目标、实施方案等完整章节',
      '核心概念定义清晰',
      '建议补充时间规划和责任人信息',
      '可考虑增加风险评估部分',
    ],
  },
  {
    summary: '这是一份数据文件。文件包含结构化的数据记录，具有一定的数据规模和字段定义。',
    keyPoints: [
      '数据结构清晰，字段定义明确',
      '数据量适中，格式规范',
      '建议检查是否有缺失值或异常值',
      '可考虑增加数据字典说明',
    ],
  },
];

/**
 * Get a mock analysis result for fallback.
 * Picks randomly from predefined results.
 */
export function getMockAnalysisResult(): MockAnalysisResult {
  return MOCK_ANALYSES[Math.floor(Math.random() * MOCK_ANALYSES.length)];
}

/**
 * Get the static fallback result when even mock data is unavailable.
 */
export function getFallbackAnalysisResult(): MockAnalysisResult {
  return {
    summary: '文件分析功能暂时不可用。请检查网络连接或 API 配置后重试。',
    keyPoints: [
      '确认 API Key 是否正确配置',
      '检查网络连接是否正常',
      '稍后重试',
    ],
  };
}
