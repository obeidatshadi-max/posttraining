import { describe, expect, it } from "vitest";
import { compareByPriority, creditSeverity, dueSoonSeverity, overdueSeverity } from "./attention";

describe("attention severity rules", () => {
  it("escalates overdue by amount or age", () => {
    expect(overdueSeverity(5_000_000, 10)).toBe("medium");
    expect(overdueSeverity(30_000_000, 10)).toBe("high");
    expect(overdueSeverity(5_000_000, 45)).toBe("high");
    expect(overdueSeverity(5_000_000, 75)).toBe("critical");
    expect(overdueSeverity(120_000_000, 1)).toBe("critical");
  });
  it("grades due-soon amounts and credit utilisation", () => {
    expect(dueSoonSeverity(60_000_000)).toBe("high");
    expect(dueSoonSeverity(2_000_000)).toBe("low");
    expect(creditSeverity(0.8)).toBeNull();
    expect(creditSeverity(0.86)).toBe("medium");
    expect(creditSeverity(0.93)).toBe("high");
    expect(creditSeverity(1.02)).toBe("critical");
  });
  it("orders by severity, then amount", () => {
    const items = [
      { severity: "high" as const, amount: 1 },
      { severity: "critical" as const, amount: 1 },
      { severity: "high" as const, amount: 9 },
    ].sort(compareByPriority);
    expect(items.map((i) => `${i.severity}:${i.amount}`)).toEqual(["critical:1", "high:9", "high:1"]);
  });
});
