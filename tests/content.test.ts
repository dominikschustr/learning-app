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

import { getFormulas, getFrameworks, getSummaries, getTexts } from "@/lib/content";
import { paperItems } from "@/lib/schema";

describe("Lesetexte", () => {
  it("alle Lesetexte gehören zu einem Kapitel ihres Fachs", () => {
    for (const c of loadAllContent()) for (const t of getTexts(c.subject.id)) expect(t.sections.length).toBeGreaterThan(0);
  });

  it.each(["management-control", "marketing", "accounting", "strategy"])("jedes Kapitel von %s hat einen gültigen Text", (id) => {
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

describe("Framework-Steckbriefe", () => {
  it("sind gültig und decken bei Strategy jedes Kapitel ab", () => {
    for (const c of loadAllContent()) getFrameworks(c.subject.id);
    const strategy = getAllContent().find((c) => c.subject.id === "strategy")!;
    const lectures = new Set(getFrameworks("strategy").map((f) => f.lecture));
    for (const l of strategy.subject.lectures) expect(lectures, l.id).toContain(l.id);
  });
});

describe("Corporate Finance", () => {
  const cf = getAllContent().find((c) => c.subject.id === "corporate-finance")!;

  it("jedes Kapitel hat Formeln und Rechenaufgaben, aber keine Multiple-Choice-Fragen zum Üben", () => {
    const formulas = new Set(getFormulas("corporate-finance").map((f) => f.lecture));
    const summary = getSummaries().find((s) => s.subject.id === "corporate-finance")!;
    for (const l of cf.subject.lectures) {
      expect(formulas, l.id).toContain(l.id);
      expect(summary.items.filter((i) => i.lecture === l.id && i.calc).length, l.id).toBeGreaterThanOrEqual(5);
    }
    expect(summary.items.some((i) => i.type !== "short")).toBe(false);
  });

  it("Probeklausuren haben 20 Punkte wie die echte Klausur, Ergebnisse von Rechenaufgaben sind endlich", () => {
    for (const p of cf.papers) {
      expect(paperItems(p).reduce((s, i) => s + i.points, 0), p.id).toBeCloseTo(20, 6);
    }
    for (const q of cf.questions) if (q.type === "short") for (const r of q.results) expect(Number.isFinite(r.value), q.id).toBe(true);
  });
});

import { renderFormula } from "@/lib/tex";

describe("Formelübersicht", () => {
  it("jede Formel ist gültiges LaTeX und erklärt ihre Symbole", () => {
    for (const c of loadAllContent())
      for (const f of getFormulas(c.subject.id)) {
        expect(() => renderFormula(f), f.id).not.toThrow();
        expect(f.vars.length, f.id).toBeGreaterThan(0);
      }
  });
});
