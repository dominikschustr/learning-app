"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flag,
  LayoutGrid,
  Play,
  Send,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { chapterFormat, createExam, gradeExam, isAnswered } from "@/lib/exam";
import { XP } from "@/lib/gamification";
import { gradeShortAnswer, selfGrade } from "@/lib/grade";
import type { Lecture, Question, SubjectContent } from "@/lib/schema";
import { SHORT_PASS, gradeMC } from "@/lib/scoring";
import { examScore, useApp, useHydrated, type ActiveExam, type AnswerEvent, type ExamRecord, type ShortGrade } from "@/lib/store";
import { announceAll, celebrate } from "@/lib/toast";
import { cn, formatClock, pct } from "@/lib/utils";
import { MCView, ShortInput, ShortResult, TFView } from "./Questions";
import { Bar, Button, ButtonLink, Chip, ProgressRing, Skeleton } from "./ui";

export function Exam({ content }: { content: SubjectContent }) {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const reviewId = params.get("review");
  const chapter = params.get("chapter");
  const active = useApp((s) => (s.activeExam?.subjectId === content.subject.id ? s.activeExam : null));
  const record = useApp((s) => (reviewId ? s.exams.find((e) => e.id === reviewId) : undefined));

  if (!hydrated) return <Skeleton className="h-96" />;
  if (record) return <Result content={content} record={record} />;
  if (active) return <Running content={content} exam={active} />;
  const lecture = content.subject.lectures.find((l) => l.id === chapter);
  return <Intro key={lecture?.id ?? "all"} content={content} lecture={lecture} />;
}

