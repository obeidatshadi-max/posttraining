import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { resolveLocale } from "@/lib/i18n/server";
import { AppShell } from "@/components/shell/app-shell";
import { PageSkeleton } from "@/components/ui/skeleton";

export default function AuthenticatedLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="p-5">
          <PageSkeleton label="Loading… · جارٍ التحميل…" />
        </div>
      }
    >
      <Shell params={params}>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { locale, t } = await resolveLocale(params);
  const user = await requireUser(locale);
  return (
    <AppShell user={user} locale={locale} t={t}>
      {children}
    </AppShell>
  );
}
