import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { dirOf, isLocale, LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import "../globals.css";

export async function generateStaticParams() {
  return LOCALES.map((l) => ({ lang: l }));
}

export async function generateMetadata(): Promise<Metadata> {
  const l = await lang();
  const t = getDictionary(isLocale(l) ? l : "en");
  return { title: { default: t.meta.appName, template: `%s · ${t.meta.appShort}` }, description: t.meta.tagline };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0e4d64" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const l = await lang();
  if (!isLocale(l)) notFound();
  return (
    <html lang={l} dir={dirOf(l)}>
      <body>{children}</body>
    </html>
  );
}
