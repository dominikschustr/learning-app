"use client";

import { Cloud, CloudOff, Flame, Loader2, Monitor, Moon, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { levelInfo } from "@/lib/gamification";
import { useApp, useHydrated, visibleStreak } from "@/lib/store";
import { useSync } from "@/lib/sync";
import { useNow } from "@/lib/useNow";
import { cn } from "@/lib/utils";

export function Header() {
  const hydrated = useHydrated();
  const xp = useApp((s) => s.xp);
  const streak = useApp((s) => s.streak);
  const lvl = levelInfo(xp);
  const now = useNow();
  const days = hydrated ? visibleStreak(streak, now) : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-ink text-bg">
            <span className="display text-lg leading-none">L</span>
          </span>
          <span className="display text-2xl">Lernwerk</span>
        </Link>

        <div className={cn("ml-auto flex items-center gap-1.5 transition-opacity", hydrated ? "opacity-100" : "opacity-0")}>
          <span
            title={`${days} Tage Streak`}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-sm font-semibold",
              days > 0 ? "bg-warn-soft text-flame" : "text-muted",
            )}
          >
            <Flame className="size-4" fill={days > 0 ? "currentColor" : "none"} />
            {days}
          </span>
          <span
            title={`${lvl.into} / ${lvl.needed} XP bis Level ${lvl.level + 1}`}
            className="relative inline-flex h-8 items-center gap-2 overflow-hidden rounded-full border border-line bg-surface pl-2.5 pr-3 text-sm font-semibold"
          >
            <span className="text-accent">Lv {lvl.level}</span>
            <span className="hidden text-muted sm:inline">{xp} XP</span>
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-surface-2">
              <span className="block h-full bg-accent" style={{ width: `${lvl.progress * 100}%` }} />
            </span>
          </span>
          <SyncBadge />
          <ThemeToggle />
          <Link
            href="/settings"
            aria-label="Einstellungen"
            className="grid size-8 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
          >
            <Settings className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Kleiner Sync-Status im Header, nur wenn die Synchronisation aktiv ist. */
function SyncBadge() {
  const key = useSync((s) => s.key);
  const status = useSync((s) => s.status);
  if (!key) return null;
  const Icon = status === "syncing" ? Loader2 : status === "idle" ? Cloud : CloudOff;
  const label = {
    off: "Aus",
    idle: "Synchronisiert",
    syncing: "Synchronisiere …",
    offline: "Offline",
    error: "Sync-Fehler",
    unavailable: "Sync nicht verfügbar",
  }[status];
  return (
    <Link
      href="/settings#sync"
      title={label}
      aria-label={label}
      className={cn(
        "grid size-8 place-items-center rounded-full hover:bg-surface-2",
        status === "idle" || status === "syncing" ? "text-ink-2" : "text-warn",
      )}
    >
      <Icon className={cn("size-4", status === "syncing" && "animate-spin")} />
    </Link>
  );
}

type Theme = "system" | "light" | "dark";
const THEME_KEY = "lernwerk-theme";

function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function subscribeTheme(cb: () => void) {
  window.addEventListener("lernwerk-theme", cb);
  return () => window.removeEventListener("lernwerk-theme", cb);
}

export function applyTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  window.dispatchEvent(new Event("lernwerk-theme"));
}

function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "system" as Theme);
  const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  const Icon = theme === "system" ? Monitor : theme === "light" ? Sun : Moon;
  const label = { system: "System", light: "Hell", dark: "Dunkel" }[theme];

  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={`Farbschema: ${label}`}
      title={`Farbschema: ${label}`}
      className="grid size-8 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
    >
      <Icon className="size-4" />
    </button>
  );
}
