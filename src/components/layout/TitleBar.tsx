import type { ReactElement } from 'react';
import './TitleBar.css';

export default function TitleBar(): ReactElement {
  return (
    <header className="titlebar">
      <span className="titlebar-title">夸克 Mini 助手</span>
      <div className="titlebar-actions">
        <button
          className="titlebar-btn"
          title="最小化"
          onClick={() => window.api.windowMinimize()}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button
          className="titlebar-btn titlebar-btn-close"
          title="关闭"
          onClick={() => window.api.windowClose()}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
            <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </header>
  );
}
