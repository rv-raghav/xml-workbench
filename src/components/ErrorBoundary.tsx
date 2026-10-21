import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('XML Workbench crashed', error, info.componentStack);
    }
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash-screen" role="alert">
        <h1>Something went wrong</h1>
        <p>The editor hit an unexpected error. Your tabs are still in local storage.</p>
        <pre>{this.state.error.message}</pre>
        <button type="button" className="primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
