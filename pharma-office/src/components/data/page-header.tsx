import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions, badges }: { title: string; subtitle?: string; actions?: ReactNode; badges?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {badges}
        </div>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "phase" }) {
  return (
    <p
      className={
        tone === "phase"
          ? "rounded-md border border-dashed border-estimated/40 bg-estimated-soft/50 px-3 py-2 text-xs text-ink-2"
          : "rounded-md border border-line bg-surface px-3 py-2 text-xs text-ink-2"
      }
    >
      {children}
    </p>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-b-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num text-end text-sm font-medium text-ink">
        {value}
        {hint ? <span className="ms-1 text-xs font-normal text-muted">{hint}</span> : null}
      </dd>
    </div>
  );
}
