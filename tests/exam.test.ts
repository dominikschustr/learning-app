import { describe, expect, it } from "vitest";
import { createExam } from "@/lib/exam";
import { QuestionSchema, type ExamFormat, type MCQuestion } from "@/lib/schema";
import { toggleOption } from "@/lib/scoring";

const tf = (id: string, lecture: string, c?: string) =>
  QuestionSchema.parse({ type: "tf", id, lecture, case: c, statement: id, answer: true });
const mc = (id: string, lecture: string, c?: string) =>
  QuestionSchema.parse({ type: "mc", id, lecture, case: c, prompt: id, options: [{ id: "a", text: "a" }, { id: "b", text: "b" }], correct: ["a"] });

const pool = [
  tf("tf-1", "l1"), tf("tf-2", "l2"), tf("tf-3", "l1"),
  mc("mc-1", "l1", "fall"), mc("mc-2", "l1", "fall"), mc("mc-3", "l2"), mc("mc-4", "l2", "fall"),
];
const format: ExamFormat = { name: "Final", minutes: 30, short: 0, mc: 4, tf: 3, order: ["tf", "mc", "short"] };

describe("createExam", () => {
  it("stellt die Teile in der Reihenfolge des Prüfungsformats", () => {
    const ids = createExam("s", format, pool, 0).questionIds;
    expect(ids.slice(0, 3).every((id) => id.startsWith("tf"))).toBe(true);
    expect(ids.slice(3).every((id) => id.startsWith("mc"))).toBe(true);
  });

  it("hält Fragen desselben Falls zusammen, in der Reihenfolge des Pools", () => {
    for (let i = 0; i < 20; i++) {
      const ids = createExam("s", format, pool, 0).questionIds.filter((id) => ["mc-1", "mc-2", "mc-4"].includes(id));
      expect(ids).toEqual(["mc-1", "mc-2", "mc-4"]);
      const all = createExam("s", format, pool, 0).questionIds;
      const pos = ["mc-1", "mc-2", "mc-4"].map((id) => all.indexOf(id));
      expect(pos[2] - pos[0]).toBe(2);
    }
  });
});

describe("toggleOption", () => {
  const multi = mc("m", "l1") as MCQuestion;
  const single = { ...multi, single: true };
  it("ergänzt bei Mehrfachauswahl und ersetzt bei Single Choice", () => {
    expect(toggleOption(multi, ["a"], "b")).toEqual(["a", "b"]);
    expect(toggleOption(single, ["a"], "b")).toEqual(["b"]);
    expect(toggleOption(single, ["b"], "b")).toEqual([]);
  });
});

import { createPaperExam } from "@/lib/exam";
import { PaperSchema, paperItems } from "@/lib/schema";
import { examScore } from "@/lib/store";

const paper = PaperSchema.parse({
  id: "p",
  title: "Probeklausur",
  minutes: 90,
  parts: [
    { title: "Part A – T/F", sections: [{ items: [{ q: "tf-1", points: 1 }, { q: "tf-2", points: 1 }] }] },
    { title: "Part B – Exercises", sections: [{ title: "Exercise 1", items: [{ q: "mc-1", points: 2 }, { q: "sa-1", points: 4 }] }] },
  ],
});

describe("Probeklausuren", () => {
  it("nummeriert Aussagen mit Zahlen und Teilfragen einer Aufgabe mit Buchstaben", () => {
    expect(paperItems(paper).map((i) => `${i.part}${i.letter}`)).toEqual(["01", "02", "1a", "1b"]);
  });

  it("übernimmt Reihenfolge und Punkte des Klausurbogens", () => {
    const exam = createPaperExam("s", paper, 0);
    expect(exam.questionIds).toEqual(["tf-1", "tf-2", "mc-1", "sa-1"]);
    expect(exam.points).toEqual({ "tf-1": 1, "tf-2": 1, "mc-1": 2, "sa-1": 4 });
    expect(exam.optionOrder).toEqual({});
  });

  it("bewertet nach Punkten, offene Fragen anteilig", () => {
    const sc = examScore({
      questionIds: ["tf-1", "tf-2", "mc-1", "sa-1"],
      results: { "tf-1": true, "tf-2": false, "mc-1": true, "sa-1": false },
      partial: {},
      points: { "tf-1": 1, "tf-2": 1, "mc-1": 2, "sa-1": 4 },
      shortGrades: { "sa-1": { score: 50, hit: [], missed: [], feedback: "", source: "self" } },
    });
    expect(sc.earned).toBe(5);
    expect(sc.max).toBe(8);
    expect(sc.score).toBeCloseTo(5 / 8);
  });
});
