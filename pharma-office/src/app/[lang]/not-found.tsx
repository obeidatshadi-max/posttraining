import Link from "next/link";

// Rendered without access to the locale; kept bilingual.
export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-lg font-semibold text-ink">Page not found · الصفحة غير موجودة</h1>
      <p className="mt-4 flex justify-center gap-4 text-sm">
        <Link className="text-brand underline" href="/en/dashboard">English</Link>
        <Link className="text-brand underline" href="/ar/dashboard">العربية</Link>
      </p>
    </main>
  );
}
