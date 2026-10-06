import "server-only";
import type { Locale } from "./config";
import { en } from "./locales/en";
import { ar } from "./locales/ar";

export type { Dictionary } from "./locales/en";

export function getDictionary(locale: Locale) {
  return locale === "ar" ? ar : en;
}
