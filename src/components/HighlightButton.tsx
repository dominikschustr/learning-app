"use client";

import { Highlighter } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cloudConfigured } from "@/lib/cloud";
import { toggleHighlight, useHighlighters, whoSentence, whoText } from "@/lib/highlights";
import { markKey, type MarkKind } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Frage für die Lerngruppe hervorheben – alle anderen sehen dann „Dominik hat diese Frage hervorgehoben“.
 * Anders als das Lesezeichen (MarkButton) ist das nicht privat.
 */
export function HighlightButton({
  kind = "q",
  subjectId,
  id,
  label = true,
  shortcut,
  className,
}: {
  kind?: MarkKind;
  subjectId: string;
  id: string;
  /** Text neben dem Symbol anzeigen (auf dem Handy nur das Symbol) */
  label?: boolean;
  shortcut?: string;
  className?: string;
}) {
  const key = markKey(kind, subjectId, id);
  const who = useHighlighters(key);
  const uid = useAuth((s) => s.session?.uid);
  if (!cloudConfigured() || !uid) return null;
  const on = who.some((h) => h.me);
  const others = who.filter((h) => !h.me).length;
  const title = on
    ? "Hervorhebung für alle zurücknehmen"
    : others
      ? `${whoText(who)} ${others === 1 ? "hat" : "haben"} das hervorgehoben – auch für alle hervorheben`
      : "Für alle hervorheben – deine Lerngruppe sieht, dass du das wichtig findest";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void toggleHighlight(key);
      }}
      aria-pressed={on}
      aria-label={label ? undefined : title}
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full text-sm font-semibold transition",
        label ? "px-2.5 py-1 sm:px-3" : "size-8 justify-center",
        on ? "bg-warn-soft text-warn" : others ? "text-warn hover:bg-warn-soft" : "text-muted hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      <Highlighter className="size-4" strokeWidth={on ? 2.5 : 2} />
      {label && <span className="hidden sm:inline">{on ? "Hervorgehoben" : "Hervorheben"}</span>}
      {label && shortcut && <span className="kbd ml-0.5 hidden sm:inline-flex">{shortcut}</span>}
    </button>
  );
}

/** Hinweis über einer Frage: wer aus der Lerngruppe sie hervorgehoben hat. Nichts, solange es niemand hat. */
export function HighlightNote({
  kind = "q",
  subjectId,
  id,
  noun = "diese Frage",
  className,
}: {
  kind?: MarkKind;
  subjectId: string;
  id: string;
  noun?: string;
  className?: string;
}) {
  const who = useHighlighters(markKey(kind, subjectId, id));
  if (!who.length) return null;
  const names = who.map((h) => (h.me ? "Du" : h.name)).join(", ");
  return (
    <span
      title={names}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn",
        className,
      )}
    >
      <Highlighter className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{whoSentence(who, noun)}</span>
    </span>
  );
}
