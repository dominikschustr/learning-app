import type { Question } from "./schema";
import { isDue, itemStatus, weakness, type ItemState } from "./srs";
import { itemKey, shuffle } from "./utils";

export type PracticeMode = "smart" | "due" | "weak" | "lecture" | "marked" | "new" | "wrong" | "checkup" | "papers";

export const MODE_TITLE: Record<PracticeMode, string> = {
  smart: "Empfohlene Session",
  due: "Wiederholung",
  weak: "Schwächen-Training",
  lecture: "Vorlesung üben",
  marked: "Markierte Fragen",
  new: "Neue Fragen",
  wrong: "Falsche wiederholen",
  checkup: "Check-up-Fragen",
  papers: "Klausuraufgaben",
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
  /** Fragen der Probeklausuren in fester Reihenfolge (für mode "papers") */
  papers?: Question[];
  /** gezielt ausgewählte Klausuraufgaben (mode "papers", aus der Aufgabentabelle) – in dieser Reihenfolge */
  ids?: string[];
  /** mode "papers": zufällige Reihenfolge statt Klausurreihenfolge (Teilaufgaben eines Falls bleiben zusammen) */
  random?: boolean;
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
    case "new":
      return unseen.slice(0, LECTURE_SIZE);
    case "wrong":
      return shuffle(questions.filter((q) => itemStatus(st(q)) === "wrong"));
    case "checkup":
      // Quiz-Aussagen vom Ende der Vorlesungen – immer alle, in zufälliger Reihenfolge
      return shuffle(questions.filter((q) => q.checkup));
    case "papers": {
      if (opts.ids?.length) {
        // in der Aufgabentabelle ausgewählt: genau diese Aufgaben, in der Reihenfolge der Auswahl
        const byId = new Map((opts.papers ?? []).map((q) => [q.id, q]));
        return unique(opts.ids.flatMap((id) => byId.get(id) ?? []));
      }
      // alle Aufgaben der Probeklausuren zu diesem Kapitel, in Klausurreihenfolge (Teilfragen a, b bleiben zusammen)
      const qs = (opts.papers ?? []).filter((q) => !opts.lecture || q.lecture === opts.lecture);
      return opts.random ? groupCases(shuffle(qs), qs) : qs;
    }
    case "marked":
      return shuffle(questions.filter((q) => opts.marked?.has(q.id)));
    case "weak":
      return weak.slice(0, SESSION_SIZE);
    case "lecture": {
      // Vorrang: fällig → neu → unsicher → Rest; neue und übrige Fragen werden zufällig gezogen,
      // daher bekommt jeder Durchgang eine andere Auswahl und der ganze Pool wird nach und nach abgedeckt.
      const rest = shuffle(questions.filter((q) => st(q) && !isDue(st(q), now)));
      // Teilfragen eines Falls wie in der Klausur hintereinander (a, b, c …)
      return groupCases(shuffle(unique([...due, ...unseen, ...weak, ...rest]).slice(0, LECTURE_SIZE)), questions);
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

/**
 * Hält die Fragen eines Falls zusammen: alle gezogenen Teilfragen stehen an der Stelle der ersten,
 * in der Reihenfolge des Fragenpools (wie a), b), c) in der Klausur). Fragen ohne Fall bleiben, wo sie sind.
 */
export function groupCases(qs: Question[], pool: Question[]): Question[] {
  const pos = new Map(pool.map((q, i) => [q.id, i]));
  const byCase = new Map<string, Question[]>();
  for (const q of qs) if (q.case) byCase.set(q.case, [...(byCase.get(q.case) ?? []), q]);
  const out: Question[] = [];
  for (const q of qs) {
    if (!q.case) out.push(q);
    else if (byCase.has(q.case)) {
      out.push(...byCase.get(q.case)!.sort((x, y) => (pos.get(x.id) ?? 0) - (pos.get(y.id) ?? 0)));
      byCase.delete(q.case);
    }
  }
  return out;
}

/** Optionsreihenfolge für MC-Fragen (gemischt, außer shuffle: false). */
export function optionOrder(q: Question): string[] {
  if (q.type !== "mc") return [];
  const ids = q.options.map((o) => o.id);
  return q.shuffle ? shuffle(ids) : ids;
}
