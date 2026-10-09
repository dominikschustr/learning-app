"use client";

import { create } from "zustand";
import { statsFrom, type Entry } from "./ranking";
import { useApp, type AppState } from "./store";

/**
 * Rangliste auf dem Client: eigenen Stand melden (nur bei Teilnahme, gebündelt und nur bei Änderungen)
 * und die Liste laden (nur beim Öffnen der Ranglisten-Seite).
 */

type BoardStatus = "idle" | "loading" | "error" | "unavailable";

type BoardState = {
  entries: Entry[];
  /** öffentliche id des eigenen Eintrags */
  me: string | null;
  status: BoardStatus;
  error: string | null;
  loadedAt: number | null;
};

export const useBoard = create<BoardState>(() => ({ entries: [], me: null, status: "idle", error: null, loadedAt: null }));

/** Zuletzt gemeldeter Stand dieses Geräts, um unnötige Anfragen zu sparen. */
type Published = { secret: string; payload: string };
const PUBLISHED_KEY = "lernwerk-leaderboard";

function readPublished(): Published | null {
  try {
    const p = JSON.parse(localStorage.getItem(PUBLISHED_KEY) ?? "null") as Published | null;
    return p && typeof p.secret === "string" ? p : null;
  } catch {
    return null;
  }
}

function writePublished(p: Published | null) {
  try {
    if (p) localStorage.setItem(PUBLISHED_KEY, JSON.stringify(p));
    else localStorage.removeItem(PUBLISHED_KEY);
  } catch {}
}

async function request(method: "GET" | "PUT" | "DELETE", secret: string | null, body?: unknown): Promise<Response> {
  return fetch("/api/leaderboard", {
    method,
    headers: { ...(secret ? { "x-lb-key": secret } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    // Melden beim Verlassen der Seite soll noch ankommen
    keepalive: method !== "GET",
  });
}

const activeProfile = (s: AppState) => (s.profile?.on && s.profile.name ? s.profile : null);

export async function loadBoard() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    useBoard.setState({ status: "error", error: "Offline – die Rangliste lädt, sobald du wieder online bist." });
    return;
  }
  useBoard.setState({ status: "loading", error: null });
  try {
    const res = await request("GET", activeProfile(useApp.getState())?.id ?? null);
    if (res.status === 503) {
      useBoard.setState({ status: "unavailable", error: "Die Rangliste ist auf dem Server noch nicht eingerichtet." });
      return;
    }
    if (!res.ok) throw new Error(`Laden fehlgeschlagen (${res.status})`);
    const { entries, me } = (await res.json()) as { entries: Entry[]; me: string | null };
    useBoard.setState({ entries, me, status: "idle", loadedAt: Date.now() });
  } catch (e) {
    useBoard.setState({ status: "error", error: (e as Error).message });
  }
}

async function publishOnce() {
  const s = useApp.getState();
  const profile = activeProfile(s);
  const last = readPublished();

  if (!profile) {
    // ausgetreten (auch auf einem anderen Gerät) oder zurückgesetzt → eigenen Eintrag entfernen
    if (last) {
      const res = await request("DELETE", last.secret);
      if (res.ok) writePublished(null);
      useBoard.setState((b) => ({ me: null, entries: b.entries.filter((e) => e.id !== b.me) }));
    }
    return;
  }

  const stats = statsFrom(s, profile.name, Date.now());
  const payload = JSON.stringify(stats);
  if (last?.secret === profile.id && last.payload === payload) return;

  const replaces = last && last.secret !== profile.id ? last.secret : undefined;
  const res = await request("PUT", profile.id, { ...stats, replaces });
  if (res.status === 409) throw new Error("Die Rangliste ist voll.");
  if (!res.ok) throw new Error(`Melden fehlgeschlagen (${res.status})`);
  const { id } = (await res.json()) as { id: string };
  writePublished({ secret: profile.id, payload });
  useBoard.setState({ me: id });
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

export async function joinBoard(name: string) {
  useApp.getState().setProfile({ name, on: true });
  await publishNow();
  await loadBoard();
}

export async function renameOnBoard(name: string) {
  useApp.getState().setProfile({ name, on: true });
  await publishNow();
}

export async function leaveBoard() {
  useApp.getState().setProfile({ on: false });
  await publishNow();
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Startet das automatische Melden. Gibt eine Aufräumfunktion zurück. */
export function startAutoPublish(): () => void {
  const schedule = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(quietly, ms);
  };

  const unsub = useApp.subscribe((s, prev) => {
    if (s.profile !== prev.profile) return schedule(0);
    if (!activeProfile(s)) return;
    // Lernen → gesammelt melden; beim Verlassen der Seite wird sofort gemeldet
    if (s.xp !== prev.xp || s.activity !== prev.activity || s.dailyGoal !== prev.dailyGoal || s.streak !== prev.streak) {
      schedule(60_000);
    }
  });

  const onHide = () => {
    if (document.visibilityState === "hidden") {
      clearTimeout(timer);
      quietly();
    }
  };
  document.addEventListener("visibilitychange", onHide);
  quietly();

  return () => {
    clearTimeout(timer);
    unsub();
    document.removeEventListener("visibilitychange", onHide);
  };
}
