"use client";

import type { Case, ShortQuestion } from "./schema";
import type { ShortGrade } from "./store";

/** Fallbeschreibung als Klartext, damit die Bewertung die Zahlen der Aufgabe kennt. */
function caseText(c: Case): string {
  const tables = c.tables.map((t) =>
    [t.caption ?? "", t.head.join(" | "), ...t.rows.map((r) => r.join(" | "))].filter(Boolean).join("\n"),
  );
  return [`CASE: ${c.title}`, ...c.text, ...tables].join("\n\n");
}

/** Fragt /api/grade an. null = KI nicht verfügbar → Selbstbewertung. */
export async function gradeShortAnswer(q: ShortQuestion, answer: string, context?: Case): Promise<ShortGrade | null> {
  try {
    const res = await fetch("/api/grade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        verb: q.verb,
        prompt: context ? `${caseText(context)}\n\n${q.prompt}` : q.prompt,
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
