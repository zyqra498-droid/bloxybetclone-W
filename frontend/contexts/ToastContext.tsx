"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

export type ToastKind = "win" | "loss" | "deposit" | "admin";

type Toast = { id: string; title: string; body?: string; kind: ToastKind; created: number };

type ToastContextValue = {
  push: (t: { title: string; body?: string; kind?: ToastKind }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const ids = useRef<Set<string>>(new Set());

  const push = useCallback((t: { title: string; body?: string; kind?: ToastKind }) => {
    const id = crypto.randomUUID();
    ids.current.add(id);
    setToasts((prev) => [
      ...prev,
      { id, title: t.title, body: t.body, kind: t.kind ?? "admin", created: Date.now() },
    ]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const t = window.setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((x) => now - x.created < DURATION_MS + 500));
    }, 500);
    return () => clearInterval(t);
  }, [toasts.length]);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 80 }}
              className={`pointer-events-auto overflow-hidden rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md ${
                t.kind === "win"
                  ? "border-accent-green/40 bg-[#0f1f18]/95 text-text-primary"
                  : t.kind === "loss"
                    ? "border-accent-red/40 bg-[#1f0f0f]/95 text-text-primary"
                    : t.kind === "deposit"
                      ? "border-accent-blue/40 bg-[#0f1520]/95 text-text-primary"
                      : "border-accent-purple/40 bg-bg-tertiary/95 text-text-primary"
              }`}
            >
              <p className="font-semibold">{t.title}</p>
              {t.body && <p className="mt-1 text-sm text-text-secondary">{t.body}</p>}
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full bg-current opacity-60"
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: DURATION_MS / 1000, ease: "linear" }}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) return { push: () => {} };
  return ctx;
}
