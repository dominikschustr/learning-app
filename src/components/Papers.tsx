"use client";

import { ArrowLeft, CheckCircle2, ChevronDown, Clock, FileText, Flag, History, Info, LayoutList, Play, Table2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createPaperExam } from "@/lib/exam";
import { paperItems, type Paper, type Question, type SubjectContent } from "@/lib/schema";
import { itemStatus } from "@/lib/srs";
import { examScore, useApp } from "@/lib/store";
import { cn, itemKey, pct } from "@/lib/utils";
import { PaperTasks, rowsOf, SelectionBar, STATUS, TaskTable } from "./PaperTasks";
import { Bar, Button, Chip } from "./ui";

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

/** „2 Nachbauten von Altklausuren · 3 neue Klausuren“ für die Fach-Übersicht. */
export function paperCountLabel(papers: { kind: Paper["origin"]["kind"] }[]): string {
  const alt = papers.filter((p) => p.kind === "altklausur").length;
  const neu = papers.length - alt;
  return [
    alt && `${alt} ${alt === 1 ? "Nachbau einer Altklausur" : "Nachbauten von Altklausuren"}`,
    neu && `${neu} ${neu === 1 ? "neue Klausur" : "neue Klausuren"}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Label, ob eine Klausur einer echten Altklausur nachgebaut oder neu ist. */
export function OriginChip({ paper }: { paper: Paper }) {
  const { kind, faithful } = paper.origin;
  if (kind === "neu") return <Chip>Neu · eigene Klausur</Chip>;
  return (
    <Chip className={faithful ? "border-good/30 bg-good-soft text-good" : "border-warn/30 bg-warn-soft text-warn"}>
      <History className="size-3.5" /> Nachbau · {faithful ? "nah am Original" : "angepasst"}
    </Chip>
  );
}

/** Auswahl der Probeklausuren eines Fachs (ersetzt den zufälligen Abschlusstest). */
export function PaperList({ content }: { content: SubjectContent }) {
  const { subject, papers } = content;
  const startExam = useApp((s) => s.startExam);
  const allExams = useApp((s) => s.exams);
  const hasCalc = content.questions.some((q) => q.type === "short" && q.results.length > 0);
  // Reihenfolge wie angezeigt: erst Nachbauten von Altklausuren, dann neue Klausuren
  const shown = [...papers.filter((p) => p.origin.kind === "altklausur"), ...papers.filter((p) => p.origin.kind !== "altklausur")];
  // Ansicht: ganze Klausuren oder alle Aufgaben einzeln als Tabelle (?view=tasks, damit „Zurück“ aus dem Üben hierher führt)
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view = params.get("view") === "tasks" ? "tasks" : "papers";
  const items = useApp((s) => s.items);
  const byId = useMemo(() => new Map(content.questions.map((q) => [q.id, q])), [content.questions]);
  const st = (q: Question) => itemStatus(items[itemKey(subject.id, q.id)]);
  // Aufgaben einzelner Klausuren auswählen und üben (eine Auswahl über alle Karten)
  const [selected, setSelected] = useState<string[]>([]);
  // aus dem Üben zurück (?open=<id>): Aufgabenliste dieser Klausur gleich aufgeklappt
  const [openTasks, setOpenTasks] = useState<string[]>(() => [params.get("open") ?? ""].filter(Boolean));
  const sel = new Set(selected);
  const toggle = (ids: string[], on: boolean) =>
    setSelected((cur) => (on ? [...new Set([...cur, ...ids])] : cur.filter((id) => !ids.includes(id))));
  // „Zurück“ aus dem Üben führt zur Karte der Klausur (#paper-<id>)
  const practiceHref = (paperId: string) => (ids: string[]) =>
    `/s/${subject.id}/practice?mode=papers&q=${ids.join(",")}&paper=${paperId}`;
  const selOrder = shown.flatMap((p) => paperItems(p).map((i) => i.q)).filter((id, i, a) => a.indexOf(id) === i && sel.has(id));
  const selPaper = shown.find((p) => paperItems(p).some((i) => i.q === selOrder[0]))?.id ?? "";
  // aus der Fach-Übersicht oder aus dem Üben verlinkt (#paper-<id>): direkt zur Klausur scrollen
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash.startsWith("paper-")) document.getElementById(hash)?.scrollIntoView({ block: "start" });
  }, []);
  const setView = (v: "tasks" | "papers") => router.replace(v === "tasks" ? `${pathname}?view=tasks` : pathname, { scroll: false });

  return (
    <div className={cn("mx-auto max-w-3xl", view === "papers" && selected.length > 0 && "pb-24")}>
      <Link href={`/s/${subject.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {subject.name}
      </Link>
      <p className="eyebrow mt-8">Probeklausuren · {subject.examFormat.name}</p>
      <h1 className="display text-4xl sm:text-5xl mt-2">Klausur schreiben</h1>
      <p className="mt-3 text-muted">
        {view === "tasks"
          ? "Alle Aufgaben der Probeklausuren einzeln: welches Thema sie behandeln, ob du sie schon bearbeitet hast – und gezielt üben."
          : `${papers.length} vollständige Klausuren mit Punkten. Feedback und Lösungen gibt es nach der Abgabe.`}
      </p>

      <div role="tablist" className="mt-6 flex rounded-full border border-line bg-surface p-1 sm:inline-flex">
        {(
          [
            ["papers", LayoutList, "Ganze Klausuren"],
            ["tasks", Table2, "Aufgaben-Tabelle"],
          ] as const
        ).map(([v, I, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn(
              "inline-flex h-9 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 text-sm font-semibold transition sm:flex-none sm:px-4",
              view === v ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2",
            )}
          >
            <I className="size-4 max-sm:hidden" /> {label}
          </button>
        ))}
      </div>

      {view === "tasks" ? (
        <div className="mt-6">
          <PaperTasks content={content} papers={shown} />
        </div>
      ) : (
      <>
      <details className="mt-5 text-sm text-ink-2">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-semibold">
          <Info className="size-4 text-muted" /> Hinweise zur Bewertung
        </summary>
        <ul className="mt-3 space-y-2">
        <li className="flex gap-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted" /> Achte auf „select all that apply“ (mehrere richtig) vs.
          „genau eine Antwort“. Multiple Choice gibt Punkte nur bei exakt richtiger Auswahl.
        </li>
        <li className="flex gap-2">
          <FileText className="mt-0.5 size-4 shrink-0 text-muted" /> Offene Aufgaben: Rechenweg zeigen. Sie werden anteilig bewertet
          (KI oder Selbstbewertung anhand der Kernpunkte)
          {hasCalc && ", Rechenaufgaben automatisch nach dem Anteil richtiger Ergebnisse"}.
        </li>
        <li className="flex gap-2">
          <Flag className="mt-0.5 size-4 shrink-0 text-muted" /> Unsichere Fragen markieren und vor der Abgabe zurückspringen.
        </li>
        </ul>
      </details>

      {(["altklausur", "neu"] as const).map((kind) => {
        const group = papers.filter((p) => p.origin.kind === kind);
        if (!group.length) return null;
        return (
          <section key={kind} className="mt-10">
            <h2 className="display text-2xl">{kind === "altklausur" ? "Nachbauten von Altklausuren" : "Neue Klausuren"}</h2>
            <p className="mt-1 text-sm text-muted">
              {kind === "altklausur"
                ? "Gleicher Aufbau, gleiche Aufgaben und Punkte wie die Vorlage – in eigenen Worten."
                : "Selbes Format, neue Fälle aus dem Vorlesungsstoff."}
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4">
        {group.map((p) => {
          const i = shown.indexOf(p);
          const done = allExams.filter((e) => e.subjectId === subject.id && e.paper === p.id);
          const best = done.reduce((b, e) => Math.max(b, examScore(e).score), 0);
          const parts = partPoints(p);
          const max = parts.reduce((s, x) => s + x.points, 0);
          const rows = rowsOf(p, byId);
          const ids = [...new Set(rows.map((r) => r.q.id))];
          const doneQs = ids.filter((id) => st(byId.get(id)!) !== "new").length;
          const wrongQs = ids.filter((id) => st(byId.get(id)!) === "wrong").length;
          const open = openTasks.includes(p.id);
          const all = ids.every((id) => sel.has(id));
          // Stand je Teil: ein Punkt je Aufgabe in der Farbe ihres Stands
          const partRows = (pi: number) =>
            paperItems(p)
              .filter((x) => x.part === pi)
              .map((x) => byId.get(x.q))
              .filter((q): q is Question => q !== undefined);
          return (
            <div key={p.id} id={`paper-${p.id}`} className="card min-w-0 scroll-mt-24 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow">Klausur {i + 1}</p>
                  <h2 className="mt-1 text-lg font-semibold leading-snug">{p.title}</h2>
                  {p.origin.exam && (
                    <p className="mt-1 text-sm font-medium text-ink-2">Vorlage: {p.origin.exam}</p>
                  )}
                  {p.subtitle && <p className="mt-1 text-sm text-muted">{p.subtitle}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <OriginChip paper={p} />
                  {done.length > 0 && <Chip>Bestwert {fmtPoints(best * max)} / {fmtPoints(max)} P. · {pct(best)}</Chip>}
                </div>
              </div>
              <div className="mt-4 grid gap-1.5 text-sm">
                {parts.map((x, pi) => (
                  <div key={x.title} className="flex min-w-0 items-center justify-between gap-4 text-ink-2">
                    <span className="min-w-0 truncate">{x.title}</span>
                    <span className="ml-auto flex shrink-0 gap-1" aria-hidden>
                      {partRows(pi).map((q) => (
                        <span
                          key={q.id}
                          title={`${q.topic || q.id}: ${STATUS[st(q)].label}`}
                          className="size-2 rounded-full"
                          style={{ background: STATUS[st(q)].color }}
                        />
                      ))}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {x.count} {x.count === 1 ? "Frage" : "Fragen"} · {fmtPoints(x.points)} P.
                    </span>
                  </div>
                ))}
              </div>
              {/* Aufgaben der Klausur: Stand, Auswahl, einzeln üben */}
              <div className="mt-4 rounded-xl border border-line">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenTasks((cur) => (open ? cur.filter((x) => x !== p.id) : [...cur, p.id]))}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-2/60 sm:px-4"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-semibold">Aufgaben</span>
                      <span className="text-muted">
                        <span className={cn(doneQs > 0 && "font-semibold text-ink-2")}>
                          {doneQs}/{ids.length} bearbeitet
                        </span>
                        {wrongQs > 0 && (
                          <>
                            {" · "}
                            <span className="font-semibold" style={{ color: "var(--bad)" }}>
                              {wrongQs} zuletzt falsch
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                    <Bar value={ids.length ? doneQs / ids.length : 0} color={subject.color} className="mt-1.5 h-1.5" />
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-ink-2">{open ? "Ausblenden" : "Anzeigen"}</span>
                  <ChevronDown className={cn("size-4 shrink-0 text-muted transition", open && "rotate-180")} />
                </button>
                {open && (
                  <div className="border-t border-line">
                    <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-muted sm:px-4">
                      <span>Tippe Aufgaben an, um sie auszuwählen, oder starte eine direkt mit ▶.</span>
                      <button
                        type="button"
                        onClick={() => toggle(ids, !all)}
                        className="shrink-0 font-semibold text-ink-2 underline-offset-2 hover:underline"
                      >
                        {all ? "Auswahl aufheben" : "Alle auswählen"}
                      </button>
                    </div>
                    <div className="border-t border-line">
                      <TaskTable
                        rows={rows}
                        subjectId={subject.id}
                        color={subject.color}
                        sel={sel}
                        toggle={toggle}
                        practiceHref={practiceHref(p.id)}
                        lectures={subject.lectures}
                      />
                    </div>
                  </div>
                )}
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
          </section>
        );
      })}
      {selected.length > 0 && (
        <SelectionBar count={selOrder.length} onClear={() => setSelected([])} href={practiceHref(selPaper)(selOrder)} />
      )}
      </>
      )}
    </div>
  );
}
