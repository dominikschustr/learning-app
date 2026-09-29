import type { ExamFormat, MCQuestion, QuestionType } from "./schema";

export type OptionVerdict = "hit" | "wrong" | "missed" | "neutral";

export type MCResult = {
  correct: boolean;
  /** Anteil der Optionen, die richtig beurteilt wurden (angekreuzt ⇔ korrekt). */
  partial: number;
  verdicts: Record<string, OptionVerdict>;
};

/** MC gilt nur bei exakt richtiger Auswahl als richtig; Teilpunkte nur zur Info. */
export function gradeMC(q: Pick<MCQuestion, "options" | "correct">, selected: string[]): MCResult {
  const correctSet = new Set(q.correct);
  const selectedSet = new Set(selected);
  const verdicts: Record<string, OptionVerdict> = {};
  let judgedRight = 0;

  for (const { id } of q.options) {
    const isCorrect = correctSet.has(id);
    const isSelected = selectedSet.has(id);
    if (isCorrect === isSelected) judgedRight++;
    verdicts[id] = isCorrect ? (isSelected ? "hit" : "missed") : isSelected ? "wrong" : "neutral";
  }

  return {
    correct: judgedRight === q.options.length,
    partial: q.options.length ? judgedRight / q.options.length : 0,
    verdicts,
  };
}

export function gradeTF(answer: boolean, given: boolean | null): boolean {
  return given === answer;
}

/** Ab diesem Score (0–100) gilt eine Kurzantwort als richtig. */
export const SHORT_PASS = 60;

/** Prognostizierter Prüfungs-Score: Mastery je Fragetyp, gewichtet mit dem Prüfungsformat. */
export function examReadiness(
  format: Pick<ExamFormat, QuestionType>,
  masteryByType: Partial<Record<QuestionType, number>>,
): number {
  const types: QuestionType[] = ["short", "mc", "tf"];
  const total = types.reduce((s, t) => s + format[t], 0);
  if (!total) return 0;
  return types.reduce((s, t) => s + format[t] * (masteryByType[t] ?? 0), 0) / total;
}
