import { Suspense } from "react";
import { connection } from "next/server";
import { resolveLocale } from "@/lib/i18n/server";
import { USERS, DEMO_PASSWORD } from "@/db/seed/catalog";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { loc } from "@/lib/format";
import { LoginForm } from "./login-form";

export default async function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const { locale, t } = await resolveLocale(params);
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <div className="rounded-lg border border-line bg-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">{t.meta.appShort}</p>
          <h1 className="mt-1 text-xl font-semibold text-ink">{t.login.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.login.subtitle}</p>
          <LoginForm
            lang={locale}
            labels={{
              email: t.login.email,
              password: t.login.password,
              submit: t.login.submit,
              submitting: t.login.submitting,
              invalid: t.login.invalid,
              invalidInput: t.login.invalidInput,
            }}
          />
        </div>
        <Suspense fallback={null}>
          <DemoAccounts t={t} locale={locale} />
        </Suspense>
        <p className="text-center text-xs text-muted">
          <a className="underline" href={locale === "ar" ? "/en/login" : "/ar/login"}>
            {t.common.language}
          </a>
        </p>
      </div>
    </main>
  );
}

/** Read at request time so DEMO_MODE is honoured per deployment, not baked in at build. */
async function DemoAccounts({ t, locale }: { t: Dictionary; locale: Locale }) {
  await connection();
  if (process.env.DEMO_MODE !== "true") return null;
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface p-4 text-xs">
      <p className="font-semibold text-ink">{t.login.demoTitle}</p>
      <p className="mt-1 text-muted">{t.login.demoNote}</p>
      <p className="mt-2">
        {t.login.demoPassword}: <code className="rounded bg-canvas px-1 py-0.5 font-mono">{DEMO_PASSWORD}</code>
      </p>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {Object.values(USERS).map((u) => (
          <li key={u.email} className="min-w-0">
            <code className="block truncate font-mono text-ink" dir="ltr">
              {u.email}
            </code>
            <span className="text-muted">
              {t.roles[u.role]} · {loc(locale, u.fullName, u.fullNameAr)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
