import "server-only";
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { z } from "zod";
import {
  CardSchema,
  QuestionSchema,
  SubjectSchema,
  checkContent,
  type SubjectContent,
  type SubjectSummary,
} from "./schema";

const ROOT = path.join(process.cwd(), "content", "subjects");

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`Content: ${path.relative(process.cwd(), file)} ist kein gültiges JSON – ${(e as Error).message}`);
  }
}

function readDir<T>(dir: string, schema: z.ZodType<T>): T[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .flatMap((f) => {
      const file = path.join(dir, f);
      const result = z.array(schema).safeParse(readJson(file));
      if (!result.success) {
        throw new Error(`Content: ${path.relative(process.cwd(), file)}\n${z.prettifyError(result.error)}`);
      }
      return result.data;
    });
}

function loadSubject(dir: string): SubjectContent {
  const subjectFile = path.join(ROOT, dir, "subject.json");
  const parsed = SubjectSchema.safeParse(readJson(subjectFile));
  if (!parsed.success) throw new Error(`Content: ${subjectFile}\n${z.prettifyError(parsed.error)}`);

  const content: SubjectContent = {
    subject: parsed.data,
    questions: readDir(path.join(ROOT, dir, "questions"), QuestionSchema),
    cards: readDir(path.join(ROOT, dir, "cards"), CardSchema),
  };
  const errors = checkContent(content);
  if (errors.length) throw new Error(`Content "${dir}":\n- ${errors.join("\n- ")}`);
  return content;
}

export const getAllContent = cache((): SubjectContent[] =>
  fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(ROOT, d.name, "subject.json")))
    .map((d) => loadSubject(d.name)),
);

export function getSubjectContent(id: string): SubjectContent | undefined {
  return getAllContent().find((c) => c.subject.id === id);
}

export function getSummaries(): SubjectSummary[] {
  return getAllContent().map(({ subject, questions, cards }) => ({
    subject,
    items: questions.map((q) => ({ id: q.id, type: q.type, lecture: q.lecture })),
    cards: cards.map((c) => ({ id: c.id, lecture: c.lecture })),
  }));
}
