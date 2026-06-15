import type { FileNode } from '../types';

const ICON_MAP: Record<string, string> = {
  code: '📕',
  text: '📄',
  data: '📊',
  image: '🖼️',
  binary: '📦',
};

const FOLDER_ICON = '📁';
const FOLDER_OPEN_ICON = '📂';

/**
 * Return an emoji icon based on file type.
 */
export function getFileIcon(node: FileNode, isOpen?: boolean): string {
  if (node.type === 'folder') {
    return isOpen ? FOLDER_OPEN_ICON : FOLDER_ICON;
  }
  const icon = ICON_MAP[node.fileType];
  if (icon) return icon;
  return ICON_MAP.binary!;
}
