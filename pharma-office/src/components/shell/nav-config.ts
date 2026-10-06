import type { Permission } from "@/lib/auth/permissions";

export type NavKey =
  | "dashboard" | "drugstores" | "sales" | "collections" | "products"
  | "marketSignals" | "risks" | "reports" | "settings";

export type NavItem = {
  key: NavKey;
  href: string;
  permission: Permission;
  group: "groupMain" | "groupIntel" | "groupAdmin";
  /** Availability label: built, partially built in Phase 1, or planned. */
  availability: { kind: "built" } | { kind: "partial"; phase: number } | { kind: "planned"; phase?: number };
};

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/dashboard", permission: "dashboard.view", group: "groupMain", availability: { kind: "built" } },
  { key: "drugstores", href: "/drugstores", permission: "drugstores.view", group: "groupMain", availability: { kind: "built" } },
  { key: "sales", href: "/sales", permission: "invoices.view", group: "groupMain", availability: { kind: "built" } },
  { key: "collections", href: "/collections", permission: "payments.view", group: "groupMain", availability: { kind: "partial", phase: 2 } },
  { key: "products", href: "/products", permission: "products.view", group: "groupMain", availability: { kind: "partial", phase: 3 } },
  { key: "marketSignals", href: "/market-signals", permission: "signals.view", group: "groupIntel", availability: { kind: "partial", phase: 4 } },
  { key: "risks", href: "/risks", permission: "risks.view", group: "groupIntel", availability: { kind: "planned", phase: 5 } },
  { key: "reports", href: "/reports", permission: "reports.view", group: "groupIntel", availability: { kind: "planned" } },
  { key: "settings", href: "/settings", permission: "settings.view", group: "groupAdmin", availability: { kind: "partial", phase: 2 } },
];
