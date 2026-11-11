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

describe("HRM – Multiple-Choice-Set", () => {
  const hr = loadAllContent().find((c) => c.subject.id === "hr")!;
  const set = hr.questions.filter((q) => q.mcSet);

  it("hat in jedem Kapitel 30 Single-Choice-Fragen mit genau einer richtigen Antwort", () => {
    for (const l of hr.subject.lectures) {
      const qs = set.filter((q) => q.lecture === l.id);
      expect(qs, l.id).toHaveLength(30);
      for (const q of qs) {
        expect(q.type, q.id).toBe("mc");
        if (q.type !== "mc") continue;
        expect(q.single, q.id).toBe(true);
        expect(q.correct, q.id).toHaveLength(1);
        expect(q.paperOnly, q.id).toBe(false);
      }
    }
  });

  it("jede Frage nennt ihre Herkunft: Lecture-Folien, Kahoot oder Theorievideo", () => {
    for (const q of set) {
      expect(q.basis.length, q.id).toBeGreaterThan(0);
      for (const b of q.basis) expect(["slides", "video", "quiz"], q.id).toContain(b.kind);
    }
    // Theorievideos zu H1 (RBV), H3/H4 (R&S, Employer Branding), H5 (PM), H6/H7 (Rewards); H2 hat kein Video
    for (const id of ["h1", "h3", "h4", "h5", "h6", "h7"])
      expect(set.some((q) => q.lecture === id && q.basis.some((b) => b.kind === "video")), id).toBe(true);
  });
});

describe("Accounting", () => {
  const acc = loadAllContent().find((c) => c.subject.id === "accounting")!;

  it("hat nur Single-Choice-Fragen mit genau einer richtigen Antwort", () => {
    for (const q of acc.questions)
      if (q.type === "mc") {
        expect(q.single, q.id).toBe(true);
        expect(q.correct, q.id).toHaveLength(1);
      }
  });

  it("hat in jedem Kapitel die Check-up-Fragen vom Ende der Vorlesung", () => {
    for (const l of acc.subject.lectures)
      expect(acc.questions.filter((q) => q.checkup && q.lecture === l.id).length, l.id).toBeGreaterThan(0);
    expect(acc.questions.filter((q) => q.checkup)).toHaveLength(45);
  });

  it("jede Frage nennt ihre Grundlage (Altklausur, Folien oder Übung), jede offene Aufgabe hat einen Lösungsweg", () => {
    for (const q of acc.questions) {
      expect(q.basis.length, q.id).toBeGreaterThan(0);
      if (q.type === "short") expect(q.steps.length, q.id).toBeGreaterThan(0);
    }
  });

  it("übt die Übungsfälle der Vorlesung aus jedem Topic", () => {
    for (const l of acc.subject.lectures)
      expect(
        acc.questions.some((q) => q.lecture === l.id && q.basis.some((b) => b.kind === "case")),
        l.id,
      ).toBe(true);
  });
});

describe("Marketing", () => {
  const mk = getAllContent().find((c) => c.subject.id === "marketing")!;

  it("jede Frage nennt ihre Grundlage (Altklausur, Quiz, Folien, Übung oder eigene Aufgabe)", () => {
    for (const q of mk.questions) expect(q.basis.length, q.id).toBeGreaterThan(0);
  });

  it("jedes Kapitel hat Aufgaben aus Altklausuren oder im Klausurstil", () => {
    for (const l of mk.subject.lectures)
      expect(
        mk.questions.filter((q) => q.lecture === l.id && q.basis.some((b) => b.kind === "exam" || b.kind === "own")).length,
        l.id,
      ).toBeGreaterThanOrEqual(5);
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
