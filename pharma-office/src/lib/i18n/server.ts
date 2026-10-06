import "server-only";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "./config";
import { getDictionary, type Dictionary } from "./dictionaries";

export async function resolveLocale(params: Promise<{ lang: string }>): Promise<{ locale: Locale; t: Dictionary }> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return { locale: lang, t: getDictionary(lang) };
}
