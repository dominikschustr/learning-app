"use client";

import { ArrowRight, CalendarClock, Check, ChevronDown, Flame, Info, Lock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { ACHIEVEMENTS, levelInfo, titleFor } from "@/lib/gamification";
import { READINESS_TARGET, countdown, fmtExamDate, studyPlan, type PlanEntry, type Priority } from "@/lib/plan";
import { subjectStats } from "@/lib/progress";
import type { CalendarEntry, SubjectSummary } from "@/lib/schema";
import { achievementProgress, useApp, useHydrated, visibleStreak } from "@/lib/store";
import { useMobile } from "@/lib/useMobile";
import { useNow } from "@/lib/useNow";
import { alpha, cn, dayKey } from "@/lib/utils";
import { Heatmap } from "./Heatmap";
import { Icon } from "./Icon";
import { Bar, Chip, ProgressRing, Skeleton } from "./ui";

const PRIORITY: Record<Priority, { label: string; className: string; dot: string }> = {
  hoch: { label: "Priorität hoch", className: "bg-bad-soft text-bad", dot: "bg-bad" },
  mittel: { label: "Priorität mittel", className: "bg-warn-soft text-warn", dot: "bg-warn" },
  niedrig: { label: "Priorität niedrig", className: "bg-surface-2 text-muted", dot: "bg-line-strong" },
  sicher: { label: "Ziel erreicht", className: "bg-good-soft text-good", dot: "bg-good" },
};

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
  const planOf = new Map(plan.upcoming.map((e) => [e.key, e]));
  // Fach mit dem größten Anteil der Lernzeit heute
  const focusKey = plan.upcoming.filter((e) => e.share > 0).toSorted((a, b) => b.share - a.share)[0]?.key;
  // Klausuren ohne Fach in der App (content/calendar.json)
  const external = plan.upcoming.filter((e) => e.readiness === undefined);
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
        <div className="mb-3 flex items-baseline justify-between gap-3 sm:mb-4">
          <h2 className="display text-2xl">Deine Fächer</h2>
          {plan.upcoming.length > 0 && <span className="text-xs text-muted">nach Klausurtermin</span>}
        </div>
        {external.length > 0 && (
          <ul className="mb-3 space-y-2 sm:mb-4">
            {external.map((e) => (
              <ExternalExam key={e.key} e={e} />
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {sorted.map(({ summary, st }, i) => (
            <motion.div
              key={summary.subject.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="min-w-0"
            >
              <SubjectTile
                summary={summary}
                st={st}
                days={daysTo.get(summary.subject.id)}
                entry={planOf.get(summary.subject.id)}
                focus={summary.subject.id === focusKey}
                mobile={mobile}
              />
            </motion.div>
          ))}
        </div>
        {focusKey && (
          <details className="mt-3 text-xs leading-relaxed text-muted">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-semibold text-ink-2">
              <Info className="size-3.5" /> Wie wird priorisiert?
            </summary>
            <p className="mt-2 max-w-prose">
              Anteil der Lernzeit = was bis {Math.round(READINESS_TARGET * 100)} % Readiness fehlt, geteilt durch die Tage
              bis zur Klausur – nahe Klausuren mit viel Rückstand zuerst. Er verschiebt sich, sobald du lernst.
              {external.length > 0 &&
                ` Für ${external.map((e) => e.name).join(" und ")} plane zusätzlich Zeit ein – ${external.length === 1 ? "das Fach ist" : "die Fächer sind"} nicht in der App.`}
            </p>
          </details>
        )}
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

type Stats = ReturnType<typeof subjectStats>;

/**
 * Fachkachel mit integriertem Prüfungsplan: Priorität und Anteil der Lernzeit heute.
 * Am Desktop ersetzt die Klausurzeile die Beschreibung, auf dem Handy bleibt es bei Chip, Titel und einer Zeile.
 */
function SubjectTile({
  summary,
  st,
  days,
  entry,
  focus,
  mobile,
}: {
  summary: SubjectSummary;
  st: Stats;
  days?: number;
  entry?: PlanEntry;
  focus: boolean;
  mobile: boolean;
}) {
  const { subject } = summary;
  const soon = days !== undefined && days >= 0 && days <= 7;
  const priority = entry?.priority ? PRIORITY[entry.priority] : null;
  const share = entry && entry.share > 0 ? Math.round(entry.share * 100) : null;

  return (
    <Link
      href={`/s/${subject.id}`}
      className="card group relative block overflow-hidden p-4 transition hover:-translate-y-0.5 sm:p-6"
    >
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: subject.color }} aria-hidden />
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
              <Chip className={cn("sm:hidden", soon && "border-bad/40 text-bad")}>
                <CalendarClock className="size-3" />
                {days >= 0 ? `Klausur ${countdown(days)}` : "geschrieben"}
              </Chip>
            )}
            {priority && (
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold max-sm:hidden", priority.className)}>
                {priority.label}
              </span>
            )}
          </div>
          <h3 className="display mt-2 truncate text-xl sm:mt-3 sm:text-2xl">{subject.name}</h3>
          {/* Desktop: Klausurtermin statt Beschreibung – die steht auf der Fachseite */}
          {days !== undefined && entry ? (
            <p className={cn("mt-1 flex items-center gap-1.5 text-sm max-sm:hidden", soon ? "font-semibold text-bad" : "text-muted")}>
              <CalendarClock className="size-3.5 shrink-0" />
              Klausur {fmtExamDate(entry.date)} · {countdown(days)}
            </p>
          ) : days !== undefined && days < 0 ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted max-sm:hidden">
              <Check className="size-3.5 shrink-0" /> Klausur geschrieben
            </p>
          ) : (
            <p className="mt-1 line-clamp-2 text-sm text-muted max-sm:hidden">{subject.description}</p>
          )}
          {/* Handy: Priorität als Punkt und Anteil der Lernzeit in einer Zeile */}
          {priority && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted sm:hidden">
              <span className={cn("size-2 shrink-0 rounded-full", priority.dot)} title={priority.label} />
              {share !== null ? `${share} % der Lernzeit heute` : priority.label}
            </p>
          )}
          <div className="mt-4 hidden flex-wrap gap-2 sm:flex">
            <Chip>{st.due + st.cardsDue} fällig</Chip>
            <Chip>
              {st.seen}/{st.total} Fragen gesehen
            </Chip>
          </div>
        </div>
        <ProgressRing value={st.readiness} size={mobile ? 60 : 96} stroke={mobile ? 6 : 8} color={subject.color}>
          <span>
            <span className="display block text-base tabular-nums sm:text-xl">{Math.round(st.readiness * 100)}</span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-muted sm:block">Readiness</span>
          </span>
        </ProgressRing>
      </div>
      <div className="mt-5 hidden items-center justify-between gap-4 sm:flex">
        <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: subject.color }}>
          {focus ? "Heute zuerst" : "Weiterlernen"}{" "}
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </span>
        {share !== null && (
          <span className="flex min-w-0 items-center gap-2 text-xs tabular-nums text-muted" title="Anteil deiner Lernzeit heute">
            <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-2 lg:w-24">
              <span className="block h-full rounded-full" style={{ width: `${share}%`, background: subject.color }} />
            </span>
            {share} % der Lernzeit
          </span>
        )}
      </div>
    </Link>
  );
}

/** Klausur ohne Fach in der App: schlichte Zeile ohne Statistik */
function ExternalExam({ e }: { e: PlanEntry }) {
  const soon = e.days <= 7;
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-2.5 text-sm">
      <CalendarClock className="size-4 shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-semibold text-ink-2">{e.name}</span>
        <span className="text-muted max-sm:hidden"> · nicht in der App</span>
      </span>
      <span className={cn("shrink-0 text-xs tabular-nums", soon ? "font-semibold text-bad" : "text-muted")}>
        <span className="max-sm:hidden">{fmtExamDate(e.date)} · </span>
        {countdown(e.days)}
      </span>
    </li>
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
