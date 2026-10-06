import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/** Honest placeholder for modules not built yet — no mock data, no inert buttons. */
export function PlannedModule({ title, phaseLabel, items, t }: { title: string; phaseLabel: string; items: readonly string[]; t: Dictionary }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        <Badge tone="neutral">{phaseLabel}</Badge>
      </div>
      <Card>
        <CardBody>
          <p className="text-sm font-semibold text-ink">{t.planned.title}</p>
          <p className="mt-1 text-sm text-muted">{t.planned.body}</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{t.planned.willInclude}</p>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-ink-2">
            {items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
