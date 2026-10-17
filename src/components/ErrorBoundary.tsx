import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Глобальный обработчик ошибок React (app-shell).
 * Любое исключение при рендере страницы перехватывается и показывается
 * карточка с кнопкой «Перезагрузить» вместо белого экрана.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center text-slate-900 dark:bg-slate-900 dark:text-slate-100">
          <h1 className="text-xl font-bold">Что-то пошло не так 😔</h1>
          <p className="max-w-md text-sm text-slate-400">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-[48px] rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-500"
          >
            Перезагрузить
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
