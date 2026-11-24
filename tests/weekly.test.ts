import { describe, expect, it, vi } from "vitest";
import { mergeWeekly } from "@/lib/merge";
import { WEEKLY_ALL_BONUS, WEEKLY_ALL_ID, challengeProgress, claimableXp, weeklyChallenges, weeklyState, type WeeklyInput } from "@/lib/weekly";

// Mittwoch, 25.11.2026 → Woche ab Montag 23.11.
const WED = new Date(2026, 10, 25, 10, 0).getTime();
const WEEK = "2026-11-23";

const input = (patch: Partial<WeeklyInput> = {}): WeeklyInput => ({
  activity: {},
  dailyGoal: 30,
  counters: {},
  exams: [],
  focus: {},
  ...patch,
});

describe("Wochen-Challenge", () => {
  it("wählt je Woche drei feste Aufgaben – eine je Kategorie, auf allen Geräten gleich", () => {
    const a = weeklyChallenges(WEEK);
    expect(a).toHaveLength(3);
    expect(weeklyChallenges(WEEK)).toEqual(a);
    expect(["answers", "xp"]).toContain(a[0].kind);
    expect(["days", "goals"]).toContain(a[1].kind);
    expect(["chapterTest", "exam", "focus"]).toContain(a[2].kind);
    // über mehrere Wochen wechseln die Aufgaben
    const weeks = ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30", "2026-12-07"];
    expect(new Set(weeks.map((w) => weeklyChallenges(w).map((c) => c.id).join())).size).toBeGreaterThan(1);
  });

  it("zählt nur Aktivität dieser Woche", () => {
    const d = input({
      activity: { "2026-11-22": 100, "2026-11-23": 40, "2026-11-25": 20 },
      exams: [{ finishedAt: WED, lecture: "f1" }, { finishedAt: WED - 7 * 86_400_000, lecture: "f2" }, { finishedAt: WED }],
      focus: { [WEEK]: {} },
    });
    const ch = (kind: string, target = 1) => ({ id: "x", kind, target, xp: 0, title: "", icon: "" }) as never;
    expect(challengeProgress(ch("answers"), d, WED)).toBe(60);
    expect(challengeProgress(ch("days"), d, WED)).toBe(2);
    expect(challengeProgress(ch("goals"), d, WED)).toBe(1);
    expect(challengeProgress(ch("chapterTest"), d, WED)).toBe(1);
    expect(challengeProgress(ch("exam"), d, WED)).toBe(1);
    expect(challengeProgress(ch("focus"), d, WED)).toBe(1);
  });

  it("lässt erledigte Aufgaben einmal abholen und den Wochenbonus erst nach allen dreien", () => {
    const everything = input({
      activity: Object.fromEntries([23, 24, 25, 26, 27, 28, 29].map((d) => [`2026-11-${d}`, 60])),
      counters: { a: { xp: 5000, activity: {}, xpDays: { "2026-11-25": 5000 } } },
      exams: [{ finishedAt: WED, lecture: "a" }, { finishedAt: WED, lecture: "b" }, { finishedAt: WED }],
      focus: { [WEEK]: {} },
    });
    const now = new Date(2026, 10, 29, 20).getTime();
    const ids = weeklyChallenges(WEEK).map((c) => c.id);
    let log: Record<string, string[]> = {};
    expect(claimableXp(weeklyState(everything, log, now), WEEKLY_ALL_ID)).toBeNull();
    for (const id of ids) {
      expect(claimableXp(weeklyState(everything, log, now), id)).toBeGreaterThan(0);
      log = { [WEEK]: [...(log[WEEK] ?? []), id] };
      expect(claimableXp(weeklyState(everything, log, now), id)).toBeNull();
    }
    expect(claimableXp(weeklyState(everything, log, now), WEEKLY_ALL_ID)).toBe(WEEKLY_ALL_BONUS);
    // nicht erledigt → nichts abzuholen
    expect(claimableXp(weeklyState(input(), {}, now), ids[0])).toBeNull();
  });

  it("vereinigt abgeholte Aufgaben zweier Geräte", () => {
    expect(mergeWeekly({ [WEEK]: ["a"] }, { [WEEK]: ["b", "a"], "2026-11-16": ["all"] })).toEqual({
      [WEEK]: ["a", "b"],
      "2026-11-16": ["all"],
    });
  });

  it("Store: Bonus-XP abholen – einmalig und ohne Fokus-Verdopplung", async () => {
    const { useApp } = await import("@/lib/store");
    vi.useFakeTimers();
    try {
      vi.setSystemTime(WED);
      useApp.getState().reset();
      useApp.getState().startFocus();
      const [first] = weeklyChallenges(WEEK);
      // genug Aktivität für jede mögliche erste Aufgabe (Antworten oder XP)
      useApp.setState({
        activity: { "2026-11-25": 300 },
        counters: { dev: { xp: 2000, activity: { "2026-11-25": 300 }, xpDays: { "2026-11-25": 2000 } } },
        xp: 2000,
        deviceId: "dev",
      });
      const before = useApp.getState().xp;
      const ev = useApp.getState().claimWeekly(first.id);
      expect(ev?.xp).toBe(first.xp);
      expect(useApp.getState().xp).toBe(before + first.xp);
      expect(useApp.getState().claimWeekly(first.id)).toBeNull();
      expect(useApp.getState().weekly[WEEK]).toEqual([first.id]);
    } finally {
      vi.useRealTimers();
    }
  });
});
