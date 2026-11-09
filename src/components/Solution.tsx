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

const BASIS_ICON = { exam: ScrollText, slides: Presentation, case: BookOpenCheck };
/** Niveau gemessen an den Unterlagen: Wissensfrage wie im Folien-Quiz, Einzelfrage wie in der Klausur, ganzer Klausurteil */
const LEVEL = { 1: "Niveau Folien-Quiz", 2: "Niveau Klausurfrage", 3: "Niveau Klausur-Hauptaufgabe" } as const;

/** „Orientiert an“: Altklausur, Folien oder Übungsfall, dazu das Niveau der Aufgabe. */
export function BasisLine({ basis, difficulty }: { basis: Basis[]; difficulty?: number }) {
  if (!basis.length) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
      <span>Orientiert an</span>
      {basis.map((b, i) => {
        const Icon = BASIS_ICON[b.kind];
        return (
          <span key={i} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-ink-2">
            <Icon className="size-3 shrink-0" />
            {b.source}
            {b.ref && <span className="text-muted">· {b.ref}</span>}
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
