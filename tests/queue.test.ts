import { describe, expect, it } from "vitest";
import { LECTURE_SIZE, buildQueue } from "@/lib/queue";
import type { Question } from "@/lib/schema";
import { review } from "@/lib/srs";
import { itemKey } from "@/lib/utils";

const pool: Question[] = Array.from({ length: 40 }, (_, i) => ({
  type: "tf",
  id: `tf-${i}`,
  lecture: i < 35 ? "a" : "b",
  difficulty: 1,
  statement: `Statement ${i}`,
  answer: true,
  explanation: "",
}));

const ids = (qs: Question[]) => qs.map((q) => q.id).sort().join(",");

describe("buildQueue – Kapitel-Übung", () => {
  it("zieht eine begrenzte, wechselnde Auswahl nur aus dem Kapitel", () => {
    const run = () => buildQueue({ mode: "lecture", subjectId: "s", questions: pool, items: {}, now: 0, lecture: "a" });
    const a = run();
    const b = run();
    expect(a).toHaveLength(LECTURE_SIZE);
    expect(a.every((q) => q.lecture === "a")).toBe(true);
    expect(ids(a)).not.toBe(ids(b));
  });

  it("nimmt fällige Fragen immer mit", () => {
    const now = 10 * 86_400_000;
    // alle Kapitelfragen gesehen und nicht fällig, außer tf-3 (falsch beantwortet → sofort fällig)
    const items = Object.fromEntries(
      pool.map((q) => [itemKey("s", q.id), review(review(undefined, true, 0), true, now - 60_000)]),
    );
    items[itemKey("s", "tf-3")] = review(undefined, false, now - 60_000);
    for (let i = 0; i < 5; i++) {
      const q = buildQueue({ mode: "lecture", subjectId: "s", questions: pool, items, now, lecture: "a" });
      expect(q.map((x) => x.id)).toContain("tf-3");
    }
  });
});
