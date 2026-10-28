"use client";

import { create } from "zustand";
import { getIdToken, useAuth } from "./auth";
import { cloudConfigured, progressGet, progressPut } from "./cloud";
import type { SyncData } from "./merge";
import { mergeSync, syncSnapshot, useApp, withDevice, type ExamRecord } from "./store";

/**
 * Synchronisation des Lernstands mit dem Konto: Cloud-Stand holen, mit dem lokalen zusammenführen, hochladen.
 * Läuft automatisch nach Änderungen, beim Zurückkehren in die App und wenn das Gerät wieder online ist.
 */

export type SyncStatus = "idle" | "syncing" | "error" | "offline";

type SyncState = { lastSync: number | null; status: SyncStatus; error: string | null };

export const useSync = create<SyncState>(() => ({ lastSync: null, status: "idle", error: null }));

/** Basispfad der App (GitHub Pages: /<repo>), siehe next.config.ts */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Wendet einen zusammengeführten Stand an, ohne dabei selbst einen neuen Sync auszulösen. */
let applying = false;

let running: Promise<boolean> | null = null;
let again = false;

/** Synchronisiert jetzt. true = Cloud und Gerät sind auf demselben Stand. */
export function syncNow(): Promise<boolean> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      let ok: boolean;
      do {
        again = false;
        ok = await syncOnce();
      } while (again);
      return ok;
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce(): Promise<boolean> {
  const session = useAuth.getState().session;
  if (!session || !cloudConfigured()) return false;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    useSync.setState({ status: "offline" });
    return false;
  }
  useSync.setState({ status: "syncing", error: null });
  const { uid } = session;

  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const token = await getIdToken();
      const remote = await progressGet<SyncData<ExamRecord>>(uid, token);
      if (useAuth.getState().session?.uid !== uid) return false; // inzwischen abgemeldet

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
        return true;
      }

      const etag = await progressPut(uid, token, { ...merged, deviceId: "cloud" }, remote.etag);
      if (etag === null) continue; // anderes Gerät war schneller → neu laden und zusammenführen
      useSync.setState({ status: "idle", lastSync: Date.now() });
      return true;
    }
    throw new Error("Zu viele gleichzeitige Änderungen – bitte gleich nochmal versuchen.");
  } catch (e) {
    // fetch wirft TypeError, wenn das Netz fehlt
    const offline = !navigator.onLine || e instanceof TypeError;
    useSync.setState({ status: offline ? "offline" : "error", error: (e as Error).message });
    return false;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Startet die automatische Synchronisation. Gibt eine Aufräumfunktion zurück. */
export function startAutoSync(): () => void {
  const signedIn = () => !!useAuth.getState().session;
  const schedule = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), ms);
  };

  // Änderungen am Lernstand → kurz sammeln, dann hochladen
  const unsubApp = useApp.subscribe((s, prev) => {
    if (applying || !signedIn()) return;
    if (s.xp !== prev.xp || s.items !== prev.items || s.cards !== prev.cards || s.exams !== prev.exams ||
      s.achievements !== prev.achievements || s.dailyGoal !== prev.dailyGoal || s.blitzBest !== prev.blitzBest ||
      s.marks !== prev.marks) {
      schedule(20_000);
    }
  });
  // Anmelden → sofort holen und zusammenführen
  const unsubAuth = useAuth.subscribe((s, prev) => {
    if (s.session && s.session.uid !== prev.session?.uid) schedule(0);
  });

  const onVisibility = () => {
    if (!signedIn()) return;
    // Beim Verlassen hochladen, beim Zurückkehren den Stand anderer Geräte holen
    schedule(document.visibilityState === "hidden" ? 0 : 300);
  };
  const onOnline = () => signedIn() && schedule(0);

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", onOnline);
  window.addEventListener("focus", onVisibility);
  if (signedIn()) schedule(0);

  return () => {
    clearTimeout(timer);
    unsubApp();
    unsubAuth();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("focus", onVisibility);
  };
}
