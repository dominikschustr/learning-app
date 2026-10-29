import { z } from "zod";
import { levelInfo } from "./gamification";
import { weekXp, type Counter } from "./merge";
import { addDays, dayKey, weekKey } from "./utils";

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
  /** XP der Woche `week` (Montag der Woche); fehlt bei Einträgen von vor der Wochenliga */
  weekXp: z.number().int().min(0).max(10_000_000).default(0),
  week: day.nullable().default(null),
});

export type Stats = z.infer<typeof StatsSchema>;

/** Gespeicherter Eintrag; id ist öffentlich (Hash des geheimen Schlüssels). */
export type Entry = Stats & { id: string; at: number };

export type SortBy = "xp" | "week" | "today" | "streak";

export type Row = Entry & {
  rank: number;
  level: number;
  /** Tagesstand bezogen auf heute (0, wenn die Person heute noch nichts gemeldet hat) */
  todayNow: number;
  streakNow: number;
  /** Wochen-XP bezogen auf die aktuelle Woche (0, wenn aus einer früheren Woche) */
  weekNow: number;
};

export function statsFrom(
  s: {
    xp: number;
    activity: Record<string, number>;
    dailyGoal: number;
    streak: { current: number; lastDay: string | null };
    counters?: Record<string, Counter>;
  },
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
    weekXp: weekXp(s.counters ?? {}, now),
    week: weekKey(now),
  };
}

/** Sortiert und nummeriert; gleiche Werte teilen sich den Platz. */
export function rankEntries(entries: Entry[], by: SortBy, now: number): Row[] {
  const today = dayKey(now);
  const yesterday = dayKey(addDays(now, -1));
  const week = weekKey(now);
  const rows = entries.map((e) => ({
    ...e,
    rank: 0,
    level: levelInfo(e.xp).level,
    todayNow: e.day === today ? e.today : 0,
    streakNow: e.streakDay === today || e.streakDay === yesterday ? e.streak : 0,
    weekNow: e.week === week ? e.weekXp : 0,
  }));
  const key = (r: Row) => sortValue(r, by);
  rows.sort((a, b) => key(b) - key(a) || b.xp - a.xp || a.name.localeCompare(b.name, "de"));
  rows.forEach((r, i) => {
    r.rank = i > 0 && key(rows[i - 1]) === key(r) ? rows[i - 1].rank : i + 1;
  });
  return rows;
}

/** Wert, nach dem gerade sortiert wird. */
export function sortValue(r: Row, by: SortBy): number {
  return by === "xp" ? r.xp : by === "week" ? r.weekNow : by === "today" ? r.todayNow : r.streakNow;
}

export type League = { id: string; name: string; minLevel: number; color: string };

/** Ligen nach Level – farbige Stufen über den Titeln. */
export const LEAGUES: League[] = [
  { id: "bronze", name: "Bronze", minLevel: 1, color: "#b8733a" },
  { id: "silver", name: "Silber", minLevel: 3, color: "#8a94a3" },
  { id: "gold", name: "Gold", minLevel: 5, color: "#d4a017" },
  { id: "platinum", name: "Platin", minLevel: 8, color: "#3fa7b5" },
  { id: "diamond", name: "Diamant", minLevel: 12, color: "#6c63ff" },
  { id: "legend", name: "Legende", minLevel: 17, color: "#e0457b" },
];

export function leagueFor(level: number): League {
  return [...LEAGUES].reverse().find((l) => level >= l.minLevel)!;
}

/** Höchster erreichter Streak-Meilenstein (für das Flammen-Abzeichen). */
export const STREAK_MILESTONES = [3, 7, 14, 30, 100] as const;

export function streakMilestone(streak: number): number | null {
  return [...STREAK_MILESTONES].reverse().find((m) => streak >= m) ?? null;
}

export type Duel = {
  /** Person direkt vor dir (null = du führst) */
  ahead: { row: Row; gap: number } | null;
  /** Person direkt hinter dir (null = du bist Letzte:r) */
  behind: { row: Row; gap: number } | null;
};

/**
 * Wie weit bis zum nächsten Platz, wie knapp hinter dir? gap ahead = so viel brauchst du,
 * um vorbeizuziehen (bei Gleichstand 1); gap behind = Vorsprung.
 */
export function duel(rows: Row[], myId: string, by: SortBy): Duel | null {
  const i = rows.findIndex((r) => r.id === myId);
  if (i < 0) return null;
  const me = rows[i];
  const mine = sortValue(me, by);
  const ahead = rows.slice(0, i).reverse().find((r) => r.rank < me.rank) ?? null;
  const behind = rows.slice(i + 1).find((r) => r.rank > me.rank) ?? null;
  return {
    ahead: ahead && { row: ahead, gap: sortValue(ahead, by) - mine + 1 },
    behind: behind && { row: behind, gap: mine - sortValue(behind, by) },
  };
}

/** Gemeinsamer Tagesstand aller: Antworten heute, wie viele ihr Ziel geschafft haben. */
export function teamDay(rows: Row[]) {
  const active = rows.filter((r) => r.todayNow > 0);
  return {
    answers: rows.reduce((s, r) => s + r.todayNow, 0),
    goal: active.reduce((s, r) => s + r.goal, 0),
    active: active.length,
    done: rows.filter((r) => r.todayNow >= r.goal).length,
  };
}

/** Platz je Person beim letzten Besuch (pro Sortierung), um Auf- und Abstiege zu zeigen. */
export type Seen = Record<string, number>;

export function snapshot(rows: Row[]): Seen {
  return Object.fromEntries(rows.map((r) => [r.id, r.rank]));
}

/** Plätze gewonnen (+) oder verloren (−) seit dem letzten Besuch; undefined = neu oder unverändert unbekannt. */
export function movement(prev: Seen | null, row: Row): number | undefined {
  const before = prev?.[row.id];
  return before === undefined ? undefined : before - row.rank;
}

/** Wen du seit dem letzten Besuch überholt hast und wer dich überholt hat. */
export function overtakes(prev: Seen | null, rows: Row[], myId: string) {
  const me = rows.find((r) => r.id === myId);
  const was = prev?.[myId];
  if (!me || was === undefined) return { passed: [] as Row[], passedBy: [] as Row[] };
  const passed = rows.filter((r) => r.id !== myId && prev![r.id] !== undefined && prev![r.id] < was && r.rank > me.rank);
  const passedBy = rows.filter((r) => r.id !== myId && prev![r.id] !== undefined && prev![r.id] > was && r.rank < me.rank);
  return { passed, passedBy };
}
