"use client";

import { ArrowLeft, CheckCircle2, Clock, FileText, Flag, Play } from "lucide-react";
import Link from "next/link";
import { createPaperExam } from "@/lib/exam";
import { paperItems, type Paper, type SubjectContent } from "@/lib/schema";
import { examScore, useApp } from "@/lib/store";
import { pct } from "@/lib/utils";
import { Button, Chip } from "./ui";

/** Punkte mit höchstens zwei Nachkommastellen, deutsch formatiert. */
export function fmtPoints(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString("de-DE");
}

export type PaperSlot = {
  part: number;
  partTitle: string;
  instructions: string;
  section: string;
  letter: string;
  points: number;
};

/** Frage-id → Position im Klausurbogen (Teil, Aufgabe, Teilfrage, Punkte). */
export function paperSlots(paper: Paper | undefined): Map<string, PaperSlot> {
  if (!paper) return new Map();
  return new Map(
    paperItems(paper).map((i) => {
      const part = paper.parts[i.part];
      return [
        i.q,
        {
          part: i.part,
          partTitle: part.title,
          instructions: part.instructions,
          section: part.sections[i.section].title,
          letter: i.letter,
          points: i.points,
        },
      ];
    }),
  );
}

/** Kurzlabel wie „Part B · Exercise 2 · b)“. */
export function slotLabel(s: PaperSlot): string {
  const part = s.partTitle.split(/\s[–:-]\s/)[0];
  return [part, s.section, s.letter && `${s.letter})`].filter(Boolean).join(" · ");
}

/** Erreichbare Punkte je Teil einer Klausur. */
function partPoints(paper: Paper) {
  const items = paperItems(paper);
  return paper.parts.map((p, i) => ({
    title: p.title,
    count: items.filter((x) => x.part === i).length,
    points: items.filter((x) => x.part === i).reduce((s, x) => s + x.points, 0),
  }));
}

/** Auswahl der Probeklausuren eines Fachs (ersetzt den zufälligen Abschlusstest). */
export function PaperList({ content }: { content: SubjectContent }) {
  const { subject, papers } = content;
  const startExam = useApp((s) => s.startExam);
  const allExams = useApp((s) => s.exams);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/s/${subject.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {subject.name}
      </Link>
      <p className="eyebrow mt-8">Probeklausuren · {subject.examFormat.name}</p>
      <h1 className="display text-4xl sm:text-5xl mt-2">Klausur schreiben</h1>
      <p className="mt-3 text-muted">
        {papers.length} vollständige Klausuren im Aufbau der Altklausuren – mit Fallbeschreibungen, Aufgaben in Teilfragen
        und Punkten. Kein Feedback bis zur Abgabe; danach siehst du deine Punkte pro Teil und jede Lösung.
      </p>

      <ul className="mt-6 space-y-2 text-sm text-ink-2">
        <li className="flex gap-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted" /> Achte auf „select all that apply“ (mehrere richtig) vs.
          „genau eine Antwort“. Multiple Choice gibt Punkte nur bei exakt richtiger Auswahl.
        </li>
        <li className="flex gap-2">
          <FileText className="mt-0.5 size-4 shrink-0 text-muted" /> Offene Aufgaben: Rechenweg zeigen. Sie werden anteilig bewertet
          (KI oder Selbstbewertung anhand der Kernpunkte).
        </li>
        <li className="flex gap-2">
          <Flag className="mt-0.5 size-4 shrink-0 text-muted" /> Unsichere Fragen markieren und vor der Abgabe zurückspringen.
        </li>
      </ul>

      <div className="mt-8 grid gap-4">
        {papers.map((p, i) => {
          const done = allExams.filter((e) => e.subjectId === subject.id && e.paper === p.id);
          const best = done.reduce((b, e) => Math.max(b, examScore(e).score), 0);
          const parts = partPoints(p);
          const max = parts.reduce((s, x) => s + x.points, 0);
          return (
            <div key={p.id} className="card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow">Klausur {i + 1}</p>
                  <h2 className="mt-1 text-lg font-semibold leading-snug">{p.title}</h2>
                  {p.subtitle && <p className="mt-1 text-sm text-muted">{p.subtitle}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {done.length > 0 && <Chip>Bestwert {fmtPoints(best * max)} / {fmtPoints(max)} P. · {pct(best)}</Chip>}
                </div>
              </div>
              <div className="mt-4 grid gap-1.5 text-sm">
                {parts.map((x) => (
                  <div key={x.title} className="flex justify-between gap-4 text-ink-2">
                    <span className="min-w-0 truncate">{x.title}</span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {x.count} Fragen · {fmtPoints(x.points)} P.
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button onClick={() => startExam(createPaperExam(subject.id, p, Date.now()))}>
                  <Play className="size-4" /> {done.length ? "Nochmal schreiben" : "Klausur starten"}
                </Button>
                <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                  <Clock className="size-4" /> {p.minutes} Min · {fmtPoints(max)} Punkte
                  {done.length > 0 && ` · ${done.length}× geschrieben`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
