import { optionOrder } from "./queue";
import type { ExamFormat, Question, QuestionType } from "./schema";
import { gradeMC, gradeTF } from "./scoring";
import type { ActiveExam, ExamAnswer, ExamRecord } from "./store";
import { shuffle } from "./utils";

/** Zieht n Fragen eines Typs, möglichst gleichmäßig über die Vorlesungen verteilt. */
function pickSpread(questions: Question[], n: number): Question[] {
  const byLecture = new Map<string, Question[]>();
  for (const q of shuffle(questions)) {
    byLecture.set(q.lecture, [...(byLecture.get(q.lecture) ?? []), q]);
  }
  const buckets = shuffle([...byLecture.values()]);
  const out: Question[] = [];
  while (out.length < n && buckets.some((b) => b.length)) {
    for (const b of buckets) {
      const q = b.shift();
      if (q && out.length < n) out.push(q);
    }
  }
  return out;
}

export function createExam(subjectId: string, format: ExamFormat, questions: Question[], now: number): ActiveExam {
  const of = (t: QuestionType) => questions.filter((q) => q.type === t);
  const picked = [
    ...pickSpread(of("short"), format.short),
    ...pickSpread(of("mc"), format.mc),
    ...pickSpread(of("tf"), format.tf),
  ];
  return {
    subjectId,
    questionIds: picked.map((q) => q.id),
    optionOrder: Object.fromEntries(picked.map((q) => [q.id, optionOrder(q)])),
    answers: {},
    flagged: [],
    current: 0,
    startedAt: now,
    minutes: format.minutes,
  };
}

export function isAnswered(a: ExamAnswer | undefined): boolean {
  if (!a) return false;
  if (a.kind === "mc") return a.selected.length > 0;
  if (a.kind === "tf") return a.value !== null;
  return a.text.trim().length > 0;
}

/** Wertet MC/TF sofort aus; Kurzantworten bleiben offen (null), bis sie bewertet sind. */
export function gradeExam(exam: ActiveExam, byId: Map<string, Question>, now: number): ExamRecord {
  const results: ExamRecord["results"] = {};
  const partial: ExamRecord["partial"] = {};

  for (const id of exam.questionIds) {
    const q = byId.get(id);
    const a = exam.answers[id];
    if (!q) continue;
    if (q.type === "mc") {
      const r = gradeMC(q, a?.kind === "mc" ? a.selected : []);
      results[id] = r.correct;
      partial[id] = a?.kind === "mc" && a.selected.length ? r.partial : 0;
    } else if (q.type === "tf") {
      results[id] = gradeTF(q.answer, a?.kind === "tf" ? a.value : null);
    } else {
      results[id] = isAnswered(a) ? null : false;
      if (!isAnswered(a)) partial[id] = 0;
    }
  }

  return {
    id: `exam-${now}`,
    subjectId: exam.subjectId,
    finishedAt: now,
    durationSec: Math.min(exam.minutes * 60, Math.round((now - exam.startedAt) / 1000)),
    questionIds: exam.questionIds,
    optionOrder: exam.optionOrder,
    answers: exam.answers,
    results,
    partial,
    shortGrades: {},
  };
}
