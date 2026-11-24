import { describe, expect, it } from "vitest";
import { PAPER_WEIGHT, subjectStats } from "@/lib/progress";
import type { SubjectSummary } from "@/lib/schema";
import { review } from "@/lib/srs";
import { itemKey } from "@/lib/utils";

const summary = (papers: SubjectSummary["papers"]): SubjectSummary => ({
  subject: {
    id: "s",
    name: "S",
    short: "S",
    color: "#000000",
    description: "",
    demo: false,
    draft: false,
    look: "default",
    lectures: [{ id: "a", title: "A" }],
    examFormat: { name: "Exam", minutes: 60, short: 0, mc: 0, tf: 2, order: ["short", "mc", "tf"] },
  },
  items: ["q1", "q2"].map((id) => ({ id, type: "tf", lecture: "a", calc: false, checkup: false, mcSet: false, quiz: false })),
  cards: [],
  texts: [],
  frameworks: [],
  formulas: [],
  papers,
  paperItems: [],
});

const paper = (id: string, questions: string[]) => ({ id, title: id, points: 10, kind: "altklausur" as const, minutes: 60, questions });

describe("subjectStats – Gesamtstand mit Probeklausuren", () => {
  it("ohne Probeklausuren zählt nur die Prognose aus den Übungsfragen", () => {
    const st = subjectStats(summary([]), {}, {}, 0);
    expect(st.paperWeight).toBe(0);
    expect(st.readiness).toBe(st.questionReadiness);
  });

  it("rechnet bearbeitete Klausuraufgaben anteilig ein – ganze Klausur oder einzelne Aufgaben", () => {
    const sum = summary([paper("p1", ["x1", "x2"]), paper("p2", ["x3", "x4"])]);
    const done = review(undefined, true, 0);
    const items = { [itemKey("s", "x1")]: done, [itemKey("s", "x2")]: done, [itemKey("s", "x3")]: done };
    const st = subjectStats(sum, items, {}, 0);
    expect(st.papers).toEqual([
      { id: "p1", progress: 1 },
      { id: "p2", progress: 0.5 },
    ]);
    expect(st.papersDone).toBe(1);
    expect(st.paperProgress).toBe(0.75);
    expect(st.questionReadiness).toBe(0);
    expect(st.readiness).toBeCloseTo(PAPER_WEIGHT * 0.75);
  });
});

import { PRACTICE_FULL, practiceReadiness } from "@/lib/scoring";
import { mastery } from "@/lib/srs";

describe("Readiness – schneller Fortschritt", () => {
  it("schon die erste richtige Antwort bringt 70 % Sicherheit", () => {
    expect(mastery(review(undefined, true, 0))).toBe(0.7);
    expect(mastery(review(undefined, false, 0))).toBe(0.2);
  });

  it("Multiple Choice zählt auch, wenn die Prüfung nur Kurzantworten hat", () => {
    const shortOnly = { short: 4, mc: 0, tf: 0 };
    const mcDone = practiceReadiness(shortOnly, { short: 0, mc: 1 }, { short: 60, mc: 210 });
    expect(mcDone).toBeGreaterThan(0.45); // vorher 0
    // ohne MC-Fragen im Fach zählt nur der Prüfungstyp
    expect(practiceReadiness(shortOnly, { short: 0.5 }, { short: 60 })).toBeCloseTo(0.5 / PRACTICE_FULL);
  });

  it("ab 80 % Sicherheit im Schnitt zählen die Übungsfragen voll", () => {
    expect(practiceReadiness({ short: 1, mc: 1, tf: 0 }, { short: 0.8, mc: 0.8 }, { short: 5, mc: 5 })).toBe(1);
  });

  it("Altklausuren zählen im Klausurfortschritt doppelt", () => {
    const alt = paper("alt", ["a1"]);
    const neu = { ...paper("neu", ["n1"]), kind: "neu" as const };
    const done = review(undefined, true, 0);
    const onlyAlt = subjectStats(summary([alt, neu]), { [itemKey("s", "a1")]: done }, {}, 0);
    const onlyNeu = subjectStats(summary([alt, neu]), { [itemKey("s", "n1")]: done }, {}, 0);
    expect(onlyAlt.paperProgress).toBeCloseTo(2 / 3);
    expect(onlyNeu.paperProgress).toBeCloseTo(1 / 3);
    expect(onlyAlt.readiness).toBeCloseTo(PAPER_WEIGHT * (2 / 3));
  });
});
