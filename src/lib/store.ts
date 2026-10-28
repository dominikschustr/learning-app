"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ACHIEVEMENTS, levelInfo, type AchievementDef } from "./gamification";
import { mergeSync, totals, type Counter, type Mark, type SyncData } from "./merge";
import { review, type ItemState } from "./srs";
import { addDays, dayKey, itemKey, randomId } from "./utils";

export type ExamAnswer =
  | { kind: "mc"; selected: string[] }
  | { kind: "tf"; value: boolean | null }
  | { kind: "short"; text: string };

export type ShortGrade = {
  score: number;
  hit: string[];
  missed: string[];
  feedback: string;
  source: "ai" | "self";
};

export type ActiveExam = {
  subjectId: string;
  /** gesetzt = Kapiteltest, sonst Abschlusstest über alle Kapitel */
  lecture?: string;
  questionIds: string[];
  optionOrder: Record<string, string[]>;
  answers: Record<string, ExamAnswer>;
  flagged: string[];
  current: number;
  startedAt: number;
  minutes: number;
};

export type ExamRecord = {
  id: string;
  subjectId: string;
  lecture?: string;
  finishedAt: number;
  durationSec: number;
  questionIds: string[];
  optionOrder: Record<string, string[]>;
  answers: Record<string, ExamAnswer>;
  /** Frage-id → richtig? (Kurzantwort erst nach Bewertung) */
  results: Record<string, boolean | null>;
  /** Frage-id → Teilpunkte 0–1 */
  partial: Record<string, number>;
  shortGrades: Record<string, ShortGrade>;
};

export type Streak = { current: number; best: number; lastDay: string | null };

type Data = {
  /** Kennung dieses Geräts (für die geräteübergreifende Synchronisation) */
  deviceId: string;
  /** XP und Aktivität je Gerät; xp/activity sind deren Summe */
  counters: Record<string, Counter>;
  dailyGoalAt: number;
  items: Record<string, ItemState>;
  cards: Record<string, ItemState>;
  xp: number;
  streak: Streak;
  activity: Record<string, number>;
  dailyGoal: number;
  bestCombo: number;
  achievements: Record<string, number>;
  exams: ExamRecord[];
  activeExam: ActiveExam | null;
  blitzBest: Record<string, number>;
  /** Lesezeichen für Fragen (q:…) und Karteikarten (c:…), siehe markKey */
  marks: Record<string, Mark>;
};

export type AnswerEvent = { xp: number; levelUp: number | null; achievements: AchievementDef[]; goalReached: boolean };

type Actions = {
  answer(input: {
    subjectId: string;
    itemId: string;
    correct: boolean;
    xp: number;
    combo?: number;
    /** false: zählt für XP/Aktivität, verändert aber nicht die Spaced-Repetition-Box. */
    srs?: boolean;
  }): AnswerEvent;
  reviewCard(input: { subjectId: string; cardId: string; known: boolean; xp: number }): AnswerEvent;
  bonusXp(xp: number): AnswerEvent;
  startExam(exam: ActiveExam): void;
  updateExam(patch: Partial<ActiveExam>): void;
  setExamAnswer(questionId: string, answer: ExamAnswer): void;
  finishExam(record: ExamRecord): void;
  updateExamRecord(id: string, patch: Partial<ExamRecord>): void;
  discardExam(): void;
  setBlitzBest(subjectId: string, score: number): void;
  setDailyGoal(goal: number): void;
  toggleMark(key: string): void;
  /** Übernimmt einen zusammengeführten Stand aus der Synchronisation. */
  applySync(data: SyncData<ExamRecord>): void;
  importData(data: unknown): boolean;
  reset(): void;
};

export type AppState = Data & Actions;

const initial: Data = {
  deviceId: "",
  counters: {},
  dailyGoalAt: 0,
  items: {},
  cards: {},
  xp: 0,
  streak: { current: 0, best: 0, lastDay: null },
  activity: {},
  dailyGoal: 30,
  bestCombo: 0,
  achievements: {},
  exams: [],
  activeExam: null,
  blitzBest: {},
  marks: {},
};

function nextStreak(streak: Streak, now: number): Streak {
  const today = dayKey(now);
  if (streak.lastDay === today) return streak;
  const current = streak.lastDay === dayKey(addDays(now, -1)) ? streak.current + 1 : 1;
  return { current, best: Math.max(streak.best, current), lastDay: today };
}

/** Aktuelle Streak für die Anzeige: verfällt, wenn gestern und heute nichts gelernt wurde. */
export function visibleStreak(streak: Streak, now: number): number {
  if (!streak.lastDay) return 0;
  const alive = streak.lastDay === dayKey(now) || streak.lastDay === dayKey(addDays(now, -1));
  return alive ? streak.current : 0;
}

