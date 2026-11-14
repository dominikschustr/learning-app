"use client";

import { ArrowLeft, ArrowRight, Bookmark, Highlighter, PartyPopper, RotateCcw, Sigma, SkipForward } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { answerXp } from "@/lib/gamification";
import { gradeShortAnswer, selfGrade } from "@/lib/grade";
import { useAuth } from "@/lib/auth";
import { cloudConfigured } from "@/lib/cloud";
import { highlightIndex, highlightedIn, toggleHighlight, useHighlights } from "@/lib/highlights";
import { MODE_TITLE, buildQueue, optionOrder, type PracticeMode } from "@/lib/queue";
import type { Question, SubjectContent } from "@/lib/schema";
import type { RenderedFormula } from "@/lib/tex";
import { gradeMC, gradeTF, shortPassed, toggleOption, type MCResult } from "@/lib/scoring";
import { markKey, markedIds, useApp, useHydrated, type ShortGrade } from "@/lib/store";
import { announce, celebrate } from "@/lib/toast";
import { refreshNow } from "@/lib/useNow";
import { cn, pct } from "@/lib/utils";
import { FormulaDrawer, sideBySide } from "./FormulaDrawer";
import { HighlightButton, HighlightNote } from "./HighlightButton";
import { MarkButton } from "./MarkButton";
import { Explanation, MCView, ShortInput, ShortResult, TFView, useCaseOf } from "./Questions";
import { SessionBar, XpFloat } from "./SessionBar";
import { Button, ButtonLink, Skeleton } from "./ui";

type Entry = { q: Question; order: string[]; retry: boolean };
type Outcome = { q: Question; correct: boolean };
/** Antwortzustand einer Frage – gemerkt, damit man zu ihr zurückgehen kann. */
type Snap = {
  selected: string[];
  tf: boolean | null;
  text: string;
  mc: MCResult | null;
  shortGrade: ShortGrade | null;
  revealed: boolean;
  wasCorrect: boolean;
};
const BLANK: Snap = { selected: [], tf: null, text: "", mc: null, shortGrade: null, revealed: false, wasCorrect: false };

const MODES: PracticeMode[] = ["smart", "due", "weak", "lecture", "marked", "new", "wrong", "checkup", "mc", "papers", "highlighted"];

export function Practice({
  content,
  formulas = [],
  papers = [],
}: {
  content: SubjectContent;
  formulas?: RenderedFormula[];
  /** Aufgaben der Probeklausuren (auch paperOnly) für mode "papers" */
  papers?: Question[];
}) {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const raw = params.get("mode") as PracticeMode;
  const mode = MODES.includes(raw) ? raw : "smart";
  const lecture = params.get("lecture") ?? undefined;
  const picked = params.get("q") ?? "";
  const random = params.get("order") === "random";
  const [run, setRun] = useState(0);
  // Hervorgehobene Fragen: erst starten, wenn die Liste der Lerngruppe da ist (oder nicht geladen werden kann)
  const highlightsReady = useHighlights(
    (s) =>
      s.loadedAt !== null ||
      s.status === "error" ||
      !cloudConfigured() ||
      (typeof navigator !== "undefined" && !navigator.onLine),
  );

  if (!hydrated || (mode === "highlighted" && !highlightsReady)) return <Skeleton className="h-96" />;
  return (
    <Session
      key={`${mode}-${lecture}-${picked}-${random}-${run}`}
      content={content}
      formulas={formulas}
      papers={papers}
      mode={mode}
      lecture={lecture}
      ids={mode === "papers" && picked ? picked.split(",").filter(Boolean) : undefined}
      random={random}
      onRestart={() => setRun((r) => r + 1)}
    />
  );
}

