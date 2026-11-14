import { describe, expect, it } from "vitest";
import type { HighlightDoc } from "@/lib/cloud";
import { highlightIndex, whoSentence, whoText } from "@/lib/highlights";

const doc = (uid: string, name: string, items: string[]): HighlightDoc => ({ uid, name, items, at: 0 });

describe("Hervorhebungen", () => {
  const docs = [doc("b", "Ben", ["q:acc:1", "q:acc:2"]), doc("me", "Dominik", ["q:acc:1"]), doc("a", "Anna", ["q:acc:1", "q:acc:1"])];

  it("ordnet jeder Frage zu, wer sie hervorgehoben hat – eigenes Konto zuerst, dann nach Name", () => {
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

  it("formuliert, wer hervorgehoben hat", () => {
    const h = (name: string, me = false) => ({ uid: name, name, me });
    expect(whoSentence([h("Dominik")])).toBe("Dominik hat diese Frage hervorgehoben");
    expect(whoSentence([h("Ich", true)])).toBe("Du hast diese Frage für alle hervorgehoben");
    expect(whoSentence([h("Ich", true), h("Lisa")])).toBe("Du und Lisa haben diese Frage hervorgehoben");
    expect(whoText([h("A"), h("B"), h("C")])).toBe("A, B und C");
    expect(whoText([h("A"), h("B"), h("C"), h("D")])).toBe("A, B und 2 weitere");
    expect(whoSentence([])).toBe("");
  });
});
