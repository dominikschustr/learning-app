"use client";

import { Check, CheckCircle2, ChevronDown, Circle, FileText, Loader2, Sparkles, X } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import type { Case, MCQuestion, Question, ShortQuestion, TFQuestion } from "@/lib/schema";
import { SHORT_PASS, type OptionVerdict } from "@/lib/scoring";
import type { ShortGrade } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "./ui";

const VERB_LABEL = { define: "Define", state: "State", explain: "Explain", calculate: "Calculate" };

/** Liefert zu einer Frage ihre Fallbeschreibung (falls sie sich auf einen Fall bezieht). */
export function useCaseOf(cases: Case[]) {
  const byId = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);
  return useCallback((q: Question) => (q.case ? byId.get(q.case) : undefined), [byId]);
}

/** Fallbeschreibung mit Tabellen über einer Frage, wie in der Prüfung. */
export function CaseContext({ c }: { c: Case }) {
  return (
    <details open className="group mb-6 rounded-2xl border border-line bg-surface-2/60">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold">
        <FileText className="size-4 shrink-0 text-accent" />
        <span className="flex-1">{c.title}</span>
        <ChevronDown className="size-4 shrink-0 text-muted transition group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-line px-4 pb-4 pt-3 text-sm leading-relaxed text-ink-2">
        {c.text.map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
        {c.tables.map((t, i) => (
          <div key={i}>
            {t.caption && <p className="mb-1.5 font-semibold text-ink">{t.caption}</p>}
            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full min-w-max text-left text-[0.8rem] tabular-nums">
                <thead className="bg-accent/10 text-ink">
                  <tr>
                    {t.head.map((h, j) => (
                      <th key={j} className="px-3 py-2 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((r, j) => (
                    <tr key={j} className="border-t border-line even:bg-surface-2/50">
                      {r.map((cell, k) => (
                        <td key={k} className={cn("px-3 py-1.5", k === 0 && "font-medium text-ink")}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

export function QuestionMeta({ kind, extra }: { kind: "mc" | "tf" | "short"; extra?: React.ReactNode }) {
  const label = { mc: "Multiple Choice", tf: "True / False", short: "Kurzantwort" }[kind];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="eyebrow">{label}</span>
      {extra}
    </div>
  );
}

export function MCView({
  q,
  order,
  selected,
  onToggle,
  verdicts,
  context,
}: {
  q: MCQuestion;
  order: string[];
  selected: string[];
  onToggle?: (id: string) => void;
  verdicts?: Record<string, OptionVerdict> | null;
  context?: Case;
}) {
  const byId = new Map(q.options.map((o) => [o.id, o]));
  return (
    <div>
      {context && <CaseContext c={context} />}
      <QuestionMeta
        kind="mc"
        extra={
          <span className="text-xs text-muted">
            {q.single ? "· genau eine Antwort" : "· mehrere Antworten können richtig sein"}
          </span>
        }
      />
      <h2 className="mt-3 text-xl font-semibold leading-snug sm:text-2xl">{q.prompt}</h2>
      <div className="mt-6 grid gap-2.5">
        {order.map((id, i) => {
          const o = byId.get(id);
          if (!o) return null;
          const isSel = selected.includes(id);
          const v = verdicts?.[id];
          return (
            <button
              key={id}
              type="button"
              disabled={!onToggle || !!verdicts}
              onClick={() => onToggle?.(id)}
              aria-pressed={isSel}
              className={cn(
                "group flex w-full items-start gap-3 rounded-2xl border-2 bg-surface p-4 text-left transition",
                !verdicts && (isSel ? "border-accent bg-accent/5" : "border-line hover:border-line-strong"),
                v === "hit" && "border-good bg-good-soft",
                v === "wrong" && "border-bad bg-bad-soft",
                v === "missed" && "border-dashed border-good",
                v === "neutral" && "border-line opacity-60",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-6 shrink-0 place-items-center border-2 transition",
                  q.single ? "rounded-full" : "rounded-md",
                  isSel ? "border-transparent bg-accent text-white" : "border-line-strong",
                  v === "hit" && "bg-good",
                  v === "wrong" && "bg-bad",
                )}
              >
                {isSel && (v === "wrong" ? <X className="size-4" /> : <Check className="size-4" strokeWidth={3} />)}
              </span>
              <span className="flex-1">{o.text}</span>
              {v === "missed" && <span className="shrink-0 text-xs font-semibold text-good">übersehen</span>}
              {!verdicts && <span className="kbd hidden shrink-0 sm:inline-flex">{i + 1}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TFView({
  q,
  value,
  onChange,
  revealed,
  context,
}: {
  q: TFQuestion;
  value: boolean | null;
  onChange?: (v: boolean) => void;
  revealed?: boolean;
  context?: Case;
}) {
  return (
    <div>
      {context && <CaseContext c={context} />}
      <QuestionMeta kind="tf" />
      <h2 className="mt-3 text-xl font-semibold leading-snug sm:text-2xl">{q.statement}</h2>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {([true, false] as const).map((opt) => {
          const isSel = value === opt;
          const isRight = q.answer === opt;
          return (
            <button
              key={String(opt)}
              type="button"
              disabled={!onChange || revealed}
              onClick={() => onChange?.(opt)}
              className={cn(
                "flex h-20 items-center justify-center gap-2 rounded-2xl border-2 bg-surface text-lg font-semibold transition",
                !revealed && (isSel ? "border-accent bg-accent/5 text-accent" : "border-line hover:border-line-strong"),
                revealed && isRight && "border-good bg-good-soft text-good",
                revealed && isSel && !isRight && "border-bad bg-bad-soft text-bad",
                revealed && !isSel && !isRight && "border-line opacity-50",
              )}
            >
              {opt ? "True" : "False"}
              {!revealed && <span className="kbd hidden sm:inline-flex">{opt ? "T" : "F"}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ShortInput({
  q,
  text,
  onChange,
  disabled,
  context,
}: {
  q: ShortQuestion;
  text: string;
  onChange?: (t: string) => void;
  disabled?: boolean;
  context?: Case;
}) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div>
      {context && <CaseContext c={context} />}
      <QuestionMeta
        kind="short"
        extra={
          <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-accent">
            {VERB_LABEL[q.verb]}
          </span>
        }
      />
      <h2 className="mt-3 text-xl font-semibold leading-snug sm:text-2xl">{q.prompt}</h2>
      <textarea
        value={text}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        rows={6}
        placeholder="Deine Antwort – Englisch oder Deutsch …"
        className="mt-6 w-full resize-y rounded-2xl border-2 border-line bg-surface p-4 leading-relaxed outline-none transition placeholder:text-muted focus:border-accent disabled:opacity-70"
      />
      <p className="mt-1 text-right text-xs text-muted">{words} Wörter</p>
    </div>
  );
}

/** Ergebnis einer Kurzantwort: KI-Bewertung oder Selbstbewertung + Musterlösung. */
export function ShortResult({
  q,
  grade,
  pending,
  onSelfGrade,
}: {
  q: ShortQuestion;
  grade: ShortGrade | null;
  pending?: boolean;
  onSelfGrade?: (hit: string[]) => void;
}) {
  const [checked, setChecked] = useState<string[]>([]);

  return (
    <div className="space-y-4">
      {pending && (
        <div className="flex items-center gap-2 rounded-2xl bg-surface-2 p-4 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" /> Antwort wird bewertet …
        </div>
      )}

      {grade && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "rounded-2xl border p-4",
            grade.score >= SHORT_PASS ? "border-good/30 bg-good-soft" : "border-bad/30 bg-bad-soft",
          )}
        >
          <div className="flex items-center gap-3">
            <span className="display text-3xl tabular-nums">{grade.score}</span>
            <span className="text-sm">
              <span className="block font-semibold">
                {grade.score >= SHORT_PASS ? "Gut – zählt als richtig" : "Noch nicht ausreichend"}
              </span>
              <span className="flex items-center gap-1 text-muted">
                {grade.source === "ai" ? (
                  <>
                    <Sparkles className="size-3" /> KI-Bewertung
                  </>
                ) : (
                  "Selbstbewertung"
                )}
              </span>
            </span>
          </div>
          {grade.source === "ai" && <p className="mt-2 text-sm">{grade.feedback}</p>}
          <ul className="mt-3 space-y-1.5 text-sm">
            {q.keyPoints.map((k) => {
              const hit = grade.hit.includes(k);
              return (
                <li key={k} className="flex gap-2">
                  {hit ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-good" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-bad" />
                  )}
                  <span className={hit ? "" : "text-ink-2"}>{k}</span>
                </li>
              );
            })}
          </ul>
        </motion.div>
      )}

      {!grade && !pending && onSelfGrade && (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="font-semibold">Selbstbewertung</p>
          <p className="text-sm text-muted">
            Die KI-Bewertung ist gerade nicht verfügbar. Hake ab, welche Kernpunkte deine Antwort enthält.
          </p>
          <div className="mt-3 grid gap-2">
            {q.keyPoints.map((k) => {
              const on = checked.includes(k);
              return (
                <label key={k} className="flex cursor-pointer gap-3 rounded-xl border border-line p-3 text-sm hover:bg-surface-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-[var(--accent)]"
                    checked={on}
                    onChange={() => setChecked(on ? checked.filter((c) => c !== k) : [...checked, k])}
                  />
                  {k}
                </label>
              );
            })}
          </div>
          <Button className="mt-3" onClick={() => onSelfGrade(checked)}>
            Bewertung übernehmen
          </Button>
        </div>
      )}

      <details className="group rounded-2xl border border-line bg-surface p-4" open={!!grade}>
        <summary className="cursor-pointer text-sm font-semibold">Musterlösung</summary>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-2">{q.modelAnswer}</p>
      </details>
    </div>
  );
}

export function Explanation({ correct, text, partial }: { correct: boolean; text: string; partial?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-2xl border p-4",
        correct ? "border-good/30 bg-good-soft" : "border-bad/30 bg-bad-soft",
      )}
    >
      <p className={cn("flex items-center gap-2 font-semibold", correct ? "text-good" : "text-bad")}>
        {correct ? <CheckCircle2 className="size-5" /> : <X className="size-5" />}
        {correct ? "Richtig!" : "Nicht ganz."}
        {partial !== undefined && !correct && (
          <span className="text-sm font-normal text-ink-2">
            {Math.round(partial * 100)} % der Optionen richtig beurteilt
          </span>
        )}
      </p>
      {text && <p className="mt-2 text-sm leading-relaxed text-ink-2">{text}</p>}
    </motion.div>
  );
}
