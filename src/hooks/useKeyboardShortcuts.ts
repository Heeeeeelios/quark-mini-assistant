import { useEffect } from 'react';

interface ShortcutMap {
  /** Ctrl+O — open folder */
  onOpenFolder?: () => void;
}

/**
 * Global keyboard shortcuts.
 * - Enter in textarea is handled by ChatInput component (Shift+Enter for newline)
 * - Ctrl+O: open folder
 */
export function useKeyboardShortcuts({ onOpenFolder }: ShortcutMap): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+O / Cmd+O: open folder
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        onOpenFolder?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenFolder]);
}
