import fs from 'fs';
import path from 'path';
import { classifyFile } from '../utils/file-classify';

const MAX_DEPTH = 2;
const MAX_ITEMS = 100;
const MAX_LINES = 200;
const TEXT_EXTENSIONS = [
  '.txt', '.md', '.json', '.js', '.ts', '.py', '.csv',
  '.jsx', '.tsx', '.mjs', '.cjs', '.yaml', '.yml', '.xml',
  '.html', '.css', '.scss', '.sh', '.bash', '.zsh',
  '.toml', '.ini', '.cfg', '.conf', '.env', '.log',
];

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'folder' | 'file';
  children?: FileNode[];
  depth: number;
  ext?: string;
  fileType: 'text' | 'code' | 'data' | 'binary' | 'image';
  sizeBytes: number;
  modifiedAt: string;
  content?: string;
  contentTruncated?: boolean;
}

export interface DirectoryResult {
  rootPath: string;
  rootName: string;
  nodes: FileNode[];
  truncated: boolean;
}

/**
 * Read a directory recursively with depth and item limits.
 */
export async function readDirectory(
  dirPath: string,
): Promise<DirectoryResult> {
  const result: DirectoryResult = {
    rootPath: dirPath,
    rootName: path.basename(dirPath),
    nodes: [],
    truncated: false,
  };

  let itemCount = 0;

  async function readDirRecursive(currentPath: string, depth: number): Promise<FileNode[]> {
    if (depth > MAX_DEPTH || itemCount >= MAX_ITEMS) {
      return [];
    }

    const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      if (itemCount >= MAX_ITEMS) {
        result.truncated = true;
        break;
      }

      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        const children = await readDirRecursive(fullPath, depth + 1);
        const stat = await fs.promises.stat(fullPath);
        itemCount++;

        nodes.push({
          id: fullPath,
          name: entry.name,
          path: fullPath,
          type: 'folder',
          children,
          depth,
          fileType: 'binary', // folders are treated as binary (non-file)
          sizeBytes: 0,
          modifiedAt: stat.mtime.toISOString(),
        });
      } else {
        const stat = await fs.promises.stat(fullPath);
        const ext = path.extname(entry.name).toLowerCase();
        const fileType = classifyFile(ext);
        itemCount++;

        const node: FileNode = {
          id: fullPath,
          name: entry.name,
          path: fullPath,
          type: 'file',
          depth,
          ext: ext || undefined,
          fileType,
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        };

        // Read content for text-based files
        if (TEXT_EXTENSIONS.includes(ext)) {
          try {
            const raw = await fs.promises.readFile(fullPath, 'utf-8');
            const lines = raw.split('\n');
            if (lines.length > MAX_LINES) {
              node.content = lines.slice(0, MAX_LINES).join('\n');
              node.contentTruncated = true;
            } else {
              node.content = raw;
            }
          } catch {
            // Skip unreadable files
          }
        }

        nodes.push(node);
      }
    }

    return nodes;
  }

  result.nodes = await readDirRecursive(dirPath, 0);
  if (itemCount >= MAX_ITEMS) {
    result.truncated = true;
  }

  return result;
}
