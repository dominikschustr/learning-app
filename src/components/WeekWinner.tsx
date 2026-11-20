"use client";

import { Crown, Trophy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { getIdToken, useAuth } from "@/lib/auth";
import { cloudConfigured, userList } from "@/lib/cloud";
import { lastWeekWinners, type Entry } from "@/lib/ranking";
import { celebrateWinner } from "@/lib/toast";
import { weekKey } from "@/lib/utils";

/** Gemerkt, für welche Woche der Sieger schon gefeiert wurde (nur einmal, beim ersten Öffnen am Montag). */
const SHOWN_KEY = "lernwerk-week-winner";
const SHOW_MS = 7000;

type Celebration = { week: string; xp: number; winners: Entry[] };

/** Kalenderwoche (ISO 8601) eines YYYY-MM-DD-Datums. */
function isoWeek(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

function readShown(): string | null {
  try {
    return localStorage.getItem(SHOWN_KEY);
  } catch {
    return null;
  }
}

function writeShown(week: string) {
  try {
    localStorage.setItem(SHOWN_KEY, week);
  } catch {}
}

/**
 * Am ersten Tag der Woche (Montag) beim ersten Öffnen der App: kurze Feier für den Sieger der Wochenliga der
 * Vorwoche. Lädt dafür einmal die Rangliste; ohne Netz oder ohne Sieger passiert nichts.
 */
export function WeekWinner() {
  const uid = useAuth((s) => s.session?.uid);
  const [show, setShow] = useState<Celebration | null>(null);

  useEffect(() => {
    if (!uid || !cloudConfigured()) return;
    const now = Date.now();
    const thisWeek = weekKey(now);
    if (new Date(now).getDay() !== 1 || readShown() === thisWeek) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = lastWeekWinners(await userList(await getIdToken()), now);
        if (cancelled) return;
        // auch ohne Sieger merken – sonst würde bei jedem Start erneut geladen
        writeShown(thisWeek);
        if (result.winners.length) {
          setShow(result);
          celebrateWinner();
        }
      } catch {
        // Rangliste nicht erreichbar → beim nächsten Start noch einmal versuchen
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [show]);

  const me = show?.winners.some((w) => w.id === uid);
  const names = show?.winners.map((w) => (w.id === uid ? "Du" : w.name)) ?? [];
  const title = me && names.length === 1 ? "Du bist Wochensieger!" : `${names.join(" & ")} ${names.length > 1 ? "sind" : "ist"} Wochensieger!`;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="week-winner"
          role="dialog"
          aria-modal="true"
          aria-label="Wochensieger"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShow(null)}
          className="fixed inset-0 z-[60] grid place-items-center bg-ink/40 px-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.6, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="card relative w-full max-w-sm overflow-hidden px-6 pt-8 pb-6 text-center"
          >
            {/* Lichtschein hinter dem Pokal */}
            <motion.div
              aria-hidden
              className="absolute top-2 left-1/2 size-40 -translate-x-1/2 rounded-full bg-amber-300/40 blur-2xl dark:bg-amber-400/25"
              animate={{ scale: [0.8, 1.15, 0.95, 1.1], opacity: [0.5, 1, 0.7, 0.9] }}
              transition={{ duration: 2.4, repeat: Infinity, repeatType: "mirror" }}
            />
            <motion.div
              initial={{ rotate: -25, scale: 0 }}
              animate={{ rotate: [-25, 12, -6, 0], scale: [0, 1.25, 0.95, 1] }}
              transition={{ duration: 0.9, delay: 0.15, ease: "easeOut" }}
              className="relative mx-auto grid size-20 place-items-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 text-white shadow-lg shadow-amber-500/30"
            >
              <Trophy className="size-10" fill="currentColor" />
              <motion.span
                className="absolute -top-4 text-amber-400"
                initial={{ y: -12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7, type: "spring", stiffness: 300 }}
              >
                <Crown className="size-7" fill="currentColor" />
              </motion.span>
            </motion.div>
            <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }}>
              <p className="eyebrow relative mt-5">Wochenliga · KW {isoWeek(show.week)}</p>
              <h2 className="display relative mt-2 text-2xl leading-tight">{title}</h2>
              <p className="relative mt-2 text-sm text-muted">
                {show.xp.toLocaleString("de-DE")} XP letzte Woche
                {me ? " – Glückwunsch!" : " – Glückwunsch! Diese Woche ist alles wieder offen."}
              </p>
              <button
                type="button"
                onClick={() => setShow(null)}
                className="relative mt-5 inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-semibold text-bg transition hover:opacity-90"
              >
                Weiter
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
