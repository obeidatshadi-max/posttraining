import { describe, expect, it } from "vitest";
import { can, drugstoreScopeFor, homePathFor, ROLES } from "./permissions";

const u = (role: (typeof ROLES)[number], extra: Partial<{ territoryId: number | null; financialAccess: boolean }> = {}) => ({
  id: "u1",
  role,
  territoryId: extra.territoryId ?? null,
  financialAccess: extra.financialAccess ?? false,
});

describe("permissions", () => {
  it("keeps medical reps away from financials unless explicitly granted", () => {
    expect(can(u("medical_rep"), "financials.view")).toBe(false);
    expect(can(u("medical_rep"), "signals.submit")).toBe(true);
    expect(can(u("medical_rep", { financialAccess: true }), "financials.view")).toBe(true);
    expect(homePathFor(u("medical_rep"))).toBe("/market-signals");
  });
  it("gives admins configuration but not financial visibility", () => {
    expect(can(u("admin"), "settings.view")).toBe(true);
    expect(can(u("admin"), "invoices.view")).toBe(false);
  });
  it("restricts recording payments and creating invoices", () => {
    expect(can(u("finance"), "payments.record")).toBe(true);
    expect(can(u("sales_rep"), "payments.record")).toBe(false);
    expect(can(u("area_manager"), "invoices.create")).toBe(false);
  });
  it("scopes drugstore visibility by role", () => {
    expect(drugstoreScopeFor(u("director"))).toEqual({ kind: "all" });
    expect(drugstoreScopeFor(u("area_manager", { territoryId: 2 }))).toEqual({ kind: "territory", territoryId: 2 });
    expect(drugstoreScopeFor(u("area_manager"))).toEqual({ kind: "none" });
    expect(drugstoreScopeFor(u("sales_rep"))).toEqual({ kind: "assigned", userId: "u1" });
    expect(drugstoreScopeFor(u("medical_rep"))).toEqual({ kind: "none" });
    expect(drugstoreScopeFor(u("admin"))).toEqual({ kind: "none" });
  });
});
