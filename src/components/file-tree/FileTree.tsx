import type { ReactElement } from 'react';
import type { FileNode } from '../../types';
import FileTreeNode from './FileTreeNode';
import './FileTree.css';

interface FileTreeProps {
  nodes: FileNode[];
  selectedFileId: string | null;
  collapsedFolders: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

export default function FileTree({
  nodes,
  selectedFileId,
  collapsedFolders,
  onSelect,
  onToggle,
}: FileTreeProps): ReactElement {
  if (nodes.length === 0) {
    return (
      <div className="file-tree-empty">
        <span className="file-tree-empty__icon">📁</span>
        <p>点击上方按钮选择文件夹</p>
      </div>
    );
  }

  return (
    <div className="file-tree">
      {nodes.map((node) => (
        <FileTreeNode
          key={node.id}
          node={node}
          selectedFileId={selectedFileId}
          collapsedFolders={collapsedFolders}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
