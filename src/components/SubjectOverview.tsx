"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Brain,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  History,
  Info,
  Layers,
  LayoutGrid,
  ListChecks,
  MessageCircleQuestion,
  Play,
  RotateCcw,
  Sigma,
  Table2,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { READINESS_TARGET, countdown, daysUntil, fmtExamDate } from "@/lib/plan";
import { subjectStats, type SubjectStats } from "@/lib/progress";
import type { SubjectSummary } from "@/lib/schema";
import { useAuth } from "@/lib/auth";
import { cloudConfigured } from "@/lib/cloud";
import { highlightedIn, highlightersOf, splitMarks, useHighlightIndex, useHighlights, whoText } from "@/lib/highlights";
import { chapterBests, examScore, markedIds, useApp, useHydrated, type ExamRecord } from "@/lib/store";
import { LevelBadge } from "./ChapterView";
import { PaperChoice, type PaperChoiceTarget } from "./PaperChoice";
import { fmtPoints } from "./Papers";
import { useMobile } from "@/lib/useMobile";
import { useNow } from "@/lib/useNow";
import { statusCounts } from "@/lib/srs";
import { alpha, cn, itemKey, pct } from "@/lib/utils";
import { Bar, ButtonLink, Chip, LinkRow, ProgressRing, Skeleton } from "./ui";

export function SubjectOverview({ summary }: { summary: SubjectSummary }) {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  return <Inner summary={summary} />;
}

function readinessLabel(r: number) {
  if (r < 0.25) return "Am Anfang";
  if (r < 0.5) return "Auf dem Weg";
  if (r < 0.7) return "Solide";
  if (r < 0.85) return "Prüfungsreif";
  return "Sehr sicher";
}

type Tab = "kapitel" | "klausuren" | "training";
const TABS: Tab[] = ["kapitel", "klausuren", "training"];

/** Gewählter Bereich steht im Hash (#klausuren), damit „Zurück“ aus einer Klausur wieder dort landet. */
function useTab(): [Tab, (t: Tab) => void] {
  const [tab, setTab] = useState<Tab>(() => {
    const h = typeof window === "undefined" ? "" : window.location.hash.slice(1);
    return TABS.includes(h as Tab) ? (h as Tab) : "kapitel";
  });
  useEffect(() => {
    const url = tab === "kapitel" ? window.location.pathname + window.location.search : `#${tab}`;
    window.history.replaceState(window.history.state, "", url);
  }, [tab]);
  return [tab, setTab];
}

