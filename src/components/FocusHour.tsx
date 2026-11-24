"use client";

import { ArrowRight, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FOCUS_MS, FOCUS_MULTIPLIER, focusState, type FocusState } from "@/lib/focus";
import { useApp, useHydrated } from "@/lib/store";
import { useToasts } from "@/lib/toast";
import { refreshNow, useNow, useSecondNow } from "@/lib/useNow";
import { cn, formatClock } from "@/lib/utils";
import { Button, ButtonLink, ProgressRing } from "./ui";

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
    body: "Jede Antwort zählt jetzt doppelt.",
  });
}

/** Karte auf der Startseite: starten, Countdown, Rückblick. */
export function FocusCard({ href }: { href?: string }) {
  const f = useFocus();
  const now = useNow();
  const [confirm, setConfirm] = useState(false);
  if (!f) return null;

  if (f.status === "active") {
    return (
      <section className="card border-accent p-5 sm:p-6" aria-live="polite">
        <div className="flex flex-wrap items-center gap-5">
          <ProgressRing value={1 - f.progress} size={88} stroke={7}>
            <span className="display text-2xl text-accent">{FOCUS_MULTIPLIER}×</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Fokus-Stunde läuft</p>
            <p className="display mt-1 text-4xl tabular-nums sm:text-5xl">{clock(f.remaining)}</p>
            <p className="mt-1 text-sm text-muted">Doppelte XP bis {time(f.endsAt)} Uhr</p>
          </div>
          <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:flex-col sm:items-end">
            <div className="sm:text-right">
              <p className="text-2xl font-semibold tabular-nums">+{f.run.xp} XP</p>
              <p className="text-xs text-muted">in dieser Stunde</p>
            </div>
            {href && (
              <ButtonLink href={href}>
                Weiterlernen <ArrowRight className="size-4" />
              </ButtonLink>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (f.status === "used") {
    const days = Math.ceil((f.nextAt - now) / 86_400_000);
    return (
      <section className="card flex items-center gap-4 p-4 sm:p-5">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">
          <Zap className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Fokus-Stunde dieser Woche genutzt</p>
          <p className="text-sm text-muted">
            +{f.run.xp} XP · nächste {days <= 1 ? "ab morgen" : `in ${days} Tagen (Montag)`}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent">
          <Zap className="size-5" />
        </div>
        <div className="min-w-[14rem] flex-1">
          <p className="eyebrow">Einmal pro Woche</p>
          <h2 className="mt-1 text-lg font-semibold">Fokus-Stunde: 60 Minuten doppelte XP</h2>
          <p className="mt-0.5 text-sm text-muted">Gilt für Fragen, Karten, Blitzrunden und Tests – auch in der Wochenliga.</p>
        </div>
        {!confirm && (
          <Button variant="secondary" onClick={() => setConfirm(true)} className="w-full sm:w-auto">
            Fokus starten
          </Button>
        )}
      </div>
      {confirm && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <p className="min-w-[14rem] flex-1 text-sm text-ink-2">
            Die Stunde läuft am Stück und lässt sich nicht pausieren. Jetzt starten?
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Abbrechen
            </Button>
            <Button onClick={startFocus}>Starten</Button>
          </div>
        </div>
      )}
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
        title: "Fokus-Stunde vorbei",
        body: `+${f.run.xp} XP verdient. Nächste Woche wieder.`,
      });
    }
  }, [f]);

  if (f?.status !== "active") return null;
  return (
    <Link
      href="/"
      title={`Fokus-Stunde: doppelte XP bis ${time(f.endsAt)} Uhr`}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-accent/40 bg-surface px-2.5 text-sm font-semibold text-accent"
    >
      {FOCUS_MULTIPLIER}×
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
      className={cn("shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white", className)}
    >
      {FOCUS_MULTIPLIER}×
    </span>
  );
}
