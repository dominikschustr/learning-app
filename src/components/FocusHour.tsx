"use client";

import { ArrowRight, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { FOCUS_MS, FOCUS_MULTIPLIER, focusState, type FocusState } from "@/lib/focus";
import { useApp, useHydrated } from "@/lib/store";
import { celebrate, useToasts } from "@/lib/toast";
import { refreshNow, useNow, useSecondNow } from "@/lib/useNow";
import { cn, formatClock } from "@/lib/utils";
import { Button, ButtonLink } from "./ui";

/** Zustand der Fokus-Stunde; tickt sekündlich, solange eine laufen könnte. */
export function useFocus(): FocusState | null {
  const hydrated = useHydrated();
  const log = useApp((s) => s.focus);
  const slow = useNow();
  const live = Object.values(log ?? {}).some((r) => r.start + FOCUS_MS > slow - 5000);
  const now = useSecondNow(hydrated && live);
  return hydrated && now ? focusState(log, now) : null;
}

const clock = (ms: number) => formatClock(Math.ceil(ms / 1000));
const time = (ms: number) => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

function startFocus() {
  if (!useApp.getState().startFocus()) return;
  refreshNow();
  useToasts.getState().push({
    kind: "focus",
    icon: "zap",
    title: "60 Minuten doppelte XP",
    body: "Jede Antwort zählt jetzt doppelt. Los geht's!",
  });
  celebrate();
}

/** Ring mit Verlauf: zeigt die verbleibende Zeit. */
function FocusRing({ value, size = 104, stroke = 9, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const id = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="55%" stopColor="#b04ae0" />
            <stop offset="100%" stopColor="var(--flame)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Karte auf der Startseite: starten, Countdown, Rückblick. */
export function FocusCard({ href }: { href?: string }) {
  const f = useFocus();
  const now = useNow();
  const [confirm, setConfirm] = useState(false);
  if (!f) return null;

  if (f.status === "active") {
    return (
      <motion.section
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="focus-border relative overflow-clip rounded-[1.25rem] p-5 shadow-soft sm:p-6"
        aria-live="polite"
      >
        <div aria-hidden className="focus-gradient focus-glow pointer-events-none absolute -right-20 -top-24 size-64 rounded-full opacity-50 blur-3xl" />
        <div aria-hidden className="focus-gradient focus-glow pointer-events-none absolute -bottom-28 -left-16 size-56 rounded-full opacity-30 blur-3xl [animation-delay:1.4s]" />
        <div className="relative flex flex-wrap items-center gap-5">
          <FocusRing value={1 - f.progress}>
            <span className="display focus-text text-3xl">{FOCUS_MULTIPLIER}×</span>
          </FocusRing>
          <div className="min-w-0 flex-1">
            <p className="eyebrow flex items-center gap-1.5">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-flame opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-flame" />
              </span>
              Fokus-Stunde läuft
            </p>
            <p className="display mt-1 text-5xl tabular-nums sm:text-6xl">{clock(f.remaining)}</p>
            <p className="mt-1 text-sm text-muted">Doppelte XP bis {time(f.endsAt)} Uhr – dranbleiben!</p>
          </div>
          <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:flex-col sm:items-end">
            <div className="sm:text-right">
              <p className="display focus-text text-3xl tabular-nums">+{f.run.xp} XP</p>
              <p className="text-xs text-muted">in dieser Stunde</p>
            </div>
            {href && (
              <ButtonLink href={href} className="focus-gradient text-white hover:opacity-90">
                Weiterlernen <ArrowRight className="size-4" />
              </ButtonLink>
            )}
          </div>
        </div>
      </motion.section>
    );
  }

  if (f.status === "used") {
    const days = Math.ceil((f.nextAt - now) / 86_400_000);
    return (
      <section className="card flex items-center gap-4 p-4 sm:p-5">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-muted">
          <Zap className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Fokus-Stunde dieser Woche genutzt</p>
          <p className="text-sm text-muted">
            <span className="font-semibold text-ink-2">+{f.run.xp} XP</span> mit doppelten XP · nächste{" "}
            {days <= 1 ? "ab morgen" : `in ${days} Tagen (Montag)`}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="card relative overflow-clip p-5 sm:p-6">
      <div aria-hidden className="focus-gradient focus-glow pointer-events-none absolute -right-24 -top-28 size-64 rounded-full opacity-25 blur-3xl" />
      <div className="relative flex flex-wrap items-center gap-4 sm:gap-5">
        <div className="focus-gradient grid size-14 shrink-0 place-items-center rounded-2xl text-white shadow-[0_8px_24px_-6px_rgb(176_74_224/0.55)]">
          <Zap className="size-7" fill="currentColor" />
        </div>
        <div className="min-w-[14rem] flex-1">
          <p className="eyebrow">Fokus-Stunde · 1× pro Woche</p>
          <h2 className="display mt-1 text-2xl">
            60 Minuten <span className="focus-text">doppelte XP</span>
          </h2>
          <p className="mt-1 text-sm text-muted">
            Fragen, Karten, Blitzrunden und Tests zählen doppelt – auch in der Wochenliga.
          </p>
        </div>
        {!confirm && (
          <Button onClick={() => setConfirm(true)} className="focus-gradient w-full text-white hover:opacity-90 sm:w-auto">
            <Zap className="size-4" fill="currentColor" /> Fokus starten
          </Button>
        )}
      </div>
      <AnimatePresence>
        {confirm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="relative overflow-hidden"
          >
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 p-4">
              <p className="min-w-[14rem] flex-1 text-sm text-ink-2">
                Die Stunde läuft am Stück und lässt sich nicht pausieren. Handy auf lautlos, Tab offen lassen – bereit?
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setConfirm(false)}>
                  Später
                </Button>
                <Button onClick={startFocus} className="focus-gradient text-white hover:opacity-90">
                  Jetzt starten
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** Countdown in der Kopfleiste, solange die Fokus-Stunde läuft; meldet ihr Ende. */
export function FocusPill() {
  const f = useFocus();
  const prev = useRef<FocusState | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = f;
    if (before?.status === "active" && f?.status === "used") {
      useToasts.getState().push({
        kind: "focus",
        icon: "zap",
        title: "Fokus-Stunde geschafft",
        body: `+${f.run.xp} XP verdient. Nächste Woche wieder!`,
      });
      celebrate(true);
    }
  }, [f]);

  if (f?.status !== "active") return null;
  return (
    <Link
      href="/"
      title={`Fokus-Stunde: doppelte XP bis ${time(f.endsAt)} Uhr`}
      className="focus-border inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-sm font-bold [--focus-fill:var(--bg)]"
    >
      <Zap className="size-3.5 text-flame" fill="currentColor" />
      <span className="focus-text">{FOCUS_MULTIPLIER}×</span>
      <span className="hidden tabular-nums text-ink-2 min-[400px]:inline">{clock(f.remaining)}</span>
    </Link>
  );
}

/** Kleines „2×“ in der Lernleiste. */
export function FocusBadge({ className }: { className?: string }) {
  const f = useFocus();
  if (f?.status !== "active") return null;
  return (
    <span
      title="Fokus-Stunde: doppelte XP"
      className={cn("focus-gradient inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold text-white", className)}
    >
      <Zap className="size-3" fill="currentColor" />
      {FOCUS_MULTIPLIER}×
    </span>
  );
}
