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

/** Richtig für Lernstand und Kapiteltest: Rechenaufgaben nur mit allen Ergebnissen, sonst ab SHORT_PASS. */
export function shortPassed(g: { score: number; source: string }): boolean {
  return g.source === "auto" ? g.score === 100 : g.score >= SHORT_PASS;
}

/**
 * Zusatzgewicht je Fragetyp, sobald es im Fach Übungsfragen dieses Typs gibt – auch wenn er in der Prüfung
 * nicht vorkommt. Multiple Choice zählt am meisten, damit sich das Üben damit deutlich im Stand zeigt.
 */
export const PRACTICE_BOOST: Record<QuestionType, number> = { mc: 1, short: 0.25, tf: 0.25 };

/** Ab diesem Durchschnitt (Sicherheit) gelten die Übungsfragen als voll – nicht jede Frage muss perfekt sitzen. */
export const PRACTICE_FULL = 0.8;

/**
 * Stand aus den Übungsfragen (0–1): Sicherheit je Fragetyp, gewichtet mit dem Prüfungsformat plus PRACTICE_BOOST
 * für jeden geübten Typ; ab PRACTICE_FULL zählt es als 100 %.
 */
export function practiceReadiness(
  format: Pick<ExamFormat, QuestionType>,
  masteryByType: Partial<Record<QuestionType, number>>,
  available: Partial<Record<QuestionType, number>>,
): number {
  const types: QuestionType[] = ["short", "mc", "tf"];
  const formatTotal = types.reduce((s, t) => s + format[t], 0);
  const weight = (t: QuestionType) =>
    (formatTotal ? format[t] / formatTotal : 0) + ((available[t] ?? 0) > 0 ? PRACTICE_BOOST[t] : 0);
  const total = types.reduce((s, t) => s + weight(t), 0);
  if (!total) return 0;
  const raw = types.reduce((s, t) => s + weight(t) * (masteryByType[t] ?? 0), 0) / total;
  return Math.min(1, raw / PRACTICE_FULL);
}

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

/** Neue Auswahl nach Klick auf eine Option – bei Single Choice ersetzt sie die bisherige. */
export function toggleOption(q: MCQuestion, selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  return q.single ? [id] : [...selected, id];
}
