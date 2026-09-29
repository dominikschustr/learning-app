"use client";

import type { ShortQuestion } from "./schema";
import type { ShortGrade } from "./store";

/** Fragt /api/grade an. null = KI nicht verfügbar → Selbstbewertung. */
export async function gradeShortAnswer(q: ShortQuestion, answer: string): Promise<ShortGrade | null> {
  try {
    const res = await fetch("/api/grade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        verb: q.verb,
        prompt: q.prompt,
        modelAnswer: q.modelAnswer,
        keyPoints: q.keyPoints,
        answer,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.fallback || typeof data.score !== "number") return null;
    return { score: data.score, hit: data.hit, missed: data.missed, feedback: data.feedback, source: "ai" };
  } catch {
    return null;
  }
}

export function selfGrade(q: ShortQuestion, hit: string[]): ShortGrade {
  return {
    score: Math.round((hit.length / q.keyPoints.length) * 100),
    hit,
    missed: q.keyPoints.filter((k) => !hit.includes(k)),
    feedback: "Selbstbewertung anhand der Kernpunkte.",
    source: "self",
  };
}
