"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Eye, EyeOff, FileCheck2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Subject } from "@/lib/schema";
import type { RenderedFormula } from "@/lib/tex";
import { alpha, cn } from "@/lib/utils";
import { FormulaText } from "./FormulaText";
import { Button } from "./ui";

type Filter = "all" | "memorize";

/** Formelübersicht eines Fachs nach Kapiteln – mit Abfrage-Modus, der die Formeln verdeckt. */
export function FormulaOverview({ subject, formulas }: { subject: Subject; formulas: RenderedFormula[] }) {
  const [quiz, setQuiz] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState<Set<string>>(new Set());
  const base = `/s/${subject.id}`;
  const visible = formulas.filter((f) => filter === "all" || !f.sheet);
  const chapters = subject.lectures.filter((l) => visible.some((f) => f.lecture === l.id));
  const onSheet = formulas.filter((f) => f.sheet).length;

  // Die Seite erscheint erst nach der Anmeldung – den Anker (#l3) daher selbst ansteuern
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash) document.getElementById(hash)?.scrollIntoView();
  }, []);

  const toggle = (id: string) =>
    setShown((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={base} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {subject.name}
      </Link>

      <header className="mt-8">
        <p className="eyebrow">Formelübersicht · {formulas.length} Formeln</p>
        <h1 className="display mt-2 text-4xl sm:text-5xl">Die wichtigsten Formeln je Kapitel</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Je Formel: wann du sie brauchst, was die Symbole bedeuten und die typische Falle. {onSheet} von{" "}
          {formulas.length} stehen auf dem Formelblatt der Klausur, den Rest musst du selbst können. Im Abfrage-Modus
          sind die Formeln verdeckt – erst aufschreiben, dann aufdecken.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Segmented
            value={quiz}
            onChange={(q) => {
              setQuiz(q);
              setShown(new Set());
            }}
            options={[
              [false, "Lernen", Eye],
              [true, "Abfragen", EyeOff],
            ]}
          />
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              ["all", "Alle", null],
              ["memorize", "Nur auswendig", null],
            ]}
          />
        </div>
      </header>

      <nav className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 mt-8 flex gap-2 overflow-x-auto border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-full sm:border sm:px-2 sm:py-1.5">
        {chapters.map((l) => (
          <a
            key={l.id}
            href={`#${l.id}`}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-2"
          >
            {l.title.split(" · ")[0]}
          </a>
        ))}
      </nav>

      <div className="mt-12 space-y-16">
        {chapters.map((l) => {
          const [code, ...rest] = l.title.split(" · ");
          const list = visible.filter((f) => f.lecture === l.id);
          return (
            <section key={l.id} id={l.id} className="scroll-mt-32">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">{code}</p>
                  <h2 className="display text-3xl">{rest.join(" · ") || l.title}</h2>
                </div>
                <Link
                  href={`${base}/practice?mode=lecture&lecture=${l.id}`}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink"
                >
                  Aufgaben rechnen <ArrowRight className="size-4" />
                </Link>
              </div>
              <div className="mt-6 space-y-4">
                {list.map((f) => (
                  <FormulaCard
                    key={f.id}
                    f={f}
                    color={subject.color}
                    hidden={quiz && !shown.has(f.id)}
                    quiz={quiz}
                    onToggle={() => toggle(f.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Segmented<T extends string | boolean>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string, typeof Eye | null][];
}) {
  return (
    <div className="inline-flex rounded-full border border-line-strong bg-surface p-1">
      {options.map(([v, label, Icon]) => (
        <button
          key={label}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition",
            value === v ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2",
          )}
        >
          {Icon && <Icon className="size-4" />} {label}
        </button>
      ))}
    </div>
  );
}

function FormulaCard({
  f,
  color,
  hidden,
  quiz,
  onToggle,
}: {
  f: RenderedFormula;
  color: string;
  hidden: boolean;
  quiz: boolean;
  onToggle: () => void;
}) {
  return (
    <article id={f.id} className="card scroll-mt-32 p-5 sm:p-6">
      <FormulaHeading f={f} color={color} />

      {hidden ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-line-strong p-4">
          <span className="flex-1 text-sm text-ink-2">Schreib die Formel auf, dann aufdecken.</span>
          <Button variant="secondary" onClick={onToggle}>
            <Eye className="size-4" /> Aufdecken
          </Button>
        </div>
      ) : (
        <>
          <FormulaDetails f={f} color={color} />
          {quiz && (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" onClick={onToggle}>
                <EyeOff className="size-4" /> Wieder verdecken
              </Button>
            </div>
          )}
        </>
      )}
    </article>
  );
}

/** Name der Formel mit Kennzeichnung (Formelblatt / auswendig) und Einsatzzweck. */
export function FormulaHeading({ f, color }: { f: RenderedFormula; color: string }) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg font-semibold">{f.name}</h3>
        <SheetBadge sheet={f.sheet} color={color} />
      </div>
      {f.use && <FormulaText text={f.use} className="mt-1 block text-sm leading-relaxed text-ink-2" />}
    </>
  );
}

export function SheetBadge({ sheet, color }: { sheet: boolean; color: string }) {
  return sheet ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-muted">
      <FileCheck2 className="size-3.5" /> Formelblatt
    </span>
  ) : (
    <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: alpha(color, 0.1), color }}>
      auswendig
    </span>
  );
}

/** Gesetzte Formel, Bedeutung jedes Symbols und die typische Falle. */
export function FormulaDetails({ f, color }: { f: RenderedFormula; color: string }) {
  return (
    <>
      <FittedFormula html={f.html} background={alpha(color, 0.06)} />
      <dl className="mt-4 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-sm">
        {f.vars.map((v) => (
          <div key={v.symbol} className="contents">
            <dt className="text-right text-base text-ink" dangerouslySetInnerHTML={{ __html: v.html }} />
            <dd className="leading-relaxed text-ink-2">
              <FormulaText text={v.meaning} />
            </dd>
          </div>
        ))}
      </dl>
      {f.pitfall && (
        <p className="mt-3 flex gap-2 text-sm leading-relaxed text-ink-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-bad" />
          <FormulaText text={f.pitfall} />
        </p>
      )}
    </>
  );
}

/** Formel im getönten Kasten; ist sie breiter als der Platz (Handy), wird sie bis auf 70 % verkleinert, danach scrollt sie. */
function FittedFormula({ html, background }: { html: string; background: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "";
      const s = getComputedStyle(el);
      const pad = parseFloat(s.paddingLeft) + parseFloat(s.paddingRight);
      const ratio = (el.clientWidth - pad) / (el.scrollWidth - pad);
      if (ratio < 1) el.style.fontSize = `${parseFloat(s.fontSize) * Math.max(ratio * 0.98, 0.7)}px`;
    };
    fit();
    void document.fonts.ready.then(fit);
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [html]);
  return (
    <div
      ref={ref}
      className="formula mt-4 overflow-x-auto rounded-2xl px-3 py-1 text-[0.95rem] sm:px-6 sm:py-2 sm:text-xl"
      style={{ background }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
