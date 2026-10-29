"use client";

import { create } from "zustand";
import { getIdToken, useAuth } from "./auth";
import { cloudConfigured, userList, userPut } from "./cloud";
import { statsFrom, StatsSchema, type Entry } from "./ranking";
import { useApp } from "./store";
import { syncNow } from "./sync";

/**
 * Rangliste: jedes Konto meldet seinen Stand (gebündelt und nur bei Änderungen) nach users/{uid};
 * die Liste wird beim Öffnen der Ranglisten-Seite geladen.
 */

type BoardStatus = "idle" | "loading" | "error";

type BoardState = {
  entries: Entry[];
  status: BoardStatus;
  error: string | null;
  loadedAt: number | null;
};

export const useBoard = create<BoardState>(() => ({ entries: [], status: "idle", error: null, loadedAt: null }));

/** Zuletzt gemeldeter Stand dieses Geräts, um unnötige Anfragen zu sparen. */
type Published = { uid: string; payload: string };
const PUBLISHED_KEY = "lernwerk-leaderboard";

function readPublished(): Published | null {
  try {
    const p = JSON.parse(localStorage.getItem(PUBLISHED_KEY) ?? "null") as Published | null;
    return p && typeof p.uid === "string" ? p : null;
  } catch {
    return null;
  }
}

export function writePublished(p: Published | null) {
  try {
    if (p) localStorage.setItem(PUBLISHED_KEY, JSON.stringify(p));
    else localStorage.removeItem(PUBLISHED_KEY);
  } catch {}
}

export async function loadBoard() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    useBoard.setState({ status: "error", error: "Offline – die Rangliste lädt, sobald du wieder online bist." });
    return;
  }
  useBoard.setState({ status: "loading", error: null });
  try {
    useBoard.setState({ entries: await userList(await getIdToken()), status: "idle", loadedAt: Date.now() });
  } catch (e) {
    useBoard.setState({ status: "error", error: (e as Error).message });
  }
}

async function publishOnce() {
  const session = useAuth.getState().session;
  if (!session || !cloudConfigured()) return;
  const stats = StatsSchema.parse(statsFrom(useApp.getState(), session.name, Date.now()));
  const payload = JSON.stringify(stats);
  const last = readPublished();
  if (last?.uid === session.uid && last.payload === payload) return;
  await userPut(session.uid, await getIdToken(), stats);
  writePublished({ uid: session.uid, payload });
}

let running: Promise<void> | null = null;
let again = false;

/** Meldet den eigenen Stand, falls er sich seit der letzten Meldung geändert hat. */
export function publishNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await publishOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

const quietly = () => void publishNow().catch(() => undefined);

let timer: ReturnType<typeof setTimeout> | undefined;

/** Startet das automatische Melden. Gibt eine Aufräumfunktion zurück. */
export function startAutoPublish(): () => void {
  const schedule = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(quietly, ms);
  };

  const unsubApp = useApp.subscribe((s, prev) => {
    if (!useAuth.getState().session) return;
    // Lernen → gesammelt melden; beim Verlassen der Seite wird sofort gemeldet
    if (s.xp !== prev.xp || s.activity !== prev.activity || s.dailyGoal !== prev.dailyGoal || s.streak !== prev.streak) {
      schedule(60_000);
    }
  });
  // Anmelden → erst synchronisieren (sonst würde ein Gerät mit altem Stand die Rangliste zurücksetzen),
  // Umbenennen → gleich melden
  const unsubAuth = useAuth.subscribe((s, prev) => {
    if (!s.session) return;
    if (s.session.uid !== prev.session?.uid) void syncNow().then((ok) => ok && quietly());
    else if (s.session.name !== prev.session?.name) schedule(0);
  });

  const onHide = () => {
    if (document.visibilityState === "hidden") {
      clearTimeout(timer);
      quietly();
    }
  };
  document.addEventListener("visibilitychange", onHide);
  if (useAuth.getState().session) void syncNow().then((ok) => ok && quietly());

  return () => {
    clearTimeout(timer);
    unsubApp();
    unsubAuth();
    document.removeEventListener("visibilitychange", onHide);
  };
}
