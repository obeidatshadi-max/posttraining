import { CheckCircle2, MessageSquareText, Sigma } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { PaymentStatus } from "@/lib/domain/payment-status";

export type SourceType = "confirmed" | "reported" | "estimated";

const SOURCE_ICON = { confirmed: CheckCircle2, reported: MessageSquareText, estimated: Sigma } as const;

/**
 * The platform's central visual: every important figure states whether it is
 * CONFIRMED, REPORTED or ESTIMATED (icon + text + colour, never colour alone).
 */
export function SourceBadge({ source, t }: { source: SourceType; t: Dictionary }) {
  const Icon = SOURCE_ICON[source];
  const help = t.source[`${source}Help`];
  return (
    <Badge tone={source} title={help} aria-label={`${t.source[source]}: ${help}`}>
      <Icon aria-hidden className="size-3" />
      {t.source[source]}
    </Badge>
  );
}

const STATUS_TONE: Record<PaymentStatus, BadgeTone> = {
  not_due: "neutral",
  due_soon: "warn",
  due: "warn",
  partially_paid: "brand",
  overdue: "bad",
  paid: "good",
  disputed: "estimated",
};

export function PaymentStatusBadge({ status, t }: { status: PaymentStatus; t: Dictionary }) {
  return <Badge tone={STATUS_TONE[status]}>{t.paymentStatus[status]}</Badge>;
}

const SEVERITY_TONE = { low: "neutral", medium: "warn", high: "bad", critical: "critical" } as const;

export function SeverityBadge({ severity, t }: { severity: keyof typeof SEVERITY_TONE; t: Dictionary }) {
  return <Badge tone={SEVERITY_TONE[severity]}>{t.severity[severity]}</Badge>;
}

export function ConfidenceBadge({ level, t }: { level: "low" | "medium" | "high"; t: Dictionary }) {
  return (
    <Badge tone="neutral">
      {t.confidence.label}: {t.confidence[level]}
    </Badge>
  );
}

export function SourceLegend({ t }: { t: Dictionary }) {
  return (
    <details className="group rounded-md border border-line bg-surface px-3 py-2 text-xs text-ink-2">
      <summary className="cursor-pointer select-none font-medium text-ink">{t.source.legendTitle}</summary>
      <ul className="mt-2 space-y-1.5">
        {(["confirmed", "reported", "estimated"] as const).map((s) => (
          <li key={s} className="flex items-start gap-2">
            <SourceBadge source={s} t={t} />
            <span>{t.source[`${s}Help`]}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
