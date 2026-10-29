import { describe, expect, it } from "vitest";
import { rankEntries, StatsSchema, statsFrom, type Entry } from "@/lib/ranking";

const NOW = new Date(2026, 9, 9, 12).getTime();

function entry(id: string, patch: Partial<Entry> = {}): Entry {
  return { id, name: id, xp: 0, today: 0, day: "2026-10-09", goal: 30, streak: 0, streakDay: null, weekXp: 0, week: null, at: NOW, ...patch };
}

describe("rankEntries", () => {
  it("sortiert nach XP und berechnet das Level", () => {
    const rows = rankEntries([entry("a", { xp: 50 }), entry("b", { xp: 350 }), entry("c", { xp: 100 })], "xp", NOW);
    expect(rows.map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(rows.map((r) => r.level)).toEqual([3, 2, 1]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("zählt den Tagesstand nur, wenn er von heute ist", () => {
    const rows = rankEntries(
      [entry("gestern", { today: 80, day: "2026-10-08" }), entry("heute", { today: 5 })],
      "today",
      NOW,
    );
    expect(rows.map((r) => [r.id, r.todayNow])).toEqual([
      ["heute", 5],
      ["gestern", 0],
    ]);
  });

  it("lässt eine abgelaufene Streak verfallen", () => {
    const rows = rankEntries(
      [
        entry("alt", { streak: 9, streakDay: "2026-10-07" }),
        entry("gestern", { streak: 3, streakDay: "2026-10-08" }),
        entry("heute", { streak: 2, streakDay: "2026-10-09" }),
      ],
      "streak",
      NOW,
    );
    expect(rows.map((r) => [r.id, r.streakNow])).toEqual([
      ["gestern", 3],
      ["heute", 2],
      ["alt", 0],
    ]);
  });

  it("vergibt bei Gleichstand denselben Platz", () => {
    const rows = rankEntries([entry("a", { today: 10 }), entry("b", { today: 10 }), entry("c", { today: 3 })], "today", NOW);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });
});

describe("Ranglisten-Meldung", () => {
  it("baut die Meldung aus dem Lernstand und prüft sie", () => {
    const stats = statsFrom(
      { xp: 123.4, activity: { "2026-10-09": 7 }, dailyGoal: 20, streak: { current: 4, lastDay: "2026-10-09" } },
      "  Anna ",
      NOW,
    );
    expect(stats).toEqual({ name: "  Anna ", xp: 123, today: 7, day: "2026-10-09", goal: 20, streak: 4, streakDay: "2026-10-09", weekXp: 0, week: "2026-10-05" });
    expect(StatsSchema.parse(stats).name).toBe("Anna");
  });

  it("lehnt leere oder zu lange Namen und unsinnige Werte ab", () => {
    const ok = { name: "Ben", xp: 1, today: 0, day: "2026-10-09", goal: 30, streak: 0, streakDay: null };
    expect(StatsSchema.safeParse(ok).success).toBe(true);
    expect(StatsSchema.safeParse({ ...ok, name: "   " }).success).toBe(false);
    expect(StatsSchema.safeParse({ ...ok, name: "x".repeat(25) }).success).toBe(false);
    expect(StatsSchema.safeParse({ ...ok, xp: -5 }).success).toBe(false);
    expect(StatsSchema.safeParse({ ...ok, day: "heute" }).success).toBe(false);
    expect(StatsSchema.safeParse({ ...ok, weekXp: -1 }).success).toBe(false);
    expect(StatsSchema.parse(ok)).toMatchObject({ weekXp: 0, week: null });
  });
});

import { duel, leagueFor, movement, overtakes, snapshot, streakMilestone, teamDay } from "@/lib/ranking";

describe("Gamification der Rangliste", () => {
  const rows = rankEntries(
    [entry("a", { xp: 500, today: 40 }), entry("b", { xp: 300, today: 10 }), entry("me", { xp: 250, today: 30 }), entry("c", { xp: 100 })],
    "xp",
    NOW,
  );

  it("berechnet das Duell mit dem Platz davor und dahinter", () => {
    const d = duel(rows, "me", "xp")!;
    expect(d.ahead?.row.id).toBe("b");
    expect(d.ahead?.gap).toBe(51);
    expect(d.behind?.row.id).toBe("c");
    expect(d.behind?.gap).toBe(150);
    expect(duel(rows, "a", "xp")!.ahead).toBeNull();
  });

  it("ordnet Ligen und Streak-Meilensteine zu", () => {
    expect(leagueFor(1).id).toBe("bronze");
    expect(leagueFor(5).id).toBe("gold");
    expect(leagueFor(20).id).toBe("legend");
    expect(streakMilestone(2)).toBeNull();
    expect(streakMilestone(8)).toBe(7);
  });

  it("summiert den gemeinsamen Tagesstand", () => {
    expect(teamDay(rows)).toEqual({ answers: 80, goal: 90, active: 3, done: 2 });
  });

  it("erkennt Auf- und Abstiege und Überholungen seit dem letzten Besuch", () => {
    const before = { a: 1, me: 2, b: 3, c: 4 };
    expect(movement(before, rows.find((r) => r.id === "me")!)).toBe(-1);
    const { passed, passedBy } = overtakes(before, rows, "me");
    expect(passed).toEqual([]);
    expect(passedBy.map((r) => r.id)).toEqual(["b"]);
    const later = overtakes(snapshot(rows), rankEntries([entry("a", { xp: 500 }), entry("b", { xp: 300 }), entry("me", { xp: 400 }), entry("c", { xp: 100 })], "xp", NOW), "me");
    expect(later.passed.map((r) => r.id)).toEqual(["b"]);
    expect(overtakes(null, rows, "me").passed).toEqual([]);
  });
});

import { mergeSync, weekXp } from "@/lib/merge";
import { nextWeekStart, weekKey } from "@/lib/utils";

describe("Wochenliga", () => {
  it("bestimmt Montag als Wochenschlüssel und den nächsten Wochenstart", () => {
    expect(weekKey(new Date(2026, 9, 29, 15))).toBe("2026-10-26"); // Donnerstag
    expect(weekKey(new Date(2026, 9, 26, 0, 1))).toBe("2026-10-26"); // Montag
    expect(weekKey(new Date(2026, 10, 1, 23))).toBe("2026-10-26"); // Sonntag
    expect(nextWeekStart(new Date(2026, 9, 29))).toBe(new Date(2026, 10, 2).getTime());
  });

  it("summiert die XP aller Geräte nur für die laufende Woche", () => {
    const counters = {
      laptop: { xp: 500, activity: {}, xpDays: { "2026-10-25": 300, "2026-10-26": 40, "2026-10-29": 60 } },
      handy: { xp: 50, activity: {}, xpDays: { "2026-10-28": 50 } },
      alt: { xp: 999, activity: {} },
    };
    expect(weekXp(counters, new Date(2026, 9, 29, 12).getTime())).toBe(150);
  });

  it("verliert beim Zusammenführen keine Tages-XP", () => {
    const base = { xp: 0, activity: {}, items: {}, cards: {}, streak: { current: 0, best: 0, lastDay: null }, dailyGoal: 30, dailyGoalAt: 0, bestCombo: 0, achievements: {}, exams: [], blitzBest: {}, marks: {} };
    const a = { ...base, deviceId: "a", counters: { a: { xp: 30, activity: {}, xpDays: { "2026-10-29": 30 } } } };
    const b = { ...base, deviceId: "b", counters: { a: { xp: 10, activity: {}, xpDays: { "2026-10-29": 10 } }, b: { xp: 20, activity: {}, xpDays: { "2026-10-28": 20 } } } };
    const m = mergeSync(a, b);
    expect(weekXp(m.counters, new Date(2026, 9, 29, 12).getTime())).toBe(50);
  });

  it("zählt Wochen-XP aus einer früheren Woche als 0 und meldet die eigene Woche", () => {
    const now = new Date(2026, 9, 29, 12).getTime();
    const rows = rankEntries([entry("alt", { weekXp: 900, week: "2026-10-19" }), entry("neu", { weekXp: 40, week: "2026-10-26" })], "week", now);
    expect(rows.map((r) => [r.id, r.weekNow])).toEqual([["neu", 40], ["alt", 0]]);
    const s = statsFrom({ xp: 10, activity: {}, dailyGoal: 30, streak: { current: 0, lastDay: null }, counters: { x: { xp: 10, activity: {}, xpDays: { "2026-10-29": 10 } } } }, "Ich", now);
    expect([s.weekXp, s.week]).toEqual([10, "2026-10-26"]);
  });
});
