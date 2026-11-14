"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getIdToken, useAuth } from "./auth";
import { cloudConfigured, highlightList, highlightRename, highlightSet, type HighlightDoc } from "./cloud";
import { useToasts } from "./toast";

/**
 * Hervorhebungen für die Lerngruppe: Jedes Konto kann Fragen hervorheben, alle anderen sehen dann
 * „Dominik hat diese Frage hervorgehoben“. Anders als die Lesezeichen (privat, im Lernstand) liegen sie
 * in Firestore unter highlights/{uid}; geladen wird beim Start, beim Zurückkehren in die App und alle paar Minuten.
 */

type State = {
  docs: HighlightDoc[];
  loadedAt: number | null;
  status: "idle" | "loading" | "error";
};

export const useHighlights = create<State>()(
  persist((): State => ({ docs: [], loadedAt: null, status: "idle" }), {
    name: "lernwerk-highlights",
    storage: createJSONStorage(() => localStorage),
    // nur die Liste merken (offline weiter sichtbar), nicht den Ladezustand
    partialize: (s) => ({ docs: s.docs, loadedAt: s.loadedAt }) as State,
    skipHydration: true,
  }),
);

export type Highlighter = { uid: string; name: string; me: boolean };

/** Schlüssel → wer ihn hervorgehoben hat (eigenes Konto zuerst). Je Liste und Konto einmal berechnet. */
const indexCache = new WeakMap<HighlightDoc[], { uid: string | undefined; idx: Map<string, Highlighter[]> }>();

export function highlightIndex(docs: HighlightDoc[], myUid: string | undefined): Map<string, Highlighter[]> {
  const hit = indexCache.get(docs);
  if (hit && hit.uid === myUid) return hit.idx;
  const idx = new Map<string, Highlighter[]>();
  const sorted = [...docs].sort((a, b) => (a.uid === myUid ? -1 : b.uid === myUid ? 1 : a.name.localeCompare(b.name, "de")));
  for (const d of sorted) {
    const who = { uid: d.uid, name: d.name || "Jemand", me: d.uid === myUid };
    for (const key of new Set(d.items)) {
      const list = idx.get(key);
      if (list) list.push(who);
      else idx.set(key, [who]);
    }
  }
  indexCache.set(docs, { uid: myUid, idx });
  return idx;
}

const EMPTY: Highlighter[] = [];

/** Wer die Frage bzw. Karte (markKey) hervorgehoben hat. */
export function useHighlighters(key: string): Highlighter[] {
  const docs = useHighlights((s) => s.docs);
  const uid = useAuth((s) => s.session?.uid);
  return highlightIndex(docs, uid).get(key) ?? EMPTY;
}

/** Alle Hervorhebungen als Index (für Listen und Tabellen). */
export function useHighlightIndex(): Map<string, Highlighter[]> {
  const docs = useHighlights((s) => s.docs);
  const uid = useAuth((s) => s.session?.uid);
  return highlightIndex(docs, uid);
}

/** „Du“, „Lisa“, „Du und Lisa“, „Lisa, Ben und 2 weitere“ */
export function whoText(list: Highlighter[], max = 2): string {
  const names = list.map((h) => (h.me ? "Du" : h.name));
  if (names.length <= max + 1) {
    return names.length > 1 ? `${names.slice(0, -1).join(", ")} und ${names.at(-1)}` : (names[0] ?? "");
  }
  const rest = names.length - max;
  return `${names.slice(0, max).join(", ")} und ${rest} weitere`;
}

/** Ganzer Satz für die Anzeige über der Frage. */
export function whoSentence(list: Highlighter[], noun = "diese Frage"): string {
  if (!list.length) return "";
  const verb = list.length === 1 ? (list[0].me ? "hast" : "hat") : "haben";
  const tail = list.length === 1 && list[0].me ? "für alle hervorgehoben" : "hervorgehoben";
  return `${whoText(list)} ${verb} ${noun} ${tail}`;
}

function setMine(uid: string, name: string, key: string, on: boolean) {
  const docs = useHighlights.getState().docs;
  const mine = docs.find((d) => d.uid === uid);
  const items = mine ? mine.items.filter((k) => k !== key) : [];
  if (on) items.push(key);
  const next: HighlightDoc = { uid, name, items, at: Date.now() };
  useHighlights.setState({ docs: mine ? docs.map((d) => (d.uid === uid ? next : d)) : [...docs, next] });
}

/** Hebt eine Frage für alle hervor bzw. nimmt die Hervorhebung zurück (sofort sichtbar, dann gespeichert). */
export async function toggleHighlight(key: string): Promise<void> {
  const session = useAuth.getState().session;
  if (!session || !cloudConfigured()) return;
  const on = !useHighlights.getState().docs.some((d) => d.uid === session.uid && d.items.includes(key));
  setMine(session.uid, session.name, key, on);
  try {
    await highlightSet(session.uid, await getIdToken(), session.name, key, on);
  } catch (e) {
    setMine(session.uid, session.name, key, !on);
    useToasts.getState().push({
      kind: "info",
      eyebrow: "Hervorheben",
      title: on ? "Hervorheben hat nicht geklappt" : "Zurücknehmen hat nicht geklappt",
      body: (e as Error).message,
      icon: "highlighter",
    });
  }
}

let loading: Promise<void> | null = null;

export function loadHighlights(): Promise<void> {
  if (loading) return loading;
  if (!useAuth.getState().session || !cloudConfigured()) return Promise.resolve();
  if (typeof navigator !== "undefined" && !navigator.onLine) return Promise.resolve();
  loading = (async () => {
    useHighlights.setState({ status: "loading" });
    try {
      const docs = await highlightList(await getIdToken());
      useHighlights.setState({ docs, loadedAt: Date.now(), status: "idle" });
    } catch {
      useHighlights.setState({ status: "error" });
    } finally {
      loading = null;
    }
  })();
  return loading;
}

const REFRESH_MS = 3 * 60_000;

/** Lädt die Hervorhebungen beim Start, beim Zurückkehren in die App und alle paar Minuten. Gibt eine Aufräumfunktion zurück. */
export function startHighlights(): () => void {
  const stale = () => Date.now() - (useHighlights.getState().loadedAt ?? 0) > REFRESH_MS;
  const quietly = () => void loadHighlights();
  const onShow = () => {
    if (document.visibilityState === "visible" && stale()) quietly();
  };
  const timer = setInterval(() => {
    if (document.visibilityState === "visible") quietly();
  }, REFRESH_MS);

  const unsubAuth = useAuth.subscribe((s, prev) => {
    if (!s.session) return;
    if (s.session.uid !== prev.session?.uid) {
      useHighlights.setState({ docs: [], loadedAt: null });
      quietly();
    } else if (s.session.name !== prev.session?.name) {
      // neuer Name auch bei den eigenen Hervorhebungen
      const { uid, name } = s.session;
      const docs = useHighlights.getState().docs;
      if (docs.some((d) => d.uid === uid)) {
        useHighlights.setState({ docs: docs.map((d) => (d.uid === uid ? { ...d, name } : d)) });
        void getIdToken()
          .then((token) => highlightRename(uid, token, name))
          .catch(() => undefined);
      }
    }
  });
  document.addEventListener("visibilitychange", onShow);
  quietly();

  return () => {
    clearInterval(timer);
    unsubAuth();
    document.removeEventListener("visibilitychange", onShow);
  };
}

export function clearHighlights() {
  useHighlights.setState({ docs: [], loadedAt: null, status: "idle" });
}
