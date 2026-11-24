import { weekXp, type Counter } from "./merge";
import { nextWeekStart, weekKey } from "./utils";

/**
 * Wochen-Challenge: jede Woche (Montag bis Sonntag) drei Aufgaben – je eine aus Menge, Regelmäßigkeit und
 * Besonderem. Jede erledigte Aufgabe bringt Bonus-XP zum Abholen, alle drei zusammen einen Extra-Bonus.
 * Welche drei es sind, hängt nur von der Woche ab – auf allen Geräten gleich.
 */

export type ChallengeKind = "answers" | "days" | "goals" | "xp" | "chapterTest" | "exam" | "focus";

export type Challenge = {
  id: string;
  kind: ChallengeKind;
  title: string;
  icon: string;
  target: number;
  /** Bonus-XP beim Abholen */
  xp: number;
};

/** Extra-Bonus, wenn alle drei Aufgaben der Woche abgeholt sind */
export const WEEKLY_ALL_ID = "all";
export const WEEKLY_ALL_BONUS = 150;

const c = (kind: ChallengeKind, target: number, xp: number, title: string, icon: string): Challenge => ({
  id: `${kind}-${target}`,
  kind,
  target,
  xp,
  title,
  icon,
});

const POOLS: Challenge[][] = [
  [
    c("answers", 150, 75, "Beantworte 150 Fragen oder Karten", "layers"),
    c("answers", 250, 120, "Beantworte 250 Fragen oder Karten", "layers"),
    c("xp", 600, 80, "Sammle 600 XP", "trending-up"),
    c("xp", 1000, 120, "Sammle 1.000 XP", "trending-up"),
  ],
  [
    c("days", 4, 75, "Lerne an 4 verschiedenen Tagen", "calendar-check"),
    c("days", 6, 120, "Lerne an 6 verschiedenen Tagen", "calendar-check"),
    c("goals", 3, 90, "Schaffe 3× dein Tagesziel", "target"),
    c("goals", 5, 140, "Schaffe 5× dein Tagesziel", "target"),
  ],
  [
    c("chapterTest", 2, 80, "Schließe 2 Kapiteltests ab", "file-check"),
    c("exam", 1, 100, "Schreibe einen Abschlusstest oder eine Probeklausur", "trophy"),
    c("focus", 1, 60, "Nutze deine Fokus-Stunde", "zap"),
  ],
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** Die drei Aufgaben der Woche (Schlüssel = Montag als JJJJ-MM-TT). */
export function weeklyChallenges(week: string): Challenge[] {
  const h = hash(week);
  return POOLS.map((pool, i) => pool[(h >>> (i * 5)) % pool.length]);
}

export type WeeklyInput = {
  activity: Record<string, number>;
  dailyGoal: number;
  counters: Record<string, Counter>;
  exams: { finishedAt: number; lecture?: string }[];
  focus?: Record<string, unknown>;
};

const inWeek = (day: string, week: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return weekKey(new Date(y, m - 1, d)) === week;
};

/** Aktueller Stand einer Aufgabe in der Woche von `now`, vergleichbar mit target. */
export function challengeProgress(ch: Challenge, d: WeeklyInput, now: number): number {
  const week = weekKey(now);
  const days = Object.entries(d.activity).filter(([day, n]) => n > 0 && inWeek(day, week));
  const exams = d.exams.filter((e) => weekKey(e.finishedAt) === week);
  switch (ch.kind) {
    case "answers":
      return days.reduce((s, [, n]) => s + n, 0);
    case "days":
      return days.length;
    case "goals":
      return days.filter(([, n]) => n >= d.dailyGoal).length;
    case "xp":
      return weekXp(d.counters, now);
    case "chapterTest":
      return exams.filter((e) => e.lecture).length;
    case "exam":
      return exams.filter((e) => !e.lecture).length;
    case "focus":
      return d.focus?.[week] ? 1 : 0;
  }
}

export type WeeklyState = {
  week: string;
  /** Beginn der nächsten Woche (ms) */
  endsAt: number;
  items: { challenge: Challenge; value: number; done: boolean; claimed: boolean }[];
  /** alle drei abgeholt → Extra-Bonus abholbar */
  allReady: boolean;
  allClaimed: boolean;
};

export function weeklyState(d: WeeklyInput, claimedLog: Record<string, string[]> | undefined, now: number): WeeklyState {
  const week = weekKey(now);
  const claimed = new Set(claimedLog?.[week] ?? []);
  const items = weeklyChallenges(week).map((challenge) => {
    const value = challengeProgress(challenge, d, now);
    return { challenge, value, done: value >= challenge.target, claimed: claimed.has(challenge.id) };
  });
  const allClaimed = claimed.has(WEEKLY_ALL_ID);
  return {
    week,
    endsAt: nextWeekStart(now),
    items,
    allReady: items.every((i) => i.claimed) && !allClaimed,
    allClaimed,
  };
}

/** Bonus-XP für eine abholbare Aufgabe (oder den Wochenbonus); null, wenn nichts abzuholen ist. */
export function claimableXp(state: WeeklyState, id: string): number | null {
  if (id === WEEKLY_ALL_ID) return state.allReady ? WEEKLY_ALL_BONUS : null;
  const item = state.items.find((i) => i.challenge.id === id);
  return item && item.done && !item.claimed ? item.challenge.xp : null;
}

/** Wochen, in denen alle drei Aufgaben samt Wochenbonus geschafft wurden (für Achievements). */
export function completedWeeks(log: Record<string, string[]> | undefined): number {
  return Object.values(log ?? {}).filter((ids) => ids.includes(WEEKLY_ALL_ID)).length;
}
