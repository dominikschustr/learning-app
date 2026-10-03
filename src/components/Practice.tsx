"use client";

import { ArrowRight, Bookmark, PartyPopper, RotateCcw, SkipForward } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { answerXp } from "@/lib/gamification";
import { gradeShortAnswer, selfGrade } from "@/lib/grade";
import { MODE_TITLE, buildQueue, optionOrder, type PracticeMode } from "@/lib/queue";
import type { Question, SubjectContent } from "@/lib/schema";
import { SHORT_PASS, gradeMC, gradeTF, type MCResult } from "@/lib/scoring";
import { markKey, markedIds, useApp, useHydrated, type ShortGrade } from "@/lib/store";
import { announce, celebrate } from "@/lib/toast";
import { refreshNow } from "@/lib/useNow";
import { pct } from "@/lib/utils";
import { MarkButton } from "./MarkButton";
import { Explanation, MCView, ShortInput, ShortResult, TFView } from "./Questions";
import { SessionBar, XpFloat } from "./SessionBar";
import { Button, ButtonLink, Skeleton } from "./ui";

type Entry = { q: Question; order: string[]; retry: boolean };
type Outcome = { q: Question; correct: boolean };

const MODES: PracticeMode[] = ["smart", "due", "weak", "lecture", "marked", "new", "wrong"];

export function Practice({ content }: { content: SubjectContent }) {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const raw = params.get("mode") as PracticeMode;
  const mode = MODES.includes(raw) ? raw : "smart";
  const lecture = params.get("lecture") ?? undefined;
  const [run, setRun] = useState(0);

  if (!hydrated) return <Skeleton className="h-96" />;
  return (
    <Session
      key={`${mode}-${lecture}-${run}`}
      content={content}
      mode={mode}
      lecture={lecture}
      onRestart={() => setRun((r) => r + 1)}
    />
  );
}

