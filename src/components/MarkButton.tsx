"use client";

import { Bookmark } from "lucide-react";
import { markKey, useApp, type MarkKind } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Lesezeichen für eine Frage oder Karteikarte – zum späteren Wiederholen. */
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
  const on = useApp((s) => !!s.marks[key]?.on);
  const toggleMark = useApp((s) => s.toggleMark);
  const text = on ? "Markiert" : "Markieren";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggleMark(key);
      }}
      aria-pressed={on}
      aria-label={label ? undefined : on ? "Markierung entfernen" : "Zum Wiederholen markieren"}
      title={on ? "Markierung entfernen" : "Zum späteren Wiederholen markieren"}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full text-sm font-semibold transition",
        label ? "px-3 py-1" : "size-8 justify-center",
        on ? "bg-accent/10 text-accent" : "text-muted hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      <Bookmark className="size-4" fill={on ? "currentColor" : "none"} />
      {label && text}
      {label && shortcut && <span className="kbd ml-0.5 hidden sm:inline-flex">{shortcut}</span>}
    </button>
  );
}
