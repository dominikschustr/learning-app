"use client";

import { useSyncExternalStore } from "react";

let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function tick() {
  now = Date.now();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) {
    now = Date.now();
    timer = setInterval(tick, 30_000);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size) clearInterval(timer);
  };
}

/** Aktuelle Zeit (ms), aktualisiert alle 30 s. Auf dem Server 0. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, () => now, () => 0);
}

/** Zeitstempel sofort aktualisieren, z. B. nach einer Antwort. */
export function refreshNow() {
  tick();
  fastNow = now;
  fastListeners.forEach((l) => l());
}

// Sekundentakt, nur solange jemand ihn braucht (z. B. Countdown der Fokus-Stunde)
let fastNow = Date.now();
const fastListeners = new Set<() => void>();
let fastTimer: ReturnType<typeof setInterval> | undefined;

function subscribeFast(cb: () => void) {
  fastListeners.add(cb);
  if (fastListeners.size === 1) {
    fastNow = Date.now();
    fastTimer = setInterval(() => {
      fastNow = Date.now();
      fastListeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    fastListeners.delete(cb);
    if (!fastListeners.size) clearInterval(fastTimer);
  };
}

const noSubscribe = () => () => {};

/** Wie useNow, aber sekündlich, solange enabled. */
export function useSecondNow(enabled: boolean): number {
  const slow = useNow();
  const fast = useSyncExternalStore(enabled ? subscribeFast : noSubscribe, () => fastNow, () => 0);
  return enabled ? Math.max(fast, slow) : slow;
}
