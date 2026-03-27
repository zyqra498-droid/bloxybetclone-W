"use client";

import { Component, type ComponentType, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };

type State = { hasError: boolean; err: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, err: null };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, err };
  }

  componentDidCatch(err: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console -- debug-only
      console.error("ErrorBoundary:", err, info.componentStack);
    }
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.err) {
      return (
        <div className="rounded-card border border-accent-red/30 bg-bg-secondary p-8 text-center shadow-card">
          <p className="text-2xl" aria-hidden>
            ⚠️
          </p>
          <h2 className="mt-2 font-display text-xl font-bold text-text-primary">Something went wrong</h2>
          <p className="mt-3 font-mono text-sm text-accent-red">{this.state.err.message}</p>
          <button
            type="button"
            className="mt-4 rounded-btn bg-accent-purple px-5 py-2 text-sm font-semibold text-white transition active:scale-95"
            onClick={() => this.setState({ hasError: false, err: null })}
          >
            Reset
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function withErrorBoundary<P extends object>(C: ComponentType<P>): ComponentType<P> {
  function Wrapped(props: P) {
    return (
      <ErrorBoundary>
        <C {...props} />
      </ErrorBoundary>
    );
  }
  Wrapped.displayName = `withErrorBoundary(${C.displayName ?? C.name ?? "Component"})`;
  return Wrapped;
}
