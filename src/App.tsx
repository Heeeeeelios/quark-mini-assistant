import type { ReactElement } from 'react';
import ErrorFallback from './components/shared/ErrorFallback';
import TitleBar from './components/layout/TitleBar';
import AppLayout from './components/layout/AppLayout';

export default function App(): ReactElement {
  return (
    <ErrorFallback>
      <div className="app-root">
        <TitleBar />
        <AppLayout />
      </div>
    </ErrorFallback>
  );
}