type AchievementInput = Pick<Data, "activity" | "cards" | "items" | "bestCombo" | "dailyGoal" | "streak" | "exams" | "blitzBest" | "xp">;

/** Aktueller Stand je Achievement, vergleichbar mit dessen target. */
export function achievementProgress(d: AchievementInput, now: number): Record<string, number> {
  const best = (exams: ExamRecord[]) => Math.floor(exams.reduce((b, e) => Math.max(b, examScore(e).score), 0) * 100 + 1e-9);
  return {
    "first-answer": Object.values(d.activity).reduce((a, b) => a + b, 0),
    "combo-5": d.bestCombo,
    "combo-10": d.bestCombo,
    "daily-goal": (d.activity[dayKey(now)] ?? 0) >= d.dailyGoal ? 1 : 0,
    "streak-3": d.streak.best,
    "streak-7": d.streak.best,
    "cards-50": Object.values(d.cards).reduce((a, c) => a + c.correct, 0),
    "mastered-25": Object.values(d.items).filter((i) => i.box >= 4).length,
    "exam-1": d.exams.filter((e) => !e.lecture).length,
    "exam-80": best(d.exams.filter((e) => !e.lecture)),
    "chapter-test": best(d.exams.filter((e) => e.lecture)),
    "blitz-15": Math.max(0, ...Object.values(d.blitzBest)),
    "level-5": levelInfo(d.xp).level,
  };
}

function unlocked(d: Data, now: number): string[] {
  const p = achievementProgress(d, now);
  return ACHIEVEMENTS.filter((a) => (p[a.id] ?? 0) >= a.target && !d.achievements[a.id]).map((a) => a.id);
}

/** Stellt sicher, dass es eine Geräte-id gibt und XP/Aktivität in den Gerätezählern stecken. */
export function withDevice(d: Data): Data {
  const deviceId = d.deviceId || randomId(12);
  const counters = { ...(d.counters ?? {}) };
  const counted = totals(counters);
  if (counted.xp !== d.xp || Object.keys(counted.activity).length !== Object.keys(d.activity ?? {}).length) {
    // Altbestand (vor der Synchronisation) oder Import: Differenz diesem Gerät zuschreiben
    const own = counters[deviceId] ?? { xp: 0, activity: {} };
    const activity = { ...own.activity };
    for (const [day, n] of Object.entries(d.activity ?? {})) {
      const missing = n - (counted.activity[day] ?? 0);
      if (missing > 0) activity[day] = (activity[day] ?? 0) + missing;
    }
    counters[deviceId] = { xp: own.xp + Math.max(0, d.xp - counted.xp), activity };
  }
  return { ...d, deviceId, counters, ...totals(counters) };
}

/** Der Teil des Zustands, der zwischen Geräten synchronisiert wird. */
export function syncSnapshot(s: Data): SyncData<ExamRecord> {
  return {
    deviceId: s.deviceId,
    counters: s.counters,
    xp: s.xp,
    activity: s.activity,
    items: s.items,
    cards: s.cards,
    streak: s.streak,
    dailyGoal: s.dailyGoal,
    dailyGoalAt: s.dailyGoalAt,
    bestCombo: s.bestCombo,
    achievements: s.achievements,
    exams: s.exams,
    blitzBest: s.blitzBest,
    marks: s.marks,
  };
}

export { mergeSync };

export type MarkKind = "q" | "c";

export function markKey(kind: MarkKind, subjectId: string, id: string): string {
  return `${kind}:${itemKey(subjectId, id)}`;
}

/** ids der markierten Fragen bzw. Karten eines Fachs */
export function markedIds(marks: Record<string, Mark>, kind: MarkKind, subjectId: string): Set<string> {
  const prefix = `${kind}:${itemKey(subjectId, "")}`;
  const out = new Set<string>();
  for (const [k, m] of Object.entries(marks)) if (m.on && k.startsWith(prefix)) out.add(k.slice(prefix.length));
  return out;
}