function Intro({ content, lecture }: { content: SubjectContent; lecture?: Lecture }) {
  const { subject, questions } = content;
  const f = lecture ? chapterFormat(questions, lecture.id, subject.examFormat) : subject.examFormat;
  const startExam = useApp((s) => s.startExam);
  const allExams = useApp((s) => s.exams);
  const exams = allExams.filter((e) => e.subjectId === subject.id && e.lecture === lecture?.id);
  const best = exams.reduce((b, e) => Math.max(b, examScore(e).score), 0);
  const total = f.short + f.mc + f.tf;
  const pool = lecture ? questions.filter((q) => q.lecture === lecture.id).length : questions.length;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={lecture ? `/s/${subject.id}/c/${lecture.id}` : `/s/${subject.id}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> {lecture ? lecture.title : subject.name}
      </Link>
      <p className="eyebrow mt-8">{lecture ? `Kapiteltest · ${lecture.title}` : `Abschlusstest · ${f.name}`}</p>
      <h1 className="display text-4xl sm:text-5xl mt-2">{lecture ? "Kapiteltest" : `${f.name}-Probelauf`}</h1>
      <p className="mt-3 text-muted">
        {lecture
          ? `${total} Fragen nur aus diesem Kapitel, ${f.minutes} Minuten, kein Feedback bis zur Abgabe. Mit mindestens 80 % erreichst du das Kapitel-Level „Gemeistert“.`
          : `Wie in der echten Prüfung: ${total} Fragen, ${f.minutes} Minuten, kein Feedback bis zur Abgabe. Die Fragen werden zufällig aus ${pool} Fragen gezogen – jedes der ${subject.lectures.length} Kapitel ist vertreten.`}
      </p>

      <div className="mt-8 grid grid-cols-3 gap-3">
        {[
          [f.short, "Kurzantwort", "define / state / explain"],
          [f.mc, "Multiple Choice", "mehrere richtig möglich"],
          [f.tf, "True / False", ""],
        ].map(([n, label, hint]) => (
          <div key={label} className="card p-4">
            <p className="display text-3xl tabular-nums">{n}</p>
            <p className="mt-1 text-sm font-semibold">{label}</p>
            {hint && <p className="text-xs text-muted">{hint}</p>}
          </div>
        ))}
      </div>

      <ul className="mt-6 space-y-2 text-sm text-ink-2">
        <li className="flex gap-2">
          <Clock className="mt-0.5 size-4 shrink-0 text-muted" /> Richtwert: ca. {Math.round((f.minutes / total) * 10) / 10} Min
          pro Frage. Bei Zeitablauf wird automatisch abgegeben.
        </li>
        <li className="flex gap-2">
          <Flag className="mt-0.5 size-4 shrink-0 text-muted" /> Unsichere Fragen markieren und später zurückspringen.
        </li>
        <li className="flex gap-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted" /> Multiple Choice zählt nur bei exakt richtiger
          Auswahl; Teilpunkte siehst du zusätzlich in der Auswertung.
        </li>
      </ul>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button
          className="h-12 px-7 text-base"
          onClick={() => startExam(createExam(subject.id, f, questions, Date.now(), lecture?.id))}
        >
          <Play className="size-4" /> {lecture ? "Kapiteltest starten" : "Abschlusstest starten"}
        </Button>
        {best > 0 && <Chip>Bestwert {pct(best)}</Chip>}
      </div>
    </div>
  );
}

function useTicker(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function Running({ content, exam }: { content: SubjectContent; exam: ActiveExam }) {
  const router = useRouter();
  const { subject } = content;
  const byId = useMemo(() => new Map(content.questions.map((q) => [q.id, q])), [content.questions]);
  const updateExam = useApp((s) => s.updateExam);
  const setExamAnswer = useApp((s) => s.setExamAnswer);
  const discardExam = useApp((s) => s.discardExam);
  const now = useTicker(1000);
  const [confirm, setConfirm] = useState(false);
  const [showNav, setShowNav] = useState(false);

  const total = exam.questionIds.length;
  const limit = exam.minutes * 60;
  const elapsed = Math.max(0, (now - exam.startedAt) / 1000);
  const remaining = limit - elapsed;
  const answered = exam.questionIds.filter((id) => isAnswered(exam.answers[id])).length;
  const qid = exam.questionIds[exam.current];
  const q = byId.get(qid);

  const submit = useCallback(() => {
    const { finishExam, answer, bonusXp } = useApp.getState();
    const record = gradeExam(exam, byId, Date.now());
    finishExam(record);
    const events: AnswerEvent[] = [];
    for (const id of record.questionIds) {
      const r = record.results[id];
      if (r === null || r === undefined) continue;
      events.push(answer({ subjectId: subject.id, itemId: id, correct: r, xp: r ? XP.examCorrect : 0 }));
    }
    events.push(bonusXp(XP.examFinish));
    announceAll(events);
    router.replace(`/s/${subject.id}/exam?review=${record.id}`);
  }, [exam, byId, subject.id, router]);

  useEffect(() => {
    if (remaining <= 0) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining <= 0]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || confirm) return;
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      const cur = exam.questionIds[exam.current];
      const question = byId.get(cur);
      const ans = exam.answers[cur];
      if (e.key === "Enter") {
        e.preventDefault();
        updateExam({ current: Math.min(total - 1, exam.current + 1) });
      } else if (question?.type === "mc") {
        const n = Number(e.key);
        const order = exam.optionOrder[cur] ?? question.options.map((o) => o.id);
        if (n >= 1 && n <= order.length) {
          const id = order[n - 1];
          const sel = ans?.kind === "mc" ? ans.selected : [];
          setExamAnswer(cur, { kind: "mc", selected: sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id] });
        }
      } else if (question?.type === "tf" && (e.key === "t" || e.key === "f")) {
        setExamAnswer(cur, { kind: "tf", value: e.key === "t" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exam, byId, confirm, total, updateExam, setExamAnswer]);

  const go = (i: number) => {
    updateExam({ current: Math.max(0, Math.min(total - 1, i)) });
    setShowNav(false);
  };
  const flagged = exam.flagged.includes(qid);

  // Tempo relativ zum Richtwert
  const expected = elapsed / (limit / total);
  const behind = expected - answered;

  const a = exam.answers[qid];
  const low = remaining < 5 * 60;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="sticky top-14 z-30 -mx-4 mb-6 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums",
              remaining < 60 ? "bg-bad text-white" : low ? "bg-warn-soft text-warn" : "bg-surface-2",
            )}
          >
            <Clock className="size-4" /> {formatClock(remaining)}
          </span>
          <span className="hidden text-sm text-muted sm:inline">
            {answered}/{total} beantwortet
            {behind > 1.5 && <span className="ml-2 font-semibold text-warn">· {Math.round(behind)} hinter dem Richtwert</span>}
          </span>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" className="h-9 px-3" onClick={() => setShowNav((s) => !s)} aria-label="Fragenübersicht">
              <LayoutGrid className="size-4" /> <span className="tabular-nums">{exam.current + 1}/{total}</span>
            </Button>
            <Button className="h-9 px-4" onClick={() => setConfirm(true)}>
              <Send className="size-4" /> Abgeben
            </Button>
          </div>
        </div>
        <Bar value={answered / total} color={subject.color} className="mt-3 h-1" />

        <AnimatePresence>
          {showNav && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-7 gap-1.5 pt-3 sm:grid-cols-11">
                {exam.questionIds.map((id, i) => {
                  const done = isAnswered(exam.answers[id]);
                  const fl = exam.flagged.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => go(i)}
                      className={cn(
                        "relative h-9 rounded-lg border text-sm font-semibold tabular-nums transition",
                        i === exam.current ? "border-ink bg-ink text-bg" : done ? "border-transparent bg-accent/15 text-accent" : "border-line bg-surface",
                      )}
                    >
                      {i + 1}
                      {fl && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-warn" />}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 flex gap-4 text-xs text-muted">
                <span>■ beantwortet</span>
                <span className="text-warn">● markiert</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <span className="eyebrow">Frage {exam.current + 1}</span>
        <button
          type="button"
          onClick={() =>
            updateExam({ flagged: flagged ? exam.flagged.filter((f) => f !== qid) : [...exam.flagged, qid] })
          }
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold transition",
            flagged ? "bg-warn-soft text-warn" : "text-muted hover:bg-surface-2",
          )}
        >
          <Flag className="size-4" fill={flagged ? "currentColor" : "none"} /> {flagged ? "Markiert" : "Markieren"}
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={qid}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.16 }}
        >
          {q?.type === "mc" && (
            <MCView
              q={q}
              order={exam.optionOrder[qid] ?? q.options.map((o) => o.id)}
              selected={a?.kind === "mc" ? a.selected : []}
              onToggle={(id) => {
                const sel = a?.kind === "mc" ? a.selected : [];
                setExamAnswer(qid, { kind: "mc", selected: sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id] });
              }}
            />
          )}
          {q?.type === "tf" && (
            <TFView
              q={q}
              value={a?.kind === "tf" ? a.value : null}
              onChange={(v) => setExamAnswer(qid, { kind: "tf", value: a?.kind === "tf" && a.value === v ? null : v })}
            />
          )}
          {q?.type === "short" && (
            <ShortInput
              q={q}
              text={a?.kind === "short" ? a.text : ""}
              onChange={(text) => setExamAnswer(qid, { kind: "short", text })}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="secondary" disabled={exam.current === 0} onClick={() => go(exam.current - 1)}>
          <ArrowLeft className="size-4" /> Zurück
        </Button>
        {exam.current < total - 1 ? (
          <Button onClick={() => go(exam.current + 1)}>
            Weiter <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button onClick={() => setConfirm(true)}>
            <Send className="size-4" /> Abgeben
          </Button>
        )}
      </div>

      <div className="mt-10 text-center">
        <button
          type="button"
          className="text-xs text-muted underline-offset-2 hover:underline"
          onClick={() => {
            if (window.confirm("Simulation abbrechen? Die Antworten gehen verloren.")) discardExam();
          }}
        >
          Simulation abbrechen
        </button>
      </div>

      <AnimatePresence>
        {confirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4 backdrop-blur-sm"
            onClick={() => setConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="card w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="display text-2xl">Abgeben?</h2>
              {answered < total ? (
                <p className="mt-2 flex gap-2 text-sm text-ink-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
                  {total - answered} {total - answered === 1 ? "Frage ist" : "Fragen sind"} noch unbeantwortet.
                </p>
              ) : (
                <p className="mt-2 text-sm text-ink-2">Alle Fragen beantwortet. Restzeit: {formatClock(remaining)}.</p>
              )}
              {exam.flagged.length > 0 && (
                <p className="mt-1 text-sm text-muted">{exam.flagged.length} markiert.</p>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirm(false)}>
                  Weiter bearbeiten
                </Button>
                <Button onClick={submit}>Abgeben</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const grading = new Set<string>();

function Result({ content, record }: { content: SubjectContent; record: ExamRecord }) {
  const { subject } = content;
  const base = `/s/${subject.id}`;
  const byId = useMemo(() => new Map(content.questions.map((q) => [q.id, q])), [content.questions]);
  const updateExamRecord = useApp((s) => s.updateExamRecord);
  const allExams = useApp((s) => s.exams);
  const exams = allExams.filter((e) => e.subjectId === subject.id && e.lecture === record.lecture);
  const lecture = subject.lectures.find((l) => l.id === record.lecture);
  const back = lecture ? `${base}/c/${lecture.id}` : base;
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState<string[]>([]);

  const sc = examScore(record);
  const pendingShort = record.questionIds.filter((id) => record.results[id] === null);
  const isBest = exams.every((e) => e.id === record.id || examScore(e).score < sc.score);

  const applyGrade = (id: string, g: ShortGrade) => {
    const correct = g.score >= SHORT_PASS;
    const cur = useApp.getState().exams.find((e) => e.id === record.id) ?? record;
    updateExamRecord(record.id, {
      shortGrades: { ...cur.shortGrades, [id]: g },
      results: { ...cur.results, [id]: correct },
      partial: { ...cur.partial, [id]: g.score / 100 },
    });
    announceAll([
      useApp.getState().answer({ subjectId: subject.id, itemId: id, correct, xp: correct ? XP.examCorrect : 0 }),
    ]);
  };

  useEffect(() => {
    for (const id of pendingShort) {
      if (grading.has(`${record.id}:${id}`)) continue;
      const q = byId.get(id);
      const a = record.answers[id];
      if (q?.type !== "short" || a?.kind !== "short") continue;
      grading.add(`${record.id}:${id}`);
      void gradeShortAnswer(q, a.text).then((g) => {
        if (g) applyGrade(id, g);
        else setAiUnavailable((u) => [...u, id]);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id, pendingShort.join()]);

  useEffect(() => {
    if (!pendingShort.length && sc.score >= 0.8) celebrate(isBest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingShort.length]);

  const groups = [
    { key: "mc", label: "Multiple Choice" },
    { key: "tf", label: "True / False" },
    { key: "short", label: "Kurzantwort" },
  ] as const;
  const stat = (ids: string[]) => ({
    correct: ids.filter((id) => record.results[id]).length,
    total: ids.length,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link href={back} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {lecture ? lecture.title : subject.name}
      </Link>

      <section className="card grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:p-8">
        <div className="flex justify-center">
          <ProgressRing
            value={sc.score}
            size={168}
            stroke={12}
            color={sc.score >= 0.8 ? "var(--good)" : sc.score >= 0.5 ? subject.color : "var(--bad)"}
          >
            <span>
              <span className="display block text-5xl tabular-nums">{Math.round(sc.score * 100)}</span>
              <span className="eyebrow">Prozent</span>
            </span>
          </ProgressRing>
        </div>
        <div className="flex flex-col justify-center">
          <p className="eyebrow">{lecture ? `Auswertung Kapiteltest · ${lecture.title}` : `Auswertung Abschlusstest · ${subject.examFormat.name}`}</p>
          <h1 className="display text-4xl sm:text-5xl mt-1">
            {sc.correct} von {sc.total} richtig
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip>mit Teilpunkten {pct(sc.partialScore)}</Chip>
            <Chip>{formatClock(record.durationSec)} Min</Chip>
            {isBest && exams.length > 1 && <Chip className="border-good/40 text-good">Neuer Bestwert</Chip>}
            {pendingShort.length > 0 &&
              (pendingShort.every((id) => aiUnavailable.includes(id)) ? (
                <Chip className="border-warn/40 text-warn">Kurzantwort: Selbstbewertung offen ↓</Chip>
              ) : (
                <Chip>Kurzantwort wird bewertet …</Chip>
              ))}
          </div>
          <div className="mt-5 grid gap-2.5">
            {groups.map((g) => {
              const s = stat(record.questionIds.filter((id) => byId.get(id)?.type === g.key));
              if (!s.total) return null;
              return (
                <div key={g.key} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3 text-sm">
                  <span className="text-ink-2">{g.label}</span>
                  <Bar value={s.correct / s.total} color={subject.color} />
                  <span className="text-right tabular-nums text-muted">
                    {s.correct}/{s.total}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {lecture ? (
        <section className="flex flex-wrap gap-2">
          {sc.score >= 0.8 ? (
            <Chip className="h-11 border-good/40 px-4 text-sm text-good">Bestanden – Kapitel-Level „Gemeistert“ möglich</Chip>
          ) : (
            <Chip className="h-11 px-4 text-sm">Für „Gemeistert“ brauchst du mindestens 80 %</Chip>
          )}
          <ButtonLink href={`${base}/practice?mode=lecture&lecture=${lecture.id}`}>Kapitel weiter üben</ButtonLink>
          <ButtonLink variant="secondary" href={`${base}/exam?chapter=${lecture.id}`}>
            Neuer Kapiteltest
          </ButtonLink>
        </section>
      ) : (
      <section className="card p-6">
        <h2 className="display text-2xl">Nach Kapitel</h2>
        <div className="mt-4 grid gap-3">
          {subject.lectures.map((l) => {
            const s = stat(record.questionIds.filter((id) => byId.get(id)?.lecture === l.id));
            if (!s.total) return null;
            const v = s.correct / s.total;
            return (
              <div key={l.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 text-sm sm:grid-cols-[16rem_1fr_3rem]">
                <span className="truncate text-ink-2">{l.title}</span>
                <span className="text-right tabular-nums text-muted sm:order-last">
                  {s.correct}/{s.total}
                </span>
                <Bar value={v} color={v >= 0.7 ? "var(--good)" : v >= 0.4 ? "var(--warn)" : "var(--bad)"} className="col-span-2 sm:col-span-1" />
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <ButtonLink href={`${base}/practice?mode=weak`}>Schwächen trainieren</ButtonLink>
          <ButtonLink variant="secondary" href={`${base}/exam`}>
            Neuer Abschlusstest
          </ButtonLink>
        </div>
      </section>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="display text-2xl">Alle Fragen</h2>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} className="accent-[var(--accent)]" />
            nur falsche
          </label>
        </div>
        <div className="space-y-4">
          {record.questionIds.map((id, i) => {
            const q = byId.get(id);
            if (!q) return null;
            const r = record.results[id];
            if (onlyWrong && r !== false) return null;
            return (
              <ReviewItem
                key={id}
                index={i}
                q={q}
                record={record}
                aiUnavailable={aiUnavailable.includes(id)}
                onSelfGrade={(hit) => q.type === "short" && applyGrade(id, selfGrade(q, hit))}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ReviewItem({
  index,
  q,
  record,
  aiUnavailable,
  onSelfGrade,
}: {
  index: number;
  q: Question;
  record: ExamRecord;
  aiUnavailable: boolean;
  onSelfGrade: (hit: string[]) => void;
}) {
  const a = record.answers[q.id];
  const r = record.results[q.id];
  const [open, setOpen] = useState(r !== true);

  return (
    <div className="card overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 p-4 text-left">
        {r === null ? (
          <span className="mt-0.5 size-5 shrink-0 animate-pulse rounded-full bg-surface-2" />
        ) : r ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-good" />
        ) : (
          <XCircle className="mt-0.5 size-5 shrink-0 text-bad" />
        )}
        <span className="flex-1">
          <span className="eyebrow block">Frage {index + 1}</span>
          <span className="font-medium">{q.type === "tf" ? q.statement : q.prompt}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-line p-4">
          {q.type === "mc" && (
            <>
              <MCView
                q={q}
                order={record.optionOrder[q.id] ?? q.options.map((o) => o.id)}
                selected={a?.kind === "mc" ? a.selected : []}
                verdicts={gradeMC(q, a?.kind === "mc" ? a.selected : []).verdicts}
              />
              {q.explanation && <p className="mt-4 text-sm leading-relaxed text-ink-2">{q.explanation}</p>}
            </>
          )}
          {q.type === "tf" && (
            <>
              <TFView q={q} value={a?.kind === "tf" ? a.value : null} revealed />
              {a?.kind !== "tf" || a.value === null ? <p className="mt-3 text-sm text-bad">Nicht beantwortet.</p> : null}
              {q.explanation && <p className="mt-4 text-sm leading-relaxed text-ink-2">{q.explanation}</p>}
            </>
          )}
          {q.type === "short" && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-surface-2 p-4 text-sm">
                <p className="eyebrow mb-1">Deine Antwort</p>
                <p className="whitespace-pre-wrap">{a?.kind === "short" && a.text.trim() ? a.text : "—"}</p>
              </div>
              <ShortResult
                q={q}
                grade={record.shortGrades[q.id] ?? null}
                pending={r === null && !aiUnavailable}
                onSelfGrade={r === null && aiUnavailable ? onSelfGrade : undefined}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
