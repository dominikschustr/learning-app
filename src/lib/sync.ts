"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { cloudConfigured, isSyncKey, syncDelete, syncGet, syncPut } from "./cloud";
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

export const isValidKey = isSyncKey;

/** Basispfad der App (GitHub Pages: /<repo>), siehe next.config.ts */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function pairingLink(key: string): string {
  return `${window.location.origin}${BASE_PATH}/settings/#sync=${key}`;
}

/** Wendet einen zusammengeführten Stand an, ohne dabei selbst einen neuen Sync auszulösen. */
let applying = false;

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
    if (!cloudConfigured()) {
      useSync.setState({ status: "unavailable", error: "Die Synchronisation ist noch nicht eingerichtet." });
      return;
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      const remote = await syncGet<SyncData<ExamRecord>>(key);

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

      const etag = await syncPut(key, { ...merged, deviceId: "cloud" }, remote.etag);
      if (etag === null) continue; // anderes Gerät war schneller → neu laden und zusammenführen
      useSync.setState({ status: "idle", lastSync: Date.now() });
      return;
    }
    throw new Error("Zu viele gleichzeitige Änderungen – bitte gleich nochmal versuchen.");
  } catch (e) {
    // fetch wirft TypeError, wenn das Netz fehlt
    const offline = !navigator.onLine || e instanceof TypeError;
    useSync.setState({ status: offline ? "offline" : "error", error: (e as Error).message });
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
  if (key) await syncDelete(key).catch(() => undefined);
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
      s.marks !== prev.marks || s.profile !== prev.profile) {
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
