import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Erro inesperado na interface.' };
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) friendly = parsed.error;
      } catch {
        // plain error message
      }
      return (
        <div className="min-h-screen flex items-center justify-center px-6 bg-[var(--site-bg)] text-[var(--site-text)]">
          <div className="max-w-lg w-full p-8 border border-[var(--site-border)] bg-[var(--site-surface)] rounded-lg space-y-4">
            <h2 className="font-editorial text-2xl font-semibold">Aviso do Sistema</h2>
            <p className="text-sm text-[var(--site-text-muted)] leading-relaxed">{friendly}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.href = '/';
              }}
              className="px-5 py-2.5 text-sm font-medium bg-[var(--site-text)] text-[var(--site-surface)] rounded-[var(--site-radius)] hover:opacity-90 transition-opacity"
            >
              Voltar ao início
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
