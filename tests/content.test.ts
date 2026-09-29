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
  it("jedes Kapitel von Management Control hat einen gültigen Text", () => {
    const content = getAllContent().find((c) => c.subject.id === "management-control")!;
    const texts = getTexts("management-control");
    expect(texts.map((t) => t.lecture).sort()).toEqual(content.subject.lectures.map((l) => l.id).sort());
    for (const t of texts) expect(t.sections.length).toBeGreaterThan(0);
  });
});
