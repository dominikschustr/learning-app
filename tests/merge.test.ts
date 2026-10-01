import { describe, expect, it } from "vitest";
import { mergeSync, streakFromActivity, type SyncData } from "@/lib/merge";
import { review } from "@/lib/srs";

function base(deviceId: string, patch: Partial<SyncData> = {}): SyncData {
  return {
    deviceId,
    counters: {},
    xp: 0,
    activity: {},
    items: {},
    cards: {},
    streak: { current: 0, best: 0, lastDay: null },
    dailyGoal: 30,
    dailyGoalAt: 0,
    bestCombo: 0,
    achievements: {},
    exams: [],
    blitzBest: {},
    marks: {},
    ...patch,
  };
}

describe("mergeSync", () => {
  it("addiert XP und Aktivität beider Geräte, ohne doppelt zu zählen", () => {
    const laptop = base("laptop", { counters: { laptop: { xp: 120, activity: { "2026-09-29": 12 } } } });
    const phone = base("phone", { counters: { phone: { xp: 40, activity: { "2026-09-29": 4, "2026-09-30": 5 } } } });
    const once = mergeSync(laptop, phone);
    expect(once.xp).toBe(160);
    expect(once.activity).toEqual({ "2026-09-29": 16, "2026-09-30": 5 });
    // erneutes Zusammenführen mit demselben Stand ändert nichts
    const twice = mergeSync(once, phone);
    expect(twice.xp).toBe(160);
    expect(twice.activity).toEqual(once.activity);
    expect(twice.deviceId).toBe("laptop");
  });

  it("nimmt pro Frage den zuletzt geübten Stand", () => {
    const old = review(undefined, true, 1000);
    const newer = review(old, false, 5000);
    const a = base("a", { items: { "mc:q1": old, "mc:q2": old } });
    const b = base("b", { items: { "mc:q1": newer } });
    const m = mergeSync(a, b);
    expect(m.items["mc:q1"].box).toBe(1);
    expect(m.items["mc:q2"]).toEqual(old);
  });

  it("vereinigt Tests und Achievements, übernimmt Bestwerte", () => {
    const a = base("a", {
      exams: [{ id: "exam-1", results: { x: null } }],
      achievements: { "first-answer": 200 },
      blitzBest: { mc: 12 },
      bestCombo: 4,
    });
    const b = base("b", {
      exams: [
        { id: "exam-1", results: { x: true } },
        { id: "exam-2", results: {} },
      ],
      achievements: { "first-answer": 100, "combo-5": 300 },
      blitzBest: { mc: 9 },
      bestCombo: 7,
    });
    const m = mergeSync(a, b);
    expect(m.exams.map((e) => e.id)).toEqual(["exam-1", "exam-2"]);
    expect(m.exams[0].results.x).toBe(true);
    expect(m.achievements).toEqual({ "first-answer": 100, "combo-5": 300 });
    expect(m.blitzBest.mc).toBe(12);
    expect(m.bestCombo).toBe(7);
  });

  it("übernimmt das zuletzt geänderte Tagesziel", () => {
    const a = base("a", { dailyGoal: 30, dailyGoalAt: 10 });
    const b = base("b", { dailyGoal: 50, dailyGoalAt: 20 });
    expect(mergeSync(a, b).dailyGoal).toBe(50);
    expect(mergeSync(b, a).dailyGoal).toBe(50);
  });

  it("übernimmt Lesezeichen, auch das spätere Entfernen auf einem anderen Gerät", () => {
    const a = base("a", { marks: { "q:mc:x": { on: true, at: 10 }, "q:mc:y": { on: true, at: 10 } } });
    const b = base("b", { marks: { "q:mc:x": { on: false, at: 20 }, "c:mc:k": { on: true, at: 5 } } });
    for (const m of [mergeSync(a, b).marks, mergeSync(b, a).marks]) {
      expect(m["q:mc:x"].on).toBe(false);
      expect(m["q:mc:y"].on).toBe(true);
      expect(m["c:mc:k"].on).toBe(true);
    }
  });
});

describe("streakFromActivity", () => {
  it("berechnet aktuelle und längste Serie über Monatsgrenzen", () => {
    const s = streakFromActivity({ "2026-08-30": 3, "2026-08-31": 1, "2026-09-01": 2, "2026-09-05": 1, "2026-09-06": 4 });
    expect(s).toEqual({ current: 2, best: 3, lastDay: "2026-09-06" });
  });
});
