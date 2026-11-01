"use client";

import { Check, CheckCircle2, ChevronDown, Circle, FileText, Loader2, Sparkles, X } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import { checkResult, decodeCalc, encodeCalc, fmtResult, isCalc } from "@/lib/calc";
import type { Case, MCQuestion, Question, ShortQuestion, TFQuestion } from "@/lib/schema";
import { shortPassed, type OptionVerdict } from "@/lib/scoring";
import type { ShortGrade } from "@/lib/store";
import { cn } from "@/lib/utils";
import { FormulaText } from "./FormulaText";
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
    <details open className="group mb-4 rounded-2xl border border-line bg-surface-2/60 sm:mb-6">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold sm:px-4 sm:py-3">
        <FileText className="size-4 shrink-0 text-accent" />
        <span className="flex-1">{c.title}</span>
        <ChevronDown className="size-4 shrink-0 text-muted transition group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-line px-3 pb-3 pt-2.5 text-[13px] leading-relaxed text-ink-2 sm:space-y-4 sm:px-4 sm:pb-4 sm:pt-3 sm:text-sm">
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
        ))}
      </div>
    </details>
  );
}

export function QuestionMeta({
  kind,
  extra,
  label,
}: {
  kind: "mc" | "tf" | "short";
  extra?: React.ReactNode;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="eyebrow">{label ?? { mc: "Multiple Choice", tf: "True / False", short: "Kurzantwort" }[kind]}</span>
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
      <h2 className="mt-2 text-lg font-semibold leading-snug sm:mt-3 sm:text-2xl">{q.prompt}</h2>
      <div className="mt-4 grid gap-2 sm:mt-6 sm:gap-2.5">
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
                "group flex w-full items-start gap-3 rounded-2xl border-2 bg-surface p-3 text-left text-[15px] transition sm:p-4 sm:text-base",
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
      <h2 className="mt-2 text-lg font-semibold leading-snug sm:mt-3 sm:text-2xl">{q.statement}</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-6">
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
                "flex h-16 items-center justify-center gap-2 rounded-2xl border-2 bg-surface text-lg font-semibold transition sm:h-20",
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
  if (isCalc(q)) return <CalcInput q={q} text={text} onChange={onChange} disabled={disabled} context={context} />;
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
      <h2 className="mt-2 text-lg font-semibold leading-snug sm:mt-3 sm:text-2xl">{q.prompt}</h2>
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

/** Rechenaufgabe: ein Feld je Ergebnis, darunter optional der eigene Rechenweg. */
function CalcInput({
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
  const answer = decodeCalc(text, q.results.length);
  const set = (patch: Partial<typeof answer>) => onChange?.(encodeCalc({ ...answer, ...patch }));
  return (
    <div>
      {context && <CaseContext c={context} />}
      <QuestionMeta
        kind="short"
        label="Rechenaufgabe"
        extra={<span className="text-xs text-muted max-sm:hidden">· Ergebnisse werden automatisch geprüft</span>}
      />
      <h2 className="mt-2 whitespace-pre-line text-base font-semibold leading-snug sm:mt-3 sm:text-xl">
        <FormulaText text={q.prompt} />
      </h2>
      <div className="mt-4 grid gap-2 sm:mt-6 sm:gap-2.5">
        {q.results.map((r, i) => (
          <label
            key={r.label}
            className="flex items-center gap-3 rounded-2xl border-2 border-line bg-surface p-2.5 pl-3 transition focus-within:border-accent sm:gap-4 sm:p-3"
          >
            <FormulaText text={r.label} className="flex-1 text-sm font-medium" />
            <span className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={answer.values[i]}
                disabled={disabled}
                onChange={(e) => set({ values: answer.values.map((v, j) => (j === i ? e.target.value : v)) })}
                placeholder="Ergebnis"
                className="w-28 rounded-xl border border-line bg-surface-2 px-3 py-2 text-right tabular-nums outline-none placeholder:text-muted focus:border-accent disabled:opacity-70 sm:w-36"
              />
              <span className="w-7 shrink-0 text-sm text-muted sm:w-10">{r.unit}</span>
            </span>
          </label>
        ))}
      </div>
      <textarea
        value={answer.work}
        onChange={(e) => set({ work: e.target.value })}
        disabled={disabled}
        rows={3}
        placeholder="Rechenweg (optional, nur für dich) …"
        className="mt-3 w-full resize-y rounded-2xl border-2 border-line bg-surface p-4 text-sm leading-relaxed outline-none transition placeholder:text-muted focus:border-accent disabled:opacity-70"
      />
      <p className="mt-1 text-xs text-muted">
        Prozent als Prozentzahl (13,8) oder Dezimalzahl (0,138). Kleine Rundungsabweichungen zählen als richtig.
      </p>
    </div>
  );
}

/** Eingegebene Ergebnisse neben der Lösung, je Zeile richtig oder falsch. */
function CalcCheck({ q, answer }: { q: ShortQuestion; answer: string }) {
  const { values } = decodeCalc(answer, q.results.length);
  return (
    <ul className="mt-3 divide-y divide-line/70 text-sm">
      {q.results.map((r, i) => {
        const ok = checkResult(r, values[i]);
        return (
          <li key={r.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            {ok ? <CheckCircle2 className="size-4 shrink-0 text-good" /> : <X className="size-4 shrink-0 text-bad" />}
            <FormulaText text={r.label} className="min-w-0 flex-1" />
            <span className="tabular-nums">
              {!ok && <span className="mr-2 text-ink-2 line-through">{values[i].trim() || "—"}</span>}
              <span className="font-semibold">{fmtResult(r)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Was in der Auswertung unter „Deine Antwort“ steht: bei Rechenaufgaben nur der Rechenweg. */
export function answerText(q: ShortQuestion, text: string): string {
  return isCalc(q) ? decodeCalc(text, q.results.length).work : text;
}

/** Ergebnis einer Kurzantwort: KI-Bewertung oder Selbstbewertung + Musterlösung. */
export function ShortResult({
  q,
  grade,
  pending,
  onSelfGrade,
  answer = "",
}: {
  q: ShortQuestion;
  grade: ShortGrade | null;
  pending?: boolean;
  onSelfGrade?: (hit: string[]) => void;
  /** eigene Antwort, für den Abgleich der Ergebnisse bei Rechenaufgaben */
  answer?: string;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const calc = isCalc(q);

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
            shortPassed(grade) ? "border-good/30 bg-good-soft" : "border-bad/30 bg-bad-soft",
          )}
        >
          <div className="flex items-center gap-3">
            <span className="display text-3xl tabular-nums">{grade.score}</span>
            <span className="text-sm">
              <span className="block font-semibold">
                {shortPassed(grade)
                  ? calc
                    ? "Alle Ergebnisse richtig"
                    : "Gut – zählt als richtig"
                  : calc
                    ? "Noch nicht alle Ergebnisse richtig"
                    : "Noch nicht ausreichend"}
              </span>
              <span className="flex items-center gap-1 text-muted">
                {grade.source === "ai" ? (
                  <>
                    <Sparkles className="size-3" /> KI-Bewertung
                  </>
                ) : grade.source === "auto" ? (
                  "Automatisch geprüft"
                ) : (
                  "Selbstbewertung"
                )}
              </span>
            </span>
          </div>
          {grade.source === "ai" && <p className="mt-2 text-sm">{grade.feedback}</p>}
          {calc ? (
            <CalcCheck q={q} answer={answer} />
          ) : (
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
          )}
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
        <summary className="cursor-pointer text-sm font-semibold">{calc ? "Lösungsweg" : "Musterlösung"}</summary>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-2">
          {calc ? <FormulaText text={q.modelAnswer} /> : q.modelAnswer}
        </p>
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
