import { AlertTriangle, BookOpenCheck, Presentation, ScrollText } from "lucide-react";
import type { Basis, Step, Table } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { FormulaText } from "./FormulaText";

/** Tabelle wie in der Prüfung (Fallbeschreibung oder Lösungsschritt). */
export function DataTable({ t, compact }: { t: Table; compact?: boolean }) {
  return (
    <div>
      {t.caption && <p className="mb-1.5 font-semibold text-ink">{t.caption}</p>}
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className={cn("w-full min-w-max text-left tabular-nums", compact ? "text-[0.78rem]" : "text-[0.8rem]")}>
          <thead className="bg-accent/10 text-ink">
            <tr>
              {t.head.map((h, j) => (
                <th key={j} className="px-2.5 py-1.5 font-semibold sm:px-3 sm:py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r, j) => (
              <tr key={j} className="border-t border-line even:bg-surface-2/50">
                {r.map((cell, k) => (
                  <td key={k} className={cn("px-2.5 py-1 sm:px-3 sm:py-1.5", k === 0 && "font-medium text-ink")}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Ausführlicher Lösungsweg: nummerierte Schritte mit Begründung, Rechnung, Tabelle und Ergebnis. */
export function SolutionSteps({ steps, pitfalls = [] }: { steps: Step[]; pitfalls?: string[] }) {
  return (
    <div className="space-y-3 text-sm">
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="rounded-xl border border-line bg-surface-2/40 p-3 sm:p-4">
            <p className="flex items-start gap-2.5 font-semibold leading-snug text-ink">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent">
                {i + 1}
              </span>
              <span className="pt-0.5">{s.title}</span>
            </p>
            <div className="mt-2 space-y-2.5 sm:pl-[2.125rem]">
              {s.why && <FormulaText text={s.why} className="block leading-relaxed text-ink-2" />}
              {s.lines.length > 0 && (
                <div className="space-y-1 overflow-x-auto rounded-lg border border-line bg-surface px-3 py-2 text-[13px] tabular-nums leading-relaxed text-ink">
                  {s.lines.map((l, j) => (
                    <p key={j} className={cn(l.startsWith("  ") && "pl-4 text-ink-2")}>
                      <FormulaText text={l.trim()} />
                    </p>
                  ))}
                </div>
              )}
              {s.table && <DataTable t={s.table} compact />}
              {s.result && (
                <p className="rounded-lg bg-good-soft px-3 py-1.5 font-semibold text-ink">
                  → <FormulaText text={s.result} />
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {pitfalls.length > 0 && (
        <div className="rounded-xl border border-bad/25 bg-bad-soft p-3 sm:p-4">
          <p className="flex items-center gap-2 font-semibold text-bad">
            <AlertTriangle className="size-4" /> Typische Fehler
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 leading-relaxed text-ink-2">
            {pitfalls.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Art der Quelle: Symbol, Bezeichnung und Farbe (Folien blau, Altklausur orange, Übung violett). */
const BASIS_KIND = {
  slides: {
    Icon: Presentation,
    label: "Folien",
    cls: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-100",
    tag: "bg-sky-600 text-white dark:bg-sky-400 dark:text-sky-950",
  },
  exam: {
    Icon: ScrollText,
    label: "Altklausur",
    cls: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100",
    tag: "bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950",
  },
  case: {
    Icon: BookOpenCheck,
    label: "Übung",
    cls: "border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-400/40 dark:bg-violet-400/10 dark:text-violet-100",
    tag: "bg-violet-600 text-white dark:bg-violet-400 dark:text-violet-950",
  },
} as const;
/** Niveau gemessen an den Unterlagen: Wissensfrage wie im Folien-Quiz, Einzelfrage wie in der Klausur, ganzer Klausurteil */
const LEVEL = { 1: "Niveau Folien-Quiz", 2: "Niveau Klausurfrage", 3: "Niveau Klausur-Hauptaufgabe" } as const;

/** „Orientiert an“: Altklausur, Folien oder Übungsfall, dazu das Niveau der Aufgabe. */
export function BasisLine({ basis, difficulty }: { basis: Basis[]; difficulty?: number }) {
  if (!basis.length) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
      <span>Orientiert an</span>
      {basis.map((b, i) => {
        const k = BASIS_KIND[b.kind];
        // „Folien L3“ → Etikett „Folien“ + „L3“; sonst Quelle vollständig zeigen
        const rest = b.source.startsWith(`${k.label} `) ? b.source.slice(k.label.length + 1) : b.source;
        return (
          <span
            key={i}
            className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5", k.cls)}
          >
            <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-semibold", k.tag)}>
              <k.Icon className="size-3 shrink-0" />
              {k.label}
            </span>
            <span className="min-w-0">
              <span className="font-medium">{rest}</span>
              {b.ref && <span className="opacity-75"> · {b.ref}</span>}
            </span>
          </span>
        );
      })}
      {difficulty !== undefined && (
        <span className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5">
          <span className="flex gap-0.5" aria-hidden>
            {[1, 2, 3].map((d) => (
              <span key={d} className={cn("size-1.5 rounded-full", d <= difficulty ? "bg-accent" : "bg-line")} />
            ))}
          </span>
          {LEVEL[difficulty as 1 | 2 | 3]}
        </span>
      )}
    </div>
  );
}
