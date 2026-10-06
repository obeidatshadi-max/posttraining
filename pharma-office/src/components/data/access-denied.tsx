import type { Dictionary } from "@/lib/i18n/dictionaries";

export function AccessDenied({ t }: { t: Dictionary }) {
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-line bg-surface p-6 text-center">
      <h1 className="text-base font-semibold text-ink">{t.errors.accessDeniedTitle}</h1>
      <p className="mt-2 text-sm text-muted">{t.errors.accessDeniedBody}</p>
    </div>
  );
}
