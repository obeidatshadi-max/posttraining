/**
 * IQD formatting. Large values display compactly ("IQD 125M") for
 * management views; exact values ("125,000,000") are used in tables where
 * precision matters. Western digits are used in both languages for
 * consistency with Iraqi commercial documents; this is a presentation choice
 * and can be changed here in one place.
 */
export type Locale = "en" | "ar";

const UNITS = {
  en: { B: "B", M: "M", K: "K", currency: "IQD" },
  ar: { B: " مليار", M: " مليون", K: " ألف", currency: "د.ع" },
} as const;

export function formatCompactNumber(value: number, locale: Locale = "en"): string {
  const u = UNITS[locale];
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const fmt = (n: number) => {
    const digits = n >= 100 ? 0 : n >= 10 ? 1 : 2;
    return trimZeros(n.toFixed(digits));
  };
  if (abs >= 1e9) return `${sign}${fmt(abs / 1e9)}${u.B}`;
  if (abs >= 1e6) return `${sign}${fmt(abs / 1e6)}${u.M}`;
  if (abs >= 1e3) return `${sign}${fmt(abs / 1e3)}${u.K}`;
  return `${sign}${Math.round(abs)}`;
}

/** "IQD 125M" (en) / "125 مليون د.ع" (ar). */
export function formatIQDCompact(value: number, locale: Locale = "en"): string {
  const n = formatCompactNumber(value, locale);
  return locale === "ar" ? `${n} ${UNITS.ar.currency}` : `IQD ${n}`;
}

/** "125,000,000" — exact, no currency label (use in tables with an IQD column header). */
export function formatIQDExact(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value));
}

export function formatPct(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatInt(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/** Percentage change from `previous` to `current`; null when undefined (previous = 0). */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function trimZeros(s: string) {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}
