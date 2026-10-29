import { describe, expect, it } from "vitest";
import { rankEntries, StatsSchema, statsFrom, type Entry } from "@/lib/ranking";

const NOW = new Date(2026, 9, 9, 12).getTime();

function entry(id: string, patch: Partial<Entry> = {}): Entry {
  return { id, name: id, xp: 0, today: 0, day: "2026-10-09", goal: 30, streak: 0, streakDay: null, at: NOW, ...patch };
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
    expect(stats).toEqual({ name: "  Anna ", xp: 123, today: 7, day: "2026-10-09", goal: 20, streak: 4, streakDay: "2026-10-09" });
    expect(StatsSchema.parse(stats).name).toBe("Anna");
  });

  it("lehnt leere oder zu lange Namen und unsinnige Werte ab", () => {
    const ok = { name: "Ben", xp: 1, today: 0, day: "2026-10-09", goal: 30, streak: 0, streakDay: null };
    expect(StatsSchema.safeParse(ok).success).toBe(true);
    expect(StatsSchema.safeParse({ ...ok, name: "   " }).success).toBe(false);
    expect(StatsSchema.safeParse({ ...ok, name: "x".repeat(25) }).success).toBe(false);
    expect(StatsSchema.safeParse({ ...ok, xp: -5 }).success).toBe(false);
    expect(StatsSchema.safeParse({ ...ok, day: "heute" }).success).toBe(false);
  });
});
