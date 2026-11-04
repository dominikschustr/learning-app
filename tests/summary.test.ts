import { describe, expect, it } from "vitest";
import { getAllContent } from "@/lib/content";
import { getLectureSummaries } from "@/lib/summary";

describe("Lern-Zusammenfassungen", () => {
  it("alle Zusammenfassungen sind gültig und gehören zu einem Kapitel ihres Fachs", () => {
    for (const c of getAllContent()) {
      const ids = new Set(c.subject.lectures.map((l) => l.id));
      for (const s of getLectureSummaries(c.subject.id)) expect(ids.has(s.lecture)).toBe(true);
    }
  });

  it("jedes Marketing-Kapitel hat eine Zusammenfassung mit Diagrammen", () => {
    const marketing = getAllContent().find((c) => c.subject.id === "marketing")!;
    const summaries = getLectureSummaries("marketing");
    expect(summaries.map((s) => s.lecture)).toEqual(marketing.subject.lectures.map((l) => l.id));
    const visual = new Set([
      "flow",
      "grid",
      "table",
      "matrix",
      "scatter",
      "correlation",
      "bars",
      "waterfall",
      "funnel",
      "map",
      "line",
      "causal",
      "compare",
    ]);
    for (const s of summaries) {
      const blocks = s.sections.flatMap((x) => x.blocks);
      expect(blocks.filter((b) => visual.has(b.type)).length, s.lecture).toBeGreaterThanOrEqual(4);
      // Abschnitts-IDs sind Sprungmarken und müssen eindeutig sein
      expect(new Set(s.sections.map((x) => x.id)).size, s.lecture).toBe(s.sections.length);
    }
  });

  it("Matrizen haben genau eine Zelle je Feld", () => {
    for (const c of getAllContent())
      for (const s of getLectureSummaries(c.subject.id))
        for (const b of s.sections.flatMap((x) => x.blocks))
          if (b.type === "matrix") expect(b.cells.length, `${s.lecture}: ${b.title}`).toBe(b.x.length * b.y.length);
  });
});
