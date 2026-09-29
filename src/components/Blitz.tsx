"use client";

import { ArrowLeft, Check, Flame, X, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { XP } from "@/lib/gamification";
import type { SubjectContent, TFQuestion } from "@/lib/schema";
import { useApp, useHydrated, type AnswerEvent } from "@/lib/store";
import { announceAll, celebrate } from "@/lib/toast";
import { cn, shuffle } from "@/lib/utils";
import { Button, ButtonLink, Skeleton } from "./ui";

const SECONDS = 60;

type Phase = "intro" | "run" | "done";
type Answered = { q: TFQuestion; correct: boolean };

export function Blitz({ content }: { content: SubjectContent }) {
  const hydrated = useHydrated();
  const [phase, setPhase] = useState<Phase>("intro");
  const [round, setRound] = useState(0);
  const [log, setLog] = useState<Answered[]>([]);
  const { subject } = content;
  const best = useApp((s) => s.blitzBest[subject.id] ?? 0);
  const tf = content.questions.filter((q): q is TFQuestion => q.type === "tf");

  if (!hydrated) return <Skeleton className="h-96" />;

  if (phase === "run") {
    return (
      <Run
        key={round}
        content={content}
        pool={tf}
        onDone={(l) => {
          setLog(l);
          setPhase("done");
        }}
      />
    );
  }

  const start = () => {
    setRound((r) => r + 1);
    setPhase("run");
  };

  if (phase === "done") {
    const score = log.filter((a) => a.correct).length;
    const wrong = log.filter((a) => !a.correct);
    return (
      <div className="mx-auto max-w-xl py-6 text-center">
        <p className="eyebrow">Zeit ist um</p>
        <h1 className="display mt-2 text-7xl">{score}</h1>
        <p className="mt-1 text-muted">
          richtige Antworten · {log.length} gesamt · Rekord {Math.max(best, score)}
        </p>
        {wrong.length > 0 && (
          <div className="card mt-8 p-5 text-left">
            <p className="font-semibold">Daneben gelegen</p>
            <ul className="mt-3 space-y-3 text-sm">
              {[...new Map(wrong.map((w) => [w.q.id, w.q])).values()].map((q) => (
                <li key={q.id}>
                  <p className="text-ink-2">{q.statement}</p>
                  <p className="mt-0.5 text-xs">
                    <strong className={q.answer ? "text-good" : "text-bad"}>{q.answer ? "True" : "False"}</strong>
                    {q.explanation && <span className="text-muted"> – {q.explanation}</span>}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-8 flex justify-center gap-2">
          <Button onClick={start}>
            <Zap className="size-4" /> Nochmal
          </Button>
          <ButtonLink variant="secondary" href={`/s/${subject.id}`}>
            Zur Übersicht
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link href={`/s/${subject.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {subject.name}
      </Link>
      <div className="mt-10 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-warn-soft text-flame">
          <Zap className="size-8" fill="currentColor" />
        </span>
        <h1 className="display mt-5 text-6xl">Blitzrunde</h1>
        <p className="mx-auto mt-3 max-w-sm text-muted">
          {SECONDS} Sekunden, so viele True/False-Aussagen wie möglich. Ab 5 richtigen in Folge gibt es doppelte XP.
        </p>
        <p className="mt-4 hidden text-sm text-muted sm:block">
          <span className="kbd">←</span> True · <span className="kbd">→</span> False
        </p>
        <Button className="mt-8 h-12 px-8 text-base" onClick={start} disabled={!tf.length}>
          Los geht’s
        </Button>
        {best > 0 && <p className="mt-4 text-sm text-muted">Dein Rekord: {best}</p>}
      </div>
    </div>
  );
}

function Run({
  content,
  pool,
  onDone,
}: {
  content: SubjectContent;
  pool: TFQuestion[];
  onDone: (log: Answered[]) => void;
}) {
  const { subject } = content;
  const [order] = useState(() => shuffle(pool));
  const [i, setI] = useState(0);
  const [log, setLog] = useState<Answered[]>([]);
  const [combo, setCombo] = useState(0);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const [left, setLeft] = useState(SECONDS);
  const events = useRef<AnswerEvent[]>([]);
  const logRef = useRef<Answered[]>([]);
  const seen = useRef(new Set<string>());
  const ended = useRef(false);

  const q = order[i % order.length];

  const end = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    const score = logRef.current.filter((a) => a.correct).length;
    const { setBlitzBest } = useApp.getState();
    setBlitzBest(subject.id, score);
    events.current.push(useApp.getState().bonusXp(0)); // Achievements (Blitz-Rekord) prüfen
    announceAll(events.current);
    if (score >= 10) celebrate(score >= 15);
    onDone(logRef.current);
  }, [onDone, subject.id]);

  useEffect(() => {
    const startedAt = Date.now();
    const t = setInterval(() => {
      const l = SECONDS - Math.floor((Date.now() - startedAt) / 1000);
      setLeft(l);
      if (l <= 0) {
        clearInterval(t);
        end();
      }
    }, 200);
    return () => clearInterval(t);
  }, [end]);

  const pick = useCallback(
    (v: boolean) => {
      if (flash || ended.current) return;
      const correct = v === q.answer;
      const newCombo = correct ? combo + 1 : 0;
      const first = !seen.current.has(q.id);
      seen.current.add(q.id);
      const xp = correct ? XP.blitzCorrect * (newCombo >= 5 ? 2 : 1) : 0;
      events.current.push(
        useApp.getState().answer({ subjectId: subject.id, itemId: q.id, correct, xp, combo: newCombo, srs: first }),
      );
      const entry = { q, correct };
      logRef.current = [...logRef.current, entry];
      setLog(logRef.current);
      setCombo(newCombo);
      setFlash(correct ? "good" : "bad");
      setTimeout(() => {
        setFlash(null);
        setI((n) => n + 1);
      }, correct ? 220 : 650);
    },
    [flash, q, combo, subject.id],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "t") pick(true);
      if (e.key === "ArrowRight" || e.key === "f") pick(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick]);

  const score = log.filter((a) => a.correct).length;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <span className={cn("display w-14 text-4xl tabular-nums", left <= 10 && "text-bad")}>{Math.max(0, left)}</span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-flame"
            style={{ width: `${(Math.max(0, left) / SECONDS) * 100}%`, transition: "width 0.2s linear" }}
          />
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-bold text-flame">
          <Flame className="size-4" fill={combo >= 5 ? "currentColor" : "none"} /> {combo}
        </span>
        <span className="w-10 text-right text-lg font-bold tabular-nums">{score}</span>
      </div>

      <AnimatePresence mode="popLayout">
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "card grid min-h-64 place-items-center p-8 text-center transition-colors",
            flash === "good" && "border-good bg-good-soft",
            flash === "bad" && "border-bad bg-bad-soft",
          )}
        >
          <div>
            <p className="text-xl font-semibold leading-snug sm:text-2xl">{q.statement}</p>
            {flash === "bad" && (
              <p className="mt-4 text-sm font-semibold text-bad">Richtig wäre: {q.answer ? "True" : "False"}</p>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="secondary" className="h-16 text-lg" onClick={() => pick(true)}>
          <Check className="size-5 text-good" /> True
        </Button>
        <Button variant="secondary" className="h-16 text-lg" onClick={() => pick(false)}>
          <X className="size-5 text-bad" /> False
        </Button>
      </div>
    </div>
  );
}
