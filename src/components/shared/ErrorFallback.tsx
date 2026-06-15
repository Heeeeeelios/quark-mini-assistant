import type { ReactElement, ReactNode } from 'react';
import { Component } from 'react';
import './ErrorFallback.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorFallback extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReload = () => {
    window.location.reload();
  };

  render(): ReactElement {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <span className="error-fallback__icon">💥</span>
          <h2 className="error-fallback__title">应用出现错误</h2>
          <p className="error-fallback__message">
            {this.state.error?.message || '未知错误'}
          </p>
          <button className="error-fallback__reload-btn" onClick={this.handleReload}>
            🔄 重新加载
          </button>
        </div>
      );
    }

    return this.props.children as ReactElement;
  }
}
