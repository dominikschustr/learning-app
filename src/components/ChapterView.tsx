"use client";

import { ArrowLeft, ArrowRight, BookOpen, Bookmark, FileText, Layers, ScrollText, Trophy } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { chapterFormat } from "@/lib/exam";
import { LECTURE_SIZE } from "@/lib/queue";
import { LEVEL_NAMES, subjectStats, type ChapterStats } from "@/lib/progress";
import type { QuestionType, SubjectSummary } from "@/lib/schema";
import { chapterBests, examScore, markedIds, useApp, useHydrated } from "@/lib/store";
import { useNow } from "@/lib/useNow";
import { statusCounts, type ItemState, type ItemStatus } from "@/lib/srs";
import { alpha, cn, itemKey, pct } from "@/lib/utils";
import { Bar, ButtonLink, Chip, ProgressRing, Skeleton } from "./ui";

export function ChapterView({ summary, chapterId }: { summary: SubjectSummary; chapterId: string }) {
  const hydrated = useHydrated();
  if (!hydrated) return <Skeleton className="h-96" />;
  return <Inner summary={summary} chapterId={chapterId} />;
}

/** Kleiner Level-Ring mit Levelnummer – auch im Lernpfad verwendet. */
export function LevelBadge({ ch, color, size = 56 }: { ch: ChapterStats; color: string; size?: number }) {
  const done = ch.level.level === 5;
  return (
    <ProgressRing value={done ? 1 : ch.level.progress} size={size} stroke={Math.max(4, size / 12)} color={done ? "var(--good)" : color}>
      {done ? (
        <Trophy className="text-good" style={{ width: size / 2.6, height: size / 2.6 }} />
      ) : (
        <span className="display tabular-nums" style={{ fontSize: size / 3 }}>
          {ch.level.level}
        </span>
      )}
    </ProgressRing>
  );
}

