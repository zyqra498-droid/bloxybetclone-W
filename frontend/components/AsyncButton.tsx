"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  onClickAsync?: () => Promise<void>;
};

export function AsyncButton({ children, onClickAsync, onClick, disabled, ...rest }: Props) {
  const [busy, setBusy] = useState(false);
  const mergedDisabled = disabled || busy;

  async function handle(e: React.MouseEvent<HTMLButtonElement>) {
    onClick?.(e);
    if (e.defaultPrevented || !onClickAsync) return;
    setBusy(true);
    try {
      await onClickAsync();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" {...rest} disabled={mergedDisabled} onClick={handle}>
      {busy ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
