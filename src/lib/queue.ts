import type { Question } from "./schema";
import { isDue, weakness, type ItemState } from "./srs";
import { itemKey, shuffle } from "./utils";

export type PracticeMode = "smart" | "due" | "weak" | "lecture" | "marked";

export const MODE_TITLE: Record<PracticeMode, string> = {
  smart: "Empfohlene Session",
  due: "Wiederholung",
  weak: "Schwächen-Training",
  lecture: "Vorlesung üben",
  marked: "Markierte Fragen",
};

const SESSION_SIZE = 12;
/** Fragen pro Kapitel-Übung */
export const LECTURE_SIZE = 15;

/** Stellt die Fragen einer Übungssession zusammen. */
export function buildQueue(opts: {
  mode: PracticeMode;
  subjectId: string;
  questions: Question[];
  items: Record<string, ItemState>;
  now: number;
  lecture?: string;
  /** ids der markierten Fragen (für mode "marked") */
  marked?: Set<string>;
}): Question[] {
  const { mode, subjectId, items, now } = opts;
  const st = (q: Question) => items[itemKey(subjectId, q.id)];
  const questions = opts.lecture ? opts.questions.filter((q) => q.lecture === opts.lecture) : opts.questions;

  const due = questions.filter((q) => isDue(st(q), now)).sort((a, b) => weakness(st(b)) - weakness(st(a)));
  const unseen = shuffle(questions.filter((q) => !st(q)));
  const weak = questions
    .filter((q) => st(q) && weakness(st(q)) > 0.25)
    .sort((a, b) => weakness(st(b)) - weakness(st(a)));

  const unique = (qs: Question[]) => [...new Map(qs.map((q) => [q.id, q])).values()];

  switch (mode) {
    case "due":
      return due.slice(0, 30);
    case "marked":
      return shuffle(questions.filter((q) => opts.marked?.has(q.id)));
    case "weak":
      return weak.slice(0, SESSION_SIZE);
    case "lecture": {
      // Vorrang: fällig → neu → unsicher → Rest; neue und übrige Fragen werden zufällig gezogen,
      // daher bekommt jeder Durchgang eine andere Auswahl und der ganze Pool wird nach und nach abgedeckt.
      const rest = shuffle(questions.filter((q) => st(q) && !isDue(st(q), now)));
      return shuffle(unique([...due, ...unseen, ...weak, ...rest]).slice(0, LECTURE_SIZE));
    }
    case "smart": {
      const picked = unique([...due.slice(0, 6), ...unseen.slice(0, SESSION_SIZE), ...weak]).slice(0, SESSION_SIZE);
      if (picked.length < SESSION_SIZE) {
        const others = shuffle(questions.filter((q) => !picked.includes(q)));
        picked.push(...others.slice(0, SESSION_SIZE - picked.length));
      }
      return shuffle(picked);
    }
  }
}

/** Optionsreihenfolge für MC-Fragen (gemischt, außer shuffle: false). */
export function optionOrder(q: Question): string[] {
  if (q.type !== "mc") return [];
  const ids = q.options.map((o) => o.id);
  return q.shuffle ? shuffle(ids) : ids;
}
