/**
 * Role-based access control. Pure and framework-free so it can be tested
 * and reused by server code, navigation and (later) row-level security.
 */
export const ROLES = [
  "director",
  "sales_manager",
  "area_manager",
  "sales_rep",
  "medical_rep",
  "finance",
  "admin",
] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | "dashboard.view"
  | "drugstores.view"
  | "financials.view"
  | "invoices.view"
  | "invoices.create"
  | "payments.view"
  | "payments.record"
  | "products.view"
  | "signals.view"
  | "signals.submit"
  | "risks.view"
  | "reports.view"
  | "settings.view"
  | "users.manage";

const MATRIX: Record<Role, readonly Permission[]> = {
  director: [
    "dashboard.view", "drugstores.view", "financials.view", "invoices.view", "invoices.create",
    "payments.view", "payments.record", "products.view", "signals.view", "signals.submit",
    "risks.view", "reports.view", "settings.view",
  ],
  sales_manager: [
    "dashboard.view", "drugstores.view", "financials.view", "invoices.view", "invoices.create",
    "payments.view", "payments.record", "products.view", "signals.view", "signals.submit",
    "risks.view", "reports.view",
  ],
  area_manager: [
    "dashboard.view", "drugstores.view", "financials.view", "invoices.view", "payments.view",
    "products.view", "signals.view", "signals.submit", "risks.view", "reports.view",
  ],
  sales_rep: [
    "dashboard.view", "drugstores.view", "financials.view", "invoices.view", "payments.view",
    "products.view", "signals.view", "signals.submit",
  ],
  // Limited market-intelligence entry; no financial access unless explicitly granted.
  medical_rep: ["products.view", "signals.view", "signals.submit"],
  finance: [
    "dashboard.view", "drugstores.view", "financials.view", "invoices.view", "invoices.create",
    "payments.view", "payments.record", "products.view", "reports.view",
  ],
  admin: ["settings.view", "users.manage", "products.view"],
};

/** Permissions unlocked for a medical rep when `financial_access` is granted. */
const FINANCIAL_GRANT: readonly Permission[] = [
  "dashboard.view", "drugstores.view", "financials.view", "invoices.view", "payments.view",
];

export type AccessSubject = {
  id: string;
  role: Role;
  territoryId: number | null;
  financialAccess: boolean;
};

export function permissionsFor(user: Pick<AccessSubject, "role" | "financialAccess">): Set<Permission> {
  const set = new Set<Permission>(MATRIX[user.role]);
  if (user.role === "medical_rep" && user.financialAccess) FINANCIAL_GRANT.forEach((p) => set.add(p));
  return set;
}

export function can(user: Pick<AccessSubject, "role" | "financialAccess">, permission: Permission): boolean {
  return permissionsFor(user).has(permission);
}

/**
 * Which drugstores a user may see.
 *  - all:       director, sales manager, finance
 *  - territory: area manager (their territory)
 *  - assigned:  sales rep (drugstores assigned to them)
 *  - none:      everyone else (or a misconfigured account without a territory)
 */
export type DrugstoreScope =
  | { kind: "all" }
  | { kind: "territory"; territoryId: number }
  | { kind: "assigned"; userId: string }
  | { kind: "none" };

export function drugstoreScopeFor(user: AccessSubject): DrugstoreScope {
  if (!can(user, "drugstores.view")) return { kind: "none" };
  switch (user.role) {
    case "director":
    case "sales_manager":
    case "finance":
      return { kind: "all" };
    case "area_manager":
      return user.territoryId ? { kind: "territory", territoryId: user.territoryId } : { kind: "none" };
    case "sales_rep":
    case "medical_rep":
      return { kind: "assigned", userId: user.id };
    default:
      return { kind: "none" };
  }
}

/** Where a user lands after login. */
export function homePathFor(user: Pick<AccessSubject, "role" | "financialAccess">): string {
  if (can(user, "dashboard.view")) return "/dashboard";
  if (can(user, "signals.view")) return "/market-signals";
  if (can(user, "settings.view")) return "/settings";
  return "/products";
}
