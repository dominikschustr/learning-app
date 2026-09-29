"use client";

import { create } from "zustand";
import type { AnswerEvent } from "./store";

export type Toast = {
  id: number;
  kind: "achievement" | "level" | "goal" | "info";
  title: string;
  body?: string;
  icon?: string;
};

type ToastState = {
  toasts: Toast[];
  push(t: Omit<Toast, "id">): void;
  dismiss(id: number): void;
};

let nextId = 1;

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  push(t) {
    const id = nextId++;
    set({ toasts: [...get().toasts, { ...t, id }] });
    setTimeout(() => get().dismiss(id), 4200);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

async function confetti(opts: { particleCount: number; spread: number; origin?: { y: number } }) {
  if (typeof window === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { default: fire } = await import("canvas-confetti");
  fire({ ...opts, colors: ["#2f5bea", "#16865b", "#ee6a22", "#f2c14e", "#b04ae0"], disableForReducedMotion: true });
}

export function celebrate(big = false) {
  void confetti({ particleCount: big ? 160 : 70, spread: big ? 100 : 65, origin: { y: 0.7 } });
}

/** Zeigt Level-Up, Achievements und Tagesziel eines Store-Events an. */
export function announce(e: AnswerEvent) {
  const { push } = useToasts.getState();
  if (e.levelUp) {
    push({ kind: "level", title: `Level ${e.levelUp}!`, body: "Weiter so – du steigst auf.", icon: "trending-up" });
    celebrate(true);
  }
  if (e.goalReached) {
    push({ kind: "goal", title: "Tagesziel erreicht", body: "Alles darüber ist Bonus.", icon: "target" });
    if (!e.levelUp) celebrate();
  }
  for (const a of e.achievements) {
    push({ kind: "achievement", title: a.title, body: a.description, icon: a.icon });
  }
}