function Inner({ summary }: { summary: SubjectSummary }) {
  const { subject } = summary;
  const s = useApp();
  const now = useNow();
  const mobile = useMobile();
  const st = subjectStats(summary, s.items, s.cards, now, chapterBests(s.exams, subject.id));
  const [tab, setTab] = useTab();
  const base = `/s/${subject.id}`;
  const active = s.activeExam?.subjectId === subject.id ? s.activeExam : null;
  const weakest = [...st.lectures].filter((l) => l.total).sort((a, b) => a.combined - b.combined)[0];
  const hasPapers = summary.papers.length > 0;

  // nächster sinnvoller Schritt neben der empfohlenen Session
  const second =
    st.due > 0
      ? { href: `${base}/practice?mode=due`, label: `Wiederholen · ${st.due} fällig` }
      : weakest && st.seen > 0
        ? { href: `${base}/c/${weakest.id}`, label: `Schwächstes Kapitel · ${weakest.title.split(" · ")[0]}` }
        : null;

  return (
    <div className="space-y-6 sm:space-y-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Übersicht
      </Link>

      <header>
        <span
          className="rounded-md px-2 py-0.5 text-xs font-bold"
          style={{ background: alpha(subject.color, 0.12), color: subject.color }}
        >
          {subject.short}
        </span>
        <h1 className="display mt-2 text-3xl sm:mt-3 sm:text-5xl">{subject.name}</h1>
        <p className="mt-2 max-w-2xl text-muted max-sm:hidden">{subject.description}</p>
        {subject.examDate && <ExamCountdown date={subject.examDate} readiness={st.readiness} now={now} />}
      </header>

      {subject.demo && (
        <div className="flex gap-3 rounded-2xl border border-warn/30 bg-warn-soft p-4 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-warn" />
          <p>
            <strong>Demo-Inhalte</strong> – Platzhalter, bis die Vorlesungsunterlagen da sind.
          </p>
        </div>
      )}

      {active && (
        <Link
          href={active.lecture ? `${base}/exam?chapter=${active.lecture}` : `${base}/exam`}
          className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-surface p-4 text-sm font-semibold text-accent"
        >
          <Play className="size-4" /> Laufende {active.paper ? "Probeklausur" : active.lecture ? "Kapiteltest" : "Abschlusstest"}{" "}
          fortsetzen
          <ArrowRight className="ml-auto size-4" />
        </Link>
      )}

      {/* Stand des Fachs: woraus sich die Prozent zusammensetzen, und der nächste Schritt */}
      <section className="card grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-4 p-4 sm:gap-x-8 sm:p-8">
        <div className="flex justify-center sm:row-span-2">
          <ProgressRing value={st.readiness} size={mobile ? 88 : 168} stroke={mobile ? 8 : 12} color={subject.color}>
            <span>
              <span className="display block text-2xl tabular-nums sm:text-5xl">{Math.round(st.readiness * 100)}</span>
              <span className="eyebrow max-sm:hidden">Prozent</span>
            </span>
          </ProgressRing>
        </div>
        <div className="flex flex-col justify-center sm:self-end">
          <p className="eyebrow">Dein Stand · {subject.examFormat.name}</p>
          <h2 className="display mt-1 text-2xl sm:text-3xl">{readinessLabel(st.readiness)}</h2>
        </div>
        <div className="col-span-2 sm:col-span-1 sm:col-start-2 sm:self-start">
          <StandBreakdown st={st} color={subject.color} />
          <div className="mt-4 flex gap-2 max-sm:flex-col sm:mt-5 sm:flex-wrap">
            <ButtonLink href={`${base}/practice?mode=smart`}>
              <Brain className="size-4" /> Empfohlene Session
            </ButtonLink>
            {second && (
              <ButtonLink variant="secondary" href={second.href}>
                {second.label}
              </ButtonLink>
            )}
          </div>
        </div>
      </section>

      <div>
        <div
          role="tablist"
          aria-label="Bereiche"
          className="flex rounded-full border border-line bg-surface p-1 sm:inline-flex"
        >
          {(
            [
              ["kapitel", "Kapitel", `${st.lectures.filter((l) => l.level.level === 5).length}/${st.lectures.length}`],
              ["klausuren", hasPapers ? "Klausuren" : "Abschlusstest", hasPapers ? `${st.papersDone}/${summary.papers.length}` : ""],
              ["training", "Training", st.due + st.cardsDue ? String(st.due + st.cardsDue) : ""],
            ] as const
          ).map(([t, label, count]) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 text-sm font-semibold transition sm:flex-none sm:px-5",
                tab === t ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2",
              )}
            >
              {label}
              {count && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] tabular-nums",
                    tab === t ? "bg-bg/15" : "bg-surface-2 text-muted",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-5 sm:mt-6" role="tabpanel">
          {tab === "kapitel" && <ChaptersTab summary={summary} st={st} />}
          {tab === "klausuren" && <ExamsTab summary={summary} st={st} />}
          {tab === "training" && <TrainingTab summary={summary} st={st} />}
        </div>
      </div>
    </div>
  );
}

/** Woraus sich der Gesamtstand zusammensetzt: Übungsfragen (Prognose) und bearbeitete Probeklausuren. */
function StandBreakdown({ st, color }: { st: SubjectStats; color: string }) {
  const rows = [
    {
      label: "Übungsfragen",
      value: st.questionReadiness,
      right: `${Math.round(st.questionReadiness * 100)} %`,
      hint: "Sicherheit je Fragetyp, gewichtet wie in der Prüfung",
    },
    ...(st.paperWeight
      ? [
          {
            label: "Probeklausuren",
            value: st.paperProgress,
            right: `${st.papersDone}/${st.papers.length}`,
            hint: "Anteil bearbeiteter Aufgaben – ganze Klausur oder einzeln",
          },
        ]
      : []),
  ];
  return (
    <div className="max-w-md">
      <div className="grid gap-2.5">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3 text-sm" title={r.hint}>
            <span className="text-ink-2">{r.label}</span>
            <Bar value={r.value} color={color} />
            <span className="text-right tabular-nums text-muted">{r.right}</span>
          </div>
        ))}
      </div>
      {st.paperWeight > 0 && (
        <p className="mt-2 text-xs text-muted">
          Gesamt = {Math.round((1 - st.paperWeight) * 100)} % Übungsfragen + {Math.round(st.paperWeight * 100)} %
          Probeklausuren
        </p>
      )}
    </div>
  );
}

