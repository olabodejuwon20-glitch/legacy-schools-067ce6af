import { describe, it, expect } from "vitest";
import { naira as formatCurrencyNaira, toKobo, invoiceStatusColor } from "@/lib/payments";
import { formatNaira, naira, kobo, revenueForSchool, type PlanPricing, type Addon } from "@/lib/pricing";

describe("payments & kobo conversion utilities (Golden Convention #1)", () => {
  it("converts Naira amounts to integer kobo accurately", () => {
    expect(toKobo(1500)).toBe(150000);
    expect(toKobo("2500.50")).toBe(250050);
    expect(toKobo(0)).toBe(0);
    expect(toKobo("invalid")).toBe(0);
    expect(kobo(500)).toBe(50000);
    expect(kobo("199.99")).toBe(19999);
  });

  it("converts kobo to whole Naira and formatted NGN strings", () => {
    expect(naira(150000)).toBe(1500);
    expect(naira(0)).toBe(0);
    expect(formatNaira(2500000)).toBe("₦25,000");
    expect(formatNaira(-500)).toBe("₦0");
    expect(formatCurrencyNaira(500000)).toContain("5,000");
  });

  it("maps invoice status to semantic badge classes", () => {
    expect(invoiceStatusColor("paid")).toContain("text-success");
    expect(invoiceStatusColor("partial")).toContain("text-primary");
    expect(invoiceStatusColor("overdue")).toContain("text-destructive");
    expect(invoiceStatusColor("waived")).toContain("text-muted-foreground");
    expect(invoiceStatusColor("pending")).toContain("text-warning");
  });
});

describe("subscription revenue & tier calculations", () => {
  const samplePricing: PlanPricing[] = [
    {
      plan: "starter",
      label: "Starter",
      term_price_kobo: 50000_00,
      included_students: 100,
      extra_student_kobo: 500_00,
      sort_order: 1,
    },
    {
      plan: "growth",
      label: "Growth",
      term_price_kobo: 120000_00,
      included_students: 300,
      extra_student_kobo: 400_00,
      sort_order: 2,
    },
  ];

  const sampleAddons: Addon[] = [
    { id: "a1", slug: "ai-copilot", name: "AI Copilot", term_price_kobo: 15000_00 },
    { id: "a2", slug: "transport", name: "Bus Tracking", term_price_kobo: 10000_00 },
  ];

  it("computes base plan with no extra students when within included cap", () => {
    const res = revenueForSchool({
      plan: "starter",
      studentCount: 85,
      addons: [],
      planPricing: samplePricing,
    });
    expect(res.basePlanKobo).toBe(50000_00);
    expect(res.extraStudents).toBe(0);
    expect(res.extraStudentKobo).toBe(0);
    expect(res.termKobo).toBe(50000_00);
    expect(res.annualKobo).toBe(150000_00);
  });

  it("computes extra student charges and addon totals accurately", () => {
    const res = revenueForSchool({
      plan: "starter",
      studentCount: 140,
      addons: sampleAddons,
      planPricing: samplePricing,
    });
    expect(res.extraStudents).toBe(40);
    expect(res.extraStudentKobo).toBe(20000_00);
    expect(res.addonsKobo).toBe(25000_00);
    expect(res.termKobo).toBe(50000_00 + 20000_00 + 25000_00);
    expect(res.annualKobo).toBe(res.termKobo * 3);
  });
});