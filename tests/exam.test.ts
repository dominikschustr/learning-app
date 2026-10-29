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
