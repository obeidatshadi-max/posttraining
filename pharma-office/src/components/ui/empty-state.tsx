import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-md text-xs text-muted">{description}</p> : null}
      {action}
    </div>
  );
}
