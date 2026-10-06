import type { Locale } from "./i18n/config";
import { formatIQDCompact, formatIQDExact } from "./domain/money";

const dateFormatters = {
  en: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
  ar: new Intl.DateTimeFormat("ar-IQ-u-nu-latn", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
};
const monthFormatters = {
  en: new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }),
  ar: new Intl.DateTimeFormat("ar-IQ-u-nu-latn", { month: "short", timeZone: "UTC" }),
};

export function formatDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "—";
  return dateFormatters[locale].format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
}

export function formatMonth(iso: string, locale: Locale): string {
  return monthFormatters[locale].format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
}

export const money = (value: number, locale: Locale) => formatIQDCompact(value, locale);
export const exact = (value: number) => formatIQDExact(value);

/** Pick the localized variant of a bilingual DB field. */
export function loc(locale: Locale, en: string | null | undefined, ar: string | null | undefined): string {
  return (locale === "ar" ? ar || en : en || ar) ?? "";
}
