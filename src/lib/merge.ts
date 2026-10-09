import type { ItemState } from "./srs";
import { addDays, dayKey } from "./utils";

/**
 * Zusammenführen des Lernstands zweier Geräte.
 * Grundsatz: nichts geht verloren, egal in welcher Reihenfolge Geräte synchronisieren.
 * - XP und Aktivität zählt jedes Gerät separat (counters), die Summe ist der Gesamtwert.
 * - Pro Frage/Karte gewinnt der zuletzt geübte Stand.
 * - Tests und Achievements werden vereinigt, Bestwerte als Maximum übernommen.
 * - Lesezeichen: pro Frage/Karte gewinnt das zuletzt gesetzte oder entfernte.
 * - Ranglisten-Profil: das zuletzt geänderte gewinnt.
 */

export type Counter = { xp: number; activity: Record<string, number> };

/** Lesezeichen; on: false bleibt stehen, damit das Entfernen auf andere Geräte übertragen wird. */
export type Mark = { on: boolean; at: number };

/**
 * Teilnahme an der Rangliste. id ist geheim (nur der SHA-256 davon ist öffentlich), damit niemand
 * fremde Einträge überschreiben kann. on: false bleibt stehen, damit das Austreten synchronisiert wird.
 */
export type Profile = { id: string; name: string; on: boolean; at: number };

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
  profile?: Profile | null;
};

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

function newerProfile(a: Profile | null | undefined, b: Profile | null | undefined): Profile | null {
  if (!a || !b) return a ?? b ?? null;
  return b.at > a.at || (b.at === a.at && b.id > a.id) ? b : a;
}

const graded = (e: ExamLike) => Object.values(e.results).filter((r) => r !== null).length;

export function mergeSync<E extends ExamLike>(local: SyncData<E>, remote: SyncData<E>): SyncData<E> {
  const counters = mergeRecord(local.counters ?? {}, remote.counters ?? {}, (x, y) => ({
    xp: Math.max(x.xp, y.xp),
    activity: mergeRecord(x.activity, y.activity, Math.max),
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
    profile: newerProfile(local.profile, remote.profile),
  };
}