function Session({
  content,
  mode,
  lecture,
  onRestart,
  only,
}: {
  content: SubjectContent;
  mode: PracticeMode;
  lecture?: string;
  onRestart: () => void;
  only?: Question[];
}) {
  const { subject } = content;
  const base = `/s/${subject.id}`;
  const home = lecture ? `${base}/c/${lecture}` : base;
  const answer = useApp((s) => s.answer);

  const [queue, setQueue] = useState<Entry[]>(() => {
    const qs =
      only ??
      buildQueue({
        mode,
        subjectId: subject.id,
        questions: content.questions,
        items: useApp.getState().items,
        now: Date.now(),
        lecture,
        marked: markedIds(useApp.getState().marks, "q", subject.id),
      });
    return qs.map((q) => ({ q, order: optionOrder(q), retry: false }));
  });
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [lastXp, setLastXp] = useState({ amount: 0, n: 0 });

  // Antwortzustand der aktuellen Frage
  const [selected, setSelected] = useState<string[]>([]);
  const [tf, setTf] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const [mc, setMc] = useState<MCResult | null>(null);
  const [shortGrade, setShortGrade] = useState<ShortGrade | null>(null);
  const [pending, setPending] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [retryMode, setRetryMode] = useState<Question[] | null>(null);

  const entry = queue[index];
  const done = index >= queue.length;

  const finish = useCallback(
    (correct: boolean) => {
      const { q, retry } = entry;
      const newCombo = correct ? combo + 1 : 0;
      const xp = retry ? (correct ? 2 : 0) : answerXp({ correct, difficulty: q.difficulty, combo: newCombo });
      const event = answer({ subjectId: subject.id, itemId: q.id, correct, xp, combo: newCombo, srs: !retry });
      announce(event);
      refreshNow();
      setCombo(newCombo);
      setBestCombo((b) => Math.max(b, newCombo));
      setSessionXp((s) => s + xp);
      setLastXp((l) => ({ amount: xp, n: l.n + 1 }));
      setWasCorrect(correct);
      setRevealed(true);
      if (!retry) setOutcomes((o) => [...o, { q, correct }]);
      if (!correct && !retry) {
        // Falsche Frage kommt in dieser Session noch einmal
        setQueue((qs) => {
          const at = Math.min(qs.length, index + 3);
          return [...qs.slice(0, at), { q, order: optionOrder(q), retry: true }, ...qs.slice(at)];
        });
      }
    },
    [entry, combo, answer, subject.id, index],
  );

  const check = useCallback(async () => {
    if (!entry || revealed) return;
    const q = entry.q;
    if (q.type === "mc") {
      if (!selected.length) return;
      const r = gradeMC(q, selected);
      setMc(r);
      finish(r.correct);
    } else if (q.type === "short") {
      if (pending) return;
      setPending(true);
      const g = await gradeShortAnswer(q, text);
      setPending(false);
      if (g) {
        setShortGrade(g);
        finish(g.score >= SHORT_PASS);
      } else {
        setRevealed(true); // Selbstbewertung anzeigen
      }
    }
  }, [entry, revealed, selected, finish, pending, text]);

  const pickTf = useCallback(
    (v: boolean) => {
      if (!entry || entry.q.type !== "tf" || revealed) return;
      setTf(v);
      finish(gradeTF(entry.q.answer, v));
    },
    [entry, revealed, finish],
  );

  const next = useCallback(() => {
    setIndex((i) => i + 1);
    setSelected([]);
    setTf(null);
    setText("");
    setMc(null);
    setShortGrade(null);
    setRevealed(false);
  }, []);

  const canContinue = revealed && (entry?.q.type !== "short" || !!shortGrade);

  /** Frage auslassen: zählt weder als richtig noch als falsch, Lernstand bleibt unverändert. */
  const skip = useCallback(() => {
    if (!entry || revealed || pending) return;
    setSkipped((n) => n + 1);
    setCombo(0);
    next();
  }, [entry, revealed, pending, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!entry) return;
      const inText = (e.target as HTMLElement)?.tagName === "TEXTAREA";
      if (e.key === "Enter") {
        // Im Textfeld nur mit Cmd/Ctrl+Enter abschicken
        if (inText && !(e.metaKey || e.ctrlKey)) return;
        e.preventDefault();
        if (canContinue) next();
        else void check();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || inText) return;
      if (e.key === "m") {
        useApp.getState().toggleMark(markKey("q", subject.id, entry.q.id));
        return;
      }
      if (e.key === "s") {
        skip();
        return;
      }
      if (revealed) return;
      const q = entry.q;
      if (q.type === "mc") {
        const n = Number(e.key);
        if (n >= 1 && n <= entry.order.length) {
          const id = entry.order[n - 1];
          setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
        }
      } else if (q.type === "tf") {
        if (e.key === "t" || e.key === "w" || e.key === "ArrowLeft") pickTf(true);
        if (e.key === "f" || e.key === "ArrowRight") pickTf(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entry, revealed, canContinue, next, check, pickTf, subject.id, skip]);

  if (retryMode) {
    return <Session content={content} mode={mode} onRestart={onRestart} only={retryMode} />;
  }

  if (!queue.length) {
    if (mode === "marked") {
      return (
        <div className="mx-auto max-w-lg py-16 text-center">
          <Bookmark className="mx-auto size-12 text-accent" />
          <h1 className="display text-4xl sm:text-5xl mt-4">Nichts markiert</h1>
          <p className="mt-2 text-muted">
            Tippe beim Üben oder in der Test-Auswertung auf „Markieren“ (oder drücke M) – die Frage landet dann hier
            zum gezielten Wiederholen.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <ButtonLink href={lecture ? `${base}/practice?mode=lecture&lecture=${lecture}` : `${base}/practice?mode=smart`}>
              Jetzt üben
            </ButtonLink>
            <ButtonLink variant="secondary" href={home}>
              Zurück
            </ButtonLink>
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <PartyPopper className="mx-auto size-12 text-good" />
        <h1 className="display text-4xl sm:text-5xl mt-4">
          {mode === "due"
            ? "Nichts fällig"
            : mode === "weak"
              ? "Keine Schwächen gefunden"
              : mode === "new"
                ? "Alles schon gesehen"
                : mode === "wrong"
                  ? "Nichts falsch"
                  : "Keine Fragen"}
        </h1>
        <p className="mt-2 text-muted">
          {mode === "due"
            ? "Alles, was du gelernt hast, sitzt gerade. Lerne neue Fragen oder komm später wieder."
            : mode === "weak"
              ? "Beantworte erst ein paar Fragen – dann weiß die App, wo du unsicher bist."
              : mode === "new"
                ? "Du hast jede Frage hier mindestens einmal bearbeitet. Weiter geht es mit Wiederholung und Kapiteltest."
                : mode === "wrong"
                  ? "Keine Frage ist gerade als falsch beantwortet markiert – stark!"
                  : "Für diese Auswahl gibt es noch keine Fragen."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <ButtonLink href={lecture ? `${base}/practice?mode=lecture&lecture=${lecture}` : `${base}/practice?mode=smart`}>
            {lecture ? "Kapitel üben" : "Empfohlene Session"}
          </ButtonLink>
          <ButtonLink variant="secondary" href={home}>
            Zurück
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <Summary
        outcomes={outcomes}
        xp={sessionXp}
        bestCombo={bestCombo}
        skipped={skipped}
        base={home}
        subjectId={subject.id}
        onRestart={onRestart}
        onRetry={(qs) => setRetryMode(qs)}
      />
    );
  }

  const q = entry.q;
  const lectureTitle = subject.lectures.find((l) => l.id === q.lecture)?.title;

  return (
    <div className="mx-auto max-w-2xl">
      <SessionBar exitHref={home} progress={index / queue.length} combo={combo} xp={sessionXp} color={subject.color} />

      <div className="mb-4 flex items-center justify-between gap-3 text-xs text-muted">
        <span className="min-w-0">
          {only ? "Fehler wiederholen" : MODE_TITLE[mode]} · {lectureTitle}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="tabular-nums">
            {index + 1} / {queue.length}
          </span>
          <MarkButton kind="q" subjectId={subject.id} id={q.id} shortcut="M" />
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.22 }}
          className="relative"
        >
          {entry.retry && (
            <span className="mb-3 inline-flex items-center gap-1 rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">
              <RotateCcw className="size-3" /> Zweiter Versuch
            </span>
          )}
          <XpFloat amount={lastXp.amount} trigger={revealed ? lastXp.n : 0} />

          {q.type === "mc" && (
            <MCView
              q={q}
              order={entry.order}
              selected={selected}
              verdicts={mc?.verdicts}
              onToggle={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
            />
          )}
          {q.type === "tf" && <TFView q={q} value={tf} onChange={pickTf} revealed={revealed} />}
          {q.type === "short" && <ShortInput q={q} text={text} onChange={setText} disabled={revealed || pending} />}

          <div className="mt-6 space-y-4">
            {revealed && q.type === "mc" && mc && (
              <Explanation correct={wasCorrect} text={q.explanation} partial={mc.partial} />
            )}
            {revealed && q.type === "tf" && <Explanation correct={wasCorrect} text={q.explanation} />}
            {q.type === "short" && (revealed || pending) && (
              <ShortResult
                q={q}
                grade={shortGrade}
                pending={pending}
                onSelfGrade={(hit) => {
                  const g = selfGrade(q, hit);
                  setShortGrade(g);
                  finish(g.score >= SHORT_PASS);
                }}
              />
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="sticky bottom-4 mt-8 flex items-center justify-end gap-2">
        {!revealed && !pending && (
          <Button variant="ghost" onClick={skip} className="mr-auto text-muted">
            <SkipForward className="size-4" /> Überspringen <span className="kbd ml-1 hidden sm:inline-flex">S</span>
          </Button>
        )}
        {canContinue ? (
          <Button onClick={next} className="min-w-40 shadow-soft">
            Weiter <ArrowRight className="size-4" /> <span className="kbd ml-1 hidden border-white/30 bg-transparent text-inherit sm:inline-flex">↵</span>
          </Button>
        ) : q.type === "tf" || (q.type === "short" && revealed) ? null : (
          <Button
            onClick={() => void check()}
            disabled={(q.type === "mc" && !selected.length) || (q.type === "short" && (pending || revealed || !text.trim()))}
            className="min-w-40 shadow-soft"
          >
            {q.type === "short" ? "Bewerten" : "Prüfen"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Summary({
  outcomes,
  xp,
  bestCombo,
  skipped,
  base,
  subjectId,
  onRestart,
  onRetry,
}: {
  outcomes: Outcome[];
  xp: number;
  bestCombo: number;
  skipped: number;
  base: string;
  subjectId: string;
  onRestart: () => void;
  onRetry: (qs: Question[]) => void;
}) {
  const right = outcomes.filter((o) => o.correct).length;
  const acc = outcomes.length ? right / outcomes.length : 0;
  const mistakes = outcomes.filter((o) => !o.correct).map((o) => o.q);

  useEffect(() => {
    if (acc >= 0.8) celebrate(acc === 1);
  }, [acc]);

  return (
    <div className="mx-auto max-w-xl py-6 text-center">
      <p className="eyebrow">Session abgeschlossen</p>
      <h1 className="display text-4xl sm:text-5xl mt-2">
        {!outcomes.length
          ? "Session beendet"
          : acc >= 0.9
            ? "Hervorragend!"
            : acc >= 0.7
              ? "Stark gemacht."
              : acc >= 0.5
                ? "Guter Fortschritt."
                : "Dranbleiben!"}
      </h1>
      {skipped > 0 && (
        <p className="mt-2 text-sm text-muted">
          {skipped} {skipped === 1 ? "Frage" : "Fragen"} übersprungen – sie kommen in einer späteren Session wieder.
        </p>
      )}
      <div className="mt-8 grid grid-cols-3 gap-3">
        {[
          ["Treffer", outcomes.length ? pct(acc) : "–"],
          ["XP", `+${xp}`],
          ["Beste Combo", String(bestCombo)],
        ].map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="display text-3xl tabular-nums">{value}</p>
            <p className="eyebrow mt-1">{label}</p>
          </div>
        ))}
      </div>

      {mistakes.length > 0 && (
        <div className="card mt-6 p-5 text-left">
          <p className="font-semibold">Diese Fragen solltest du dir nochmal ansehen</p>
          <p className="text-sm text-muted">Mit dem Lesezeichen merkst du sie dir für später vor.</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-2">
            {mistakes.map((q) => (
              <li key={q.id} className="flex items-start gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-bad" />
                <span className="flex-1 pt-1">{q.type === "tf" ? q.statement : q.prompt}</span>
                <MarkButton kind="q" subjectId={subjectId} id={q.id} label={false} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {mistakes.length > 0 && (
          <Button onClick={() => onRetry(mistakes)}>
            <RotateCcw className="size-4" /> Fehler wiederholen
          </Button>
        )}
        <Button variant={mistakes.length ? "secondary" : "primary"} onClick={onRestart}>
          Neue Session
        </Button>
        <ButtonLink variant="ghost" href={base}>
          Zur Übersicht
        </ButtonLink>
      </div>
    </div>
  );
}
