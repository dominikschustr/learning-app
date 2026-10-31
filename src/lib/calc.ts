import type { CalcResult, ShortQuestion } from "./schema";
import type { ShortGrade } from "./store";

/**
 * Rechenaufgaben: Die Antwort bleibt ein Text (wie bei Kurzantworten, damit Speicher und Sync gleich bleiben),
 * enthält aber die eingetippten Ergebnisse und den optionalen Rechenweg als JSON.
 */

export type CalcAnswer = { values: string[]; work: string };

const PREFIX = '{"calc":';

export function encodeCalc({ values, work }: CalcAnswer): string {
  if (!values.some((v) => v.trim()) && !work.trim()) return "";
  return JSON.stringify({ calc: values, work });
}

export function decodeCalc(text: string, n: number): CalcAnswer {
  const empty = { values: Array<string>(n).fill(""), work: "" };
  if (!text.startsWith(PREFIX)) return { ...empty, work: text };
  try {
    const data = JSON.parse(text) as { calc?: unknown; work?: unknown };
    const values = Array.isArray(data.calc) ? data.calc.map((v) => String(v ?? "")) : [];
    return {
      values: Array.from({ length: n }, (_, i) => values[i] ?? ""),
      work: typeof data.work === "string" ? data.work : "",
    };
  } catch {
    return empty;
  }
}

/** „13,8 %“, „1 400“, „−0.25“, „1e3“ → Zahl; leer oder unlesbar → null. */
export function parseNumber(raw: string): number | null {
  const s = raw
    .trim()
    .replace(/[−–]/g, "-")
    .replace(/[%€$\s]|EUR|USD/gi, "")
    .replace(/'/g, "");
  if (!s) return null;
  // Komma als Dezimaltrenner, außer es ist ein Tausendertrenner neben einem Punkt („1,400.5“)
  const normalized = s.includes(".") ? s.replace(/,/g, "") : s.replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(normalized)) return null;
  return Number(normalized);
}

export function tolerance(r: CalcResult): number {
  return r.tol ?? Math.max(Math.abs(r.value) * 0.005, 0.01);
}

/** Richtig innerhalb der Toleranz; bei Prozent zählt auch die Dezimalschreibweise (0.138 für 13.8 %). */
export function checkResult(r: CalcResult, raw: string): boolean {
  const x = parseNumber(raw);
  if (x === null) return false;
  const tol = tolerance(r) + 1e-9; // Gleitkomma: 219.05 − 219 ist minimal größer als 0.05
  if (Math.abs(x - r.value) <= tol) return true;
  return r.unit === "%" && !raw.includes("%") && Math.abs(x * 100 - r.value) <= tol;
}

/** Zahl für die Anzeige, deutsch formatiert: Prozent mit zwei, sonst bis zu vier Nachkommastellen (wie in der Klausur). */
export function fmtResult(r: CalcResult): string {
  const n = r.value.toLocaleString("de-DE", { maximumFractionDigits: r.unit === "%" ? 2 : 4 });
  return r.unit === "%" ? `${n} %` : r.unit ? `${n} ${r.unit}` : n;
}

export function isCalc(q: ShortQuestion): boolean {
  return q.results.length > 0;
}

/** Bewertet eine Rechenaufgabe sofort und ohne KI: Anteil der richtigen Ergebnisse. */
export function gradeCalc(q: ShortQuestion, text: string): ShortGrade {
  const { values } = decodeCalc(text, q.results.length);
  const ok = q.results.map((r, i) => checkResult(r, values[i]));
  const hit = q.results.filter((_, i) => ok[i]).map((r) => r.label);
  const right = hit.length;
  return {
    score: Math.round((right / q.results.length) * 100),
    hit,
    missed: q.results.filter((_, i) => !ok[i]).map((r) => r.label),
    feedback:
      right === q.results.length
        ? "Alle Ergebnisse stimmen."
        : right
          ? `${right} von ${q.results.length} Ergebnissen stimmen.`
          : "Noch kein Ergebnis richtig – vergleiche mit dem Lösungsweg.",
    source: "auto",
  };
}
