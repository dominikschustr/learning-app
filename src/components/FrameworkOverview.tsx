"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Eye, EyeOff, ListChecks, Presentation } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Framework, Subject } from "@/lib/schema";
import { alpha, cn } from "@/lib/utils";
import { FrameworkVisual, visualCount } from "./FrameworkVisual";
import { Button } from "./ui";

/** Alle Framework-Steckbriefe eines Fachs, nach Kapiteln – mit Abfrage-Modus, der die Bausteine verdeckt. */
export function FrameworkOverview({ subject, frameworks }: { subject: Subject; frameworks: Framework[] }) {
  const [quiz, setQuiz] = useState(false);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const base = `/s/${subject.id}`;
  const chapters = subject.lectures.filter((l) => frameworks.some((f) => f.lecture === l.id));

  // Die Seite erscheint erst nach der Anmeldung – den Anker (#f3) daher selbst ansteuern
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
  const setMode = (q: boolean) => {
    setQuiz(q);
    setShown(new Set());
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={base} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {subject.name}
      </Link>

      <header className="mt-8">
        <p className="eyebrow">Framework-Übersicht · {frameworks.length} Frameworks</p>
        <h1 className="display mt-2 text-4xl sm:text-5xl">Alle Frameworks auf einen Blick</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Je Framework: wozu es dient, die Bausteine zum Auswendiglernen, das Vorgehen im Case, typische Fehler und das
          Beispiel aus den Slides. Im Abfrage-Modus sind die Bausteine verdeckt – erst selbst aufsagen, dann aufdecken.
        </p>
        <div className="mt-5 inline-flex rounded-full border border-line-strong bg-surface p-1">
          {([
            [false, "Lernen", Eye],
            [true, "Abfragen", EyeOff],
          ] as const).map(([q, label, Icon]) => (
            <button
              key={label}
              type="button"
              onClick={() => setMode(q)}
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

      <nav className="sticky top-14 z-20 -mx-4 mt-8 flex gap-2 overflow-x-auto border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-full sm:border sm:px-2 sm:py-1.5">
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

      <section className="card mt-8 p-5 sm:p-6">
        <p className="eyebrow">Auf einen Blick</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {chapters.map((l) => (
            <div key={l.id} className="min-w-0">
              <a href={`#${l.id}`} className="text-xs font-bold" style={{ color: subject.color }}>
                {l.title.split(" · ")[0]} · {l.title.split(" · ").slice(1).join(" · ")}
              </a>
              <ul className="mt-1.5 space-y-0.5">
                {frameworks
                  .filter((f) => f.lecture === l.id)
                  .map((f) => (
                    <li key={f.id}>
                      <a href={`#${f.id}`} className="text-sm text-ink-2 hover:text-ink hover:underline">
                        {f.name}
                      </a>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-12 space-y-16">
        {chapters.map((l) => {
          const [code, ...rest] = l.title.split(" · ");
          const list = frameworks.filter((f) => f.lecture === l.id);
          return (
            <section key={l.id} id={l.id} className="scroll-mt-32">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">{code}</p>
                  <h2 className="display text-3xl">{rest.join(" · ") || l.title}</h2>
                </div>
                <Link
                  href={`${base}/c/${l.id}`}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink"
                >
                  Im Case anwenden <ArrowRight className="size-4" />
                </Link>
              </div>
              <div className="mt-6 space-y-5">
                {list.map((f) => (
                  <FrameworkCard
                    key={f.id}
                    f={f}
                    color={subject.color}
                    hidden={quiz && !shown.has(f.id)}
                    onReveal={() => toggle(f.id)}
                    quiz={quiz}
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

function FrameworkCard({
  f,
  color,
  hidden,
  quiz,
  onReveal,
}: {
  f: Framework;
  color: string;
  hidden: boolean;
  quiz: boolean;
  onReveal: () => void;
}) {
  const shownInVisual = visualCount(f);
  const rest = f.parts.slice(shownInVisual);
  return (
    <article id={f.id} className="card scroll-mt-32 p-5 sm:p-6" style={{ borderTop: `4px solid ${color}` }}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-xl font-semibold">{f.name}</h3>
        {f.origin && <span className="text-sm text-muted">{f.origin}</span>}
      </div>
      <p className="mt-2 leading-relaxed text-ink-2">{f.purpose}</p>

      {f.visual && <FrameworkVisual parts={f.parts.slice(0, shownInVisual)} visual={f.visual} color={color} hidden={hidden} />}

      {hidden ? (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-line-strong p-4">
          <span className="flex-1 text-sm text-ink-2">
            {f.visual
              ? "Füll das Diagramm im Kopf aus (mit Unterpunkten), dann aufdecken."
              : `${f.parts.length} Bausteine – sag sie auf (mit Unterpunkten), dann aufdecken.`}
          </span>
          <Button variant="secondary" onClick={onReveal}>
            <Eye className="size-4" /> Aufdecken
          </Button>
        </div>
      ) : (
        <>
          {rest.length > 0 && (
            <div className={cn("mt-5 grid gap-3", rest.length > 1 && "sm:grid-cols-2")}>
              {rest.map((p, i) => (
                <div key={i} className="rounded-2xl p-4" style={{ background: alpha(color, 0.06) }}>
                  <p className="font-semibold" style={{ color }}>
                    {p.label}
                  </p>
                  {p.points.length > 0 && (
                    <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink-2">
                      {p.points.map((pt, j) => (
                        <li key={j} className="flex gap-2">
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-ink-2" />
                          {pt}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {f.apply.length > 0 && (
            <div className="mt-5">
              <p className="eyebrow flex items-center gap-2">
                <ListChecks className="size-3.5" /> Im Case anwenden
              </p>
              <ol className="mt-2 space-y-1.5 text-sm leading-relaxed">
                {f.apply.map((a, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="font-semibold tabular-nums" style={{ color }}>
                      {i + 1}.
                    </span>
                    {a}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {f.pitfalls.length > 0 && (
            <div className="mt-5">
              <p className="eyebrow flex items-center gap-2">
                <AlertTriangle className="size-3.5" /> Fallen
              </p>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink-2">
                {f.pitfalls.map((p, i) => (
                  <li key={i}>– {p}</li>
                ))}
              </ul>
            </div>
          )}

          {f.example && (
            <div className="mt-5 flex gap-3 rounded-2xl bg-surface-2 p-4 text-sm leading-relaxed">
              <Presentation className="mt-0.5 size-4 shrink-0 text-muted" />
              <p>
                <span className="font-semibold">Beispiel aus den Slides: </span>
                {f.example}
              </p>
            </div>
          )}

          {quiz && (
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={onReveal}>
                <EyeOff className="size-4" /> Wieder verdecken
              </Button>
            </div>
          )}
        </>
      )}
    </article>
  );
}
