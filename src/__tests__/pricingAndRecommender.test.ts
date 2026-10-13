import { describe, it, expect } from "vitest";
import {
  snapStudentCountToBracket,
  getBracketBySlug,
  calculateSubscriptionTotal,
  OFFICIAL_PRICING_BRACKETS,
  OFFICIAL_ADDONS,
} from "@/lib/pricing";
import { heuristicRecommendation } from "@/api/aiRecommender";
import { computeClientEstimate } from "@/api/paystackInit";

describe("Pricing Engine & Capacity Snapping", () => {
  it("snaps student count to correct capacity brackets", () => {
    expect(snapStudentCountToBracket(50).slug).toBe("up_to_100");
    expect(snapStudentCountToBracket(100).slug).toBe("up_to_100");
    expect(snapStudentCountToBracket(101).slug).toBe("up_to_200");
    expect(snapStudentCountToBracket(200).slug).toBe("up_to_200");
    expect(snapStudentCountToBracket(201).slug).toBe("up_to_500");
    expect(snapStudentCountToBracket(500).slug).toBe("up_to_500");
    expect(snapStudentCountToBracket(501).slug).toBe("up_to_1000");
    expect(snapStudentCountToBracket(1200).slug).toBe("up_to_1000");
  });

  it("calculates termly base subscription without add-ons correctly", () => {
    const res = calculateSubscriptionTotal({
      bracketSlug: "up_to_100",
      addonSlugs: [],
      cycle: "termly",
    });

    expect(res.baseKobo).toBe(2500000); // ₦25,000
    expect(res.addonsKobo).toBe(0);
    expect(res.storageBoostKobo).toBe(0);
    expect(res.finalTotalKobo).toBe(2500000);
    expect(res.finalTotalNaira).toBe(25000);
    expect(res.discountKobo).toBe(0);
  });

  it("sums requested active add-ons and storage boost", () => {
    // up_to_500 (₦80,000) + mod_hostel (₦25,000) + mod_transport (₦20,000) + 20GB boost (₦5,000)
    // Subtotal: ₦80,000 + ₦25,000 + ₦20,000 + ₦5,000 = ₦130,000 = 13,000,000 kobo
    const res = calculateSubscriptionTotal({
      bracketSlug: "up_to_500",
      addonSlugs: ["mod_hostel", "mod_transport"],
      cycle: "termly",
      storageBoostGb: 20,
    });

    expect(res.baseKobo).toBe(8000000);
    expect(res.addonsKobo).toBe(4500000);
    expect(res.storageBoostKobo).toBe(500000);
    expect(res.termSubtotalKobo).toBe(13000000);
    expect(res.finalTotalKobo).toBe(13000000);
    expect(res.finalTotalNaira).toBe(130000);
    expect(res.totalStorageGb).toBe(40); // 20 base + 20 boost
  });

  it("ignores coming_soon add-ons from total calculation", () => {
    const res = calculateSubscriptionTotal({
      bracketSlug: "up_to_100",
      addonSlugs: ["mod_canteen", "mod_biometric"], // both are coming_soon
      cycle: "termly",
    });

    expect(res.addonsKobo).toBe(0);
    expect(res.finalTotalKobo).toBe(2500000);
  });

  it("applies exactly 15% discount on annual 3-term prepay", () => {
    // Term total: ₦25,000 (2,500,000 kobo)
    // 3 terms: ₦75,000 (7,500,000 kobo)
    // 15% discount: 1,125,000 kobo (₦11,250)
    // Final annual: 6,375,000 kobo (₦63,750)
    const res = calculateSubscriptionTotal({
      bracketSlug: "up_to_100",
      addonSlugs: [],
      cycle: "annually",
    });

    expect(res.cycle).toBe("annually");
    expect(res.discountRate).toBe(0.15);
    expect(res.discountKobo).toBe(1125000);
    expect(res.finalTotalKobo).toBe(6375000);
    expect(res.finalTotalNaira).toBe(63750);
  });

  it("computes client estimate matching the pricing engine", () => {
    const estimate = computeClientEstimate({
      bracket: "up_to_200",
      addons: ["mod_virtual_lab"],
      cycle: "termly",
    });

    // up_to_200 = ₦45,000 (4,500,000 kobo) + mod_virtual_lab = ₦35,000 (3,500,000 kobo) = ₦80,000 (8,000,000 kobo)
    expect(estimate.finalTotalKobo).toBe(8000000);
    expect(estimate.finalTotalNaira).toBe(80000);
  });
});

describe("AI Plan Recommender Heuristic Parser", () => {
  it("recommends up_to_500, hostel, and transport for boarding school with buses", () => {
    const prompt = "We have 350 students with a boarding house and 4 school buses.";
    const rec = heuristicRecommendation(prompt);

    expect(rec.recommended_bracket).toBe("up_to_500");
    expect(rec.recommended_addons).toContain("mod_hostel");
    expect(rec.recommended_addons).toContain("mod_transport");
    expect(rec.suggested_student_count).toBe(350);
    expect(rec.reasoning).toContain("up to 500");
  });

  it("recommends virtual science lab for STEM/science school", () => {
    const prompt = "Day school with 180 learners needing physics and chemistry lab experiments";
    const rec = heuristicRecommendation(prompt);

    expect(rec.recommended_bracket).toBe("up_to_200");
    expect(rec.recommended_addons).toContain("mod_virtual_lab");
  });

  it("recommends SMS messaging and autonomous agent when requested", () => {
    const prompt = "Large school with 850 kids needing SMS broadcast alerts and autonomous beast copilot";
    const rec = heuristicRecommendation(prompt);

    expect(rec.recommended_bracket).toBe("up_to_1000");
    expect(rec.recommended_addons).toContain("mod_messaging");
    expect(rec.recommended_addons).toContain("mod_copilot_auto");
  });
});
