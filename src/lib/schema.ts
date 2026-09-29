import { z } from "zod";

const id = z.string().min(1).regex(/^[a-z0-9-]+$/, "nur a-z, 0-9 und -");

export const LectureSchema = z.object({ id, title: z.string().min(1) });

export const ExamFormatSchema = z.object({
  name: z.string().min(1),
  minutes: z.number().int().positive(),
  short: z.number().int().min(0),
  mc: z.number().int().min(0),
  tf: z.number().int().min(0),
});

export const SubjectSchema = z.object({
  id,
  name: z.string().min(1),
  short: z.string().min(1).max(4),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  description: z.string().default(""),
  demo: z.boolean().default(false),
  lectures: z.array(LectureSchema).min(1),
  examFormat: ExamFormatSchema,
});

const base = { id, lecture: id };

export const MCQuestionSchema = z.object({
  ...base,
  type: z.literal("mc"),
  difficulty: z.number().int().min(1).max(3).default(2),
  prompt: z.string().min(1),
  options: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) })).min(2),
  correct: z.array(z.string()).min(1),
  explanation: z.string().default(""),
  shuffle: z.boolean().default(true),
});

export const TFQuestionSchema = z.object({
  ...base,
  type: z.literal("tf"),
  difficulty: z.number().int().min(1).max(3).default(1),
  statement: z.string().min(1),
  answer: z.boolean(),
  explanation: z.string().default(""),
});

export const ShortQuestionSchema = z.object({
  ...base,
  type: z.literal("short"),
  difficulty: z.number().int().min(1).max(3).default(2),
  verb: z.enum(["define", "state", "explain"]),
  prompt: z.string().min(1),
  modelAnswer: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).min(1),
});

export const QuestionSchema = z.discriminatedUnion("type", [
  MCQuestionSchema,
  TFQuestionSchema,
  ShortQuestionSchema,
]);

export const CardSchema = z.object({ ...base, front: z.string().min(1), back: z.string().min(1) });

export type Lecture = z.infer<typeof LectureSchema>;
export type ExamFormat = z.infer<typeof ExamFormatSchema>;
export type Subject = z.infer<typeof SubjectSchema>;
export type MCQuestion = z.infer<typeof MCQuestionSchema>;
export type TFQuestion = z.infer<typeof TFQuestionSchema>;
export type ShortQuestion = z.infer<typeof ShortQuestionSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type QuestionType = Question["type"];
export type Card = z.infer<typeof CardSchema>;

export type SubjectContent = {
  subject: Subject;
  questions: Question[];
  cards: Card[];
};

/** Leichte Übersicht für Dashboard/Readiness, ohne Fragetexte. */
export type SubjectSummary = {
  subject: Subject;
  items: { id: string; type: QuestionType; lecture: string }[];
  cards: { id: string; lecture: string }[];
};

/** Prüft Querverweise, die zod allein nicht sieht. Gibt Fehlermeldungen zurück. */
export function checkContent({ subject, questions, cards }: SubjectContent): string[] {
  const errors: string[] = [];
  const lectures = new Set(subject.lectures.map((l) => l.id));
  const seen = new Set<string>();

  for (const item of [...questions, ...cards]) {
    if (seen.has(item.id)) errors.push(`doppelte id "${item.id}"`);
    seen.add(item.id);
    if (!lectures.has(item.lecture)) errors.push(`${item.id}: unbekannte Vorlesung "${item.lecture}"`);
  }

  for (const q of questions) {
    if (q.type !== "mc") continue;
    const optionIds = new Set(q.options.map((o) => o.id));
    if (optionIds.size !== q.options.length) errors.push(`${q.id}: doppelte Options-ids`);
    for (const c of q.correct) {
      if (!optionIds.has(c)) errors.push(`${q.id}: correct enthält unbekannte Option "${c}"`);
    }
  }

  const count = (t: QuestionType) => questions.filter((q) => q.type === t).length;
  const f = subject.examFormat;
  if (count("short") < f.short || count("mc") < f.mc || count("tf") < f.tf) {
    errors.push(
      `zu wenige Fragen für die Simulation (braucht ${f.short} short / ${f.mc} mc / ${f.tf} tf, ` +
        `hat ${count("short")} / ${count("mc")} / ${count("tf")})`,
    );
  }
  return errors;
}
