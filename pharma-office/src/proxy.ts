import { NextResponse, type NextRequest } from "next/server";

const LOCALES = ["en", "ar"];
const SESSION_COOKIE = "po_session";

/**
 * 1. Ensures every page URL starts with a supported locale (/en or /ar),
 *    choosing Arabic when the browser prefers it.
 * 2. Optimistic auth redirect: no session cookie → login page. The real
 *    check (signature, expiry, active user) happens in the data access layer.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const segment = pathname.split("/")[1] ?? "";

  if (!LOCALES.includes(segment)) {
    const prefersArabic = /^ar\b/i.test(request.headers.get("accept-language") ?? "");
    const url = request.nextUrl.clone();
    url.pathname = `/${prefersArabic ? "ar" : "en"}${pathname === "/" ? "/dashboard" : pathname}`;
    url.search = search;
    return NextResponse.redirect(url);
  }

  const isLogin = pathname === `/${segment}/login`;
  if (!isLogin && !request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${segment}/login`;
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|jpg|jpeg|webp|txt)$).*)"],
};
