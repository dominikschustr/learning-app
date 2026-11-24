import { nextWeekStart, weekKey } from "./utils";

/**
 * Fokus-Stunde: einmal pro Woche (Montag bis Sonntag) 60 Minuten doppelte XP auf alles.
 * Läuft am Stück, lässt sich nicht pausieren. Synchronisiert, damit sie nicht je Gerät neu startet.
 */

export const FOCUS_MS = 60 * 60 * 1000;
export const FOCUS_MULTIPLIER = 2;

/** start: Startzeit (ms); xp: in dieser Stunde verdiente XP (inkl. Bonus) */
export type FocusRun = { start: number; xp: number };

/** Wochenschlüssel (Montag, siehe weekKey) → Fokus-Stunde dieser Woche */
export type FocusLog = Record<string, FocusRun>;

export type FocusState =
  | { status: "ready"; week: string }
  | { status: "active"; week: string; run: FocusRun; endsAt: number; remaining: number; progress: number }
  | { status: "used"; week: string; run: FocusRun; nextAt: number };

/** Die gerade laufende Fokus-Stunde (kann über die Wochengrenze hinauslaufen). */
export function activeFocus(log: FocusLog | undefined, now: number): { week: string; run: FocusRun } | null {
  for (const [week, run] of Object.entries(log ?? {})) {
    if (now >= run.start && now < run.start + FOCUS_MS) return { week, run };
  }
  return null;
}

export function focusState(log: FocusLog | undefined, now: number): FocusState {
  const active = activeFocus(log, now);
  if (active) {
    const endsAt = active.run.start + FOCUS_MS;
    return { status: "active", ...active, endsAt, remaining: endsAt - now, progress: (now - active.run.start) / FOCUS_MS };
  }
  const week = weekKey(now);
  const run = log?.[week];
  return run ? { status: "used", week, run, nextAt: nextWeekStart(now) } : { status: "ready", week };
}

export function focusMultiplier(log: FocusLog | undefined, now: number): number {
  return activeFocus(log, now) ? FOCUS_MULTIPLIER : 1;
}

/** Startet die Fokus-Stunde dieser Woche; null, wenn sie schon genutzt wurde oder gerade läuft. */
export function startFocusRun(log: FocusLog | undefined, now: number): FocusLog | null {
  if (focusState(log, now).status !== "ready") return null;
  return { ...log, [weekKey(now)]: { start: now, xp: 0 } };
}

/** Bucht XP auf die laufende Fokus-Stunde. */
export function addFocusXp(log: FocusLog | undefined, now: number, xp: number): FocusLog | undefined {
  const active = activeFocus(log, now);
  if (!active || xp <= 0) return log;
  return { ...log, [active.week]: { ...active.run, xp: active.run.xp + xp } };
}

/** Zusammenführen zweier Geräte: früherer Start gewinnt (eine Stunde pro Woche), XP als Maximum. */
export function mergeFocus(a: FocusLog | undefined, b: FocusLog | undefined): FocusLog {
  const out: FocusLog = { ...a };
  for (const [week, run] of Object.entries(b ?? {})) {
    const prev = out[week];
    out[week] = prev ? { start: Math.min(prev.start, run.start), xp: Math.max(prev.xp, run.xp) } : run;
  }
  return out;
}

/** Bestwert an XP in einer Fokus-Stunde (für das Achievement). */
export function bestFocusXp(log: FocusLog | undefined): number {
  return Math.max(0, ...Object.values(log ?? {}).map((r) => r.xp));
}
