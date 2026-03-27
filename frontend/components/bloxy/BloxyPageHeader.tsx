import type { ReactNode } from "react";

export function BloxyPageHeader({
  title,
  subtitle,
  eyebrow,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border-default pb-6">
      <div>
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted">{eyebrow}</p>
        )}
        <h1 className="font-display text-3xl font-bold text-text-primary md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-text-secondary">{subtitle}</p>}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
