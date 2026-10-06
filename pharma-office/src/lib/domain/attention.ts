/**
 * Transparent severity rules for Phase 1 "Attention required" items.
 * All inputs are CONFIRMED Scientific Office data. Thresholds are explicit
 * constants so management can review and tune them.
 */
export type Severity = "low" | "medium" | "high" | "critical";

export const ATTENTION_RULES = {
  dueSoonWindowDays: 7,
  overdue: { criticalAmount: 100_000_000, criticalDays: 60, highAmount: 25_000_000, highDays: 30 },
  dueSoon: { highAmount: 50_000_000, mediumAmount: 10_000_000 },
  creditUtilisation: { critical: 1.0, high: 0.9, watch: 0.85 },
  disputed: { highAmount: 25_000_000 },
} as const;

const RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export function overdueSeverity(amount: number, maxDaysOverdue: number): Severity {
  const r = ATTENTION_RULES.overdue;
  if (amount >= r.criticalAmount || maxDaysOverdue >= r.criticalDays) return "critical";
  if (amount >= r.highAmount || maxDaysOverdue >= r.highDays) return "high";
  return "medium";
}

export function dueSoonSeverity(amount: number): Severity {
  const r = ATTENTION_RULES.dueSoon;
  if (amount >= r.highAmount) return "high";
  if (amount >= r.mediumAmount) return "medium";
  return "low";
}

/** null when utilisation is below the watch threshold. */
export function creditSeverity(utilisation: number): Severity | null {
  const r = ATTENTION_RULES.creditUtilisation;
  if (utilisation >= r.critical) return "critical";
  if (utilisation >= r.high) return "high";
  if (utilisation >= r.watch) return "medium";
  return null;
}

export function disputedSeverity(amount: number): Severity {
  return amount >= ATTENTION_RULES.disputed.highAmount ? "high" : "medium";
}

export function compareByPriority(a: { severity: Severity; amount: number }, b: { severity: Severity; amount: number }) {
  return RANK[b.severity] - RANK[a.severity] || b.amount - a.amount;
}
