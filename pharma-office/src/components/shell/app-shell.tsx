import { Suspense, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import type { CurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/permissions";
import { interpolate, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { loc } from "@/lib/format";
import { NAV_ITEMS } from "./nav-config";
import { DesktopSidebar, MobileNav, type SidebarGroup } from "./sidebar-nav";
import { LanguageSwitch } from "./language-switch";

export function AppShell({ user, locale, t, children }: { user: CurrentUser; locale: Locale; t: Dictionary; children: ReactNode }) {
  const visible = NAV_ITEMS.filter((i) => can(user, i.permission));
  const groups: SidebarGroup[] = (["groupMain", "groupIntel", "groupAdmin"] as const)
    .map((g) => ({
      label: t.nav[g],
      items: visible
        .filter((i) => i.group === g)
        .map((i) => ({
          key: i.key,
          href: `/${locale}${i.href}`,
          label: t.nav[i.key],
          chip:
            i.availability.kind === "planned"
              ? i.availability.phase
                ? interpolate(t.common.phase, { n: i.availability.phase })
                : t.common.planned
              : i.availability.kind === "partial"
                ? t.common.partial
                : undefined,
          chipTone: i.availability.kind === "planned" ? ("planned" as const) : ("partial" as const),
        })),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh overflow-y-auto border-e border-line bg-surface px-3 py-4 lg:block">
        <div className="mb-6 px-2">
          <p className="text-sm font-bold text-brand">{t.meta.appShort}</p>
          <p className="text-[11px] leading-tight text-muted">{t.meta.tagline}</p>
        </div>
        <DesktopSidebar groups={groups} />
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav groups={groups} menuLabel={t.common.menu} closeLabel={t.common.close} />
            <p className="truncate text-sm font-semibold text-ink lg:hidden">{t.meta.appShort}</p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Suspense fallback={null}>
              <LanguageSwitch current={locale} label={t.common.language} ariaLabel={t.common.languageLabel} />
            </Suspense>
            <div className="hidden text-end sm:block">
              <p className="text-xs font-semibold leading-tight text-ink">{loc(locale, user.fullName, user.fullNameAr)}</p>
              <p className="text-[11px] leading-tight text-muted">{t.roles[user.role]}</p>
            </div>
            <form action={logoutAction}>
              <input type="hidden" name="lang" value={locale} />
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-ink-2 hover:bg-canvas"
                title={t.common.signOut}
              >
                <LogOut className="size-4 rtl:rotate-180" aria-hidden />
                <span className="hidden md:inline">{t.common.signOut}</span>
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-3 py-5 sm:px-5">{children}</main>
      </div>
    </div>
  );
}
