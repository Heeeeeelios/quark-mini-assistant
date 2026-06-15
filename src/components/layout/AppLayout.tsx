import type { ReactElement } from 'react';
import { useMemo, useEffect, useCallback } from 'react';
import { useStore, findFileNode } from '../../store';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import FileTree from '../file-tree/FileTree';
import FileDetail from '../file-detail/FileDetail';
import AIPanel from '../ai-panel/AIPanel';
import './AppLayout.css';

export default function AppLayout(): ReactElement {
  const {
    fileTree,
    selectedFileId,
    collapsedFolders,
    isTreeLoading,
    truncated,
    selectFile,
    toggleFolder,
    setDirectory,
    setLoading,
    setApiAvailability,
  } = useStore();

  const selectedFile = useMemo(
    () => (selectedFileId ? findFileNode(fileTree, selectedFileId) : null),
    [fileTree, selectedFileId],
  );

  const hasDirectory = fileTree.length > 0;

  // Check API key availability on mount
  useEffect(() => {
    window.api.checkApiKey().then(({ configured }) => {
      setApiAvailability(configured);
    });
  }, [setApiAvailability]);

  const handleSelectDirectory = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.api.selectDirectory();
      if (result) {
        setDirectory('selected', result.nodes, result.truncated);
      }
    } catch (err) {
      console.error('Failed to select directory:', err);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setDirectory]);

  // Keyboard shortcuts: Ctrl+O = open folder
  useKeyboardShortcuts({ onOpenFolder: handleSelectDirectory });

  return (
    <div className="app-layout">
      {/* Left panel — file browser */}
      <aside className="app-layout__panel app-layout__panel--left">
        <button className="file-panel__open-btn" onClick={handleSelectDirectory} title="打开文件夹 (Ctrl+O)">
          📂 打开文件夹
        </button>
        <div className="file-panel__shortcut-hint">Ctrl+O</div>
        {isTreeLoading ? (
          <div className="file-panel__loading">
            <div className="file-panel__loading-spinner" />
            加载中...
          </div>
        ) : (
          <>
            <FileTree
              nodes={fileTree}
              selectedFileId={selectedFileId}
              collapsedFolders={collapsedFolders}
              onSelect={selectFile}
              onToggle={toggleFolder}
            />
            {truncated && (
              <div className="file-panel__truncated">
                仅展示前100个条目
              </div>
            )}
          </>
        )}
      </aside>

      {/* Middle panel — file detail */}
      <section className="app-layout__panel app-layout__panel--center">
        <FileDetail node={selectedFile} hasDirectory={hasDirectory} />
      </section>

      {/* Right panel — AI analysis */}
      <aside className="app-layout__panel app-layout__panel--right">
        <AIPanel fileTree={fileTree} selectedFileId={selectedFileId} />
      </aside>
    </div>
  );
}
