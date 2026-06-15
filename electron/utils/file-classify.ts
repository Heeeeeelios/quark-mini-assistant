const CODE_EXTENSIONS = new Set([
  '.js', '.ts', '.py', '.jsx', '.tsx', '.mjs', '.cjs',
  '.java', '.go', '.rs', '.cpp', '.c', '.h', '.hpp',
  '.rb', '.php', '.swift', '.kt', '.scala', '.sh',
]);

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.log', '.yaml', '.yml', '.xml',
  '.html', '.css', '.scss', '.less', '.toml', '.ini',
  '.cfg', '.conf', '.env', '.bash', '.zsh',
]);

const DATA_EXTENSIONS = new Set([
  '.json', '.csv', '.sql', '.parquet',
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
