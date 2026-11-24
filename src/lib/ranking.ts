import { z } from "zod";
import { levelInfo } from "./gamification";
import { weekXp, type Counter } from "./merge";
import { activeFocus, FOCUS_MS, type FocusLog } from "./focus";
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
  /** XP der Woche vor `week` – damit der Wochensieger auch feststeht, wenn alle schon in der neuen Woche gemeldet haben */
  lastWeekXp: z.number().int().min(0).max(10_000_000).default(0),
  /** gewonnene Wochenligen (abgeholte Siegerprämien) */
  wins: z.number().int().min(0).max(10_000).default(0),
  /** Ende der laufenden Fokus-Stunde (ms), 0 = keine */
  focusUntil: z.number().int().min(0).max(1e13).default(0),
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
    focus?: FocusLog;
    weekly?: Record<string, string[]>;
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
    lastWeekXp: weekXp(s.counters ?? {}, addDays(now, -7).getTime()),
    wins: leagueWins(s.weekly),
    focusUntil: (() => {
      const f = activeFocus(s.focus, now);
      return f ? f.run.start + FOCUS_MS : 0;
    })(),
  };
}

/** XP einer Person in der Vorwoche von `now` (siehe lastWeekWinners). */
function lastWeekXp(now: number) {
  const week = weekKey(addDays(now, -7));
  const thisWeek = weekKey(now);
  return { week, xpOf: (e: Entry) => (e.week === week ? e.weekXp : e.week === thisWeek ? e.lastWeekXp : 0) };
}

/**
 * Sieger der Wochenliga der Vorwoche (bei Gleichstand alle mit den meisten XP), dazu die Woche (Montag).
 * Wochen-XP der Vorwoche: aus `weekXp`, wenn jemand zuletzt in der Vorwoche gemeldet hat, sonst aus `lastWeekXp`.
 */
export function lastWeekWinners(entries: Entry[], now: number): { week: string; xp: number; winners: Entry[] } {
  const { week, xpOf } = lastWeekXp(now);
  const xp = Math.max(0, ...entries.map(xpOf));
  return { week, xp, winners: xp > 0 ? entries.filter((e) => xpOf(e) === xp).sort((a, b) => a.name.localeCompare(b.name, "de")) : [] };
}

/** Prämien der Wochenliga für Platz 1, 2, 3 (Bonus-XP, abholbar in der Woche danach). */
export const PODIUM_PRIZES = [150, 100, 50] as const;

/** Kennung der abgeholten Prämie im Wochen-Log (weekly[Woche]), z. B. "podium-1". */
export const podiumId = (place: number) => `podium-${place}`;

/**
 * Prämie für einen Platz der Wochenliga bei `active` Personen mit XP in der Woche. Hinter dir muss
 * mindestens eine Person liegen – allein gewinnt man nichts; zu zweit gibt es nur Platz 1.
 */
export function podiumPrize(place: number, active: number): number {
  return place >= 1 && place <= Math.min(PODIUM_PRIZES.length, active - 1) ? PODIUM_PRIZES[place - 1] : 0;
}

/** Gewonnene Wochenligen: Wochen, in denen die Prämie für Platz 1 abgeholt wurde. */
export function leagueWins(weekly: Record<string, string[]> | undefined): number {
  return Object.values(weekly ?? {}).filter((ids) => ids.includes(podiumId(1))).length;
}

export type LastWeekResult = {
  week: string;
  /** Platz in der Vorwoche (gleiche XP teilen sich den Platz); null = keine XP in der Vorwoche */
  place: number | null;
  xp: number;
  /** Personen mit XP in der Vorwoche */
  active: number;
  prize: number;
};

/** Eigenes Ergebnis der Wochenliga der Vorwoche – Grundlage für die Prämie. */
export function lastWeekResult(entries: Entry[], myId: string, now: number): LastWeekResult {
  const { week, xpOf } = lastWeekXp(now);
  const xs = entries.map(xpOf).filter((x) => x > 0);
  const me = entries.find((e) => e.id === myId);
  const xp = me ? xpOf(me) : 0;
  const place = xp > 0 ? xs.filter((x) => x > xp).length + 1 : null;
  return { week, place, xp, active: xs.length, prize: place ? podiumPrize(place, xs.length) : 0 };
}

/** Kürzlich gemeldet – „gerade aktiv“ (gemeldet wird spätestens eine Minute nach dem Lernen). */
export const LIVE_MS = 10 * 60_000;

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
