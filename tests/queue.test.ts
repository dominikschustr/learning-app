import { describe, expect, it } from "vitest";
import { LECTURE_SIZE, buildQueue } from "@/lib/queue";
import type { Question } from "@/lib/schema";
import { itemStatus, review } from "@/lib/srs";
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

describe("Bearbeitungsstand", () => {
  it("unterscheidet neu, direkt richtig, nach Fehler richtig und zuletzt falsch", () => {
    const first = review(undefined, true, 0);
    const recovered = review(review(undefined, false, 0), true, 1);
    const relapsed = review(first, false, 2);
    expect(itemStatus(undefined)).toBe("new");
    expect(itemStatus(first)).toBe("first");
    expect(itemStatus(recovered)).toBe("recovered");
    expect(itemStatus(relapsed)).toBe("wrong");
    // bleibt "direkt richtig", wenn nach dem Rückfall wieder richtig
    expect(itemStatus(review(relapsed, true, 3))).toBe("first");
    // Altbestand ohne firstCorrect: nie falsch → direkt richtig
    expect(itemStatus({ ...recovered, firstCorrect: undefined, wrong: 0 })).toBe("first");
  });

  it("Modi „new“ und „wrong“ wählen nur passende Fragen", () => {
    const items = {
      [itemKey("s", "tf-0")]: review(undefined, true, 0),
      [itemKey("s", "tf-1")]: review(undefined, false, 0),
    };
    const opts = { subjectId: "s", questions: pool, items, now: 1, lecture: "a" };
    const fresh = buildQueue({ ...opts, mode: "new" });
    expect(fresh.some((q) => q.id === "tf-0" || q.id === "tf-1")).toBe(false);
    expect(fresh.length).toBe(LECTURE_SIZE);
    expect(buildQueue({ ...opts, mode: "wrong" }).map((q) => q.id)).toEqual(["tf-1"]);
  });
});
