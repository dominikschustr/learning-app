import { describe, expect, it } from "vitest";
import { checkResult, decodeCalc, encodeCalc, gradeCalc, parseNumber } from "@/lib/calc";
import { ShortQuestionSchema } from "@/lib/schema";

const q = ShortQuestionSchema.parse({
  type: "short",
  id: "t-1",
  lecture: "l1",
  verb: "calculate",
  prompt: "…",
  modelAnswer: "…",
  keyPoints: ["…"],
  results: [
    { label: "Return", value: 13.8, unit: "%" },
    { label: "Beta", value: 0.4667 },
    { label: "Price", value: 219.05, unit: "EUR", tol: 0.05 },
  ],
});

describe("Rechenaufgaben", () => {
  it("liest Zahlen mit Komma, Prozentzeichen, Minuszeichen und Tausendertrennern", () => {
    expect(parseNumber("13,8 %")).toBe(13.8);
    expect(parseNumber("−5.27")).toBe(-5.27);
    expect(parseNumber("1,400.5")).toBe(1400.5);
    expect(parseNumber("1 400")).toBe(1400);
    expect(parseNumber("EUR 219.05")).toBe(219.05);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
  });

  it("akzeptiert Rundung und Prozent als Dezimalzahl, aber keine falschen Werte", () => {
    const [ret, beta, price] = q.results;
    expect(checkResult(ret, "13.80")).toBe(true);
    expect(checkResult(ret, "13,83")).toBe(true);
    expect(checkResult(ret, "0.138")).toBe(true);
    expect(checkResult(ret, "0.138 %")).toBe(false);
    expect(checkResult(ret, "14.2")).toBe(false);
    expect(checkResult(beta, "0.47")).toBe(true);
    expect(checkResult(beta, "0.49")).toBe(false);
    expect(checkResult(price, "219")).toBe(true);
    expect(checkResult(price, "218.9")).toBe(false);
  });

  it("kodiert Antworten verlustfrei und leer als leeren Text", () => {
    expect(encodeCalc({ values: ["", "", ""], work: " " })).toBe("");
    const text = encodeCalc({ values: ["13.8", "", "219"], work: "rf + β × MRP" });
    expect(decodeCalc(text, 3)).toEqual({ values: ["13.8", "", "219"], work: "rf + β × MRP" });
    expect(decodeCalc("freier Text", 2)).toEqual({ values: ["", ""], work: "freier Text" });
  });

  it("bewertet nach Anteil richtiger Ergebnisse", () => {
    const g = gradeCalc(q, encodeCalc({ values: ["13.8", "0.9", "219.05"], work: "" }));
    expect(g.score).toBe(67);
    expect(g.hit).toEqual(["Return", "Price"]);
    expect(g.missed).toEqual(["Beta"]);
    expect(g.source).toBe("auto");
    expect(gradeCalc(q, "").score).toBe(0);
  });
});
