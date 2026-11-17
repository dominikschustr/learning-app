"use client";

import { Bookmark } from "lucide-react";
import { toggleQuestionMark, useHighlighters, whoSentence, whoText } from "@/lib/highlights";
import { markKey, useApp, type MarkKind } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Markierung für eine Frage oder Karteikarte – zum späteren Wiederholen.
 * Fragen-Markierungen sieht die ganze Lerngruppe („Adrian hat diese Frage markiert“); Karten bleiben privat.
 */
export function MarkButton({
  kind,
  subjectId,
  id,
  label = true,
  shortcut,
  className,
}: {
  kind: MarkKind;
  subjectId: string;
  id: string;
  /** Text neben dem Symbol anzeigen */
  label?: boolean;
  shortcut?: string;
  className?: string;
}) {
  const key = markKey(kind, subjectId, id);
  const who = useHighlighters(key);
  const cardOn = useApp((s) => !!s.marks[key]?.on);
  const toggleMark = useApp((s) => s.toggleMark);
  const shared = kind === "q";
  const on = shared ? who.some((h) => h.me) : cardOn;
  const others = shared ? who.filter((h) => !h.me).length : 0;
  const text = on ? "Markiert" : "Markieren";
  const title = on
    ? "Markierung entfernen"
    : others
      ? `${whoText(who)} ${others === 1 ? "hat" : "haben"} das markiert – auch selbst markieren`
      : shared
        ? "Markieren – zum Wiederholen, deine Lerngruppe sieht es auch"
        : "Zum späteren Wiederholen markieren";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (shared) void toggleQuestionMark(key);
        else toggleMark(key);
      }}
      aria-pressed={on}
      aria-label={label ? undefined : title}
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full text-sm font-semibold transition",
        label ? "px-3 py-1" : "size-8 justify-center",
        on ? "bg-accent/10 text-accent" : others ? "text-accent hover:bg-accent/10" : "text-muted hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      <Bookmark className="size-4" fill={on ? "currentColor" : "none"} />
      {label && text}
      {label && shortcut && <span className="kbd ml-0.5 hidden sm:inline-flex">{shortcut}</span>}
    </button>
  );
}

/** Hinweis über einer Frage: wer aus der Lerngruppe sie markiert hat. Nichts, solange es nur du (oder niemand) bist. */
export function MarkNote({
  subjectId,
  id,
  noun = "diese Frage",
  className,
}: {
  subjectId: string;
  id: string;
  noun?: string;
  className?: string;
}) {
  const who = useHighlighters(markKey("q", subjectId, id));
  if (!who.some((h) => !h.me)) return null;
  const names = who.map((h) => (h.me ? "Du" : h.name)).join(", ");
  return (
    <span
      title={names}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent",
        className,
      )}
    >
      <Bookmark className="size-3.5 shrink-0" fill="currentColor" />
      <span className="min-w-0 truncate">{whoSentence(who, noun)}</span>
    </span>
  );
}
