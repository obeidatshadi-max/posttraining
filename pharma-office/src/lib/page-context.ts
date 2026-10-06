import "server-only";
import { requireUser, type CurrentUser } from "./auth/current-user";
import { can, type Permission } from "./auth/permissions";
import { todayISO } from "./domain/dates";
import { resolveLocale } from "./i18n/server";
import type { Locale } from "./i18n/config";
import type { Dictionary } from "./i18n/dictionaries";

export type PageContext = { locale: Locale; t: Dictionary; user: CurrentUser; today: string; allowed: boolean };

/** Common page bootstrap: locale, authenticated user, permission check and business "today". */
export async function pageContext(params: Promise<{ lang: string }>, permission: Permission): Promise<PageContext> {
  const { locale, t } = await resolveLocale(params);
  const user = await requireUser(locale);
  return { locale, t, user, today: todayISO(), allowed: can(user, permission) };
}

/** Normalises Next.js searchParams into single string values. */
export async function readSearch(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const sp = await searchParams;
  return Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}
