"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

const sizeClass: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
};

export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: open ? 1 : 0 }}
            transition={{ duration: 0.15 }}
          />
        </Dialog.Overlay>
        <Dialog.Content asChild>
          <motion.div
            className={`fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] ${sizeClass[size]} max-h-[90dvh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-card border border-border-default bg-bg-secondary p-6 shadow-card focus:outline-none`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <Dialog.Close
              type="button"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              aria-label="Close"
            >
              ✕
            </Dialog.Close>
            {title ? (
              <Dialog.Title className="mb-4 pr-8 font-display text-lg font-bold text-text-primary">{title}</Dialog.Title>
            ) : null}
            {children}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
