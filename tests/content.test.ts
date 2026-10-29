import { describe, expect, it } from "vitest";
import { getAllContent, loadAllContent } from "@/lib/content";

describe("Content", () => {
  it("alle Fächer (auch Entwürfe) sind gültig", () => {
    expect(loadAllContent().length).toBeGreaterThan(0);
  });

  it("jedes sichtbare Fach hat Fragen und reicht für eine Simulation", () => {
    const all = getAllContent();
    expect(all.length).toBeGreaterThan(0);
    for (const c of all) expect(c.questions.length).toBeGreaterThan(0);
  });

  it("Fach-ids und Kürzel sind eindeutig", () => {
    const all = loadAllContent();
    expect(new Set(all.map((c) => c.subject.id)).size).toBe(all.length);
    expect(new Set(all.map((c) => c.subject.short.toLowerCase())).size).toBe(all.length);
  });
});

import { getTexts } from "@/lib/content";

describe("Lesetexte", () => {
  it("alle Lesetexte gehören zu einem Kapitel ihres Fachs", () => {
    for (const c of loadAllContent()) for (const t of getTexts(c.subject.id)) expect(t.sections.length).toBeGreaterThan(0);
  });

  it.each(["management-control", "marketing", "accounting"])("jedes Kapitel von %s hat einen gültigen Text", (id) => {
    const content = getAllContent().find((c) => c.subject.id === id)!;
    const texts = getTexts(id);
    expect(texts.map((t) => t.lecture).sort()).toEqual(content.subject.lectures.map((l) => l.id).sort());
    for (const t of texts) expect(t.sections.length).toBeGreaterThan(0);
  });
});

describe("Fallstudien", () => {
  it("jeder Fall wird von mindestens einer Frage genutzt", () => {
    for (const c of loadAllContent()) {
      const used = new Set(c.questions.map((q) => q.case).filter(Boolean));
      for (const k of c.cases) expect(used, `${c.subject.id}: Fall ${k.id}`).toContain(k.id);
    }
  });
});
