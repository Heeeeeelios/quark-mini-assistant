import type { ReactElement } from 'react';
import type { FileNode } from '../../types';
import { getFileIcon } from '../../utils/file-icon';
import { isFolderOpen } from '../../store';
import './FileTreeNode.css';

interface FileTreeNodeProps {
  node: FileNode;
  selectedFileId: string | null;
  collapsedFolders: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

export default function FileTreeNode({
  node,
  selectedFileId,
  collapsedFolders,
  onSelect,
  onToggle,
}: FileTreeNodeProps): ReactElement {
  const icon = getFileIcon(node, isFolderOpen(node, collapsedFolders));
  const hasChildren = node.type === 'folder' && node.children && node.children.length > 0;
  const isOpen = isFolderOpen(node, collapsedFolders);
  const isSelected = selectedFileId === node.id;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'folder') {
      onToggle(node.id);
    } else {
      onSelect(node.id);
    }
  };

  return (
    <div className="file-tree-node">
      <div
        className={`file-tree-node__row ${isSelected ? 'file-tree-node__row--selected' : ''}`}
        style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        <span className="file-tree-node__icon">{icon}</span>
        {hasChildren && (
          <span className="file-tree-node__chevron">
            {isOpen ? '▾' : '▸'}
          </span>
        )}
        <span className="file-tree-node__name" title={node.name}>
          {node.name}
        </span>
      </div>
      {isOpen && hasChildren && (
        <div className="file-tree-node__children">
          {node.children!.map((child) => (
            <FileTreeNode
              key={child.id}
              node={child}
              selectedFileId={selectedFileId}
              collapsedFolders={collapsedFolders}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
