"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Subject } from "@/lib/schema";
import type { RenderedFormula } from "@/lib/tex";
import { cn } from "@/lib/utils";
import { FormulaDetails, FormulaHeading } from "./FormulaOverview";

/**
 * Formelsammlung zum Einblenden beim Üben. Ab Laptop-Breite liegt sie rechts neben der Aufgabe, die bedienbar
 * bleibt (rechnen und nachschlagen gleichzeitig); schmaler legt sie sich über die Seite.
 * Startet beim Kapitel der aktuellen Frage; „Nur Formelblatt“ zeigt genau das, was in der Klausur ausliegt.
 */
export function FormulaDrawer({
  open,
  onClose,
  subject,
  formulas,
  lecture,
}: {
  open: boolean;
  onClose: () => void;
  subject: Subject;
  formulas: RenderedFormula[];
  /** Kapitel der aktuellen Frage – wird beim Öffnen vorausgewählt */
  lecture?: string;
}) {
  // bleibt über mehrere Fragen hinweg eingestellt
  const [sheetOnly, setSheetOnly] = useState(false);

  // Esc schließt; als Overlay (schmale Fenster) scrollt die Seite dahinter nicht mit
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    if (!sideBySide()) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="formula-drawer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm lg:pointer-events-none lg:bg-transparent lg:backdrop-blur-none"
          onClick={onClose}
        >
          <motion.aside
            role="dialog"
            aria-label="Formelsammlung"
            data-formula-drawer
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-line bg-bg shadow-soft"
          >
            <Panel
              subject={subject}
              formulas={formulas}
              lecture={lecture}
              sheetOnly={sheetOnly}
              onSheetOnly={setSheetOnly}
              onClose={onClose}
            />
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Inhalt des Panels – wird bei jedem Öffnen neu aufgebaut und startet beim Kapitel der Frage. */
function Panel({
  subject,
  formulas,
  lecture,
  sheetOnly,
  onSheetOnly,
  onClose,
}: {
  subject: Subject;
  formulas: RenderedFormula[];
  lecture?: string;
  sheetOnly: boolean;
  onSheetOnly: (v: boolean) => void;
  onClose: () => void;
}) {
  const chapters = subject.lectures.filter((l) => formulas.some((f) => f.lecture === l.id));
  const [chapter, setChapter] = useState(() => (lecture && chapters.some((l) => l.id === lecture) ? lecture : "all"));
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [chapter, sheetOnly]);

  const list = formulas.filter((f) => (chapter === "all" || f.lecture === chapter) && (!sheetOnly || f.sheet));
  const groups = chapters
    .map((l) => ({ l, items: list.filter((f) => f.lecture === l.id) }))
    .filter((g) => g.items.length);

  return (
    <>
      <header className="border-b border-line px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">{subject.name}</p>
            <h2 className="display text-2xl">Formelsammlung</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Formelsammlung schließen"
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
          {[{ id: "all", label: "Alle" }, ...chapters.map((l) => ({ id: l.id, label: l.title.split(" · ")[0] }))].map(
            (c) => (
              <Pill key={c.id} on={chapter === c.id} onClick={() => setChapter(c.id)}>
                {c.label}
              </Pill>
            ),
          )}
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={sheetOnly}
            onChange={(e) => onSheetOnly(e.target.checked)}
            className="size-4 accent-[var(--accent)]"
          />
          Nur was auf dem Formelblatt der Klausur steht
        </label>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6">
        {groups.length ? (
          <div className="space-y-8">
            {groups.map(({ l, items }) => (
              <section key={l.id}>
                {chapter === "all" && <p className="eyebrow mb-3">{l.title}</p>}
                <div className="space-y-3">
                  {items.map((f) => (
                    <article key={f.id} className="card p-4 sm:p-5">
                      <FormulaHeading f={f} color={subject.color} />
                      <FormulaDetails f={f} color={subject.color} />
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-muted">
            In diesem Kapitel steht keine Formel auf dem Formelblatt – alles hier musst du auswendig können.
          </p>
        )}
      </div>
    </>
  );
}

/** Breites Fenster: Panel liegt neben der Aufgabe statt darüber (passt zu den lg:-Klassen). */
export function sideBySide() {
  return window.matchMedia("(min-width: 64rem)").matches;
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "h-8 shrink-0 rounded-full px-3 text-sm font-semibold transition",
        on ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}