/** Kapitel als Lernpfad: Level, Stand der Fragen und der Klausuraufgaben je Kapitel. */
function ChaptersTab({ summary, st }: { summary: SubjectSummary; st: SubjectStats }) {
  const { subject } = summary;
  const items = useApp((s) => s.items);
  const mobile = useMobile();
  const base = `/s/${subject.id}`;
  return (
    <ol className="relative space-y-2 sm:space-y-3">
      <span className="absolute bottom-6 left-[2.15rem] top-6 w-px bg-line-strong sm:left-[2.6rem]" aria-hidden />
      {st.lectures.map((l, i) => {
        const [code, ...rest] = l.title.split(" · ");
        const paperQs = summary.paperItems.filter((p) => p.lecture === l.id);
        const paperDone = paperQs.filter((p) => items[itemKey(subject.id, p.id)]).length;
        const facts = [
          `Level ${l.level.level} · ${l.level.name}`,
          `${l.seen}/${l.total} Fragen`,
          paperQs.length > 0 && `${paperDone}/${paperQs.length} Klausuraufgaben`,
          l.testBest > 0 && `Test ${pct(l.testBest)}`,
        ].filter(Boolean);
        return (
          <motion.li
            key={l.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="relative"
          >
            <Link
              href={`${base}/c/${l.id}`}
              className="card group flex items-center gap-3 p-3 pr-4 transition hover:-translate-y-0.5 sm:gap-4 sm:p-4 sm:pr-5"
            >
              <span className="rounded-full bg-surface">
                <LevelBadge ch={l} color={subject.color} size={mobile ? 44 : 56} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="eyebrow block">
                  Kapitel {i + 1} · {code}
                </span>
                <span className="block truncate font-semibold sm:text-lg">{rest.join(" · ") || l.title}</span>
                <span className="mt-0.5 block truncate text-xs text-muted">{facts.join(" · ")}</span>
              </span>
              <span className="hidden w-28 shrink-0 sm:block">
                <span className="flex justify-between text-xs text-muted">
                  <span>Sicherheit</span>
                  <span className="tabular-nums">{Math.round(l.combined * 100)} %</span>
                </span>
                <Bar value={l.combined} color={subject.color} className="mt-1" />
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5" />
            </Link>
          </motion.li>
        );
      })}
    </ol>
  );
}

/** Probeklausuren mit Stand, Klausuraufgaben nach Kapitel und geschriebene Klausuren. */
function ExamsTab({ summary, st }: { summary: SubjectSummary; st: SubjectStats }) {
  const { subject } = summary;
  const s = useApp();
  const base = `/s/${subject.id}`;
  const f = subject.examFormat;
  // Klick auf ein Kapitel unter „Klausuraufgaben nach Kapitel“: zufällig üben oder aus der Tabelle wählen
  const [paperChoice, setPaperChoice] = useState<PaperChoiceTarget | null>(null);
  const exams = s.exams.filter((e) => e.subjectId === subject.id && !e.lecture).toReversed();
  const progress = new Map(st.papers.map((p) => [p.id, p.progress]));
  const bestOf = (id: string) =>
    exams.filter((e) => e.paper === id).reduce((b, e) => Math.max(b, examScore(e).score), -1);
  // Altklausuren zuerst, die jüngsten oben; danach die neuen Klausuren
  const year = (title: string) => Number(title.match(/\b(19|20)\d{2}\b/)?.[0] ?? 0);
  const shown = [
    ...summary.papers.filter((p) => p.kind === "altklausur").toSorted((a, b) => year(b.title) - year(a.title)),
    ...summary.papers.filter((p) => p.kind !== "altklausur"),
  ];
  const paperChapters = subject.lectures
    .map((l, i) => {
      const qs = summary.paperItems.filter((p) => p.lecture === l.id);
      const c = statusCounts(qs.map((p) => s.items[itemKey(subject.id, p.id)]));
      return { id: l.id, n: i + 1, code: l.title.split(" · ")[0], name: l.title.split(" · ").slice(1).join(" · "), total: qs.length, done: qs.length - c.new, open: c.new };
    })
    .filter((c) => c.total > 0);

  return (
    <div className="space-y-8">
      {shown.length > 0 ? (
        <section>
          <SectionHead
            title="Probeklausuren"
            sub={`${st.papersDone} von ${shown.length} vollständig bearbeitet`}
            link={{ href: `${base}/exam`, icon: FileText, label: "Alle Klausuren" }}
            color={subject.color}
          />
          <div className="card divide-y divide-line">
            {shown.map((p) => {
              const prog = progress.get(p.id) ?? 0;
              const best = bestOf(p.id);
              const alt = p.kind === "altklausur";
              return (
                <Link
                  key={p.id}
                  href={`${base}/exam#paper-${p.id}`}
                  className="group flex items-center gap-3 p-3 hover:bg-surface-2/60 sm:gap-4 sm:p-4"
                >
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-xl max-sm:hidden"
                    style={
                      prog >= 1
                        ? { background: "var(--good-soft)", color: "var(--good)" }
                        : { background: alpha(subject.color, 0.1), color: subject.color }
                    }
                  >
                    {prog >= 1 ? <CheckCircle2 className="size-5" /> : alt ? <History className="size-5" /> : <FileText className="size-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug sm:truncate">{p.title}</span>
                    <span className="block text-xs text-muted">
                      {alt ? "Altklausur" : "Neue Klausur"} · {p.minutes} Min · {fmtPoints(p.points)} P.
                    </span>
                  </span>
                  <span className="w-20 shrink-0 text-right text-xs sm:w-32">
                    {best >= 0 ? (
                      <span className="font-semibold tabular-nums" style={{ color: scoreColor(best) }}>
                        <span className="max-sm:hidden">Bestwert </span>
                        {pct(best)}
                      </span>
                    ) : prog >= 1 ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-good">
                        <CheckCircle2 className="size-3.5 sm:hidden" /> alle Aufgaben bearbeitet
                      </span>
                    ) : prog > 0 ? (
                      <>
                        <span className="tabular-nums text-ink-2">{pct(prog)} bearbeitet</span>
                        <Bar value={prog} color={subject.color} className="mt-1" />
                      </>
                    ) : (
                      <span className="text-muted">offen</span>
                    )}
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <Link
          href={`${base}/exam`}
          className="group flex items-center gap-4 rounded-[1.25rem] bg-ink p-4 pr-5 text-bg transition hover:-translate-y-0.5"
        >
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-bg/10">
            <Trophy className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.08em] opacity-60">
              Abschlusstest · {f.name}
            </span>
            <span className="block font-semibold sm:text-lg">Fragen aus allen {st.lectures.length} Kapiteln</span>
            <span className="mt-0.5 block text-xs opacity-70">
              {f.short + f.mc + f.tf} Fragen · {f.minutes} Min
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 opacity-70 transition group-hover:translate-x-0.5" />
        </Link>
      )}

      {paperChapters.length > 0 && (
        <section>
          <SectionHead
            title="Klausuraufgaben nach Kapitel"
            sub="Einzelne Aufgaben aus den Probeklausuren üben – zählt auch für die Klausuren"
            link={{ href: `${base}/exam?view=tasks`, icon: Table2, label: "Aufgaben-Tabelle" }}
            color={subject.color}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
            {paperChapters.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() =>
                  setPaperChoice({ id: c.id, label: `Kapitel ${c.n} · ${c.code}`, title: c.name, total: c.total, open: c.open })
                }
                className="card group flex flex-col p-3 text-left transition hover:-translate-y-0.5 sm:p-4"
              >
                <span className="eyebrow">Kapitel {c.n} · {c.code}</span>
                <span className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">{c.name}</span>
                <span className="mt-auto pt-2">
                  <Bar value={c.done / c.total} color={subject.color} />
                  <span className="mt-1 block text-xs text-muted">
                    <span className="font-semibold text-ink-2">{c.done}</span>/{c.total} bearbeitet
                  </span>
                </span>
              </button>
            ))}
          </div>
          <PaperChoice subjectId={subject.id} target={paperChoice} color={subject.color} onClose={() => setPaperChoice(null)} />
        </section>
      )}

      {exams.length > 0 && <ExamHistory exams={exams} summary={summary} />}
    </div>
  );
}

function ExamHistory({ exams, summary }: { exams: ExamRecord[]; summary: SubjectSummary }) {
  const base = `/s/${summary.subject.id}`;
  const best = exams.reduce((b, e) => Math.max(b, examScore(e).score), 0);
  return (
    <section>
      <h2 className="display mb-3 text-xl sm:text-2xl">Verlauf</h2>
      <div className="card divide-y divide-line">
        {exams.slice(0, 6).map((e) => {
          const sc = examScore(e);
          return (
            <Link key={e.id} href={`${base}/exam?review=${e.id}`} className="flex items-center gap-4 p-4 hover:bg-surface-2/60">
              <span className="display w-14 text-2xl tabular-nums" style={{ color: scoreColor(sc.score) }}>
                {Math.round(sc.score * 100)}
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate font-semibold">
                  {e.paper
                    ? `${summary.papers.find((p) => p.id === e.paper)?.title ?? "Probeklausur"} · ${fmtPoints(sc.earned)}/${fmtPoints(sc.max)} P.`
                    : `Abschlusstest · ${sc.correct}/${sc.total} richtig`}
                  {sc.score === best && <Chip className="ml-2">Bestwert</Chip>}
                </span>
                <span className="text-muted">
                  {new Date(e.finishedAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                  {Math.round(e.durationSec / 60)} Min
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** Übungsmodi über alle Kapitel und Nachschlagen. */
function TrainingTab({ summary, st }: { summary: SubjectSummary; st: SubjectStats }) {
  const { subject } = summary;
  const s = useApp();
  const base = `/s/${subject.id}`;
  const qIds = new Set(summary.items.map((i) => i.id));
  const cIds = new Set(summary.cards.map((c) => c.id));
  const markedC = [...markedIds(s.marks, "c", subject.id)].filter((id) => cIds.has(id)).length;
  // Markierte Fragen – deine und die der Lerngruppe (auch reine Klausuraufgaben)
  const markIdx = useHighlightIndex();
  const pIds = new Set([...qIds, ...summary.paperItems.map((p) => p.id)]);
  const { mine, others } = splitMarks(new Map([...highlightedIn(markIdx, subject.id)].filter(([id]) => pIds.has(id))));
  const otherNames = highlightersOf(others, others.keys());
  const groupOn = useAuth((a) => !!a.session) && cloudConfigured();
  const groupState = useHighlights((h) => (h.loadedAt === null && h.status === "loading" ? "loading" : h.status === "error" && h.loadedAt === null ? "error" : "ok"));
  const fragen = (n: number) => `${n} ${n === 1 ? "Frage" : "Fragen"}`;
  const set = (pick: (i: SubjectSummary["items"][number]) => boolean) => {
    const qs = summary.items.filter(pick);
    const c = statusCounts(qs.map((i) => s.items[itemKey(subject.id, i.id)]));
    return { n: qs.length, meta: `${c.first + c.recovered}/${qs.length} richtig` };
  };
  const checkup = set((i) => i.checkup);
  const quiz = set((i) => i.quiz);
  const mc = set((i) => i.mcSet);
  const hasTf = summary.items.some((i) => i.type === "tf");

  const groups = [
    {
      title: "Wiederholen",
      modes: [
        { href: `${base}/practice?mode=due`, icon: RotateCcw, title: "Wiederholung", meta: st.due ? `${st.due} fällig` : "nichts fällig" },
        { href: `${base}/cards`, icon: Layers, title: "Karteikarten", meta: `${st.cardsDue} fällig · ${st.cardsNew} neu` },
        { href: `${base}/practice?mode=weak`, icon: Target, title: "Schwächen", meta: st.seen ? "unsicherste Fragen" : "nach ein paar Fragen" },
        ...(mine.size
          ? [{ href: `${base}/practice?mode=marked`, icon: Bookmark, title: "Meine markierten", meta: fragen(mine.size) }]
          : []),
        // immer sichtbar, sobald die Lerngruppe verfügbar ist – auch wenn noch niemand etwas markiert hat
        ...(others.size || groupOn
          ? [
              {
                href: `${base}/practice?mode=others`,
                icon: Users,
                title: "Von anderen markiert",
                meta: others.size
                  ? `${fragen(others.size)} · ${whoText(otherNames)}`
                  : groupState === "loading"
                    ? "wird geladen …"
                    : groupState === "error"
                      ? "gerade nicht erreichbar"
                      : "noch keine",
              },
            ]
          : []),
      ],
    },
    {
      title: "Aus der Vorlesung",
      modes: [
        ...(quiz.n ? [{ href: `${base}/practice?mode=quiz`, icon: MessageCircleQuestion, title: "Quiz", meta: quiz.meta }] : []),
        ...(checkup.n
          ? [{ href: `${base}/practice?mode=checkup`, icon: ClipboardCheck, title: "Check-up-Fragen", meta: checkup.meta }]
          : []),
        ...(mc.n ? [{ href: `${base}/practice?mode=mc`, icon: ListChecks, title: "Multiple Choice", meta: mc.meta }] : []),
        ...(hasTf
          ? [
              {
                href: `${base}/blitz`,
                icon: Zap,
                title: "Blitzrunde",
                meta: s.blitzBest[subject.id] ? `Rekord ${s.blitzBest[subject.id]}` : "60 Sek. True/False",
              },
            ]
          : []),
      ],
    },
  ].filter((g) => g.modes.length);

  // Nachschlagen und Lesezeichen
  const links = [
    ...(summary.formulas.length ? [{ href: `${base}/formulas`, icon: Sigma, label: "Formelübersicht" }] : []),
    ...(summary.frameworks.length ? [{ href: `${base}/frameworks`, icon: LayoutGrid, label: "Framework-Übersicht" }] : []),
    ...(markedC
      ? [{ href: `${base}/cards?marked=1`, icon: Bookmark, label: `${markedC} ${markedC === 1 ? "markierte Karte" : "markierte Karten"}` }]
      : []),
  ];

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="eyebrow mb-2">{g.title}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {g.modes.map((m, i) => (
              <motion.div key={m.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link href={m.href} className="card group flex h-full flex-col p-3 transition hover:-translate-y-0.5 sm:p-4">
                  <span
                    className="grid size-9 place-items-center rounded-xl sm:size-10"
                    style={{ background: alpha(subject.color, 0.1), color: subject.color }}
                  >
                    <m.icon className="size-5" />
                  </span>
                  <span className="mt-2 font-semibold leading-tight sm:mt-3">{m.title}</span>
                  <span className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted">
                    {m.meta}
                    <ArrowRight className="size-3.5 shrink-0 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      ))}
      {links.length > 0 && (
        <section>
          <h2 className="eyebrow mb-2">Nachschlagen</h2>
          <LinkRow links={links} color={subject.color} />
        </section>
      )}
    </div>
  );
}

function SectionHead({
  title,
  sub,
  link,
  color,
}: {
  title: string;
  sub: string;
  link: { href: string; icon: typeof FileText; label: string };
  color: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="display text-xl sm:text-2xl">{title}</h2>
        <p className="mt-1 text-sm text-muted">{sub}</p>
      </div>
      <Link href={link.href} className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
        <link.icon className="size-4" style={{ color }} /> {link.label}
      </Link>
    </div>
  );
}

const scoreColor = (x: number) => (x >= 0.8 ? "var(--good)" : x >= 0.5 ? "var(--ink)" : "var(--bad)");

/** Klausurtermin mit Countdown und dem Tempo, das bis zur Ziel-Readiness nötig ist. */
function ExamCountdown({ date, readiness, now }: { date: string; readiness: number; now: number }) {
  const days = daysUntil(date, now);
  const need = Math.max(0, READINESS_TARGET - readiness);
  const target = Math.round(READINESS_TARGET * 100);
  let pace: string;
  if (days < 0) pace = "";
  else if (!need) pace = `Ziel ${target} % erreicht`;
  else {
    const perDay = ((need / Math.max(1, days)) * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 });
    pace = `+${perDay} Pkt./Tag bis ${target} %`;
  }
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className={cn("inline-flex items-center gap-1.5 font-semibold", days >= 0 && days <= 7 && "text-bad")}>
        <CalendarClock className="size-4" />
        Klausur {fmtExamDate(date, true)} · {countdown(days)}
      </span>
      <span className="text-muted">{pace}</span>
    </p>
  );
}
