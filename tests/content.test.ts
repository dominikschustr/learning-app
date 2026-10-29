import { describe, expect, it } from "vitest";
import { getAllContent } from "@/lib/content";

describe("Content", () => {
  it("alle Fächer sind gültig und reichen für eine Simulation", () => {
    const all = getAllContent();
    expect(all.length).toBeGreaterThan(0);
    for (const c of all) expect(c.questions.length).toBeGreaterThan(0);
  });
});

import { getTexts } from "@/lib/content";

describe("Lesetexte", () => {
  it.each(["management-control", "marketing"])("jedes Kapitel von %s hat einen gültigen Text", (id) => {
    const content = getAllContent().find((c) => c.subject.id === id)!;
    const texts = getTexts(id);
    expect(texts.map((t) => t.lecture).sort()).toEqual(content.subject.lectures.map((l) => l.id).sort());
    for (const t of texts) expect(t.sections.length).toBeGreaterThan(0);
  });
});

describe("Fallstudien", () => {
  it("jeder Fall wird von mindestens einer Frage genutzt", () => {
    for (const c of getAllContent()) {
      const used = new Set(c.questions.map((q) => q.case).filter(Boolean));
      for (const k of c.cases) expect(used, `${c.subject.id}: Fall ${k.id}`).toContain(k.id);
    }
  });
});
