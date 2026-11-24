import type { QuestionType, SubjectSummary } from "./schema";
import { practiceReadiness } from "./scoring";
import { isDue, mastery, type ItemState } from "./srs";
import { itemKey } from "./utils";

export type SubjectStats = {
  /** Gesamtstand des Fachs (0–1): Prognose aus den Übungsfragen, bei Fächern mit Probeklausuren zusammen mit den bearbeiteten Klausuren */
  readiness: number;
  /** Stand allein aus den Übungsfragen (Sicherheit je Fragetyp, Prüfungsformat plus Extra-Gewicht für MC, siehe practiceReadiness) */
  questionReadiness: number;
  /** Probeklausuren: Anteil bearbeiteter Aufgaben je Klausur (0–1) */
  papers: { id: string; progress: number }[];
  /** Anteil der Probeklausuren am Gesamtstand (0, wenn das Fach keine hat) */
  paperWeight: number;
  /** Fortschritt über alle Probeklausuren (0–1); Altklausuren zählen doppelt */
  paperProgress: number;
  /** vollständig bearbeitete Probeklausuren */
  papersDone: number;
  coverage: number;
  seen: number;
  total: number;
  due: number;
  cardsDue: number;
  cardsNew: number;
  masteryByType: Record<QuestionType, number>;
  lectures: ChapterStats[];
};

export type ChapterStats = {
  id: string;
  title: string;
  /** Sicherheit der Fragen (0–1) */
  mastery: number;
  /** Sicherheit der Karteikarten (0–1) */
  cardMastery: number;
  /** kombiniert: 90 % Fragen, 10 % Karten */
  combined: number;
  seen: number;
  total: number;
  cards: number;
  testBest: number;
  level: ChapterLevel;
};

export const LEVEL_NAMES = ["Neu", "Entdeckt", "Grundlagen", "Fortgeschritten", "Sicher", "Gemeistert"] as const;
/** Mindest-Sicherheit je Level; Level 5 braucht zusätzlich einen Kapiteltest ≥ 80 %. */
export const LEVEL_THRESHOLDS = [0, 0.01, 0.3, 0.5, 0.7, 0.85];
export const CHAPTER_TEST_PASS = 0.8;

export type ChapterLevel = {
  level: number;
  name: string;
  /** Fortschritt zum nächsten Level (0–1) */
  progress: number;
  /** Was fehlt fürs nächste Level */
  hint: string;
};

export function chapterLevel(combined: number, testBest: number): ChapterLevel {
  let level = 0;
  for (let l = 1; l < LEVEL_THRESHOLDS.length; l++) {
    const reached = combined >= LEVEL_THRESHOLDS[l] && (l < 5 || testBest >= CHAPTER_TEST_PASS);
    if (reached) level = l;
    else break;
  }
  if (level === 5) return { level, name: LEVEL_NAMES[5], progress: 1, hint: "Kapitel gemeistert." };
  const from = LEVEL_THRESHOLDS[level];
  const to = LEVEL_THRESHOLDS[level + 1];
  const masteryDone = combined >= to;
  const progress = masteryDone ? 0.99 : Math.max(0, Math.min(1, (combined - from) / (to - from)));
  let hint: string;
  if (level === 0) hint = "Beantworte die ersten Fragen, um das Kapitel freizuschalten.";
  else if (level === 4 && masteryDone) hint = "Bestehe den Kapiteltest mit mindestens 80 %.";
  else if (level === 4) hint = `Noch ${Math.ceil((to - combined) * 100)} Punkte Sicherheit – dann Kapiteltest ≥ 80 %.`;
  else hint = `Noch ${Math.ceil((to - combined) * 100)} Punkte Sicherheit bis „${LEVEL_NAMES[level + 1]}“.`;
  return { level, name: LEVEL_NAMES[level], progress, hint };
}

/** Anteil der Probeklausuren (Altklausuren und neue Klausuren) am Gesamtstand eines Fachs */
export const PAPER_WEIGHT = 0.5;
/** Gewicht einer echten Altklausur gegenüber anderen Probeklausuren im Klausurfortschritt */
export const ALTKLAUSUR_WEIGHT = 2;
/** Anteil der Karteikarten an der Sicherheit eines Kapitels – bewusst klein */
export const CARD_WEIGHT = 0.1;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function subjectStats(
  summary: SubjectSummary,
  items: Record<string, ItemState>,
  cards: Record<string, ItemState>,
  now: number,
  chapterTestBest: Record<string, number> = {},
): SubjectStats {
  const { subject } = summary;
  const state = (id: string) => items[itemKey(subject.id, id)];

  const masteryByType = {} as Record<QuestionType, number>;
  for (const t of ["short", "mc", "tf"] as QuestionType[]) {
    masteryByType[t] = avg(summary.items.filter((i) => i.type === t).map((i) => mastery(state(i.id))));
  }

  const seen = summary.items.filter((i) => state(i.id)).length;
  const cardStates = summary.cards.map((c) => cards[itemKey(subject.id, c.id)]);

  const available = {} as Record<QuestionType, number>;
  for (const t of ["short", "mc", "tf"] as QuestionType[]) available[t] = summary.items.filter((i) => i.type === t).length;
  const questionReadiness = practiceReadiness(subject.examFormat, masteryByType, available);
  // Probeklausuren: bearbeitet = Aufgabe beantwortet, egal ob in der ganzen Klausur oder einzeln unter „Klausuraufgaben“
  const papers = summary.papers.map((p) => ({
    id: p.id,
    progress: p.questions.length ? p.questions.filter((id) => state(id)).length / p.questions.length : 0,
  }));
  const paperWeight = papers.length ? PAPER_WEIGHT : 0;
  const pw = (kind: string) => (kind === "altklausur" ? ALTKLAUSUR_WEIGHT : 1);
  const pwTotal = summary.papers.reduce((s, p) => s + pw(p.kind), 0);
  const paperProgress = pwTotal ? summary.papers.reduce((s, p, i) => s + pw(p.kind) * papers[i].progress, 0) / pwTotal : 0;

  return {
    readiness: (1 - paperWeight) * questionReadiness + paperWeight * paperProgress,
    questionReadiness,
    papers,
    paperWeight,
    paperProgress,
    papersDone: papers.filter((p) => p.progress >= 1).length,
    coverage: summary.items.length ? seen / summary.items.length : 0,
    seen,
    total: summary.items.length,
    due: summary.items.filter((i) => isDue(state(i.id), now)).length,
    cardsDue: cardStates.filter((c) => isDue(c, now)).length,
    cardsNew: cardStates.filter((c) => !c).length,
    masteryByType,
    lectures: subject.lectures.map((l) => {
      const ls = summary.items.filter((i) => i.lecture === l.id);
      const cs = summary.cards.filter((c) => c.lecture === l.id);
      const m = avg(ls.map((i) => mastery(state(i.id))));
      const cm = avg(cs.map((c) => mastery(cards[itemKey(subject.id, c.id)])));
      const combined = cs.length ? m * (1 - CARD_WEIGHT) + cm * CARD_WEIGHT : m;
      const testBest = chapterTestBest[l.id] ?? 0;
      return {
        id: l.id,
        title: l.title,
        mastery: m,
        cardMastery: cm,
        combined,
        seen: ls.filter((i) => state(i.id)).length,
        total: ls.length,
        cards: cs.length,
        testBest,
        level: chapterLevel(combined, testBest),
      };
    }),
  };
}
