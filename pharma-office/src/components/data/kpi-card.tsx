import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function KpiCard({
  label,
  value,
  source,
  lines,
  href,
  muted,
}: {
  label: string;
  value: ReactNode;
  source?: ReactNode;
  lines?: ReactNode[];
  href?: string;
  muted?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {source}
      </div>
      <p className={cn("num mt-1 text-start text-2xl font-semibold tracking-tight", muted ? "text-muted" : "text-ink")}>{value}</p>
      {lines?.length ? (
        <ul className="mt-2 space-y-0.5 text-xs text-ink-2">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
  const cls = "block rounded-lg border border-line bg-surface p-3.5";
  return href ? (
    <a href={href} className={cn(cls, "transition-colors hover:border-line-strong")}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Delta({ value, suffix, invert }: { value: number | null; suffix: string; invert?: boolean }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-muted">— {suffix}</span>;
  const good = invert ? value < 0 : value >= 0;
  return (
    <span>
      <span className={cn("num font-semibold", good ? "text-good" : "text-bad")}>
        {value >= 0 ? "▲" : "▼"} {Math.abs(value).toFixed(0)}%
      </span>{" "}
      <span className="text-muted">{suffix}</span>
    </span>
  );
}
