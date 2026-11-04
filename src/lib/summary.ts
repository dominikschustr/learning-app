import "server-only";
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { z } from "zod";

/**
 * Lern-Zusammenfassung einer Lecture (summaries/<kapitel>.json, optional).
 * Ersetzt in der Ansicht „Nachlesen“ den reinen Stichpunkttext durch Abschnitte mit Diagrammen.
 */

const str = z.string().min(1);
const Tile = z.object({ label: str, text: z.string().optional(), tag: z.string().optional(), points: z.array(str).optional() });
const Point = z.object({ label: str, x: z.number(), y: z.number(), group: z.number().int().min(0).max(5).optional() });

const BlockSchema = z.discriminatedUnion("type", [
  /** Fließtext; **fett** wird hervorgehoben */
  z.object({ type: z.literal("text"), text: str }),
  /** Aufzählung; „Begriff: Erklärung“ hebt den Begriff hervor */
  z.object({
    type: z.literal("list"),
    title: z.string().optional(),
    style: z.enum(["bullet", "check", "number"]).default("bullet"),
    items: z.array(str).min(1),
  }),
  /** Begriffe mit Definition */
  z.object({ type: z.literal("defs"), items: z.array(z.object({ term: str, text: str })).min(1) }),
  /** Schritte mit Pfeilen (auf dem Handy untereinander) */
  z.object({ type: z.literal("flow"), title: z.string().optional(), steps: z.array(Tile).min(2), note: z.string().optional() }),
  /** Kacheln nebeneinander */
  z.object({
    type: z.literal("grid"),
    title: z.string().optional(),
    cols: z.number().int().min(1).max(5).default(3),
    items: z.array(Tile).min(1),
  }),
  /** Tabelle; `highlight` = Spalte, die farbig hervorgehoben wird */
  z.object({
    type: z.literal("table"),
    title: z.string().optional(),
    head: z.array(z.string()).min(2),
    rows: z.array(z.array(z.string())).min(1),
    highlight: z.number().int().optional(),
    note: z.string().optional(),
  }),
  /** n×m-Matrix: x = Spaltenköpfe (links → rechts), y = Zeilenköpfe (oben → unten), cells zeilenweise */
  z.object({
    type: z.literal("matrix"),
    title: z.string().optional(),
    xLabel: str,
    yLabel: str,
    x: z.array(str).min(2),
    y: z.array(str).min(2),
    cells: z.array(
      z.object({ label: str, text: z.string().optional(), tone: z.enum(["good", "bad", "warn", "neutral", "accent"]).default("neutral") }),
    ),
    note: z.string().optional(),
  }),
  /** Formel; x_{i} und x^{2} werden tief- bzw. hochgestellt */
  z.object({ type: z.literal("formula"), name: str, formula: str, vars: z.array(str).default([]), note: z.string().optional() }),
  /** Durchgerechnetes Beispiel; Lösung zum Aufklappen */
  z.object({
    type: z.literal("example"),
    title: str,
    given: z.array(str).default([]),
    question: z.string().optional(),
    steps: z.array(str).min(1),
    result: str,
  }),
  /** Gegenüberstellung zweier Konzepte */
  z.object({
    type: z.literal("compare"),
    title: z.string().optional(),
    sides: z
      .array(z.object({ label: str, sub: z.string().optional(), points: z.array(str).min(1) }))
      .min(2)
      .max(3),
    note: z.string().optional(),
  }),
  /** Hinweiskasten */
  z.object({ type: z.literal("callout"), tone: z.enum(["exam", "tip", "warn", "key"]), title: z.string().optional(), text: str }),
  /** Streudiagramm, optional mit Regressionsgerade y = b0 + b1·x und markiertem Residuum */
  z.object({
    type: z.literal("scatter"),
    title: z.string().optional(),
    xLabel: str,
    yLabel: str,
    points: z.array(z.tuple([z.number(), z.number()])).min(2),
    line: z.tuple([z.number(), z.number()]).optional(),
    residual: z.number().int().optional(),
    caption: z.string().optional(),
  }),
  /** Fünf Mini-Streudiagramme von r = +1 bis r = −1 */
  z.object({ type: z.literal("correlation"), caption: z.string().optional() }),
  /** Balken (auch negativ), z. B. Part-worths oder Anteile */
  z.object({
    type: z.literal("bars"),
    title: z.string().optional(),
    unit: z.string().default(""),
    items: z.array(z.object({ label: str, value: z.number(), note: z.string().optional() })).min(1),
    caption: z.string().optional(),
  }),
  /** Wasserfall: Startwert, Zu- und Abschläge, Summe (total = true) */
  z.object({
    type: z.literal("waterfall"),
    title: z.string().optional(),
    unit: z.string().default(""),
    items: z.array(z.object({ label: str, value: z.number(), total: z.boolean().default(false) })).min(2),
    caption: z.string().optional(),
  }),
  /** Trichter von breit nach schmal */
  z.object({ type: z.literal("funnel"), title: z.string().optional(), stages: z.array(Tile).min(2), caption: z.string().optional() }),
  /** Positionierungs- oder Cluster-Karte; x, y von −1 bis 1, group färbt Punkte ein */
  z.object({
    type: z.literal("map"),
    title: z.string().optional(),
    x: z.tuple([str, str]),
    y: z.tuple([str, str]),
    points: z.array(Point).min(1),
    groups: z.array(str).default([]),
    centroids: z.boolean().default(false),
    caption: z.string().optional(),
  }),
  /** Liniendiagramm, z. B. Survival-Kurve */
  z.object({
    type: z.literal("line"),
    title: z.string().optional(),
    xTicks: z.array(str).min(2),
    series: z.array(z.object({ label: str, values: z.array(z.number()) })).min(1),
    unit: z.string().default(""),
    caption: z.string().optional(),
  }),
  /** Kausal-Diagramme: direct (X → Y), reverse (X ⇄ Y), confounder (Z → X, Z → Y) */
  z.object({
    type: z.literal("causal"),
    items: z
      .array(z.object({ variant: z.enum(["direct", "reverse", "confounder"]), x: str, y: str, z: z.string().optional(), caption: str }))
      .min(1),
  }),
]);