function Inner({ summary, chapterId }: { summary: SubjectSummary; chapterId: string }) {
  const { subject } = summary;
  const s = useApp();
  const now = useNow();
  const st = subjectStats(summary, s.items, s.cards, now, chapterBests(s.exams, subject.id));
  const index = subject.lectures.findIndex((l) => l.id === chapterId);
  const ch = st.lectures[index];
  const prev = subject.lectures[index - 1];
  const next = subject.lectures[index + 1];
  const base = `/s/${subject.id}`;
  const [code, ...rest] = ch.title.split(" · ");
  const title = rest.join(" · ") || ch.title;

  const tests = s.exams.filter((e) => e.subjectId === subject.id && e.lecture === chapterId).toReversed();
  const fmt = chapterFormat(summary.items, chapterId, subject.examFormat);
  const testCount = fmt.short + fmt.mc + fmt.tf;

  const byType = (t: QuestionType) => summary.items.filter((i) => i.lecture === chapterId && i.type === t).length;

  const hasText = summary.texts.includes(chapterId);
  const qMarks = markedIds(s.marks, "q", subject.id);
  const cMarks = markedIds(s.marks, "c", subject.id);
  const markedQ = summary.items.filter((i) => i.lecture === chapterId && qMarks.has(i.id)).length;
  const markedC = summary.cards.filter((c) => c.lecture === chapterId && cMarks.has(c.id)).length;
  const actions = [
    ...(hasText
      ? [
          {
            href: `${base}/c/${chapterId}/text`,
            icon: ScrollText,
            title: "Nachlesen",
            text: "Key Messages, Definitionen & Denkanstöße im Original",
            meta: "Originaltext",
          },
        ]
      : []),
    {
      href: `${base}/cards?lecture=${chapterId}`,
      icon: Layers,
      title: "Karteikarten",
      text: `${ch.cards} Key Concepts & Definitionen`,
      meta: `${Math.round(ch.cardMastery * 100)} % sicher`,
    },
    {
      href: `${base}/practice?mode=lecture&lecture=${chapterId}`,
      icon: BookOpen,
      title: "Üben",
      text: `Je Durchgang ${Math.min(LECTURE_SIZE, ch.total)} wechselnde aus ${ch.total} Fragen, mit sofortigem Feedback`,
      meta: `${ch.seen}/${ch.total} gesehen`,
    },
    {
      href: `${base}/exam?chapter=${chapterId}`,
      icon: FileText,
      title: "Kapiteltest",
      text: `${testCount} Fragen · ${fmt.minutes} Min · ohne Feedback`,
      meta: ch.testBest ? `Bestwert ${pct(ch.testBest)}` : "≥ 80 % für „Gemeistert“",
    },
  ];

  return (
    <div className="space-y-8">
      <Link href={base} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {subject.name}
      </Link>

      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">
            Kapitel {index + 1} von {subject.lectures.length} · {code}
          </p>
          <h1 className="display text-4xl sm:text-5xl mt-2">{title}</h1>
          <p className="mt-2 text-sm text-muted">
            {byType("mc")} Multiple Choice · {byType("tf")} True/False · {byType("short")} Kurzantwort · {ch.cards} Karten
          </p>
        </div>
      </header>

      <section className="card grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:p-8">
        <div className="flex justify-center">
          <LevelBadge ch={ch} color={subject.color} size={150} />
        </div>
        <div className="flex flex-col justify-center">
          <p className="eyebrow">Kapitel-Level {ch.level.level} / 5</p>
          <h2 className="display mt-1 text-3xl">{ch.level.name}</h2>
          <p className="mt-2 text-sm text-ink-2">{ch.level.hint}</p>

          <div className="mt-5 flex gap-1.5">
            {LEVEL_NAMES.slice(1).map((name, i) => {
              const lvl = i + 1;
              const reached = ch.level.level >= lvl;
              return (
                <div key={name} className="flex-1">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ background: reached ? (lvl === 5 ? "var(--good)" : subject.color) : "var(--line)" }}
                  />
                  <p className={cn("mt-1.5 hidden text-[11px] sm:block", reached ? "font-semibold text-ink" : "text-muted")}>
                    {name}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-5 grid max-w-md gap-2 text-sm">
            <div className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3">
              <span className="text-ink-2">Fragen</span>
              <Bar value={ch.mastery} color={subject.color} />
              <span className="text-right tabular-nums text-muted">{Math.round(ch.mastery * 100)}</span>
            </div>
            <div className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3">
              <span className="text-ink-2">Karteikarten</span>
              <Bar value={ch.cardMastery} color={subject.color} />
              <span className="text-right tabular-nums text-muted">{Math.round(ch.cardMastery * 100)}</span>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="display mb-3 text-2xl">Dein Stand</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <StatusCard
            title="Übungsfragen"
            states={summary.items.filter((i) => i.lecture === chapterId).map((i) => s.items[itemKey(subject.id, i.id)])}
            labels={QUESTION_LABELS}
            color={subject.color}
            newHref={`${base}/practice?mode=new&lecture=${chapterId}`}
            wrongHref={`${base}/practice?mode=wrong&lecture=${chapterId}`}
            noun={["Frage", "Fragen"]}
          />
          <StatusCard
            title="Karteikarten"
            states={summary.cards.filter((c) => c.lecture === chapterId).map((c) => s.cards[itemKey(subject.id, c.id)])}
            labels={CARD_LABELS}
            color={subject.color}
            newHref={`${base}/cards?filter=new&lecture=${chapterId}`}
            wrongHref={`${base}/cards?filter=wrong&lecture=${chapterId}`}
            noun={["Karte", "Karten"]}
          />
        </div>
      </section>

      <section className={cn("grid gap-3 sm:grid-cols-2", actions.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
        {actions.map((a, i) => (
          <motion.div key={a.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link href={a.href} className="card group flex h-full flex-col p-5 transition hover:-translate-y-0.5">
              <span
                className="grid size-11 place-items-center rounded-xl"
                style={{ background: alpha(subject.color, 0.1), color: subject.color }}
              >
                <a.icon className="size-5" />
              </span>
              <span className="mt-4 text-lg font-semibold">{a.title}</span>
              <span className="text-sm text-muted">{a.text}</span>
              <span className="mt-auto flex items-center justify-between pt-4 text-xs font-semibold text-ink-2">
                {a.meta}
                <ArrowRight className="size-4 text-muted transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          </motion.div>
        ))}
      </section>

      {(markedQ > 0 || markedC > 0) && (
        <section className="card flex flex-wrap items-center gap-3 p-4">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"
          >
            <Bookmark className="size-5" fill="currentColor" />
          </span>
          <span className="flex-1 text-sm">
            <span className="block font-semibold">Deine Lesezeichen in diesem Kapitel</span>
            <span className="text-muted">
              {[markedQ && `${markedQ} ${markedQ === 1 ? "Frage" : "Fragen"}`, markedC && `${markedC} ${markedC === 1 ? "Karte" : "Karten"}`]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          <span className="flex flex-wrap gap-2">
            {markedQ > 0 && (
              <ButtonLink variant="secondary" href={`${base}/practice?mode=marked&lecture=${chapterId}`}>
                Fragen üben
              </ButtonLink>
            )}
            {markedC > 0 && (
              <ButtonLink variant="secondary" href={`${base}/cards?marked=1&lecture=${chapterId}`}>
                Karten wiederholen
              </ButtonLink>
            )}
          </span>
        </section>
      )}

      {tests.length > 0 && (
        <section>
          <h2 className="display mb-3 text-2xl">Kapiteltests</h2>
          <div className="card divide-y divide-line">
            {tests.slice(0, 6).map((e) => {
              const sc = examScore(e);
              return (
                <Link key={e.id} href={`${base}/exam?review=${e.id}`} className="flex items-center gap-4 p-4 hover:bg-surface-2/60">
                  <span
                    className="display w-14 text-2xl tabular-nums"
                    style={{ color: sc.score >= 0.8 ? "var(--good)" : sc.score >= 0.5 ? "var(--ink)" : "var(--bad)" }}
                  >
                    {Math.round(sc.score * 100)}
                  </span>
                  <span className="flex-1 text-sm">
                    <span className="block font-semibold">
                      {sc.correct}/{sc.total} richtig
                      {sc.score >= 0.8 && <Chip className="ml-2 border-good/40 text-good">bestanden</Chip>}
                    </span>
                    <span className="text-muted">
                      {new Date(e.finishedAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-muted" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <nav className="flex justify-between gap-3 border-t border-line pt-6">
        {prev ? (
          <ButtonLink variant="ghost" href={`${base}/c/${prev.id}`}>
            <ArrowLeft className="size-4" /> Kapitel {index}
          </ButtonLink>
        ) : (
          <span />
        )}
        {next ? (
          <ButtonLink variant="secondary" href={`${base}/c/${next.id}`}>
            Kapitel {index + 2} <ArrowRight className="size-4" />
          </ButtonLink>
        ) : (
          <ButtonLink href={`${base}/exam`}>
            Zum Abschlusstest <ArrowRight className="size-4" />
          </ButtonLink>
        )}
      </nav>
    </div>
  );
}

const QUESTION_LABELS: Record<ItemStatus, string> = {
  first: "Direkt richtig",
  recovered: "Nach Fehler richtig",
  wrong: "Zuletzt falsch",
  new: "Noch nicht bearbeitet",
};

const CARD_LABELS: Record<ItemStatus, string> = {
  first: "Direkt gewusst",
  recovered: "Später gewusst",
  wrong: "Zuletzt nicht gewusst",
  new: "Noch nicht bearbeitet",
};

const STATUS_ORDER: ItemStatus[] = ["first", "recovered", "wrong", "new"];

/** Aufteilung der Fragen/Karten eines Kapitels nach Bearbeitungsstand, mit Direktstart für neue und falsche. */
function StatusCard({
  title,
  states,
  labels,
  color,
  newHref,
  wrongHref,
  noun,
}: {
  title: string;
  states: (ItemState | undefined)[];
  labels: Record<ItemStatus, string>;
  color: string;
  newHref: string;
  wrongHref: string;
  noun: [string, string];
}) {
  const counts = statusCounts(states);
  const total = states.length;
  const seen = total - counts.new;
  const colors: Record<ItemStatus, string> = {
    first: "var(--good)",
    recovered: color,
    wrong: "var(--bad)",
    new: "var(--line-strong)",
  };
  const n = (k: number) => `${k} ${k === 1 ? noun[0] : noun[1]}`;

  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="text-sm tabular-nums text-muted">
          {seen} / {total} gesehen
        </span>
      </div>

      <div className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        {STATUS_ORDER.map((k) =>
          counts[k] ? (
            <div
              key={k}
              className="h-full transition-[width] duration-700"
              style={{ width: `${(counts[k] / Math.max(1, total)) * 100}%`, background: colors[k] }}
            />
          ) : null,
        )}
      </div>

      <ul className="mt-4 grid gap-x-4 gap-y-2 text-sm lg:grid-cols-2">
        {STATUS_ORDER.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: colors[k] }} />
            <span className="min-w-0 flex-1 truncate text-ink-2">{labels[k]}</span>
            <span className="font-semibold tabular-nums">{counts[k]}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {counts.new > 0 && (
          <ButtonLink variant="secondary" href={newHref}>
            Nur neue · {n(counts.new)}
          </ButtonLink>
        )}
        {counts.wrong > 0 && (
          <ButtonLink variant="secondary" href={wrongHref}>
            Falsche wiederholen · {counts.wrong}
          </ButtonLink>
        )}
        {!counts.new && !counts.wrong && (
          <p className="text-sm text-good">Alles bearbeitet und zuletzt richtig.</p>
        )}
      </div>
    </div>
  );
}
