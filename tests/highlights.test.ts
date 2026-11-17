import { describe, expect, it } from "vitest";
import type { HighlightDoc } from "@/lib/cloud";
import { highlightIndex, markIndex, whoSentence, whoText } from "@/lib/highlights";

const doc = (uid: string, name: string, items: string[]): HighlightDoc => ({ uid, name, items, at: 0 });

describe("Markierte Fragen der Lerngruppe", () => {
  const docs = [doc("b", "Ben", ["q:acc:1", "q:acc:2"]), doc("me", "Dominik", ["q:acc:1"]), doc("a", "Anna", ["q:acc:1", "q:acc:1"])];

  it("ordnet jeder Frage zu, wer sie markiert hat – eigenes Konto zuerst, dann nach Name", () => {
    const idx = highlightIndex(docs, "me");
    expect(idx.get("q:acc:1")?.map((h) => h.name)).toEqual(["Dominik", "Anna", "Ben"]);
    expect(idx.get("q:acc:1")?.[0].me).toBe(true);
    expect(idx.get("q:acc:2")?.map((h) => h.uid)).toEqual(["b"]);
    expect(idx.get("q:acc:3")).toBeUndefined();
  });

  it("rechnet für ein anderes Konto neu", () => {
    expect(highlightIndex(docs, "me").get("q:acc:1")?.[0].me).toBe(true);
    expect(highlightIndex(docs, "b").get("q:acc:1")?.map((h) => [h.name, h.me])).toEqual([
      ["Ben", true],
      ["Anna", false],
      ["Dominik", false],
    ]);
  });

  it("zählt eigene, noch nicht geteilte Markierungen als „Du“ (nur Fragen, nur eingeschaltete)", () => {
    const marks = {
      "q:acc:2": { on: true, at: 1 },
      "q:acc:1": { on: true, at: 1 },
      "q:acc:5": { on: false, at: 1 },
      "c:acc:9": { on: true, at: 1 },
    };
    const idx = markIndex(docs, "me", marks);
    expect(idx.get("q:acc:2")?.map((h) => [h.name, h.me])).toEqual([
      ["Du", true],
      ["Ben", false],
    ]);
    // schon geteilt → nicht doppelt
    expect(idx.get("q:acc:1")?.filter((h) => h.me)).toHaveLength(1);
    expect(idx.has("q:acc:5")).toBe(false);
    expect(idx.has("c:acc:9")).toBe(false);
    // ohne lokale Markierungen bleibt es beim gemeinsamen Index
    expect(markIndex(docs, "me", {})).toBe(highlightIndex(docs, "me"));
  });

  it("formuliert, wer markiert hat", () => {
    const h = (name: string, me = false) => ({ uid: name, name, me });
    expect(whoSentence([h("Adrian")])).toBe("Adrian hat diese Frage markiert");
    expect(whoSentence([h("Ich", true)])).toBe("Du hast diese Frage markiert");
    expect(whoSentence([h("Ich", true), h("Lisa")])).toBe("Du und Lisa haben diese Frage markiert");
    expect(whoText([h("A"), h("B"), h("C")])).toBe("A, B und C");
    expect(whoText([h("A"), h("B"), h("C"), h("D")])).toBe("A, B und 2 weitere");
    expect(whoSentence([])).toBe("");
  });
});
