"use client";

import { ArrowRight, CalendarClock, Check, ChevronDown, Flame, Lock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { ACHIEVEMENTS, levelInfo, titleFor } from "@/lib/gamification";
import { countdown, studyPlan } from "@/lib/plan";
import { subjectStats } from "@/lib/progress";
import type { CalendarEntry, SubjectSummary } from "@/lib/schema";
import { achievementProgress, useApp, useHydrated, visibleStreak } from "@/lib/store";
import { useMobile } from "@/lib/useMobile";
import { useNow } from "@/lib/useNow";
import { alpha, cn, dayKey } from "@/lib/utils";
import { Heatmap } from "./Heatmap";
import { Icon } from "./Icon";
import { StudyPlan } from "./StudyPlan";
import { Bar, Chip, ProgressRing, Skeleton } from "./ui";

function greeting(hour: number) {
  if (hour < 5) return "Späte Schicht";
  if (hour < 11) return "Guten Morgen";
  if (hour < 17) return "Hallo";
  if (hour < 22) return "Guten Abend";
  return "Späte Schicht";
}

export function Dashboard({ summaries, calendar }: { summaries: SubjectSummary[]; calendar: CalendarEntry[] }) {
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
  return <DashboardInner summaries={summaries} calendar={calendar} />;
}

function DashboardInner({ summaries, calendar }: { summaries: SubjectSummary[]; calendar: CalendarEntry[] }) {
  const s = useApp();
  const now = useNow();
  const today = s.activity[dayKey(now)] ?? 0;
  const unlockedCount = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;
  const lvl = levelInfo(s.xp);
  const streak = visibleStreak(s.streak, now);
  const subjects = summaries.map((summary) => ({ summary, st: subjectStats(summary, s.items, s.cards, now) }));
  const plan = studyPlan(
    [
      ...subjects.flatMap(({ summary: { subject }, st }) =>
        subject.examDate
          ? [
              {
                key: subject.id,
                name: subject.name,
                date: subject.examDate,
                short: subject.short,
                color: subject.color,
                href: `/s/${subject.id}`,
                readiness: st.readiness,
              },
            ]
          : [],
      ),
      ...calendar.map((c) => ({ key: `cal-${c.name}`, name: c.name, date: c.date })),
    ],
    now,
  );
  const daysTo = new Map([...plan.upcoming, ...plan.past].map((e) => [e.key, e.days]));
  // Fächer nach Klausurtermin: anstehende zuerst, geschriebene und ohne Termin danach
  const order = (id: string) => {
    const d = daysTo.get(id);
    return d === undefined ? 1e6 : d < 0 ? 1e5 - d : d;
  };
  const sorted = subjects.toSorted((a, b) => order(a.summary.subject.id) - order(b.summary.subject.id));
  const mobile = useMobile();
  // Aktivität und Achievements sind auf dem Handy eingeklappt
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="space-y-6 sm:space-y-10">
      <section>
        <p className="eyebrow">{greeting(new Date(now).getHours())}</p>
        <h1 className="display mt-1 text-3xl sm:mt-2 sm:text-5xl">
          Was lernen wir <span className="text-accent">heute</span>?
        </h1>
      </section>

      {/* Handy: nur das Tagesziel – Streak und Level stehen schon in der Kopfleiste */}
      <section className="card p-4 sm:hidden">
        <p className="flex items-baseline justify-between text-sm">
          <span className="font-semibold">Tagesziel</span>
          <span className="tabular-nums text-muted">
            {today >= s.dailyGoal ? "geschafft · " : ""}
            {today} / {s.dailyGoal}
          </span>
        </p>
        <Bar value={today / s.dailyGoal} color="var(--good)" className="mt-2" />
      </section>

      <StudyPlan upcoming={plan.upcoming} past={plan.past} />

      <section className="hidden gap-4 sm:grid sm:grid-cols-3">
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
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {sorted.map(({ summary, st }, i) => {
            const { subject } = summary;
            const days = daysTo.get(subject.id);
            return (
              <motion.div
                key={subject.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  href={`/s/${subject.id}`}
                  className="card group relative block overflow-hidden p-4 transition hover:-translate-y-0.5 sm:p-6"
                >
                  <div
                    className="absolute inset-x-0 top-0 h-1.5"
                    style={{ background: subject.color }}
                    aria-hidden
                  />
                  <div className="flex items-center gap-4 sm:items-start sm:gap-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-md px-2 py-0.5 text-xs font-bold"
                          style={{ background: alpha(subject.color, 0.12), color: subject.color }}
                        >
                          {subject.short}
                        </span>
                        {subject.demo && <Chip>Demo-Inhalte</Chip>}
                        {days !== undefined && (
                          <Chip className={days >= 0 && days <= 7 ? "border-bad/40 text-bad" : undefined}>
                            <CalendarClock className="size-3" />
                            {days >= 0 ? `Klausur ${countdown(days)}` : "geschrieben"}
                          </Chip>
                        )}
                      </div>
                      <h3 className="display mt-2 truncate text-xl sm:mt-3 sm:text-2xl">{subject.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted max-sm:hidden">{subject.description}</p>
                      <div className="mt-4 hidden flex-wrap gap-2 sm:flex">
                        <Chip>
                          {st.due + st.cardsDue} fällig
                        </Chip>
                        <Chip>
                          {st.seen}/{st.total} Fragen gesehen
                        </Chip>
                      </div>
                    </div>
                    <ProgressRing value={st.readiness} size={mobile ? 60 : 96} stroke={mobile ? 6 : 8} color={subject.color}>
                      <span>
                        <span className="display block text-base tabular-nums sm:text-xl">{Math.round(st.readiness * 100)}</span>
                        <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-muted sm:block">
                          Readiness
                        </span>
                      </span>
                    </ProgressRing>
                  </div>
                  <span className="mt-5 hidden items-center gap-1 text-sm font-semibold sm:inline-flex" style={{ color: subject.color }}>
                    Weiterlernen <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        aria-expanded={showMore}
        className="flex w-full items-center justify-center gap-1.5 rounded-full border border-line py-2.5 text-sm font-semibold text-ink-2 sm:hidden"
      >
        {showMore ? "Aktivität & Achievements ausblenden" : "Aktivität & Achievements"}
        <ChevronDown className={cn("size-4 transition", showMore && "rotate-180")} />
      </button>

      <section className={cn("gap-4 sm:grid lg:grid-cols-[1fr_1.1fr]", showMore ? "grid" : "hidden")}>
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
