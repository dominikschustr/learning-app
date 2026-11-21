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

const PLAIN = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
/** Nur Tausendergruppen, z. B. „2.832.000“ oder „118,000“ – führende Null ausgeschlossen („0.138“ bleibt Dezimalzahl). */
const GROUPED = /^[-+]?[1-9]\d{0,2}([.,]\d{3})+$/;

/**
 * Alle sinnvollen Lesarten einer Eingabe. Deutsch („2.832.000“, „13,8“) und englisch („2,832,000“, „13.8“)
 * werden beide verstanden; „118.000“ ist mehrdeutig und liefert 118 und 118000 – die Prüfung nimmt die passende.
 */
export function parseNumbers(raw: string): number[] {
  const s = raw
    .trim()
    .replace(/[−–]/g, "-")
    .replace(/[%€$\s]|EUR|USD/gi, "")
    .replace(/'/g, "");
  if (!s) return [];
  const out: number[] = [];
  const add = (t: string) => {
    if (PLAIN.test(t)) out.push(Number(t));
  };
  const dots = (s.match(/\./g) ?? []).length;
  const commas = (s.match(/,/g) ?? []).length;
  if (dots && commas) {
    // Beide Trenner: der letzte ist der Dezimaltrenner („1,400.5“ bzw. „1.400,5“)
    add(s.lastIndexOf(".") > s.lastIndexOf(",") ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", "."));
  } else if (dots + commas > 1) {
    // Mehrfach derselbe Trenner: nur als Tausendertrenner sinnvoll
    if (GROUPED.test(s)) add(s.replace(/[.,]/g, ""));
  } else {
    add(s.replace(",", "."));
    if (GROUPED.test(s)) add(s.replace(/[.,]/g, ""));
  }
  return out;
}

/** „13,8 %“, „1 400“, „−0.25“, „1e3“ → Zahl (bei Mehrdeutigkeit die Dezimal-Lesart); leer oder unlesbar → null. */
export function parseNumber(raw: string): number | null {
  return parseNumbers(raw)[0] ?? null;
}

export function tolerance(r: CalcResult): number {
  return r.tol ?? Math.max(Math.abs(r.value) * 0.005, 0.01);
}

/** Richtig innerhalb der Toleranz; bei Prozent zählt auch die Dezimalschreibweise (0.138 für 13.8 %). */
export function checkResult(r: CalcResult, raw: string): boolean {
  const tol = tolerance(r) + 1e-9; // Gleitkomma: 219.05 − 219 ist minimal größer als 0.05
  return parseNumbers(raw).some(
    (x) =>
      Math.abs(x - r.value) <= tol ||
      (r.unit === "%" && !raw.includes("%") && Math.abs(x * 100 - r.value) <= tol),
  );
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
