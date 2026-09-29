"use client";

import { Flame, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Bar } from "./ui";

export function SessionBar({
  exitHref,
  progress,
  combo = 0,
  xp,
  color,
  children,
}: {
  exitHref: string;
  progress: number;
  combo?: number;
  xp?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex items-center gap-3">
      <Link
        href={exitHref}
        aria-label="Beenden"
        className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
      >
        <X className="size-5" />
      </Link>
      <Bar value={progress} color={color} className="h-2.5" />
      <AnimatePresence>
        {combo >= 2 && (
          <motion.span
            key="combo"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warn-soft px-2.5 py-1 text-sm font-bold text-flame"
          >
            <Flame className="size-4" fill="currentColor" /> {combo}
          </motion.span>
        )}
      </AnimatePresence>
      {xp !== undefined && <span className="shrink-0 text-sm font-semibold tabular-nums text-accent">+{xp} XP</span>}
      {children}
    </div>
  );
}

export function XpFloat({ amount, trigger }: { amount: number; trigger: number }) {
  return (
    <AnimatePresence>
      {trigger > 0 && amount > 0 && (
        <motion.span
          key={trigger}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: [0, 1, 1, 0], y: -24 }}
          transition={{ duration: 1.2 }}
          className="pointer-events-none absolute right-4 top-0 text-lg font-bold text-accent"
        >
          +{amount} XP
        </motion.span>
      )}
    </AnimatePresence>
  );
}
