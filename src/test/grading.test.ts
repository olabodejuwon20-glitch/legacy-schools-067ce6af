import { describe, it, expect } from "vitest";
import {
  necoGrade,
  necoDistribution,
  necoCreditPassRate,
  necoSummary,
  NECO_GRADE_REMARKS,
} from "@/lib/neco";

describe("NECO / WAEC Nigerian grading engine", () => {
  it("assigns exact A1–F9 boundaries", () => {
    expect(necoGrade(92)).toBe("A1");
    expect(necoGrade(75)).toBe("A1");
    expect(necoGrade(74)).toBe("B2");
    expect(necoGrade(70)).toBe("B2");
    expect(necoGrade(65)).toBe("B3");
    expect(necoGrade(60)).toBe("C4");
    expect(necoGrade(55)).toBe("C5");
    expect(necoGrade(50)).toBe("C6");
    expect(necoGrade(45)).toBe("D7");
    expect(necoGrade(40)).toBe("E8");
    expect(necoGrade(39)).toBe("F9");
    expect(necoGrade(0)).toBe("F9");
  });

  it("maps every grade to its official remark", () => {
    expect(NECO_GRADE_REMARKS.A1).toBe("Excellent");
    expect(NECO_GRADE_REMARKS.B2).toBe("Very Good");
    expect(NECO_GRADE_REMARKS.C6).toBe("Credit");
    expect(NECO_GRADE_REMARKS.D7).toBe("Pass");
    expect(NECO_GRADE_REMARKS.F9).toBe("Fail");
  });

  it("calculates credit pass rate (C6 >= 50 or better)", () => {
    expect(necoCreditPassRate([])).toBe(0);
    expect(necoCreditPassRate([80, 65, 50, 42])).toBe(75);
    expect(necoCreditPassRate([30, 40, 49])).toBe(0);
  });

  it("computes cohort distribution and summary statistics", () => {
    const scores = [85, 72, 60, 52, 35];
    const dist = necoDistribution(scores);
    expect(dist.find(d => d.grade === "A1")?.count).toBe(1);
    expect(dist.find(d => d.grade === "F9")?.count).toBe(1);

    const summary = necoSummary(scores);
    expect(summary.count).toBe(5);
    expect(summary.average).toBe(61);
    expect(summary.grade).toBe("C4");
    expect(summary.credit).toBe(80);
    expect(summary.best).toBe(85);
    expect(summary.worst).toBe(35);
  });
});