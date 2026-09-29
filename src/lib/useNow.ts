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
}