function Session({
  content,
  formulas,
  mode,
  lecture,
  onRestart,
  only,
  papers,
  ids,
  random,
}: {
  content: SubjectContent;
  formulas: RenderedFormula[];
  mode: PracticeMode;
  lecture?: string;
  onRestart: () => void;
  only?: Question[];
  papers?: Question[];
  /** in der Aufgabentabelle ausgewählte Klausuraufgaben */
  ids?: string[];
  random?: boolean;
}) {
  const { subject } = content;
  const caseOf = useCaseOf(content.cases);
  const base = `/s/${subject.id}`;
  // aus der Aufgabentabelle gestartet → zurück zur Tabelle
  const home = ids
    ? `${base}/exam?view=tasks${lecture ? `&lecture=${lecture}` : ""}`
    : lecture
      ? `${base}/c/${lecture}`
      : base;
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
        highlighted: new Set(
          highlightedIn(highlightIndex(useHighlights.getState().docs, useAuth.getState().session?.uid), subject.id).keys(),
        ),
        papers,
        ids,
        random,
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
  const [formulasOpen, setFormulasOpen] = useState(false);
  // Zurückgehen: Antwortzustand je Frage (am Eintrag, nicht am Index – Wiederholungen schieben die Indizes)
  const snaps = useRef(new Map<Entry, Snap>());
  const skippedEntries = useRef(new Set<Entry>());
  const [dir, setDir] = useState(1);
  // wiederhergestellte Frage: kein erneutes „+XP“
  const [restored, setRestored] = useState(false);
  const closeFormulas = useCallback(() => setFormulasOpen(false), []);

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
      setRestored(false);
      // vorher übersprungen und jetzt doch beantwortet
      if (skippedEntries.current.delete(entry)) setSkipped((n) => n - 1);
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
      const g = await gradeShortAnswer(q, text, caseOf(q));
      setPending(false);
      if (g) {
        setShortGrade(g);
        finish(shortPassed(g));
      } else {
        setRevealed(true); // Selbstbewertung anzeigen
      }
    }
  }, [entry, revealed, selected, finish, pending, text, caseOf]);

  const pickTf = useCallback(
    (v: boolean) => {
      if (!entry || entry.q.type !== "tf" || revealed) return;
      setTf(v);
      finish(gradeTF(entry.q.answer, v));
    },
    [entry, revealed, finish],
  );

  /** Zu einer anderen Frage wechseln: Stand der aktuellen merken, den der Zielfrage (falls schon besucht) laden. */
  const go = useCallback(
    (to: number) => {
      if (entry) snaps.current.set(entry, { selected, tf, text, mc, shortGrade, revealed, wasCorrect });
      const snap = (queue[to] && snaps.current.get(queue[to])) || BLANK;
      setDir(to < index ? -1 : 1);
      setIndex(to);
      setSelected(snap.selected);
      setTf(snap.tf);
      setText(snap.text);
      setMc(snap.mc);
      setShortGrade(snap.shortGrade);
      setRevealed(snap.revealed);
      setWasCorrect(snap.wasCorrect);
      setRestored(snap !== BLANK);
    },
    [entry, queue, index, selected, tf, text, mc, shortGrade, revealed, wasCorrect],
  );
  const next = useCallback(() => go(index + 1), [go, index]);
  const back = useCallback(() => {
    if (index > 0 && !pending) go(index - 1);
  }, [go, index, pending]);

  const canContinue = revealed && (entry?.q.type !== "short" || !!shortGrade);

  /** Frage auslassen: zählt weder als richtig noch als falsch, Lernstand bleibt unverändert. */
  const skip = useCallback(() => {
    if (!entry || revealed || pending) return;
    if (!skippedEntries.current.has(entry)) {
      skippedEntries.current.add(entry);
      setSkipped((n) => n + 1);
    }
    setCombo(0);
    next();
  }, [entry, revealed, pending, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!entry) return;
      // Tasten in der Formelsammlung (oder solange sie die Aufgabe verdeckt) gehören nicht der Frage
      if (formulasOpen && (!sideBySide() || (e.target as HTMLElement)?.closest?.("[data-formula-drawer]"))) return;
      const tag = (e.target as HTMLElement)?.tagName;
      const inText = tag === "TEXTAREA";
      if (e.key === "Enter") {
        // Im Textfeld nur mit Cmd/Ctrl+Enter abschicken
        if (inText && !(e.metaKey || e.ctrlKey)) return;
        e.preventDefault();
        if (canContinue) next();
        else void check();
        return;
      }
      // Ergebnisfelder von Rechenaufgaben: Enter prüft, Buchstaben sind Eingabe
      if (e.metaKey || e.ctrlKey || e.altKey || inText || tag === "INPUT") return;
      if (e.key === "m") {
        useApp.getState().toggleMark(markKey("q", subject.id, entry.q.id));
        return;
      }
      if (e.key === "h") {
        void toggleHighlight(markKey("q", subject.id, entry.q.id));
        return;
      }
      if (e.key === "s") {
        skip();
        return;
      }
      if (e.key === "Backspace" || (e.key === "ArrowLeft" && (revealed || entry.q.type !== "tf"))) {
        e.preventDefault();
        back();
        return;
      }
      if (revealed) return;
      const q = entry.q;
      if (q.type === "mc") {
        const n = Number(e.key);
        if (n >= 1 && n <= entry.order.length) {
          const id = entry.order[n - 1];
          setSelected((s) => toggleOption(q, s, id));
        }
      } else if (q.type === "tf") {
        if (e.key === "t" || e.key === "w" || e.key === "ArrowLeft") pickTf(true);
        if (e.key === "f" || e.key === "ArrowRight") pickTf(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entry, revealed, canContinue, next, back, check, pickTf, subject.id, skip, formulasOpen]);

  if (retryMode) {
    return <Session content={content} formulas={formulas} mode={mode} onRestart={onRestart} only={retryMode} />;
  }

  if (!queue.length) {
    if (mode === "highlighted") {
      return (
        <div className="mx-auto max-w-lg py-16 text-center">
          <Highlighter className="mx-auto size-12 text-warn" />
          <h1 className="display text-4xl sm:text-5xl mt-4">Noch nichts hervorgehoben</h1>
          <p className="mt-2 text-muted">
            Tippe beim Üben, in der Auswertung oder in der Aufgaben-Tabelle auf den Textmarker (oder drücke H) – die
            Frage landet dann hier, für dich und deine Lerngruppe.
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
                  : mode === "checkup"
                    ? "Keine Check-up-Fragen"
                    : mode === "mc"
                      ? "Keine Multiple-Choice-Fragen"
                      : mode === "papers"
                        ? "Keine Klausuraufgaben"
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
                  : mode === "checkup"
                    ? "Für diese Auswahl sind keine Check-up-Fragen aus den Vorlesungen hinterlegt."
                    : mode === "mc"
                      ? "Für diese Auswahl ist kein Multiple-Choice-Set hinterlegt."
                      : mode === "papers"
                        ? "In den Probeklausuren gibt es zu diesem Kapitel keine Aufgaben."
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
    <div
      className={cn(
        "mx-auto max-w-2xl transition-[margin] duration-300",
        // Formelsammlung offen: Aufgabe rückt links neben das Panel (36rem breit)
        formulasOpen && "lg:mr-[max(0px,calc(37.5rem_-_(100vw_-_64rem)/2))]",
      )}
    >
      <SessionBar exitHref={home} progress={index / queue.length} combo={combo} xp={sessionXp} color={subject.color} />

      <div className="mb-4 flex items-center justify-between gap-3 text-xs text-muted">
        <span className="min-w-0 truncate">
          {only ? "Fehler wiederholen" : MODE_TITLE[mode]} · {lectureTitle}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="tabular-nums">
            {index + 1} / {queue.length}
          </span>
          {formulas.length > 0 && (
            <button
              type="button"
              onClick={() => setFormulasOpen(true)}
              title="Formelsammlung einblenden"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-muted transition hover:bg-surface-2 hover:text-ink"
            >
              <Sigma className="size-4" /> Formeln
            </button>
          )}
          <HighlightButton subjectId={subject.id} id={q.id} shortcut="H" />
          <MarkButton kind="q" subjectId={subject.id} id={q.id} shortcut="M" />
        </span>
      </div>

      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={index}
          custom={dir}
          variants={{
            enter: (d: number) => ({ opacity: 0, x: 24 * d }),
            center: { opacity: 1, x: 0 },
            leave: (d: number) => ({ opacity: 0, x: -24 * d }),
          }}
          initial="enter"
          animate="center"
          exit="leave"
          transition={{ duration: 0.22 }}
          className="relative"
        >
          {entry.retry && (
            <span className="mb-3 inline-flex items-center gap-1 rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">
              <RotateCcw className="size-3" /> Zweiter Versuch
            </span>
          )}
          <HighlightNote subjectId={subject.id} id={q.id} className={cn("mb-3", entry.retry && "ml-2")} />
          <XpFloat amount={lastXp.amount} trigger={revealed && !restored ? lastXp.n : 0} />

          {q.type === "mc" && (
            <MCView
              q={q}
              order={entry.order}
              selected={selected}
              verdicts={mc?.verdicts}
              onToggle={(id) => setSelected((s) => toggleOption(q, s, id))}
              context={caseOf(q)}
            />
          )}
          {q.type === "tf" && <TFView q={q} value={tf} onChange={pickTf} revealed={revealed} context={caseOf(q)} />}
          {q.type === "short" && (
            <ShortInput q={q} text={text} onChange={setText} disabled={revealed || pending} context={caseOf(q)} />
          )}

          <div className="mt-6 space-y-4">
            {revealed && q.type === "mc" && mc && (
              <Explanation correct={wasCorrect} text={q.explanation} partial={mc.partial} q={q} />
            )}
            {revealed && q.type === "tf" && <Explanation correct={wasCorrect} text={q.explanation} />}
            {q.type === "short" && (revealed || pending) && (
              <ShortResult
                q={q}
                grade={shortGrade}
                pending={pending}
                answer={text}
                onSelfGrade={(hit) => {
                  const g = selfGrade(q, hit);
                  setShortGrade(g);
                  finish(shortPassed(g));
                }}
              />
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] mt-8 flex items-center justify-end gap-2">
        {index > 0 && (
          <Button
            variant="ghost"
            onClick={back}
            disabled={pending}
            className={cn("text-muted", (revealed || pending) && "mr-auto")}
            title="Zur vorigen Frage"
            aria-label="Zur vorigen Frage"
          >
            <ArrowLeft className="size-4" /> <span className="max-sm:hidden">Zurück</span>
          </Button>
        )}
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
            {q.type === "short" && !q.results.length ? "Bewerten" : "Prüfen"}
          </Button>
        )}
      </div>

      {formulas.length > 0 && (
        <FormulaDrawer
          open={formulasOpen}
          onClose={closeFormulas}
          subject={subject}
          formulas={formulas}
          lecture={q.lecture}
        />
      )}
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
