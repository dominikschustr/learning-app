"use client";

import {
  ArrowLeft,
  ArrowRight,
  Brain,
  FileText,
  Info,
  Layers,
  Play,
  RotateCcw,
  Target,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { subjectStats } from "@/lib/progress";
import type { SubjectSummary } from "@/lib/schema";
import { examScore, useApp, useHydrated } from "@/lib/store";
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
  const st = subjectStats(summary, s.items, s.cards, now);
  const f = subject.examFormat;
  const base = `/s/${subject.id}`;
  const exams = s.exams.filter((e) => e.subjectId === subject.id).toReversed();
  const best = exams.reduce((b, e) => Math.max(b, examScore(e).score), 0);
  const active = s.activeExam?.subjectId === subject.id ? s.activeExam : null;
  const weakest = [...st.lectures].filter((l) => l.total).sort((a, b) => a.mastery - b.mastery)[0];

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
      href: `${base}/exam`,
      icon: FileText,
      title: `${f.name}-Simulation`,
      text: `${f.short + f.mc + f.tf} Fragen · ${f.minutes} Min`,
      meta: best ? `Bestwert ${pct(best)}` : "noch keine",
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
        <h1 className="display mt-3 text-5xl sm:text-6xl">{subject.name}</h1>
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
          href={`${base}/exam`}
          className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-surface p-4 text-sm font-semibold text-accent"
        >
          <Play className="size-4" /> Laufende Simulation fortsetzen
          <ArrowRight className="ml-auto size-4" />
        </Link>
      )}

      <section className="card grid gap-8 p-6 sm:grid-cols-[auto_1fr] sm:p-8">
        <div className="flex justify-center">
          <ProgressRing value={st.readiness} size={176} stroke={12} color={subject.color}>
            <span>
              <span className="display block text-6xl">{Math.round(st.readiness * 100)}</span>
              <span className="eyebrow">Prozent</span>
            </span>
          </ProgressRing>
        </div>
        <div className="flex flex-col justify-center">
          <p className="eyebrow">Prognose {f.name}</p>
          <h2 className="display mt-1 text-4xl">{readinessLabel(st.readiness)}</h2>
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
              <ButtonLink variant="secondary" href={`${base}/practice?mode=lecture&lecture=${weakest.id}`}>
                Schwächste Vorlesung üben
              </ButtonLink>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {modes.map((m, i) => (
          <motion.div
            key={m.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={i === 3 ? "col-span-2 lg:col-span-1" : undefined}
          >
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
      </section>

      <section>
        <h2 className="display mb-3 text-3xl">Vorlesungen</h2>
        <div className="card divide-y divide-line">
          {st.lectures.map((l, i) => (
            <div key={l.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
              <span className="display w-8 text-3xl text-muted">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{l.title}</p>
                <div className="mt-2 flex items-center gap-3">
                  <Bar value={l.mastery} color={subject.color} className="max-w-xs" />
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {Math.round(l.mastery * 100)} % · {l.seen}/{l.total} gesehen
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <ButtonLink variant="secondary" className="h-9 px-4" href={`${base}/cards?lecture=${l.id}`}>
                  Karten
                </ButtonLink>
                <ButtonLink className="h-9 px-4" href={`${base}/practice?mode=lecture&lecture=${l.id}`} aria-disabled={!l.total}>
                  Üben
                </ButtonLink>
              </div>
            </div>
          ))}
        </div>
      </section>

      {exams.length > 0 && (
        <section>
          <h2 className="display mb-3 text-3xl">Simulationen</h2>
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
                    className="display w-16 text-3xl tabular-nums"
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
