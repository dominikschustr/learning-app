"use client";

import { ArrowLeft, ArrowRight, Bookmark, Brain, CalendarClock, ClipboardCheck, Info, Layers, LayoutGrid, ListChecks, Play, RotateCcw, ScrollText, Sigma, Table2, Target, Trophy, Zap } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { READINESS_TARGET, countdown, daysUntil, fmtExamDate } from "@/lib/plan";
import { subjectStats } from "@/lib/progress";
import type { SubjectSummary } from "@/lib/schema";
import { chapterBests, examScore, markedIds, useApp, useHydrated } from "@/lib/store";
import { LevelBadge } from "./ChapterView";
import { PaperChoice, type PaperChoiceTarget } from "./PaperChoice";
import { paperCountLabel } from "./Papers";
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

const TYPES = [
  ["mc", "Multiple Choice"],
  ["tf", "True/False"],
  ["short", "Kurzantwort"],
] as const;

function readinessLabel(r: number) {
  if (r < 0.25) return "Am Anfang";
  if (r < 0.5) return "Auf dem Weg";
  if (r < 0.7) return "Solide";
  if (r < 0.85) return "Prüfungsreif";
  return "Sehr sicher";
}

function Inner({ summary }: { summary: SubjectSummary }) {
  const { subject } = summary;
  const s = useApp();
  const now = useNow();
  const st = subjectStats(summary, s.items, s.cards, now, chapterBests(s.exams, subject.id));
  // Klick auf ein Kapitel unter „Klausuraufgaben nach Kapitel“: zufällig üben oder aus der Tabelle wählen
  const [paperChoice, setPaperChoice] = useState<PaperChoiceTarget | null>(null);
  const f = subject.examFormat;
  const base = `/s/${subject.id}`;
  const exams = s.exams.filter((e) => e.subjectId === subject.id && !e.lecture).toReversed();
  const best = exams.reduce((b, e) => Math.max(b, examScore(e).score), 0);
  const active = s.activeExam?.subjectId === subject.id ? s.activeExam : null;
  const weakest = [...st.lectures].filter((l) => l.total).sort((a, b) => a.combined - b.combined)[0];
  const mastered = st.lectures.filter((l) => l.level.level === 5).length;
  const qIds = new Set(summary.items.map((i) => i.id));
  const cIds = new Set(summary.cards.map((c) => c.id));
  const markedQ = [...markedIds(s.marks, "q", subject.id)].filter((id) => qIds.has(id)).length;
  const markedC = [...markedIds(s.marks, "c", subject.id)].filter((id) => cIds.has(id)).length;
  const mobile = useMobile();

  const hasTf = summary.items.some((i) => i.type === "tf");
  const checkups = summary.items.filter((i) => i.checkup);
  const checkupStatus = statusCounts(checkups.map((i) => s.items[itemKey(subject.id, i.id)]));
  const mcSet = summary.items.filter((i) => i.mcSet);
  const mcStatus = statusCounts(mcSet.map((i) => s.items[itemKey(subject.id, i.id)]));
  // Klausuraufgaben je Kapitel: alle Aufgaben der Probeklausuren, nach Thema sortiert
  const paperChapters = subject.lectures
    .map((l, i) => {
      const qs = summary.paperItems.filter((p) => p.lecture === l.id);
      const c = statusCounts(qs.map((p) => s.items[itemKey(subject.id, p.id)]));
      return { id: l.id, n: i + 1, code: l.title.split(" · ")[0], name: l.title.split(" · ").slice(1).join(" · "), total: qs.length, right: c.first + c.recovered, open: c.new };
    })
    .filter((c) => c.total > 0);
  // Üben: große Kacheln, nur Titel und Stand
  const modes = [
    {
      href: `${base}/cards`,
      icon: Layers,
      title: "Karteikarten",
      meta: `${st.cardsDue} fällig · ${st.cardsNew} neu`,
    },
    {
      href: `${base}/practice?mode=due`,
      icon: RotateCcw,
      title: "Wiederholung",
      meta: `${st.due} fällig`,
    },
    {
      href: `${base}/practice?mode=weak`,
      icon: Target,
      title: "Schwächen",
      meta: st.seen ? "unsicherste Fragen" : "nach ein paar Fragen",
    },
    ...(checkups.length
      ? [
          {
            href: `${base}/practice?mode=checkup`,
            icon: ClipboardCheck,
            title: "Check-up-Fragen",
            meta: `${checkupStatus.first + checkupStatus.recovered}/${checkups.length} richtig`,
          },
        ]
      : []),
    ...(mcSet.length
      ? [
          {
            href: `${base}/practice?mode=mc`,
            icon: ListChecks,
            title: "Multiple Choice",
            meta: `${mcStatus.first + mcStatus.recovered}/${mcSet.length} richtig`,
          },
        ]
      : []),
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
  ];
  // Nachschlagen und Lesezeichen: schmale Links unter den Kacheln
  const links = [
    ...(summary.formulas.length ? [{ href: `${base}/formulas`, icon: Sigma, label: "Formelübersicht" }] : []),
    ...(summary.frameworks.length ? [{ href: `${base}/frameworks`, icon: LayoutGrid, label: "Framework-Übersicht" }] : []),
    ...(markedQ
      ? [{ href: `${base}/practice?mode=marked`, icon: Bookmark, label: `${markedQ} ${markedQ === 1 ? "markierte Frage" : "markierte Fragen"}` }]
      : []),
    ...(markedC
      ? [{ href: `${base}/cards?marked=1`, icon: Bookmark, label: `${markedC} ${markedC === 1 ? "markierte Karte" : "markierte Karten"}` }]
      : []),
  ];

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
          <Play className="size-4" /> Laufenden {active.lecture ? "Kapiteltest" : "Abschlusstest"} fortsetzen
          <ArrowRight className="ml-auto size-4" />
        </Link>
      )}

      <section className="card grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-4 p-4 sm:gap-8 sm:p-8">
        <div className="flex justify-center sm:row-span-2">
          <ProgressRing value={st.readiness} size={mobile ? 88 : 176} stroke={mobile ? 8 : 12} color={subject.color}>
            <span>
              <span className="display block text-2xl tabular-nums sm:text-5xl">{Math.round(st.readiness * 100)}</span>
              <span className="eyebrow max-sm:hidden">Prozent</span>
            </span>
          </ProgressRing>
        </div>
        <div className="flex flex-col justify-center sm:self-end">
          <p className="eyebrow">Prognose {f.name}</p>
          <h2 className="display mt-1 text-2xl sm:text-3xl">{readinessLabel(st.readiness)}</h2>
        </div>
        <div className="col-span-2 sm:col-span-1 sm:col-start-2 sm:self-start">
          <div className="grid max-w-md gap-2.5">
            {TYPES.filter(([t]) => f[t]).map(([t, label]) => [label, st.masteryByType[t]] as const).map(([label, v]) => (
              <div key={label} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                <span className="text-ink-2">{label}</span>
                <Bar value={v} color={subject.color} />
                <span className="text-right tabular-nums text-muted">{Math.round(v * 100)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
            <ButtonLink href={`${base}/practice?mode=smart`} className="max-sm:flex-1">
              <Brain className="size-4" /> Empfohlene Session
            </ButtonLink>
            {weakest && st.seen > 0 && (
              <ButtonLink variant="secondary" href={`${base}/c/${weakest.id}`}>
                Schwächstes Kapitel üben
              </ButtonLink>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-4 sm:mb-4">
          <h2 className="display text-2xl">Lernpfad</h2>
          <Chip>
            {mastered}/{st.lectures.length} gemeistert
          </Chip>
        </div>
        <ol className="relative space-y-2 sm:space-y-3">
          <span className="absolute bottom-6 left-[2.15rem] top-6 w-px bg-line-strong sm:left-[2.6rem]" aria-hidden />
          {st.lectures.map((l, i) => {
            const [code, ...rest] = l.title.split(" · ");
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
                    <span className="mt-0.5 block text-xs text-muted">
                      Level {l.level.level} · {l.level.name}
                      {l.testBest > 0 && ` · Kapiteltest ${pct(l.testBest)}`}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5" />
                </Link>
              </motion.li>
            );
          })}
          <motion.li
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: st.lectures.length * 0.04 }}
            className="relative"
          >
            <Link
              href={`${base}/exam`}
              className="group flex items-center gap-4 rounded-[1.25rem] bg-ink p-3 pr-5 text-bg transition hover:-translate-y-0.5 sm:p-4"
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-bg/10">
                <Trophy className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.08em] opacity-60">
                  {summary.papers.length ? "Probeklausuren" : "Abschlusstest"} · {f.name}
                </span>
                <span className="block font-semibold sm:text-lg">
                  {summary.papers.length
                    ? paperCountLabel(summary.papers)
                    : `Fragen aus allen ${st.lectures.length} Kapiteln`}
                </span>
                <span className="mt-0.5 block text-xs opacity-70">
                  {summary.papers.length ? "Teil A, B und C mit Punkten" : `${f.short + f.mc + f.tf} Fragen`} · {f.minutes} Min
                  {best ? ` · Bestwert ${pct(best)}` : ""}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 opacity-70 transition group-hover:translate-x-0.5" />
            </Link>
          </motion.li>
        </ol>
      </section>

      {paperChapters.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="display text-2xl">Klausuraufgaben nach Kapitel</h2>
              <p className="mt-1 text-sm text-muted">Alle Aufgaben aus den Probeklausuren, nach Thema sortiert</p>
            </div>
            <Link
              href={`${base}/exam?view=tasks`}
              className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink"
            >
              <Table2 className="size-4" style={{ color: subject.color }} /> Aufgaben-Tabelle
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {paperChapters.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() =>
                  setPaperChoice({ id: c.id, label: `Kapitel ${c.n} · ${c.code}`, title: c.name, total: c.total, open: c.open })
                }
                className="card group flex flex-col p-3 text-left transition hover:-translate-y-0.5 sm:p-4"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-lg"
                    style={{ background: alpha(subject.color, 0.1), color: subject.color }}
                  >
                    <ScrollText className="size-4" />
                  </span>
                  <span className="eyebrow">Kapitel {c.n} · {c.code}</span>
                </span>
                <span className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{c.name}</span>
                <span className="mt-auto pt-2">
                  <Bar value={c.right / c.total} color={subject.color} />
                  <span className="mt-1 block text-xs text-muted">
                    {c.total} Aufgaben · {c.right} richtig
                  </span>
                </span>
              </button>
            ))}
          </div>
          <PaperChoice subjectId={subject.id} target={paperChoice} color={subject.color} onClose={() => setPaperChoice(null)} />
        </section>
      )}

      <section>
        <h2 className="display mb-3 text-2xl">Freies Training</h2>
        <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3", modes.length > 3 && "lg:grid-cols-5")}>
          {modes.map((m, i) => (
            <motion.div key={m.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link href={m.href} className="card group flex h-full flex-col p-3 transition hover:-translate-y-0.5 sm:p-4">
                <span
                  className="grid size-9 place-items-center rounded-xl sm:size-10"
                  style={{ background: alpha(subject.color, 0.1), color: subject.color }}
                >
                  <m.icon className="size-5" />
                </span>
                <span className="mt-2 font-semibold leading-tight sm:mt-3">{m.title}</span>
                <span className="mt-auto pt-1 text-xs text-muted">{m.meta}</span>
              </Link>
            </motion.div>
          ))}
        </div>
        <LinkRow links={links} color={subject.color} className="mt-3" />
      </section>

      {exams.length > 0 && (
        <section>
          <h2 className="display mb-3 text-2xl">{summary.papers.length ? "Geschriebene Klausuren" : "Abschlusstests"}</h2>
          <div className="card divide-y divide-line">
            {exams.slice(0, 8).map((e) => {
              const sc = examScore(e);
              return (
                <Link
                  key={e.id}
                  href={`${base}/exam?review=${e.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-surface-2/60"
                >
                  <span
                    className="display w-16 text-2xl tabular-nums"
                    style={{ color: sc.score >= 0.8 ? "var(--good)" : sc.score >= 0.5 ? "var(--ink)" : "var(--bad)" }}
                  >
                    {Math.round(sc.score * 100)}
                  </span>
                  <div className="flex-1 text-sm">
                    <p className="font-semibold">
                      {e.paper
                        ? `${summary.papers.find((p) => p.id === e.paper)?.title ?? "Probeklausur"} · ${(Math.round(sc.earned * 100) / 100).toLocaleString("de-DE")}/${sc.max} P.`
                        : `${sc.correct}/${sc.total} richtig`}
                      {sc.score === best && <Chip className="ml-2">Bestwert</Chip>}
                    </p>
                    <p className="text-muted">
                      {new Date(e.finishedAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                      {Math.round(e.durationSec / 60)} Min
                    </p>
                  </div>
                  <ArrowRight className="size-4 text-muted" />
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

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
