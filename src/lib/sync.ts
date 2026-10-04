"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { SyncData } from "./merge";
import { mergeSync, syncSnapshot, useApp, withDevice, type ExamRecord } from "./store";
import { randomId } from "./utils";

export type SyncStatus = "off" | "idle" | "syncing" | "error" | "offline" | "unavailable";

type SyncState = {
  key: string | null;
  lastSync: number | null;
  status: SyncStatus;
  error: string | null;
};

export const useSync = create<SyncState>()(
  persist((): SyncState => ({ key: null, lastSync: null, status: "off", error: null }), {
    name: "lernwerk-sync",
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
    partialize: (s) => ({ key: s.key, lastSync: s.lastSync }),
    onRehydrateStorage: () => (s) => {
      if (s?.key) useSync.setState({ status: "idle" });
    },
  }),
);

export const isValidKey = (k: string) => /^[A-Za-z0-9_-]{43}$/.test(k);

export function pairingLink(key: string): string {
  return `${window.location.origin}/settings#sync=${key}`;
}

/** Wendet einen zusammengeführten Stand an, ohne dabei selbst einen neuen Sync auszulösen. */
let applying = false;

type Remote = { data: SyncData<ExamRecord> | null; etag: string | null };

async function request(method: "GET" | "PUT" | "DELETE", key: string, body?: unknown): Promise<Response> {
  return fetch("/api/sync", {
    method,
    headers: { "x-sync-key": key, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
}

let running: Promise<void> | null = null;
let again = false;

/** Holt den Cloud-Stand, führt ihn mit dem lokalen zusammen und lädt das Ergebnis hoch. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce() {
  const { key } = useSync.getState();
  if (!key) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    useSync.setState({ status: "offline" });
    return;
  }
  useSync.setState({ status: "syncing", error: null });

  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await request("GET", key);
      if (res.status === 503) {
        useSync.setState({ status: "unavailable", error: "Die Synchronisation ist auf dem Server noch nicht eingerichtet." });
        return;
      }
      if (!res.ok) throw new Error(`Laden fehlgeschlagen (${res.status})`);
      const remote = (await res.json()) as Remote;

      const local = syncSnapshot(withDevice(useApp.getState()));
      const merged = remote.data ? mergeSync(local, remote.data) : local;

      applying = true;
      try {
        useApp.getState().applySync(merged);
      } finally {
        applying = false;
      }

      if (remote.data && JSON.stringify(mergeSync(remote.data, merged)) === JSON.stringify(mergeSync(remote.data, remote.data))) {
        // Cloud enthält bereits alles – nichts hochzuladen
        useSync.setState({ status: "idle", lastSync: Date.now() });
        return;
      }

      const put = await request("PUT", key, { data: { ...merged, deviceId: "cloud" }, etag: remote.etag });
      if (put.status === 409) continue; // anderes Gerät war schneller → neu laden und zusammenführen
      if (!put.ok) throw new Error(`Speichern fehlgeschlagen (${put.status})`);
      useSync.setState({ status: "idle", lastSync: Date.now() });
      return;
    }
    throw new Error("Zu viele gleichzeitige Änderungen – bitte gleich nochmal versuchen.");
  } catch (e) {
    useSync.setState({ status: navigator.onLine ? "error" : "offline", error: (e as Error).message });
  }
}

/** Neue Synchronisation starten: Schlüssel erzeugen und aktuellen Stand hochladen. */
export async function enableSync() {
  useSync.setState({ key: randomId(32), status: "idle", error: null });
  await syncNow();
}

/** Dieses Gerät mit einem bestehenden Sync-Schlüssel verbinden (lokaler Stand wird zusammengeführt). */
export async function connectSync(key: string) {
  if (!isValidKey(key)) throw new Error("Ungültiger Sync-Schlüssel.");
  useSync.setState({ key, status: "idle", error: null });
  await syncNow();
}

export function disconnectSync() {
  useSync.setState({ key: null, status: "off", error: null, lastSync: null });
}

/** Cloud-Stand löschen und trennen (z. B. beim Zurücksetzen). */
export async function deleteRemote() {
  const { key } = useSync.getState();
  if (key) await request("DELETE", key).catch(() => undefined);
  disconnectSync();
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Startet die automatische Synchronisation. Gibt eine Aufräumfunktion zurück. */
export function startAutoSync(): () => void {
  const schedule = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), ms);
  };

  // Änderungen am Lernstand → kurz sammeln, dann hochladen
  const unsubApp = useApp.subscribe((s, prev) => {
    if (applying || !useSync.getState().key) return;
    if (s.xp !== prev.xp || s.items !== prev.items || s.cards !== prev.cards || s.exams !== prev.exams ||
      s.achievements !== prev.achievements || s.dailyGoal !== prev.dailyGoal || s.blitzBest !== prev.blitzBest ||
      s.marks !== prev.marks) {
      schedule(20_000);
    }
  });
  // Neues Verbinden → sofort
  const unsubSync = useSync.subscribe((s, prev) => {
    if (s.key && s.key !== prev.key) schedule(0);
  });

  const onVisibility = () => {
    if (!useSync.getState().key) return;
    // Beim Verlassen hochladen, beim Zurückkehren den Stand anderer Geräte holen
    schedule(document.visibilityState === "hidden" ? 0 : 300);
  };
  const onOnline = () => useSync.getState().key && schedule(0);

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", onOnline);
  window.addEventListener("focus", onVisibility);
  if (useSync.getState().key) schedule(0);

  return () => {
    clearTimeout(timer);
    unsubApp();
    unsubSync();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("focus", onVisibility);
  };
}
