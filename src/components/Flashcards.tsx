"use client";

import { Bookmark, Check, RotateCcw, Undo2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { XP } from "@/lib/gamification";
import type { Card, SubjectContent } from "@/lib/schema";
import { isDue } from "@/lib/srs";
import { markKey, markedIds, useApp, useHydrated } from "@/lib/store";
import { announce, celebrate } from "@/lib/toast";
import { refreshNow } from "@/lib/useNow";
import { itemKey, shuffle } from "@/lib/utils";
import { MarkButton } from "./MarkButton";
import { SessionBar } from "./SessionBar";
import { Button, ButtonLink, Skeleton } from "./ui";

const DECK_SIZE = 20;

export function Flashcards({ content }: { content: SubjectContent }) {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const lecture = params.get("lecture") ?? undefined;
  const marked = params.get("marked") === "1";
  const [run, setRun] = useState<{ n: number; only?: Card[] }>({ n: 0 });

  if (!hydrated) return <Skeleton className="h-96" />;
  return (
    <Deck
      key={`${lecture}-${marked}-${run.n}`}
      content={content}
      lecture={lecture}
      marked={marked}
      only={run.only}
      onRestart={(only) => setRun((r) => ({ n: r.n + 1, only }))}
    />
  );
}

function Deck({
  content,
  lecture,
  marked,
  only,
  onRestart,
}: {
  content: SubjectContent;
  lecture?: string;
  /** nur markierte Karten */
  marked: boolean;
  only?: Card[];
  onRestart: (only?: Card[]) => void;
}) {
  const { subject } = content;
  const base = `/s/${subject.id}`;
  const home = lecture ? `${base}/c/${lecture}` : base;
  const reviewCard = useApp((s) => s.reviewCard);

  const [deck] = useState<Card[]>(() => {
    if (only) return shuffle(only);
    const states = useApp.getState().cards;
    const now = Date.now();
    const st = (c: Card) => states[itemKey(subject.id, c.id)];
    const marks = markedIds(useApp.getState().marks, "c", subject.id);
    const pool = content.cards.filter((c) => (!lecture || c.lecture === lecture) && (!marked || marks.has(c.id)));
    if (marked) return shuffle(pool);
    const due = pool.filter((c) => isDue(st(c), now));
    const fresh = pool.filter((c) => !st(c));
    const rest = pool.filter((c) => st(c) && !isDue(st(c), now)).sort((a, b) => st(a).due - st(b).due);
    return [...shuffle(due), ...fresh, ...rest].slice(0, DECK_SIZE);
  });
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [unknown, setUnknown] = useState<Card[]>([]);
  const [xp, setXp] = useState(0);

  const card = deck[index];
  const done = index >= deck.length;

  const rate = useCallback(
    (known: boolean) => {
      if (!card || !flipped) return;
      const gain = XP.card + (known ? XP.cardKnown : 0);
      announce(reviewCard({ subjectId: subject.id, cardId: card.id, known, xp: gain }));
      refreshNow();
      setXp((x) => x + gain);
      if (!known) setUnknown((u) => [...u, card]);
      setFlipped(false);
      setIndex((i) => i + 1);
    },
    [card, flipped, reviewCard, subject.id],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "m" && card) useApp.getState().toggleMark(markKey("c", subject.id, card.id));
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "1" || e.key === "ArrowLeft") rate(false);
      else if (e.key === "2" || e.key === "ArrowRight") rate(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rate, card, subject.id]);

  const knownCount = deck.length - unknown.length;
  useEffect(() => {
    if (done && deck.length && knownCount / deck.length >= 0.8) celebrate();
  }, [done, deck.length, knownCount]);

  if (!deck.length) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        {marked && <Bookmark className="mx-auto mb-4 size-12 text-accent" />}
        <h1 className="display text-4xl sm:text-5xl">{marked ? "Keine Karten markiert" : "Keine Karteikarten"}</h1>
        <p className="mt-2 text-muted">
          {marked
            ? "Tippe bei einer Karteikarte auf das Lesezeichen (oder drücke M) – sie landet dann hier zum Wiederholen."
            : "Für diese Auswahl gibt es noch keine Karten."}
        </p>
        <ButtonLink className="mt-6" href={base}>
          Zurück
        </ButtonLink>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <p className="eyebrow">Stapel durch</p>
        <h1 className="display text-4xl sm:text-5xl mt-2">
          {knownCount} von {deck.length} gewusst
        </h1>
        <p className="mt-3 text-muted">+{xp} XP · Karten, die du nicht wusstest, kommen bald wieder.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {unknown.length > 0 && (
            <Button onClick={() => onRestart(unknown)}>
              <RotateCcw className="size-4" /> {unknown.length} unsichere nochmal
            </Button>
          )}
          <Button variant="secondary" onClick={() => onRestart()}>
            Neuer Stapel
          </Button>
          <ButtonLink variant="ghost" href={home}>
            Zurück
          </ButtonLink>
        </div>
      </div>
    );
  }

  const lectureTitle = subject.lectures.find((l) => l.id === card.lecture)?.title;

  return (
    <div className="mx-auto max-w-2xl">
      <SessionBar exitHref={home} progress={index / deck.length} xp={xp} color={subject.color} />
      <div className="mb-4 flex items-center justify-between gap-3 text-xs text-muted">
        <span className="min-w-0">
          {marked ? "Markierte Karten" : "Karteikarten"} · {lectureTitle}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="tabular-nums">
            {index + 1} / {deck.length}
          </span>
          <MarkButton kind="c" subjectId={subject.id} id={card.id} shortcut="M" />
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={card.id + index}
          initial={{ opacity: 0, y: 16, rotate: -1 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          exit={{ opacity: 0, y: -16, rotate: 1 }}
          transition={{ duration: 0.22 }}
          className="flip-scene"
        >
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? "Vorderseite zeigen" : "Rückseite zeigen"}
            className="flip-inner relative block h-[22rem] w-full text-left sm:h-[24rem]"
            data-flipped={flipped}
          >
            <div className="flip-face card absolute inset-0 flex flex-col p-8">
              <span className="eyebrow">Begriff</span>
              <p className="display my-auto text-center text-3xl sm:text-4xl">{card.front}</p>
              <span className="text-center text-xs text-muted">
                Tippen zum Umdrehen <span className="kbd ml-1 hidden sm:inline-flex">Leertaste</span>
              </span>
            </div>
            <div
              className="flip-face flip-back card absolute inset-0 flex flex-col overflow-y-auto p-8"
              style={{ borderColor: subject.color }}
            >
              <span className="eyebrow" style={{ color: subject.color }}>
                {card.front}
              </span>
              <p className="my-auto whitespace-pre-line text-lg leading-relaxed sm:text-xl">{card.back}</p>
            </div>
          </button>
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="secondary" disabled={!flipped} onClick={() => rate(false)} className="h-14 text-base">
          <Undo2 className="size-4 text-bad" /> Nochmal <span className="kbd hidden sm:inline-flex">1</span>
        </Button>
        <Button variant="secondary" disabled={!flipped} onClick={() => rate(true)} className="h-14 text-base">
          <Check className="size-4 text-good" /> Gewusst <span className="kbd hidden sm:inline-flex">2</span>
        </Button>
      </div>
    </div>
  );
}
