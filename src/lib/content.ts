import "server-only";
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { z } from "zod";
import {
  CalendarEntrySchema,
  CardSchema,
  CaseSchema,
  FormulaSchema,
  FrameworkSchema,
  PaperSchema,
  QuestionSchema,
  SubjectSchema,
  TextSchema,
  checkContent,
  paperItems,
  type CalendarEntry,
  type Formula,
  type Framework,
  type LectureText,
  type Question,
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
    cases: readDir(path.join(ROOT, dir, "cases"), CaseSchema),
    papers: readDir(path.join(ROOT, dir, "exams"), PaperSchema),
  };
  const errors = checkContent(content);
  if (errors.length) throw new Error(`Content "${dir}":\n- ${errors.join("\n- ")}`);
  return content;
}

/** Alle Fächer inklusive Entwürfe (für die Prüfung der Inhalte). */
export const loadAllContent = cache((): SubjectContent[] =>
  fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(ROOT, d.name, "subject.json")))
    .map((d) => {
      const content = loadSubject(d.name);
      if (content.subject.id !== d.name) {
        throw new Error(`Content: Ordner "${d.name}" passt nicht zur id "${content.subject.id}" in subject.json`);
      }
      return content;
    }),
);

/** Fächer, die in der App erscheinen (ohne Entwürfe). */
export const getAllContent = cache((): SubjectContent[] => loadAllContent().filter((c) => !c.subject.draft));

export function getSubjectContent(id: string): SubjectContent | undefined {
  return getAllContent().find((c) => c.subject.id === id);
}

/** Lesetexte der Kapitel: texts/<kapitel>.json, je Datei ein Dokument. */
export const getTexts = cache((subjectId: string): LectureText[] => {
  const dir = path.join(ROOT, subjectId, "texts");
  if (!fs.existsSync(dir)) return [];
  const lectures = new Set(loadAllContent().find((c) => c.subject.id === subjectId)?.subject.lectures.map((l) => l.id));
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const file = path.join(dir, f);
      const result = TextSchema.safeParse(readJson(file));
      if (!result.success) {
        throw new Error(`Content: ${path.relative(process.cwd(), file)}\n${z.prettifyError(result.error)}`);
      }
      if (!lectures.has(result.data.lecture)) {
        throw new Error(`Content: ${path.relative(process.cwd(), file)} – unbekanntes Kapitel "${result.data.lecture}"`);
      }
      return result.data;
    });
});

export function getText(subjectId: string, lecture: string): LectureText | undefined {
  return getTexts(subjectId).find((t) => t.lecture === lecture);
}

/** Framework-Steckbriefe: frameworks/<kapitel>.json, in Kapitelreihenfolge. */
export const getFrameworks = cache((subjectId: string): Framework[] => {
  const subject = loadAllContent().find((c) => c.subject.id === subjectId)?.subject;
  const order = new Map(subject?.lectures.map((l, i) => [l.id, i]));
  const list = readDir(path.join(ROOT, subjectId, "frameworks"), FrameworkSchema);
  for (const f of list) {
    if (!order.has(f.lecture)) throw new Error(`Content "${subjectId}": Framework ${f.id} – unbekanntes Kapitel "${f.lecture}"`);
  }
  if (new Set(list.map((f) => f.id)).size !== list.length) throw new Error(`Content "${subjectId}": doppelte Framework-ids`);
  return list.toSorted((a, b) => order.get(a.lecture)! - order.get(b.lecture)!);
});

/** Formelübersicht: formulas/<kapitel>.json, in Kapitelreihenfolge. */
export const getFormulas = cache((subjectId: string): Formula[] => {
  const subject = loadAllContent().find((c) => c.subject.id === subjectId)?.subject;
  const order = new Map(subject?.lectures.map((l, i) => [l.id, i]));
  const list = readDir(path.join(ROOT, subjectId, "formulas"), FormulaSchema);
  for (const f of list) {
    if (!order.has(f.lecture)) throw new Error(`Content "${subjectId}": Formel ${f.id} – unbekanntes Kapitel "${f.lecture}"`);
  }
  if (new Set(list.map((f) => f.id)).size !== list.length) throw new Error(`Content "${subjectId}": doppelte Formel-ids`);
  return list.toSorted((a, b) => order.get(a.lecture)! - order.get(b.lecture)!);
});

