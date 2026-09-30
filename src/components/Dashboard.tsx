"use client";

import { ArrowRight, Flame, Lock } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { ACHIEVEMENTS, levelInfo, titleFor } from "@/lib/gamification";
import { subjectStats } from "@/lib/progress";
import type { SubjectSummary } from "@/lib/schema";
import { useApp, useHydrated, visibleStreak } from "@/lib/store";
import { useNow } from "@/lib/useNow";
import { alpha, dayKey } from "@/lib/utils";
import { Heatmap } from "./Heatmap";
import { Icon } from "./Icon";
import { Bar, Chip, ProgressRing, Skeleton } from "./ui";

function greeting(hour: number) {
  if (hour < 5) return "Späte Schicht";
  if (hour < 11) return "Guten Morgen";
  if (hour < 17) return "Hallo";
  if (hour < 22) return "Guten Abend";
  return "Späte Schicht";
}

export function Dashboard({ summaries }: { summaries: SubjectSummary[] }) {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40" />
        <Skeleton className="h-56" />
      </div>
    );
  }
  return <DashboardInner summaries={summaries} />;
}

function DashboardInner({ summaries }: { summaries: SubjectSummary[] }) {
  const s = useApp();
  const now = useNow();
  const today = s.activity[dayKey(now)] ?? 0;
  const lvl = levelInfo(s.xp);
  const streak = visibleStreak(s.streak, now);

  return (
    <div className="space-y-10">
      <section>
        <p className="eyebrow">{greeting(new Date(now).getHours())}</p>
        <h1 className="display text-4xl sm:text-5xl mt-2">
          Was lernen wir <span className="text-accent">heute</span>?
        </h1>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-5 p-5">
          <ProgressRing value={today / s.dailyGoal} size={84} stroke={8} color="var(--good)">
            <span className="display text-lg tabular-nums">{today}</span>
          </ProgressRing>
          <div>
            <p className="eyebrow">Tagesziel</p>
            <p className="mt-1 text-2xl font-semibold">
              {today} <span className="text-muted">/ {s.dailyGoal}</span>
            </p>
            <p className="text-sm text-muted">
              {today >= s.dailyGoal ? "Geschafft – alles Weitere ist Bonus." : `Noch ${s.dailyGoal - today} Antworten`}
            </p>
          </div>
        </div>

        <div className="card flex items-center gap-5 p-5">
          <div className="grid size-[84px] shrink-0 place-items-center rounded-full bg-warn-soft">
            <Flame className="size-9 text-flame" fill={streak ? "currentColor" : "none"} />
          </div>
          <div>
            <p className="eyebrow">Streak</p>
            <p className="mt-1 text-2xl font-semibold">
              {streak} {streak === 1 ? "Tag" : "Tage"}
            </p>
            <p className="text-sm text-muted">Rekord: {s.streak.best}</p>
          </div>
        </div>

        <div className="card flex flex-col justify-center gap-3 p-5">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">Level {lvl.level}</p>
            <p className="text-sm text-muted">{s.xp} XP</p>
          </div>
          <p className="display text-2xl">{titleFor(lvl.level)}</p>
          <Bar value={lvl.progress} />
          <p className="text-xs text-muted">
            {lvl.needed - lvl.into} XP bis Level {lvl.level + 1}
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="display text-2xl">Deine Fächer</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {summaries.map((summary, i) => {
            const st = subjectStats(summary, s.items, s.cards, now);
            const { subject } = summary;
            return (
              <motion.div
                key={subject.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  href={`/s/${subject.id}`}
                  className="card group relative block overflow-hidden p-6 transition hover:-translate-y-0.5"
                >
                  <div
                    className="absolute inset-x-0 top-0 h-1.5"
                    style={{ background: subject.color }}
                    aria-hidden
                  />
                  <div className="flex items-start gap-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-md px-2 py-0.5 text-xs font-bold"
                          style={{ background: alpha(subject.color, 0.12), color: subject.color }}
                        >
                          {subject.short}
                        </span>
                        {subject.demo && <Chip>Demo-Inhalte</Chip>}
                      </div>
                      <h3 className="display mt-3 text-2xl">{subject.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{subject.description}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Chip>
                          {st.due + st.cardsDue} fällig
                        </Chip>
                        <Chip>
                          {st.seen}/{st.total} Fragen gesehen
                        </Chip>
                      </div>
                    </div>
                    <ProgressRing value={st.readiness} size={96} stroke={8} color={subject.color}>
                      <span>
                        <span className="display block text-xl tabular-nums">{Math.round(st.readiness * 100)}</span>
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted">
                          Readiness
                        </span>
                      </span>
                    </ProgressRing>
                  </div>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: subject.color }}>
                    Weiterlernen <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="card p-6">
          <h2 className="display text-2xl">Aktivität</h2>
          <p className="mb-4 text-sm text-muted">Beantwortete Fragen und Karten pro Tag</p>
          <Heatmap activity={s.activity} goal={s.dailyGoal} />
        </div>
        <div className="card p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="display text-2xl">Achievements</h2>
            <span className="text-sm text-muted">
              {Object.keys(s.achievements).length} / {ACHIEVEMENTS.length}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {ACHIEVEMENTS.map((a) => {
              const got = !!s.achievements[a.id];
              return (
                <div
                  key={a.id}
                  title={`${a.title}: ${a.description}`}
                  className={
                    "flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center " +
                    (got ? "border-warn/30 bg-warn-soft" : "border-line opacity-55")
                  }
                >
                  <span className={"grid size-9 place-items-center rounded-full " + (got ? "bg-surface text-warn" : "bg-surface-2 text-muted")}>
                    {got ? <Icon name={a.icon} className="size-4" /> : <Lock className="size-3.5" />}
                  </span>
                  <span className="text-[11px] font-semibold leading-tight">{a.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
