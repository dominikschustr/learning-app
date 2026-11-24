import { mergeFocus, type FocusLog } from "./focus";
import type { ItemState } from "./srs";
import { addDays, dayKey, weekKey } from "./utils";

/**
 * Zusammenführen des Lernstands zweier Geräte.
 * Grundsatz: nichts geht verloren, egal in welcher Reihenfolge Geräte synchronisieren.
 * - XP und Aktivität zählt jedes Gerät separat (counters), die Summe ist der Gesamtwert.
 * - Pro Frage/Karte gewinnt der zuletzt geübte Stand.
 * - Tests und Achievements werden vereinigt, Bestwerte als Maximum übernommen.
 * - Lesezeichen: pro Frage/Karte gewinnt das zuletzt gesetzte oder entfernte.
 * - Eigene Klausurtermine: pro Fach gewinnt der zuletzt eingetragene.
 * - Fokus-Stunde: pro Woche gewinnt der frühere Start, damit sie nur einmal läuft.
 * - Wochen-Challenge: abgeholte Aufgaben je Woche werden vereinigt (nichts doppelt abholbar).
 */

/** xpDays: XP je Tag (seit der Wochenliga; ältere Zähler haben es nicht). */
export type Counter = { xp: number; activity: Record<string, number>; xpDays?: Record<string, number> };

/** Lesezeichen; on: false bleibt stehen, damit das Entfernen auf andere Geräte übertragen wird. */
export type Mark = { on: boolean; at: number };

/** Eigener Klausurtermin; date "" = zurückgesetzt (bleibt stehen, damit das Zurücksetzen synchronisiert wird). */
export type ExamDate = { date: string; at: number };

export type ExamLike = { id: string; results: Record<string, boolean | null> };

export type SyncData<E extends ExamLike = ExamLike> = {
  deviceId: string;
  counters: Record<string, Counter>;
  xp: number;
  activity: Record<string, number>;
  items: Record<string, ItemState>;
  cards: Record<string, ItemState>;
  streak: { current: number; best: number; lastDay: string | null };
  dailyGoal: number;
  dailyGoalAt: number;
  bestCombo: number;
  achievements: Record<string, number>;
  exams: E[];
  blitzBest: Record<string, number>;
  marks: Record<string, Mark>;
  /** fehlt in älteren Cloud-Ständen */
  examDates?: Record<string, ExamDate>;
  /** Fokus-Stunden je Woche; fehlt in älteren Cloud-Ständen */
  focus?: FocusLog;
  /** Wochen-Challenge: Woche → abgeholte Aufgaben; fehlt in älteren Cloud-Ständen */
  weekly?: Record<string, string[]>;
};

/** Abgeholte Aufgaben der Wochen-Challenge je Woche vereinigen. */
export function mergeWeekly(
  a: Record<string, string[]> | undefined,
  b: Record<string, string[]> | undefined,
): Record<string, string[]> {
  const out: Record<string, string[]> = { ...a };
  for (const [week, ids] of Object.entries(b ?? {})) out[week] = [...new Set([...(out[week] ?? []), ...ids])].sort();
  return out;
}

function mergeRecord<T>(a: Record<string, T>, b: Record<string, T>, pick: (x: T, y: T) => T): Record<string, T> {
  const out: Record<string, T> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? pick(out[k], v) : v;
  return out;
}

const newer = (x: ItemState, y: ItemState) =>
  y.lastSeen > x.lastSeen || (y.lastSeen === x.lastSeen && y.seen > x.seen) ? y : x;

export function totals(counters: Record<string, Counter>): Pick<SyncData, "xp" | "activity"> {
  let xp = 0;
  const activity: Record<string, number> = {};
  for (const c of Object.values(counters)) {
    xp += c.xp;
    for (const [day, n] of Object.entries(c.activity)) activity[day] = (activity[day] ?? 0) + n;
  }
  return { xp, activity };
}

/** XP aller Geräte in der Woche von `now` (Montag bis Sonntag). */
export function weekXp(counters: Record<string, Counter>, now: number): number {
  const week = weekKey(now);
  let sum = 0;
  for (const c of Object.values(counters)) {
    for (const [day, xp] of Object.entries(c.xpDays ?? {})) {
      const [y, m, d] = day.split("-").map(Number);
      if (weekKey(new Date(y, m - 1, d)) === week) sum += xp;
    }
  }
  return sum;
}

/** Streak aus den Lerntagen: aktuelle Serie bis zum letzten Lerntag und längste Serie. */
export function streakFromActivity(activity: Record<string, number>, prevBest = 0): SyncData["streak"] {
  const days = Object.keys(activity)
    .filter((d) => activity[d] > 0)
    .sort();
  if (!days.length) return { current: 0, best: prevBest, lastDay: null };
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const [y, m, d] = days[i - 1].split("-").map(Number);
    run = dayKey(addDays(new Date(y, m - 1, d), 1)) === days[i] ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return { current: run, best: Math.max(best, prevBest), lastDay: days[days.length - 1] };
}

const graded = (e: ExamLike) => Object.values(e.results).filter((r) => r !== null).length;

export function mergeSync<E extends ExamLike>(local: SyncData<E>, remote: SyncData<E>): SyncData<E> {
  const counters = mergeRecord(local.counters ?? {}, remote.counters ?? {}, (x, y) => ({
    xp: Math.max(x.xp, y.xp),
    activity: mergeRecord(x.activity, y.activity, Math.max),
    xpDays: mergeRecord(x.xpDays ?? {}, y.xpDays ?? {}, Math.max),
  }));
  const { xp, activity } = totals(counters);

  const exams = new Map<string, E>();
  for (const e of [...(local.exams ?? []), ...(remote.exams ?? [])]) {
    const prev = exams.get(e.id);
    if (!prev || graded(e) > graded(prev)) exams.set(e.id, e);
  }

  const goalFromRemote = (remote.dailyGoalAt ?? 0) > (local.dailyGoalAt ?? 0);

  return {
    deviceId: local.deviceId,
    counters,
    xp,
    activity,
    items: mergeRecord(local.items ?? {}, remote.items ?? {}, newer),
    cards: mergeRecord(local.cards ?? {}, remote.cards ?? {}, newer),
    streak: streakFromActivity(activity, Math.max(local.streak?.best ?? 0, remote.streak?.best ?? 0)),
    dailyGoal: goalFromRemote ? remote.dailyGoal : local.dailyGoal,
    dailyGoalAt: Math.max(local.dailyGoalAt ?? 0, remote.dailyGoalAt ?? 0),
    bestCombo: Math.max(local.bestCombo ?? 0, remote.bestCombo ?? 0),
    achievements: mergeRecord(local.achievements ?? {}, remote.achievements ?? {}, Math.min),
    exams: [...exams.values()].sort((a, b) => a.id.localeCompare(b.id)),
    blitzBest: mergeRecord(local.blitzBest ?? {}, remote.blitzBest ?? {}, Math.max),
    marks: mergeRecord(local.marks ?? {}, remote.marks ?? {}, (x, y) => (y.at > x.at ? y : x)),
    examDates: mergeRecord(local.examDates ?? {}, remote.examDates ?? {}, (x, y) => (y.at > x.at ? y : x)),
    focus: mergeFocus(local.focus, remote.focus),
    weekly: mergeWeekly(local.weekly, remote.weekly),
  };
}