/**
 * Karteikarten, die eine Formel abfragen: Karte „c-<name>“ gehört zur Formel „f-<name>“.
 * Solche Karten zeigen auf der Rückseite die gesetzte Formel samt Symbolen statt des Klartexts.
 */
export const getCardFormulas = cache((subjectId: string): Record<string, Formula> => {
  const byId = new Map(getFormulas(subjectId).map((f) => [f.id, f]));
  const cards = loadAllContent().find((c) => c.subject.id === subjectId)?.cards ?? [];
  const out: Record<string, Formula> = {};
  for (const c of cards) {
    const f = c.id.startsWith("c-") ? byId.get(`f-${c.id.slice(2)}`) : undefined;
    if (f) out[c.id] = f;
  }
  return out;
});

/** Weitere Prüfungen ohne eigenes Fach (content/calendar.json, optional) – nur für den Lernplan. */
export const getCalendar = cache((): CalendarEntry[] => {
  const file = path.join(process.cwd(), "content", "calendar.json");
  if (!fs.existsSync(file)) return [];
  const result = z.array(CalendarEntrySchema).safeParse(readJson(file));
  if (!result.success) throw new Error(`Content: content/calendar.json\n${z.prettifyError(result.error)}`);
  return result.data;
});

/** Fragen zum Üben, für Kapiteltests und den zufälligen Abschlusstest: ohne die nur für Probeklausuren. */
export function practiceContent(content: SubjectContent): SubjectContent {
  return { ...content, questions: content.questions.filter((q) => !q.paperOnly) };
}

const TYPE_ORDER = { short: 0, mc: 1, tf: 2 } as const;

/**
 * Alle Fragen der Probeklausuren, je einmal (auch paperOnly): erst die Rechen-/Kurzantwortaufgaben, dann Multiple
 * Choice und True/False, jeweils in der Reihenfolge der Klausuren. Grundlage für „Klausuraufgaben“ je Kapitel.
 */
export function paperQuestions({ questions, papers }: SubjectContent): Question[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const ids = [...new Set(papers.flatMap((p) => paperItems(p).map((i) => i.q)))];
  return ids
    .map((id) => byId.get(id))
    .filter((q): q is Question => q !== undefined)
    .map((q, i) => ({ q, i }))
    .sort((a, b) => TYPE_ORDER[a.q.type] - TYPE_ORDER[b.q.type] || a.i - b.i)
    .map(({ q }) => q);
}

export function getSummaries(): SubjectSummary[] {
  return getAllContent().map((content) => ({
    ...summaryOf(content),
    paperItems: paperQuestions(content).map((q) => ({ id: q.id, lecture: q.lecture })),
  }));
}

function summaryOf({ subject, questions, cards, papers }: SubjectContent): Omit<SubjectSummary, "paperItems"> {
  return {
    subject,
    items: questions
      .filter((q) => !q.paperOnly)
      .map((q) => ({
        id: q.id,
        type: q.type,
        lecture: q.lecture,
        calc: q.type === "short" && q.results.length > 0,
        checkup: q.checkup,
        mcSet: q.mcSet,
      })),
    cards: cards.map((c) => ({ id: c.id, lecture: c.lecture })),
    texts: getTexts(subject.id).map((t) => t.lecture),
    frameworks: [...new Set(getFrameworks(subject.id).map((f) => f.lecture))],
    formulas: [...new Set(getFormulas(subject.id).map((f) => f.lecture))],
    papers: papers.map((p) => ({
      id: p.id,
      title: p.title,
      points: paperItems(p).reduce((s, i) => s + i.points, 0),
      kind: p.origin.kind,
    })),
  };
}
