import type { QuestionType, SubjectSummary } from "./schema";
import { examReadiness } from "./scoring";
import { isDue, mastery, type ItemState } from "./srs";
import { itemKey } from "./utils";

export type SubjectStats = {
  readiness: number;
  coverage: number;
  seen: number;
  total: number;
  due: number;
  cardsDue: number;
  cardsNew: number;
  masteryByType: Record<QuestionType, number>;
  lectures: { id: string; title: string; mastery: number; seen: number; total: number }[];
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function subjectStats(
  summary: SubjectSummary,
  items: Record<string, ItemState>,
  cards: Record<string, ItemState>,
  now: number,
): SubjectStats {
  const { subject } = summary;
  const state = (id: string) => items[itemKey(subject.id, id)];

  const masteryByType = {} as Record<QuestionType, number>;
  for (const t of ["short", "mc", "tf"] as QuestionType[]) {
    masteryByType[t] = avg(summary.items.filter((i) => i.type === t).map((i) => mastery(state(i.id))));
  }

  const seen = summary.items.filter((i) => state(i.id)).length;
  const cardStates = summary.cardIds.map((id) => cards[itemKey(subject.id, id)]);

  return {
    readiness: examReadiness(subject.examFormat, masteryByType),
    coverage: summary.items.length ? seen / summary.items.length : 0,
    seen,
    total: summary.items.length,
    due: summary.items.filter((i) => isDue(state(i.id), now)).length,
    cardsDue: cardStates.filter((c) => isDue(c, now)).length,
    cardsNew: cardStates.filter((c) => !c).length,
    masteryByType,
    lectures: subject.lectures.map((l) => {
      const ls = summary.items.filter((i) => i.lecture === l.id);
      return {
        id: l.id,
        title: l.title,
        mastery: avg(ls.map((i) => mastery(state(i.id)))),
        seen: ls.filter((i) => state(i.id)).length,
        total: ls.length,
      };
    }),
  };
}
