import { describe, expect, it } from "vitest";
import { comboBonus, levelInfo } from "@/lib/gamification";
import { examReadiness, gradeMC } from "@/lib/scoring";
import { BOX_INTERVALS, isDue, review } from "@/lib/srs";

const q = {
  options: ["a", "b", "c", "d"].map((id) => ({ id, text: id })),
  correct: ["a", "c"],
};

describe("gradeMC", () => {
  it("zählt nur exakt richtige Auswahl als richtig", () => {
    expect(gradeMC(q, ["a", "c"]).correct).toBe(true);
    expect(gradeMC(q, ["c", "a"]).correct).toBe(true);
    expect(gradeMC(q, ["a"]).correct).toBe(false);
    expect(gradeMC(q, ["a", "c", "d"]).correct).toBe(false);
  });

  it("berechnet Teilpunkte und Urteile pro Option", () => {
    const r = gradeMC(q, ["a", "d"]);
    expect(r.partial).toBe(0.5);
    expect(r.verdicts).toEqual({ a: "hit", b: "neutral", c: "missed", d: "wrong" });
  });
});

describe("review (Leitner)", () => {
  const now = 1_000_000;
  it("ungesehen + richtig → Box 2, falsch → Box 1", () => {
    expect(review(undefined, true, now).box).toBe(2);
    expect(review(undefined, false, now).box).toBe(1);
  });

  it("steigt bis Box 5 und fällt bei Fehler auf 1", () => {
    let s = review(undefined, true, now);
    for (let i = 0; i < 6; i++) s = review(s, true, now);
    expect(s.box).toBe(5);
    expect(s.due).toBe(now + BOX_INTERVALS[5]);
    s = review(s, false, now);
    expect(s.box).toBe(1);
    expect(s.wrong).toBe(1);
  });

  it("fällig erst nach Ablauf des Intervalls", () => {
    const s = review(undefined, true, now);
    expect(isDue(s, now)).toBe(false);
    expect(isDue(s, now + BOX_INTERVALS[2])).toBe(true);
    expect(isDue(undefined, now)).toBe(false);
  });
});

describe("examReadiness", () => {
  it("gewichtet nach Prüfungsformat", () => {
    const f = { short: 1, mc: 13, tf: 6 };
    expect(examReadiness(f, { short: 1, mc: 1, tf: 1 })).toBe(1);
    expect(examReadiness(f, { mc: 1 })).toBeCloseTo(13 / 20);
  });
});

describe("Level & Combo", () => {
  it("Level-Kurve 100·n", () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, into: 0, needed: 100 });
    expect(levelInfo(100)).toMatchObject({ level: 2, into: 0, needed: 200 });
    expect(levelInfo(350)).toMatchObject({ level: 3, into: 50 });
  });
  it("Combo-Bonus ab 3, gedeckelt", () => {
    expect(comboBonus(2)).toBe(0);
    expect(comboBonus(3)).toBe(2);
    expect(comboBonus(50)).toBe(10);
  });
});

import { chapterLevel } from "@/lib/progress";

describe("chapterLevel", () => {
  it("steigt mit der Sicherheit, Level 5 nur mit bestandenem Kapiteltest", () => {
    expect(chapterLevel(0, 0).level).toBe(0);
    expect(chapterLevel(0.05, 0).level).toBe(1);
    expect(chapterLevel(0.55, 0).level).toBe(3);
    expect(chapterLevel(0.95, 0.5).level).toBe(4);
    expect(chapterLevel(0.95, 0.5).hint).toContain("Kapiteltest");
    expect(chapterLevel(0.95, 0.8).level).toBe(5);
  });
});
