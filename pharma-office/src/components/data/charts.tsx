/**
 * Small server-rendered SVG charts. Deliberately simple: no client JS, no
 * animation, legible in print. Bars are drawn left-to-right in time even in
 * RTL layouts (time axes conventionally read left-to-right in Arabic finance).
 */
export function BarSeries({
  data,
  height = 140,
  formatValue,
  formatLabel,
  ariaLabel,
}: {
  data: { key: string; value: number }[];
  height?: number;
  formatValue: (v: number) => string;
  formatLabel: (key: string) => string;
  ariaLabel: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = 100 / Math.max(1, data.length);
  return (
    <figure dir="ltr" aria-label={ariaLabel} className="w-full">
      <svg viewBox={`0 0 100 ${height / 3}`} preserveAspectRatio="none" className="h-36 w-full" role="img">
        <title>{ariaLabel}</title>
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 3 - 2);
          const last = i === data.length - 1;
          return (
            <rect
              key={d.key}
              x={i * barW + barW * 0.15}
              y={height / 3 - h}
              width={barW * 0.7}
              height={Math.max(h, 0.3)}
              className={last ? "fill-brand/40" : "fill-brand"}
            >
              <title>{`${formatLabel(d.key)}: ${formatValue(d.value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 grid text-center text-[10px] text-muted" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((d) => (
          <span key={d.key} className="truncate">
            {formatLabel(d.key)}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** Horizontal stacked bar for composition (e.g. not due vs overdue). */
export function StackedBar({ parts, ariaLabel }: { parts: { value: number; className: string; label: string }[]; ariaLabel: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div role="img" aria-label={ariaLabel} className="flex h-3 w-full overflow-hidden rounded-full bg-canvas">
      {parts.map((p) => (
        <div key={p.label} title={p.label} className={p.className} style={{ width: `${(p.value / total) * 100}%` }} />
      ))}
    </div>
  );
}

export function UtilisationBar({ value }: { value: number | null }) {
  if (value === null) return null;
  const pct = Math.min(100, Math.max(0, value * 100));
  const tone = value >= 1 ? "bg-critical" : value >= 0.9 ? "bg-bad" : value >= 0.75 ? "bg-warn" : "bg-good";
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-canvas" aria-hidden>
      <div className={tone} style={{ width: `${pct}%`, height: "100%" }} />
    </div>
  );
}
