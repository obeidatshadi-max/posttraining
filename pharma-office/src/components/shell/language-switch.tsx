"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Languages } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";

export function LanguageSwitch({ current, label, ariaLabel }: { current: Locale; label: string; ariaLabel: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const target: Locale = current === "ar" ? "en" : "ar";
  const rest = pathname.replace(/^\/(en|ar)(?=\/|$)/, "");
  const qs = search.toString();
  return (
    <Link
      href={`/${target}${rest}${qs ? `?${qs}` : ""}`}
      hrefLang={target}
      aria-label={ariaLabel}
      className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-ink-2 hover:bg-canvas"
    >
      <Languages className="size-4" aria-hidden />
      <span lang={target}>{label}</span>
    </Link>
  );
}
