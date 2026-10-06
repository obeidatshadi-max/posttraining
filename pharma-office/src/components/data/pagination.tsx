import Link from "next/link";
import { interpolate } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/cn";

export function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
  t,
}: {
  basePath: string;
  params: Record<string, string | number | undefined>;
  page: number;
  pageSize: number;
  total: number;
  t: Dictionary;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "" && k !== "page") sp.set(k, String(v));
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const link = "rounded-md border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium";
  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-muted" aria-label="Pagination">
      <span>
        {interpolate(t.common.resultsCount, { count: total })} · {interpolate(t.common.pageOf, { page: Math.min(page, pages), pages })}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className={link} href={href(page - 1)}>
            {t.common.previous}
          </Link>
        ) : (
          <span className={cn(link, "opacity-40")}>{t.common.previous}</span>
        )}
        {page < pages ? (
          <Link className={link} href={href(page + 1)}>
            {t.common.next}
          </Link>
        ) : (
          <span className={cn(link, "opacity-40")}>{t.common.next}</span>
        )}
      </div>
    </nav>
  );
}
