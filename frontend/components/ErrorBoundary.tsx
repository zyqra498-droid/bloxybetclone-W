"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; title?: string };

type State = { err: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(err: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught:", err, info.componentStack);
  }

  render() {
    if (this.state.err) {
      return (
        <div className="rounded-xl border border-accent-red/30 bg-bg-secondary p-8 text-center">
          <h2 className="font-display text-xl font-bold text-text-primary">{this.props.title ?? "Something went wrong"}</h2>
          <p className="mt-2 text-sm text-text-secondary">{this.state.err.message}</p>
          <button
            type="button"
            className="mt-3 rounded-pill bg-accent-purple px-4 py-2 text-sm font-semibold text-white"
            onClick={() => this.setState({ err: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
