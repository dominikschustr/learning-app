"use client";

import { Check, Gift } from "lucide-react";
import { motion } from "motion/react";
import { useApp } from "@/lib/store";
import { announce, celebrate, useToasts } from "@/lib/toast";
import { refreshNow, useNow } from "@/lib/useNow";
import { cn } from "@/lib/utils";
import { WEEKLY_ALL_BONUS, WEEKLY_ALL_ID, weeklyState } from "@/lib/weekly";
import { Icon } from "./Icon";
import { Bar } from "./ui";

function claim(id: string, title: string) {
  const event = useApp.getState().claimWeekly(id);
  if (!event) return;
  refreshNow();
  useToasts.getState().push({
    kind: "goal",
    eyebrow: "Wochen-Challenge",
    icon: "gift",
    title: `+${event.xp} Bonus-XP`,
    body: title,
  });
  if (id === WEEKLY_ALL_ID) celebrate(true);
  else if (!event.levelUp) celebrate();
  announce({ ...event, goalReached: false });
}

/** Drei Aufgaben der Woche mit Bonus-XP zum Abholen, dazu ein Wochenbonus für alle drei. */
export function WeeklyChallenge() {
  const now = useNow();
  const s = useApp();
  if (!now) return null;
  const w = weeklyState(s, s.weekly, now);
  const days = Math.max(1, Math.ceil((w.endsAt - now) / 86_400_000));
  const claimedCount = w.items.filter((i) => i.claimed).length;

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="display whitespace-nowrap text-xl sm:text-2xl">Wochen-Challenge</h2>
        <span className="shrink-0 text-xs text-muted sm:text-sm">
          {claimedCount}/3 · noch {days} {days === 1 ? "Tag" : "Tage"}
        </span>
      </div>

      <ul className="mt-4 divide-y divide-line">
        {w.items.map(({ challenge: ch, value, done, claimed }) => (
          <li key={ch.id} className="flex items-center gap-3 py-3 first:pt-0 sm:gap-4">
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-xl",
                claimed ? "bg-good-soft text-good" : done ? "bg-warn-soft text-warn" : "bg-surface-2 text-muted",
              )}
            >
              {claimed ? <Check className="size-5" strokeWidth={2.5} /> : <Icon name={ch.icon} className="size-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-semibold leading-snug sm:text-base", claimed && "text-muted line-through decoration-1")}>
                {ch.title}
              </p>
              {!claimed && (
                <div className="mt-1.5 flex items-center gap-2.5">
                  <Bar value={value / ch.target} color={done ? "var(--good)" : "var(--accent)"} className="h-1.5" />
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {Math.min(value, ch.target).toLocaleString("de-DE")}/{ch.target.toLocaleString("de-DE")}
                  </span>
                </div>
              )}
            </div>
            {claimed ? (
              <span className="shrink-0 text-xs font-semibold tabular-nums text-good">+{ch.xp} XP</span>
            ) : done ? (
              <motion.button
                type="button"
                onClick={() => claim(ch.id, ch.title)}
                initial={{ scale: 0.9 }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 1.8 }}
                className="h-9 shrink-0 rounded-full bg-ink px-3.5 text-sm font-semibold text-bg"
              >
                +{ch.xp} XP holen
              </motion.button>
            ) : (
              <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs font-semibold tabular-nums text-ink-2">
                +{ch.xp} XP
              </span>
            )}
          </li>
        ))}
      </ul>

      <div
        className={cn(
          "mt-1 flex items-center gap-3 rounded-2xl p-3 sm:gap-4",
          w.allClaimed ? "bg-good-soft" : w.allReady ? "bg-warn-soft" : "bg-surface-2",
        )}
      >
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl bg-surface",
            w.allClaimed ? "text-good" : w.allReady ? "text-warn" : "text-muted",
          )}
        >
          <Gift className="size-5" />
        </span>
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">Wochenbonus +{WEEKLY_ALL_BONUS} XP</span>
          <span className="block text-muted">
            {w.allClaimed
              ? "Abgeholt – nächste Woche gibt's neue Aufgaben."
              : w.allReady
                ? "Alle drei geschafft."
                : "Für alle drei Aufgaben dieser Woche."}
          </span>
        </p>
        {w.allReady && (
          <button
            type="button"
            onClick={() => claim(WEEKLY_ALL_ID, "Alle Aufgaben der Woche geschafft")}
            className="h-9 shrink-0 rounded-full bg-ink px-3.5 text-sm font-semibold text-bg"
          >
            Abholen
          </button>
        )}
      </div>
    </section>
  );
}
