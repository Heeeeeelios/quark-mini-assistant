import type { ReactElement } from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  label?: string;
}

export default function LoadingSpinner({
  label = '加载中...',
}: LoadingSpinnerProps): ReactElement {
  return (
    <div className="loading-spinner">
      <div className="loading-spinner__dots">
        <span />
        <span />
        <span />
      </div>
      {label && <span className="loading-spinner__label">{label}</span>}
    </div>
  );
}
