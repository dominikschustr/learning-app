import { describe, expect, it } from "vitest";
import { LECTURE_SIZE, buildQueue, groupCases } from "@/lib/queue";
import type { Question } from "@/lib/schema";
import { itemStatus, review } from "@/lib/srs";
import { itemKey } from "@/lib/utils";

const pool: Question[] = Array.from({ length: 40 }, (_, i) => ({
  type: "tf",
  id: `tf-${i}`,
  lecture: i < 35 ? "a" : "b",
  topic: "",
  difficulty: 1,
  statement: `Statement ${i}`,
  answer: true,
  explanation: "",
  paperOnly: false,
  checkup: i % 10 === 0,
  mcSet: false,
  basis: [],
}));

const ids = (qs: Question[]) => qs.map((q) => q.id).sort().join(",");

describe("buildQueue – Check-up-Fragen", () => {
  it("zieht alle Check-up-Fragen und nur diese, auf Wunsch je Kapitel", () => {
    const all = buildQueue({ mode: "checkup", subjectId: "s", questions: pool, items: {}, now: 0 });
    expect(ids(all)).toBe("tf-0,tf-10,tf-20,tf-30");
    const b = buildQueue({ mode: "checkup", subjectId: "s", questions: pool, items: {}, now: 0, lecture: "b" });
    expect(b).toHaveLength(0);
  });
});

describe("buildQueue – Multiple-Choice-Set", () => {
  // Kapitel a: tf-0 … tf-34; davon tf-1, tf-2, tf-3 im Multiple-Choice-Set
  const withSet = pool.map((q, i) => ({ ...q, mcSet: i >= 1 && i <= 3 }));

  it("zieht alle Fragen des Sets und nur diese, auf Wunsch je Kapitel", () => {
    const all = buildQueue({ mode: "mc", subjectId: "s", questions: withSet, items: {}, now: 0 });
    expect(ids(all)).toBe("tf-1,tf-2,tf-3");
    expect(buildQueue({ mode: "mc", subjectId: "s", questions: withSet, items: {}, now: 0, lecture: "b" })).toHaveLength(0);
  });

  it("„Üben“ im Kapitel lässt das Set aus, solange es andere Fragen gibt", () => {
    for (let run = 0; run < 20; run++) {
      const q = buildQueue({ mode: "lecture", subjectId: "s", questions: withSet, items: {}, now: 0, lecture: "a" });
      expect(q).toHaveLength(LECTURE_SIZE);
      expect(q.some((x) => x.mcSet)).toBe(false);
    }
    const onlySet = withSet.map((q) => ({ ...q, mcSet: true }));
    expect(buildQueue({ mode: "lecture", subjectId: "s", questions: onlySet, items: {}, now: 0, lecture: "b" })).toHaveLength(5);
  });
});

describe("buildQueue – Klausuraufgaben", () => {
  it("zieht alle Klausuraufgaben des Kapitels in fester Reihenfolge, auch solche nur für Probeklausuren", () => {
    const papers = [pool[36], { ...pool[2], paperOnly: true }, pool[1], pool[37]];
    const a = buildQueue({ mode: "papers", subjectId: "s", questions: pool, items: {}, now: 0, lecture: "a", papers });
    expect(a.map((q) => q.id)).toEqual(["tf-2", "tf-1"]);
    const b = buildQueue({ mode: "papers", subjectId: "s", questions: pool, items: {}, now: 0, lecture: "b", papers });
    expect(b.map((q) => q.id)).toEqual(["tf-36", "tf-37"]);
    expect(buildQueue({ mode: "papers", subjectId: "s", questions: pool, items: {}, now: 0 })).toHaveLength(0);
  });

  it("zieht nur die in der Aufgabentabelle ausgewählten Aufgaben, in der Reihenfolge der Auswahl", () => {
    const papers = [pool[36], { ...pool[2], paperOnly: true }, pool[1], pool[37]];
    const picked = buildQueue({ mode: "papers", subjectId: "s", questions: pool, items: {}, now: 0, papers, ids: ["tf-37", "tf-2", "tf-2", "gibt-es-nicht"] });
    expect(picked.map((q) => q.id)).toEqual(["tf-37", "tf-2"]);
  });

  it("mischt auf Wunsch alle Aufgaben des Kapitels, ohne welche zu verlieren", () => {
    const papers = pool.slice(0, 20);
    const r = buildQueue({ mode: "papers", subjectId: "s", questions: pool, items: {}, now: 0, lecture: "a", papers, random: true });
    expect(ids(r)).toBe(ids(papers));
  });
});

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

describe("groupCases – Teilfragen eines Falls zusammen", () => {
  it("stellt die Fragen eines Falls an die Stelle der ersten, in Pool-Reihenfolge", () => {
    const withCase = pool.slice(0, 6).map((q, i) => (i % 2 ? { ...q, case: "fall" } : q));
    const drawn = [withCase[4], withCase[5], withCase[0], withCase[3], withCase[1], withCase[2]];
    expect(groupCases(drawn, withCase).map((q) => q.id)).toEqual(["tf-4", "tf-1", "tf-3", "tf-5", "tf-0", "tf-2"]);
  });
});

describe("buildQueue – hervorgehobene Fragen", () => {
  // reine Klausuraufgabe (nicht im Übungspool), Kapitel b
  const paper: Question = { ...pool[0], id: "paper-1", lecture: "b", paperOnly: true };
  const highlighted = new Set(["tf-1", "tf-36", "paper-1", "gibt-es-nicht"]);

  it("zieht alle hervorgehobenen Fragen des Fachs, auch reine Klausuraufgaben – auf Wunsch je Kapitel", () => {
    const opts = { mode: "highlighted" as const, subjectId: "s", questions: pool, papers: [paper, pool[1]], items: {}, now: 0, highlighted };
    expect(ids(buildQueue(opts))).toBe("paper-1,tf-1,tf-36");
    expect(ids(buildQueue({ ...opts, lecture: "b" }))).toBe("paper-1,tf-36");
    expect(buildQueue({ ...opts, highlighted: new Set() })).toHaveLength(0);
  });
});
