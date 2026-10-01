"use client";

import { ArrowRight, Check, Flame, Lock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { ACHIEVEMENTS, levelInfo, titleFor } from "@/lib/gamification";
import { subjectStats } from "@/lib/progress";
import type { SubjectSummary } from "@/lib/schema";
import { achievementProgress, useApp, useHydrated, visibleStreak } from "@/lib/store";
import { useNow } from "@/lib/useNow";
import { alpha, cn, dayKey } from "@/lib/utils";
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
  const unlockedCount = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;
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
            <span className="text-sm text-muted tabular-nums">
              {unlockedCount} / {ACHIEVEMENTS.length}
            </span>
          </div>
          <Achievements
            unlocked={s.achievements}
            progress={{ ...achievementProgress(s, now), "daily-goal": today }}
            targets={{ "daily-goal": s.dailyGoal }}
          />
        </div>
      </section>
    </div>
  );
}

/** Kompakte Kacheln; Antippen zeigt, wie man das Achievement freischaltet, und den Fortschritt. */
function Achievements({
  unlocked,
  progress,
  targets,
}: {
  unlocked: Record<string, number>;
  progress: Record<string, number>;
  /** abweichende Zielwerte für die Anzeige (z. B. Tagesziel) */
  targets: Record<string, number>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = ACHIEVEMENTS.find((a) => a.id === openId);

  return (
    <>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {ACHIEVEMENTS.map((a) => {
          const got = !!unlocked[a.id];
          const active = a.id === openId;
          return (
            <button
              key={a.id}
              type="button"
              aria-expanded={active}
              onClick={() => setOpenId(active ? null : a.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition",
                got ? "border-warn/30 bg-warn-soft" : "border-line",
                !got && !active && "opacity-55 hover:opacity-80",
                active && "ring-2 ring-accent/40",
              )}
            >
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-full",
                  got ? "bg-surface text-warn" : "bg-surface-2 text-muted",
                )}
              >
                {got ? <Icon name={a.icon} className="size-4" /> : <Lock className="size-3.5" />}
              </span>
              <span className="text-[11px] font-semibold leading-tight">{a.title}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key={open.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <AchievementDetail
              a={open}
              at={unlocked[open.id]}
              value={progress[open.id] ?? 0}
              target={targets[open.id] ?? open.target}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function AchievementDetail({
  a,
  at,
  value,
  target,
}: {
  a: (typeof ACHIEVEMENTS)[number];
  at?: number;
  value: number;
  target: number;
}) {
  return (
    <div className="mt-3 flex gap-3 rounded-xl bg-surface-2 p-4">
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full",
          at ? "bg-warn-soft text-warn" : "bg-surface text-muted",
        )}
      >
        <Icon name={a.icon} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline justify-between gap-2">
          <span className="font-semibold">{a.title}</span>
          {at ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-warn">
              <Check className="size-3.5" />
              {new Date(at).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          ) : (
            <span className="shrink-0 text-xs font-semibold tabular-nums text-muted">
              {Math.min(value, target)} / {target}
              {a.unit === "%" && " %"}
            </span>
          )}
        </p>
        <p className="text-sm text-ink-2">{at ? a.description : a.howTo}</p>
        {!at && <Bar value={value / target} className="mt-2.5 h-1.5" />}
      </div>
    </div>
  );
}
