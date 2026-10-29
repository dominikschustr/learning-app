import { z } from "zod";
import { levelInfo } from "./gamification";
import { addDays, dayKey } from "./utils";

/**
 * Rangliste: jede teilnehmende Person meldet ihren Stand (Level/XP, Tagesstand, Streak).
 * Gespeichert wird nur dieser kleine Eintrag, nicht der Lernstand.
 */

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const NAME_MAX = 24;

export const StatsSchema = z.object({
  name: z
    .string()
    .transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, "").trim())
    .pipe(z.string().min(1).max(NAME_MAX)),
  xp: z.number().int().min(0).max(10_000_000),
  /** Antworten am Tag `day` (lokales Datum der Person) */
  today: z.number().int().min(0).max(100_000),
  day,
  goal: z.number().int().min(1).max(1000),
  streak: z.number().int().min(0).max(100_000),
  streakDay: day.nullable(),
});

export type Stats = z.infer<typeof StatsSchema>;

/** Gespeicherter Eintrag; id ist öffentlich (Hash des geheimen Schlüssels). */
export type Entry = Stats & { id: string; at: number };

export type SortBy = "xp" | "today" | "streak";

export type Row = Entry & {
  rank: number;
  level: number;
  /** Tagesstand bezogen auf heute (0, wenn die Person heute noch nichts gemeldet hat) */
  todayNow: number;
  streakNow: number;
};

export function statsFrom(
  s: { xp: number; activity: Record<string, number>; dailyGoal: number; streak: { current: number; lastDay: string | null } },
  name: string,
  now: number,
): Stats {
  const today = dayKey(now);
  return {
    name,
    xp: Math.max(0, Math.floor(s.xp)),
    today: s.activity[today] ?? 0,
    day: today,
    goal: s.dailyGoal,
    streak: s.streak.current,
    streakDay: s.streak.lastDay,
  };
}

/** Sortiert und nummeriert; gleiche Werte teilen sich den Platz. */
export function rankEntries(entries: Entry[], by: SortBy, now: number): Row[] {
  const today = dayKey(now);
  const yesterday = dayKey(addDays(now, -1));
  const rows = entries.map((e) => ({
    ...e,
    rank: 0,
    level: levelInfo(e.xp).level,
    todayNow: e.day === today ? e.today : 0,
    streakNow: e.streakDay === today || e.streakDay === yesterday ? e.streak : 0,
  }));
  const key = (r: Row) => (by === "xp" ? r.xp : by === "today" ? r.todayNow : r.streakNow);
  rows.sort((a, b) => key(b) - key(a) || b.xp - a.xp || a.name.localeCompare(b.name, "de"));
  rows.forEach((r, i) => {
    r.rank = i > 0 && key(rows[i - 1]) === key(r) ? rows[i - 1].rank : i + 1;
  });
  return rows;
}
