"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle, BarChart3, Building2, FileText, LayoutDashboard, Menu, Pill, Radio, Settings, Wallet, X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { NavKey } from "./nav-config";

const ICONS: Record<NavKey, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  drugstores: Building2,
  sales: FileText,
  collections: Wallet,
  products: Pill,
  marketSignals: Radio,
  risks: AlertTriangle,
  reports: BarChart3,
  settings: Settings,
};

export type SidebarGroup = {
  label: string;
  items: { key: NavKey; href: string; label: string; chip?: string; chipTone?: "planned" | "partial" }[];
};

function NavList({ groups, onNavigate }: { groups: SidebarGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-5">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{g.label}</p>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const Icon = ICONS[item.key];
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                      active ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-canvas",
                    )}
                  >
                    <Icon aria-hidden className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 leading-tight">{item.label}</span>
                    {item.chip ? (
                      <span
                        className={cn(
                          "rounded px-1 text-[9px] font-semibold uppercase",
                          active
                            ? "bg-white/20 text-white"
                            : item.chipTone === "planned"
                              ? "bg-canvas text-muted ring-1 ring-line"
                              : "bg-brand-soft text-brand",
                        )}
                      >
                        {item.chip}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DesktopSidebar({ groups }: { groups: SidebarGroup[] }) {
  return <NavList groups={groups} />;
}

export function MobileNav({ groups, menuLabel, closeLabel }: { groups: SidebarGroup[]; menuLabel: string; closeLabel: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Close the drawer whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-canvas lg:hidden"
        aria-label={menuLabel}
        aria-expanded={open}
      >
        <Menu className="size-5" aria-hidden />
      </button>
      {/* Portalled to <body>: the sticky header's backdrop-filter would otherwise clip a fixed overlay. */}
      {open
        ? createPortal(
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button type="button" aria-label={closeLabel} className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 w-72 max-w-[85%] overflow-y-auto bg-surface p-4 shadow-xl">
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-8 items-center justify-center rounded-md hover:bg-canvas"
                aria-label={closeLabel}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <NavList groups={groups} onNavigate={() => setOpen(false)} />
          </div>
        </div>,
            document.body,
          )
        : null}
    </>
  );
}
