import { describe, expect, it, vi } from "vitest";
import {
  FOCUS_MS,
  addFocusXp,
  bestFocusXp,
  focusMultiplier,
  focusState,
  mergeFocus,
  startFocusRun,
  type FocusLog,
} from "@/lib/focus";
import { mergeSync, type SyncData } from "@/lib/merge";

// Mittwoch, 25.11.2026, 10:00 lokal → Woche ab Montag 23.11.
const WED = new Date(2026, 10, 25, 10, 0).getTime();
const MIN = 60_000;

describe("Fokus-Stunde", () => {
  it("ist zu Beginn der Woche verfügbar und verdoppelt danach 60 Minuten lang", () => {
    expect(focusState({}, WED)).toEqual({ status: "ready", week: "2026-11-23" });
    expect(focusMultiplier({}, WED)).toBe(1);

    const log = startFocusRun({}, WED)!;
    expect(log["2026-11-23"]).toEqual({ start: WED, xp: 0 });

    const mid = focusState(log, WED + 15 * MIN);
    expect(mid.status).toBe("active");
    if (mid.status === "active") {
      expect(mid.remaining).toBe(45 * MIN);
      expect(mid.progress).toBeCloseTo(0.25);
    }
    expect(focusMultiplier(log, WED + 59 * MIN)).toBe(2);
    expect(focusMultiplier(log, WED + FOCUS_MS)).toBe(1);
    expect(focusState(log, WED + FOCUS_MS).status).toBe("used");
  });

  it("lässt sich nur einmal pro Woche starten", () => {
    const log = startFocusRun({}, WED)!;
    expect(startFocusRun(log, WED + 10 * MIN)).toBeNull(); // läuft noch
    expect(startFocusRun(log, WED + 2 * FOCUS_MS)).toBeNull(); // schon genutzt
    // nächste Woche wieder
    const nextMonday = new Date(2026, 10, 30, 8, 0).getTime();
    expect(focusState(log, nextMonday).status).toBe("ready");
    expect(startFocusRun(log, nextMonday)).not.toBeNull();
  });

  it("läuft über die Wochengrenze weiter, ohne die neue Woche zu verbrauchen", () => {
    const sunday = new Date(2026, 10, 29, 23, 30).getTime();
    const log = startFocusRun({}, sunday)!;
    const monday = sunday + 20 * MIN;
    expect(focusMultiplier(log, monday)).toBe(2);
    expect(startFocusRun(log, monday)).toBeNull(); // erst nach dem Ende
    expect(startFocusRun(log, sunday + FOCUS_MS)).not.toBeNull();
  });

  it("zählt XP nur während der laufenden Stunde", () => {
    let log: FocusLog | undefined = startFocusRun({}, WED)!;
    log = addFocusXp(log, WED + MIN, 20);
    log = addFocusXp(log, WED + 2 * MIN, 30);
    log = addFocusXp(log, WED + FOCUS_MS + MIN, 99);
    expect(log?.["2026-11-23"].xp).toBe(50);
    expect(bestFocusXp(log)).toBe(50);
    expect(bestFocusXp(undefined)).toBe(0);
  });

  it("führt Geräte zusammen: früherer Start gewinnt, XP als Maximum", () => {
    const a: FocusLog = { "2026-11-23": { start: WED, xp: 40 } };
    const b: FocusLog = { "2026-11-23": { start: WED + 30 * MIN, xp: 120 }, "2026-11-16": { start: 1, xp: 5 } };
    expect(mergeFocus(a, b)).toEqual({ "2026-11-23": { start: WED, xp: 120 }, "2026-11-16": { start: 1, xp: 5 } });
    expect(mergeFocus(undefined, undefined)).toEqual({});
  });

  it("wird von mergeSync übernommen, auch wenn ein älterer Stand das Feld nicht hat", () => {
    const base = (deviceId: string, patch: Partial<SyncData> = {}): SyncData => ({
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
    });
    const focus = { "2026-11-23": { start: WED, xp: 10 } };
    expect(mergeSync(base("a", { focus }), base("b")).focus).toEqual(focus);
    expect(mergeSync(base("a"), base("b", { focus })).focus).toEqual(focus);
  });
});

describe("Store mit Fokus-Stunde", () => {
  it("schreibt während der Stunde doppelte XP gut und bucht sie auf die Stunde", async () => {
    const { useApp } = await import("@/lib/store");
    vi.useFakeTimers();
    try {
      vi.setSystemTime(WED);
      useApp.getState().reset();
      const plain = useApp.getState().answer({ subjectId: "s", itemId: "q1", correct: true, xp: 10 });
      expect(plain).toMatchObject({ xp: 10, boosted: false });

      expect(useApp.getState().startFocus()).toBe(true);
      expect(useApp.getState().startFocus()).toBe(false);

      vi.setSystemTime(WED + 5 * MIN);
      const boosted = useApp.getState().answer({ subjectId: "s", itemId: "q2", correct: true, xp: 10 });
      expect(boosted).toMatchObject({ xp: 20, boosted: true });
      expect(useApp.getState().xp).toBe(30);
      expect(useApp.getState().focus["2026-11-23"].xp).toBe(20);

      vi.setSystemTime(WED + FOCUS_MS + MIN);
      expect(useApp.getState().answer({ subjectId: "s", itemId: "q3", correct: true, xp: 10 }).xp).toBe(10);
      expect(useApp.getState().xp).toBe(40);
    } finally {
      vi.useRealTimers();
    }
  });
});
