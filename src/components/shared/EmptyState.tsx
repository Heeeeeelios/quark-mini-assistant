import type { ReactElement } from 'react';
import './EmptyState.css';

interface EmptyStateProps {
  icon?: string;
  message: string;
  hint?: string;
}

export default function EmptyState({
  icon = '📄',
  message,
  hint,
}: EmptyStateProps): ReactElement {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">{icon}</span>
      <p className="empty-state__message">{message}</p>
      {hint && <p className="empty-state__hint">{hint}</p>}
    </div>
  );
}
