const CODE_EXTENSIONS = new Set([
  '.js', '.ts', '.py', '.jsx', '.tsx', '.mjs', '.cjs',
  '.java', '.go', '.rs', '.cpp', '.c', '.h', '.hpp',
  '.rb', '.php', '.swift', '.kt', '.scala', '.sh',
  '.bash', '.zsh', '.fish', '.ps1',
  '.cs', '.dart', '.lua', '.pl', '.groovy',
]);

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.log', '.yaml', '.yml', '.xml',
  '.html', '.htm', '.css', '.scss', '.less', '.sass',
  '.toml', '.ini', '.cfg', '.conf', '.env', '.properties',
  '.graphql', '.proto', '.thrift', '.markdown',
  '.rst', '.adoc', '.org',
]);

const DATA_EXTENSIONS = new Set([
  '.json', '.csv', '.sql', '.parquet',
  '.tsv', '.xls', '.xlsx',
]);

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp',
]);

export type FileCategory = 'text' | 'code' | 'data' | 'binary' | 'image';

/**
 * Classify a file by its extension.
 */
export function classifyFile(ext: string): FileCategory {
  const lower = ext.toLowerCase();
  if (CODE_EXTENSIONS.has(lower)) return 'code';
  if (TEXT_EXTENSIONS.has(lower)) return 'text';
  if (DATA_EXTENSIONS.has(lower)) return 'data';
  if (IMAGE_EXTENSIONS.has(lower)) return 'image';
  return 'binary';
}
