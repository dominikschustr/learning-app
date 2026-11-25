"use client";

import { ArrowLeft, Eye, EyeOff, Lightbulb } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Casebook, Subject } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { SlideFrame, TitleSlide } from "./Slide";
import { Button } from "./ui";

type Case = Casebook[number]["cases"][number];

const KIND = {
  class: { label: "Fall im Unterricht", cls: "bg-[#3b2182] text-white" },
  prep: { label: "Vorbereitungslektüre", cls: "bg-[#2f4b76] text-white" },
  exam: { label: "Altklausur", cls: "bg-[#b0124f] text-white" },
};

/** Alle Case Studies eines Fachs, nach Vorlesung – mit Abfrage-Modus, der die Musterantworten verdeckt. */
export function CasebookView({
  subject,
  casebook,
  frameworks,
}: {
  subject: Subject;
  casebook: Casebook;
  /** Framework-id → Name, für die Verweise auf die Framework-Folien */
  frameworks: Record<string, string>;
}) {
  const [quiz, setQuiz] = useState(false);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const base = `/s/${subject.id}`;
  const total = casebook.reduce((n, g) => n + g.cases.length, 0);

  // Die Seite erscheint erst nach der Anmeldung – den Anker selbst ansteuern
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash) document.getElementById(hash)?.scrollIntoView();
  }, []);

  const toggle = (key: string) =>
    setShown((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={base} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {subject.name}
      </Link>

      <header className="mt-8">
        <p className="eyebrow">Case Studies · {total} Fälle</p>
        <h1 className="display mt-2 text-4xl sm:text-5xl">Alle Cases der Vorlesung</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Jeder Fall aus dem Unterricht und aus den Altklausuren: worum es geht, die Fragen, eine Musterantwort aus den
          Kurskonzepten und die Frameworks, mit denen du argumentierst. Im Abfrage-Modus sind die Antworten verdeckt.
        </p>
        <div className="mt-5 inline-flex rounded-full border border-line-strong bg-surface p-1">
          {([
            [false, "Lesen", Eye],
            [true, "Abfragen", EyeOff],
          ] as const).map(([q, label, Icon]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setQuiz(q);
                setShown(new Set());
              }}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition",
                quiz === q ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      </header>

      <nav className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 mt-8 flex gap-2 overflow-x-auto border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-full sm:border sm:px-2 sm:py-1.5">
        {casebook.map((g) => (
          <a key={g.id} href={`#${g.id}`} className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-2">
            {g.title.split(" · ")[0]}
          </a>
        ))}
      </nav>

      <section className="card mt-8 p-5 sm:p-6">
        <p className="eyebrow">Auf einen Blick</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {casebook.map((g) => (
            <div key={g.id} className="min-w-0">
              <a href={`#${g.id}`} className="text-xs font-bold" style={{ color: subject.color }}>
                {g.title}
              </a>
              <ul className="mt-1.5 space-y-0.5">
                {g.cases.map((c) => (
                  <li key={c.id}>
                    <a href={`#${c.id}`} className="text-sm text-ink-2 hover:text-ink hover:underline">
                      {c.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-12 space-y-16">
        {casebook.map((g) => (
          <section key={g.id} id={g.id} className="scroll-mt-32">
            <TitleSlide
              eyebrow={`${g.title.split(" · ")[0]} · ${g.cases.length} ${g.cases.length === 1 ? "Fall" : "Fälle"}`}
              title={g.title.split(" · ").slice(1).join(" · ") || g.title}
              subtitle={g.subtitle || undefined}
              footer={subject.name}
            />
            <div className="mt-5 space-y-5">
              {g.cases.map((c) => (
                <CaseSlide
                  key={c.id}
                  c={c}
                  base={base}
                  frameworks={frameworks}
                  quiz={quiz}
                  shown={shown}
                  onToggle={toggle}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function CaseSlide({
  c,
  base,
  frameworks,
  quiz,
  shown,
  onToggle,
}: {
  c: Case;
  base: string;
  frameworks: Record<string, string>;
  quiz: boolean;
  shown: Set<string>;
  onToggle: (key: string) => void;
}) {
  const kind = KIND[c.kind];
  return (
    <SlideFrame id={c.id} title={c.title}>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide", kind.cls)}>
          {kind.label}
        </span>
        {c.tag && <span className="text-xs font-semibold text-muted">{c.tag}</span>}
      </div>

      {c.situation.length > 0 && (
        <div className="mt-4 rounded-md border-l-4 border-[#fec33f] bg-[#fec33f]/15 p-4">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-muted">Situation</p>
          <div className="mt-1.5 space-y-2 text-[0.95rem] leading-relaxed text-ink">
            {c.situation.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      )}

      <ol className="mt-5 space-y-5">
        {c.questions.map((q, i) => {
          const key = `${c.id}-${i}`;
          const hidden = quiz && !shown.has(key);
          return (
            <li key={i}>
              <p className="flex gap-2 font-semibold leading-snug text-ink">
                <span className="tabular-nums">{c.questions.length > 1 ? `${i + 1}.` : "→"}</span>
                <span>
                  {q.q}
                  {q.points !== undefined && <span className="ml-1.5 text-sm font-medium text-muted">({q.points} pts)</span>}
                </span>
              </p>
              {hidden ? (
                <div className="mt-2 flex flex-wrap items-center gap-3 rounded-md border border-dashed border-line-strong p-3">
                  <span className="flex-1 text-sm text-ink-2">Erst selbst gliedern: Problem, Theorie, Fakten aus dem Fall, Empfehlung.</span>
                  <Button variant="secondary" onClick={() => onToggle(key)}>
                    <Eye className="size-4" /> Aufdecken
                  </Button>
                </div>
              ) : (
                <ul className="mt-2 space-y-1.5 border-l-2 border-line pl-4 text-[0.92rem] leading-relaxed text-ink-2">
                  {q.answer.map((a, j) => (
                    <li key={j}>
                      <Lead text={a} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      {c.frameworks.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-muted">Frameworks</span>
          {c.frameworks.map((f) =>
            frameworks[f] ? (
              <Link
                key={f}
                href={`${base}/frameworks#${f}`}
                className="rounded-md border border-[#3b2182]/30 bg-[#3b2182]/5 px-2 py-0.5 text-xs font-semibold text-ink hover:bg-[#3b2182]/10"
              >
                {frameworks[f]}
              </Link>
            ) : (
              <span key={f} className="rounded-md border border-line px-2 py-0.5 text-xs font-medium text-ink-2">
                {f}
              </span>
            ),
          )}
        </div>
      )}

      {c.takeaway && (
        <p className="mt-4 flex gap-2 rounded-md bg-surface-2 p-3 text-sm font-medium leading-relaxed text-ink">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-[#c08a00]" />
          {c.takeaway}
        </p>
      )}
    </SlideFrame>
  );
}

/** Hebt „Begriff:“ am Anfang einer Zeile hervor. */
function Lead({ text }: { text: string }) {
  const m = text.match(/^([^:]{2,48}):\s+(.*)$/);
  if (!m) return <>{text}</>;
  return (
    <>
      <strong className="font-semibold text-ink">{m[1]}:</strong> {m[2]}
    </>
  );
}
