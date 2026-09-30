"use client";

import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Info,
  Layers,
  Play,
  RotateCcw,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { subjectStats } from "@/lib/progress";
import type { SubjectSummary } from "@/lib/schema";
import { chapterBests, examScore, useApp, useHydrated } from "@/lib/store";
import { LevelBadge } from "./ChapterView";
import { useNow } from "@/lib/useNow";
import { alpha, pct } from "@/lib/utils";
import { Bar, ButtonLink, Chip, ProgressRing, Skeleton } from "./ui";

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

function Inner({ summary }: { summary: SubjectSummary }) {
  const { subject } = summary;
  const s = useApp();
  const now = useNow();
  const st = subjectStats(summary, s.items, s.cards, now, chapterBests(s.exams, subject.id));
  const f = subject.examFormat;
  const base = `/s/${subject.id}`;
  const exams = s.exams.filter((e) => e.subjectId === subject.id && !e.lecture).toReversed();
  const best = exams.reduce((b, e) => Math.max(b, examScore(e).score), 0);
  const active = s.activeExam?.subjectId === subject.id ? s.activeExam : null;
  const weakest = [...st.lectures].filter((l) => l.total).sort((a, b) => a.combined - b.combined)[0];
  const mastered = st.lectures.filter((l) => l.level.level === 5).length;

  const modes = [
    {
      href: `${base}/cards`,
      icon: Layers,
      title: "Karteikarten",
      text: "Key Concepts aktiv abrufen",
      meta: `${st.cardsDue} fällig · ${st.cardsNew} neu`,
    },
    {
      href: `${base}/practice?mode=due`,
      icon: RotateCcw,
      title: "Wiederholung",
      text: "Was heute fällig ist",
      meta: `${st.due} fällig`,
    },
    {
      href: `${base}/practice?mode=weak`,
      icon: Target,
      title: "Schwächen-Training",
      text: "Deine unsichersten Fragen",
      meta: st.seen ? "gezielt" : "erst nach ein paar Fragen",
    },
    {
      href: `${base}/blitz`,
      icon: Zap,
      title: "Blitzrunde",
      text: "60 Sek. True/False",
      meta: s.blitzBest[subject.id] ? `Rekord ${s.blitzBest[subject.id]}` : "noch kein Rekord",
    },
  ];

  return (
    <div className="space-y-8">
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
        <h1 className="display text-4xl sm:text-5xl mt-3">{subject.name}</h1>
        <p className="mt-2 max-w-2xl text-muted">{subject.description}</p>
      </header>

      {subject.demo && (
        <div className="flex gap-3 rounded-2xl border border-warn/30 bg-warn-soft p-4 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-warn" />
          <p>
            <strong>Demo-Inhalte.</strong> Diese Fragen sind ein Platzhalter-Set. Sobald du die Key Messages der
            Vorlesungen hochlädst, werden sie durch Fragen aus deinen Dokumenten ersetzt.
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

      <section className="card grid gap-8 p-6 sm:grid-cols-[auto_1fr] sm:p-8">
        <div className="flex justify-center">
          <ProgressRing value={st.readiness} size={176} stroke={12} color={subject.color}>
            <span>
              <span className="display block text-5xl tabular-nums">{Math.round(st.readiness * 100)}</span>
              <span className="eyebrow">Prozent</span>
            </span>
          </ProgressRing>
        </div>
        <div className="flex flex-col justify-center">
          <p className="eyebrow">Prognose {f.name}</p>
          <h2 className="display mt-1 text-3xl">{readinessLabel(st.readiness)}</h2>
          <p className="mt-2 max-w-md text-sm text-muted">
            Geschätzter Score, wenn die Prüfung jetzt wäre: deine Sicherheit pro Fragetyp, gewichtet wie in der
            Prüfung ({f.short} Kurzantwort · {f.mc} Multiple Choice · {f.tf} True/False).
          </p>
          <div className="mt-4 grid max-w-md gap-2.5">
            {(
              [
                ["Multiple Choice", st.masteryByType.mc],
                ["True / False", st.masteryByType.tf],
                ["Kurzantwort", st.masteryByType.short],
              ] as const
            ).map(([label, v]) => (
              <div key={label} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                <span className="text-ink-2">{label}</span>
                <Bar value={v} color={subject.color} />
                <span className="text-right tabular-nums text-muted">{Math.round(v * 100)}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <ButtonLink href={`${base}/practice?mode=smart`}>
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
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="display text-2xl">Lernpfad</h2>
            <p className="text-sm text-muted">Ein Kapitel pro Key-Messages-Dokument – jedes mit eigenem Level.</p>
          </div>
          <Chip>
            {mastered}/{st.lectures.length} gemeistert
          </Chip>
        </div>
        <ol className="relative space-y-3">
          <span className="absolute bottom-6 left-[2.35rem] top-6 w-px bg-line-strong sm:left-[2.6rem]" aria-hidden />
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
                  className="card group flex items-center gap-4 p-3 pr-5 transition hover:-translate-y-0.5 sm:p-4"
                >
                  <span className="rounded-full bg-surface">
                    <LevelBadge ch={l} color={subject.color} />
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
                  Abschlusstest · {f.name}
                </span>
                <span className="block font-semibold sm:text-lg">Fragen aus allen {st.lectures.length} Kapiteln</span>
                <span className="mt-0.5 block text-xs opacity-70">
                  {f.short + f.mc + f.tf} Fragen · {f.minutes} Min{best ? ` · Bestwert ${pct(best)}` : ""}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 opacity-70 transition group-hover:translate-x-0.5" />
            </Link>
          </motion.li>
        </ol>
      </section>

      <section>
        <h2 className="display mb-3 text-2xl">Freies Training</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {modes.map((m, i) => (
            <motion.div key={m.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link href={m.href} className="card group flex h-full flex-col p-4 transition hover:-translate-y-0.5">
                <span
                  className="grid size-10 place-items-center rounded-xl"
                  style={{ background: alpha(subject.color, 0.1), color: subject.color }}
                >
                  <m.icon className="size-5" />
                </span>
                <span className="mt-3 font-semibold leading-tight">{m.title}</span>
                <span className="text-sm text-muted">{m.text}</span>
                <span className="mt-auto pt-3 text-xs font-semibold text-ink-2">{m.meta}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {exams.length > 0 && (
        <section>
          <h2 className="display mb-3 text-2xl">Abschlusstests</h2>
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
                      {sc.correct}/{sc.total} richtig
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