export function examScore(e: Pick<ExamRecord, "questionIds" | "results" | "partial">) {
  const total = e.questionIds.length || 1;
  const correct = e.questionIds.filter((id) => e.results[id]).length;
  const partial = e.questionIds.reduce((s, id) => s + (e.partial[id] ?? (e.results[id] ? 1 : 0)), 0);
  return { correct, total, score: correct / total, partialScore: partial / total };
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      /** Gemeinsamer Abschluss jeder Aktivität: XP, Streak, Tagesziel, Achievements. */
      function commit(patch: Partial<Data>, xp: number, activity: number): AnswerEvent {
        const now = Date.now();
        const before = withDevice(get());
        const today = dayKey(now);
        const prevToday = before.activity[today] ?? 0;
        const own = before.counters[before.deviceId] ?? { xp: 0, activity: {} };
        const counters = {
          ...before.counters,
          [before.deviceId]: {
            xp: own.xp + xp,
            activity: activity > 0 ? { ...own.activity, [today]: (own.activity[today] ?? 0) + activity } : own.activity,
          },
        };
        const next: Data = {
          ...before,
          ...patch,
          counters,
          ...totals(counters),
          streak: activity > 0 ? nextStreak(before.streak, now) : before.streak,
        };
        const newIds = unlocked(next, now);
        const achievements = { ...next.achievements };
        for (const id of newIds) achievements[id] = now;
        set({
          ...patch,
          deviceId: next.deviceId,
          counters,
          xp: next.xp,
          streak: next.streak,
          activity: next.activity,
          achievements,
        });

        const levelBefore = levelInfo(before.xp).level;
        const levelAfter = levelInfo(next.xp).level;
        return {
          xp,
          levelUp: levelAfter > levelBefore ? levelAfter : null,
          achievements: ACHIEVEMENTS.filter((a) => newIds.includes(a.id)),
          goalReached: prevToday < before.dailyGoal && prevToday + activity >= before.dailyGoal,
        };
      }

      return {
        ...initial,

        answer({ subjectId, itemId, correct, xp, combo = 0, srs = true }) {
          const s = get();
          const key = itemKey(subjectId, itemId);
          const patch: Partial<Data> = { bestCombo: Math.max(s.bestCombo, combo) };
          if (srs) patch.items = { ...s.items, [key]: review(s.items[key], correct, Date.now()) };
          return commit(patch, xp, 1);
        },

        reviewCard({ subjectId, cardId, known, xp }) {
          const s = get();
          const key = itemKey(subjectId, cardId);
          return commit({ cards: { ...s.cards, [key]: review(s.cards[key], known, Date.now()) } }, xp, 1);
        },

        bonusXp(xp) {
          return commit({}, xp, 0);
        },

        startExam(exam) {
          set({ activeExam: exam });
        },
        updateExam(patch) {
          const a = get().activeExam;
          if (a) set({ activeExam: { ...a, ...patch } });
        },
        setExamAnswer(questionId, answer) {
          const a = get().activeExam;
          if (a) set({ activeExam: { ...a, answers: { ...a.answers, [questionId]: answer } } });
        },
        finishExam(record) {
          set({ exams: [...get().exams, record], activeExam: null });
        },
        updateExamRecord(id, patch) {
          set({ exams: get().exams.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
        },
        discardExam() {
          set({ activeExam: null });
        },

        setBlitzBest(subjectId, score) {
          const prev = get().blitzBest[subjectId] ?? 0;
          if (score > prev) set({ blitzBest: { ...get().blitzBest, [subjectId]: score } });
        },

        setDailyGoal(goal) {
          set({ dailyGoal: Math.max(5, Math.min(200, Math.round(goal))), dailyGoalAt: Date.now() });
        },

        toggleMark(key) {
          const marks = get().marks;
          set({ marks: { ...marks, [key]: { on: !marks[key]?.on, at: Date.now() } } });
        },

        importData(data) {
          if (!data || typeof data !== "object") return false;
          const d = (data as { state?: unknown }).state ?? data;
          if (!d || typeof d !== "object" || !("items" in d) || !("xp" in d)) return false;
          const { deviceId } = withDevice(get());
          set(withDevice({ ...initial, ...(d as Partial<Data>), deviceId, activeExam: null }));
          return true;
        },

        applySync(data) {
          set({ ...data, deviceId: get().deviceId || data.deviceId });
        },

        reset() {
          set({ ...initial });
        },
      };
    },
    {
      name: "lernwerk-v1",
      version: 2,
      // v1 → v2: Gerätezähler für die Synchronisation anlegen
      migrate: (persisted) => withDevice({ ...initial, ...(persisted as Partial<Data>) }) as AppState,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => {
        const data: Partial<AppState> = { ...s };
        for (const k of Object.keys(data) as (keyof AppState)[]) {
          if (typeof data[k] === "function") delete data[k];
        }
        return data as Data;
      },
    },
  ),
);

export function exportData(): string {
  const s = useApp.getState();
  const data = Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== "function"));
  return JSON.stringify({ app: "lernwerk", exportedAt: new Date().toISOString(), state: data }, null, 2);
}

const subscribeHydration = (cb: () => void) => useApp.persist.onFinishHydration(cb);

/** true, sobald der Fortschritt aus localStorage geladen ist (auf dem Server immer false). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeHydration,
    () => useApp.persist.hasHydrated(),
    () => false,
  );
}

/** Bester Kapiteltest-Score je Kapitel eines Fachs. */
export function chapterBests(exams: ExamRecord[], subjectId: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of exams) {
    if (e.subjectId !== subjectId || !e.lecture) continue;
    out[e.lecture] = Math.max(out[e.lecture] ?? 0, examScore(e).score);
  }
  return out;
}
