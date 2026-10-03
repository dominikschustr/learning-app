/**
 * Leitner-System: Box 0 = ungesehen, Box 1–5 = gelernt.
 * Richtig → eine Box hoch (ungesehen + richtig → direkt Box 2), falsch → Box 1.
 */

export type ItemState = {
  box: number;
  /** Zeitpunkt (ms), ab dem das Item wieder fällig ist. */
  due: number;
  seen: number;
  correct: number;
  wrong: number;
  lastCorrect: boolean;
  lastSeen: number;
  /** Beim allerersten Versuch richtig? (fehlt bei Ständen von vor dieser Erfassung) */
  firstCorrect?: boolean;
};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Wartezeit bis zur nächsten Wiederholung je Box. Box 1 kommt noch in derselben Sitzung wieder. */
export const BOX_INTERVALS = [0, 10 * MINUTE, 1 * DAY, 3 * DAY, 7 * DAY, 14 * DAY];

/** Wie sicher ein Item sitzt (0–1). Ungesehen zählt als 0. */
export const BOX_MASTERY = [0, 0.1, 0.4, 0.65, 0.85, 1];

export const MAX_BOX = 5;

export function review(prev: ItemState | undefined, correct: boolean, now: number): ItemState {
  const box = correct ? Math.min(MAX_BOX, prev && prev.box > 0 ? prev.box + 1 : 2) : 1;
  return {
    box,
    due: now + BOX_INTERVALS[box],
    seen: (prev?.seen ?? 0) + 1,
    correct: (prev?.correct ?? 0) + (correct ? 1 : 0),
    wrong: (prev?.wrong ?? 0) + (correct ? 0 : 1),
    lastCorrect: correct,
    lastSeen: now,
    firstCorrect: prev ? firstTry(prev) : correct,
  };
}

/** Beim ersten Versuch richtig? Ältere Stände ohne Erfassung: richtig, solange nie falsch beantwortet. */
export function firstTry(state: ItemState): boolean {
  return state.firstCorrect ?? state.wrong === 0;
}

/** Bearbeitungsstand einer Frage/Karte für die Kapitelstatistik. */
export type ItemStatus = "new" | "first" | "recovered" | "wrong";

export function itemStatus(state: ItemState | undefined): ItemStatus {
  if (!state || state.seen === 0) return "new";
  if (!state.lastCorrect) return "wrong";
  return firstTry(state) ? "first" : "recovered";
}

export function statusCounts(states: (ItemState | undefined)[]): Record<ItemStatus, number> {
  const out: Record<ItemStatus, number> = { new: 0, first: 0, recovered: 0, wrong: 0 };
  for (const s of states) out[itemStatus(s)]++;
  return out;
}

export function mastery(state: ItemState | undefined): number {
  return state ? BOX_MASTERY[state.box] : 0;
}

export function isDue(state: ItemState | undefined, now: number): boolean {
  return !!state && state.box > 0 && state.due <= now;
}

/** Schwäche-Wert: höher = schwächer. Ungesehene Items zählen nicht als Schwäche. */
export function weakness(state: ItemState | undefined): number {
  if (!state || state.seen === 0) return -1;
  const errorRate = state.wrong / state.seen;
  return (1 - mastery(state)) * 0.7 + errorRate * 0.3 + (state.lastCorrect ? 0 : 0.2);
}
