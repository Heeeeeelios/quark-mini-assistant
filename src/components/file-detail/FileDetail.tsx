import type { ReactElement } from 'react';
import { useMemo } from 'react';
import type { FileNode } from '../../types';
import { formatSize, formatDate } from '../../utils/format';
import EmptyState from '../shared/EmptyState';
import './FileDetail.css';

interface FileDetailProps {
  node: FileNode | null;
  hasDirectory: boolean;
}

const TEXT_TYPES = new Set(['text', 'code', 'data']);

export default function FileDetail({
  node,
  hasDirectory,
}: FileDetailProps): ReactElement {
  const lines = useMemo(() => {
    if (!node?.content) return [];
    return node.content.split('\n');
  }, [node?.content]);

  if (!hasDirectory) {
    return <EmptyState message="请先选择一个文件夹以浏览文件" />;
  }

  if (!node) {
    return <EmptyState message="请在左侧选择一个文件" />;
  }

  const isTextFile = TEXT_TYPES.has(node.fileType);

  return (
    <div className="file-detail">
      {/* Metadata header */}
      <header className="file-detail__header">
        <div className="file-detail__name" title={node.name}>
          <span className="file-detail__icon">
            {node.type === 'folder' ? '📁' : getFileTypeEmoji(node.fileType)}
          </span>
          {node.name}
        </div>
        <dl className="file-detail__meta">
          <div className="file-detail__meta-item">
            <dt>类型</dt>
            <dd>{getFileTypeLabel(node.fileType)}</dd>
          </div>
          {node.ext && (
            <div className="file-detail__meta-item">
              <dt>扩展名</dt>
              <dd>{node.ext}</dd>
            </div>
          )}
          <div className="file-detail__meta-item">
            <dt>大小</dt>
            <dd>{formatSize(node.sizeBytes)}</dd>
          </div>
          <div className="file-detail__meta-item">
            <dt>修改时间</dt>
            <dd>{formatDate(node.modifiedAt)}</dd>
          </div>
        </dl>
      </header>

      {/* Content preview */}
      {isTextFile && node.content ? (
        <div className="file-detail__content">
          <div className="file-detail__content-header">
            内容预览
            {node.contentTruncated && (
              <span className="file-detail__content-truncated">
                （仅展示前200行）
              </span>
            )}
          </div>
          <pre className="file-detail__code-block">
            <code>
              {lines.map((line, i) => (
                <div key={i} className="file-detail__code-line">
                  <span className="file-detail__line-number">{i + 1}</span>
                  <span className="file-detail__line-content">{line || ' '}</span>
                </div>
              ))}
            </code>
          </pre>
        </div>
      ) : (
        <div className="file-detail__no-preview">
          <EmptyState
            icon="🚫"
            message="该文件类型暂不支持内容预览"
            hint={`文件类型：${node.ext || '未知'}`}
          />
        </div>
      )}
    </div>
  );
}

function getFileTypeEmoji(type: FileNode['fileType']): string {
  const map: Record<string, string> = {
    code: '📕',
    text: '📄',
    data: '📊',
    image: '🖼️',
    binary: '📦',
  };
  return map[type] ?? '📦';
}

function getFileTypeLabel(type: FileNode['fileType']): string {
  const map: Record<string, string> = {
    code: '代码文件',
    text: '文本文件',
    data: '数据文件',
    image: '图片文件',
    binary: '其他文件',
  };
  return map[type] ?? '未知';
}