/** Sprungmarken, die die Ansicht selbst vergibt */
const RESERVED = ["auf-einen-blick", "klausur"];

export const SummarySchema = z.object({
  lecture: str,
  title: str,
  source: str,
  /** Die Kernaussage in einem Satz */
  tagline: str,
  /** „Nach dieser Lecture kannst du …“ */
  goals: z.array(str).min(1),
  sections: z
    .array(
      z.object({
        id: z
          .string()
          .regex(/^[a-z0-9-]+$/)
          .refine((v) => !RESERVED.includes(v), "reserviert für feste Bereiche der Ansicht"),
        heading: str,
        lead: z.string().optional(),
        blocks: z.array(BlockSchema).min(1),
      }),
    )
    .min(1),
  /** Auf einen Blick – zum Wiederholen kurz vor der Klausur */
  recap: z.array(str).min(3),
  /** Was in der Klausur drankommt und wie */
  exam: z.array(str).default([]),
  /** Typische Fehler */
  traps: z.array(str).default([]),
});

export type Summary = z.infer<typeof SummarySchema>;
export type SummaryBlock = z.infer<typeof BlockSchema>;

const ROOT = path.join(process.cwd(), "content", "subjects");

/** Alle Zusammenfassungen eines Fachs, nach Kapitel-ID sortiert. */
export const getLectureSummaries = cache((subjectId: string): Summary[] => {
  const dir = path.join(ROOT, subjectId, "summaries");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const file = path.join(dir, f);
      let raw: unknown;
      try {
        raw = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch (e) {
        throw new Error(`Content: ${path.relative(process.cwd(), file)} ist kein gültiges JSON – ${(e as Error).message}`);
      }
      const result = SummarySchema.safeParse(raw);
      if (!result.success) {
        throw new Error(`Content: ${path.relative(process.cwd(), file)}\n${z.prettifyError(result.error)}`);
      }
      if (`${result.data.lecture}.json` !== f) {
        throw new Error(`Content: ${path.relative(process.cwd(), file)} – Dateiname passt nicht zu lecture "${result.data.lecture}"`);
      }
      return result.data;
    });
});

export function getLectureSummary(subjectId: string, lecture: string): Summary | undefined {
  return getLectureSummaries(subjectId).find((s) => s.lecture === lecture);
}
