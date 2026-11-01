import { describe, expect, it } from "vitest";
import { countdown, daysUntil, studyPlan } from "@/lib/plan";

const now = new Date(2026, 10, 1, 15, 30).getTime(); // 1. November 2026, nachmittags

describe("Lernplan", () => {
  it("zählt ganze Kalendertage, unabhängig von der Uhrzeit und der Zeitumstellung", () => {
    expect(daysUntil("2026-11-01", now)).toBe(0);
    expect(daysUntil("2026-11-02", now)).toBe(1);
    expect(daysUntil("2026-11-24", now)).toBe(23);
    expect(daysUntil("2026-10-30", now)).toBe(-2);
    expect(daysUntil("2027-03-29", new Date(2027, 2, 27, 23).getTime())).toBe(2);
    expect(countdown(0)).toBe("heute");
    expect(countdown(1)).toBe("morgen");
    expect(countdown(23)).toBe("in 23 Tagen");
  });

  it("verteilt die Lernzeit nach Rückstand pro verbleibendem Tag", () => {
    const { upcoming, past } = studyPlan(
      [
        { key: "cf", name: "Corporate Finance", date: "2026-12-16", readiness: 0 },
        { key: "acc", name: "Accounting", date: "2026-11-24", readiness: 0 },
        { key: "hr", name: "Human Resource", date: "2026-11-26" },
        { key: "mc", name: "Management Control", date: "2026-12-17", readiness: 0.9 },
        { key: "old", name: "Alt", date: "2026-10-20", readiness: 0.2 },
      ],
      now,
    );
    expect(upcoming.map((e) => e.key)).toEqual(["acc", "hr", "cf", "mc"]);
    expect(past.map((e) => e.key)).toEqual(["old"]);

    const by = Object.fromEntries(upcoming.map((e) => [e.key, e]));
    expect(by.acc.share + by.cf.share).toBeCloseTo(1, 6);
    expect(by.acc.share).toBeCloseTo(45 / (45 + 23), 6); // gleicher Rückstand, halb so viel Zeit
    expect(by.acc.priority).toBe("hoch");
    expect(by.mc.priority).toBe("sicher");
    expect(by.mc.share).toBe(0);
    expect(by.hr.priority).toBeNull(); // nicht in der App
    expect(by.acc.perDay).toBeCloseTo(0.85 / 23, 6);
  });
});
