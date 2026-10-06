"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

const TEXT = {
  en: { title: "Something went wrong", body: "The page could not be loaded. Try again; if it persists, contact your administrator.", retry: "Try again" },
  ar: { title: "حدث خطأ ما", body: "تعذّر تحميل الصفحة. حاول مجدداً؛ وإذا استمرت المشكلة تواصل مع مسؤول النظام.", retry: "إعادة المحاولة" },
};

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ lang: string }>();
  const t = params.lang === "ar" ? TEXT.ar : TEXT.en;
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="mx-auto max-w-lg rounded-lg border border-line bg-surface p-6 text-center">
      <h1 className="text-base font-semibold text-ink">{t.title}</h1>
      <p className="mt-2 text-sm text-muted">{t.body}</p>
      {error.digest ? <p className="mt-2 font-mono text-[11px] text-muted">ref: {error.digest}</p> : null}
      <button type="button" onClick={reset} className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-ink">
        {t.retry}
      </button>
    </div>
  );
}
