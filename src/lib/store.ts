"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ACHIEVEMENTS, levelInfo, type AchievementDef } from "./gamification";
import { review, type ItemState } from "./srs";
import { addDays, dayKey, itemKey } from "./utils";

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
  importData(data: unknown): boolean;
  reset(): void;
};

export type AppState = Data & Actions;

const initial: Data = {
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

function unlocked(d: Data, now: number): string[] {
  const totalAnswers = Object.values(d.activity).reduce((a, b) => a + b, 0);
  const cardsKnown = Object.values(d.cards).reduce((a, c) => a + c.correct, 0);
  const mastered = Object.values(d.items).filter((i) => i.box >= 4).length;
  const checks: Record<string, boolean> = {
    "first-answer": totalAnswers > 0,
    "combo-5": d.bestCombo >= 5,
    "combo-10": d.bestCombo >= 10,
    "daily-goal": (d.activity[dayKey(now)] ?? 0) >= d.dailyGoal,
    "streak-3": d.streak.best >= 3,
    "streak-7": d.streak.best >= 7,
    "cards-50": cardsKnown >= 50,
    "mastered-25": mastered >= 25,
    "exam-1": d.exams.length > 0,
    "exam-80": d.exams.some((e) => examScore(e).score >= 0.8),
    "blitz-15": Object.values(d.blitzBest).some((b) => b >= 15),
    "level-5": levelInfo(d.xp).level >= 5,
  };
  return Object.keys(checks).filter((id) => checks[id] && !d.achievements[id]);
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
        const before = get();
        const today = dayKey(now);
        const prevToday = before.activity[today] ?? 0;
        const next: Data = {
          ...before,
          ...patch,
          xp: before.xp + xp,
          streak: activity > 0 ? nextStreak(before.streak, now) : before.streak,
          activity: activity > 0 ? { ...before.activity, [today]: prevToday + activity } : before.activity,
        };
        const newIds = unlocked(next, now);
        const achievements = { ...next.achievements };
        for (const id of newIds) achievements[id] = now;
        set({ ...patch, xp: next.xp, streak: next.streak, activity: next.activity, achievements });

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
          set({ dailyGoal: Math.max(5, Math.min(200, Math.round(goal))) });
        },

        importData(data) {
          if (!data || typeof data !== "object") return false;
          const d = (data as { state?: unknown }).state ?? data;
          if (!d || typeof d !== "object" || !("items" in d) || !("xp" in d)) return false;
          set({ ...initial, ...(d as Partial<Data>) });
          return true;
        },

        reset() {
          set({ ...initial });
        },
      };
    },
    {
      name: "lernwerk-v1",
      version: 1,
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
