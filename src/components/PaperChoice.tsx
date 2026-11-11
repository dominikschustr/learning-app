"use client";

import { ArrowRight, Shuffle, Table2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect } from "react";

export type PaperChoiceTarget = {
  /** Kapitel-id */
  id: string;
  /** z. B. „Kapitel 2 · T2“ */
  label: string;
  title: string;
  total: number;
  open: number;
};

/** Auswahl beim Klick auf „Klausuraufgaben“ eines Kapitels: alle zufällig üben oder gezielt aus der Tabelle wählen. */
export function PaperChoice({
  subjectId,
  target,
  color,
  onClose,
}: {
  subjectId: string;
  target: PaperChoiceTarget | null;
  color: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  const base = `/s/${subjectId}`;
  return (
    <AnimatePresence>
      {target && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-end bg-ink/30 backdrop-blur-sm sm:place-items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Klausuraufgaben ${target.label}`}
            initial={{ scale: 0.97, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 16 }}
            className="card w-full p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-sm:rounded-b-none sm:max-w-md sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">Klausuraufgaben · {target.label}</p>
                <h2 className="display mt-1 text-2xl leading-tight">{target.title}</h2>
                <p className="mt-1 text-sm text-muted">
                  {target.total} Aufgaben · {target.open} noch offen
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Schließen"
                className="-mr-2 -mt-1 inline-grid size-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-2">
              <Option
                href={`${base}/practice?mode=papers&lecture=${target.id}&order=random`}
                icon={Shuffle}
                color={color}
                title="Zufällig üben"
                text={`Alle ${target.total} Aufgaben des Kapitels in zufälliger Reihenfolge – Teilaufgaben a), b) bleiben zusammen.`}
              />
              <Option
                href={`${base}/exam?view=tasks&lecture=${target.id}`}
                icon={Table2}
                color={color}
                title="Aus der Tabelle auswählen"
                text="Gezielt einzelne Klausuraufgaben wählen – mit Thema, Klausur und ob du sie schon bearbeitet hast."
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Option({
  href,
  icon: I,
  color,
  title,
  text,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:border-line-strong hover:bg-surface-2 sm:p-4"
    >
      <span
        className="grid size-10 shrink-0 place-items-center rounded-xl"
        style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
      >
        <I className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted">{text}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5" />
    </Link>
  );
}
