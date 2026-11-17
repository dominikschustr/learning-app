"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getIdToken, useAuth } from "./auth";
import { cloudConfigured, highlightList, highlightRename, highlightSet, type HighlightDoc } from "./cloud";
import type { Mark } from "./merge";
import { useApp } from "./store";
import { useToasts } from "./toast";

/**
 * Markierte Fragen der Lerngruppe: Jedes Konto kann Fragen markieren, alle anderen sehen dann
 * „Adrian hat diese Frage markiert“. Die Markierungen liegen in Firestore unter highlights/{uid}; geladen wird
 * beim Start, beim Zurückkehren in die App und alle paar Minuten.
 *
 * Ohne Konto bleiben Fragen-Markierungen lokal im Lernstand (marks, „q:…“). Nach dem Anmelden werden sie
 * einmalig in die gemeinsame Liste übernommen (shareLocalMarks). Karteikarten-Markierungen bleiben privat.
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

/** Schlüssel → wer ihn markiert hat (eigenes Konto zuerst). Je Liste und Konto einmal berechnet. */
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

/** Gemeinsamer Index plus eigene, noch nicht geteilte Fragen-Markierungen (zählen als „Du“). */
const withLocalCache = new WeakMap<Record<string, Mark>, { base: Map<string, Highlighter[]>; idx: Map<string, Highlighter[]> }>();

export function markIndex(
  docs: HighlightDoc[],
  myUid: string | undefined,
  marks: Record<string, Mark>,
): Map<string, Highlighter[]> {
  const base = highlightIndex(docs, myUid);
  const hit = withLocalCache.get(marks);
  if (hit && hit.base === base) return hit.idx;
  const local = Object.keys(marks).filter((k) => marks[k].on && k.startsWith("q:") && !base.get(k)?.some((h) => h.me));
  let idx = base;
  if (local.length) {
    idx = new Map(base);
    const me: Highlighter = { uid: myUid ?? "me", name: "Du", me: true };
    for (const k of local) idx.set(k, [me, ...(base.get(k) ?? [])]);
  }
  withLocalCache.set(marks, { base, idx });
  return idx;
}

/** Aktueller Index außerhalb von React (z. B. beim Zusammenstellen einer Übung). */
export function currentMarkIndex(): Map<string, Highlighter[]> {
  return markIndex(useHighlights.getState().docs, useAuth.getState().session?.uid, useApp.getState().marks);
}

const EMPTY: Highlighter[] = [];

/** Wer die Frage (markKey) markiert hat – eigenes Konto zuerst. */
export function useHighlighters(key: string): Highlighter[] {
  return useHighlightIndex().get(key) ?? EMPTY;
}

/** Alle Markierungen der Lerngruppe als Index (für Listen und Tabellen). */
export function useHighlightIndex(): Map<string, Highlighter[]> {
  const docs = useHighlights((s) => s.docs);
  const uid = useAuth((s) => s.session?.uid);
  const marks = useApp((s) => s.marks);
  return markIndex(docs, uid, marks);
}

/** ids der Fragen eines Fachs, die jemand markiert hat → wer. */
export function highlightedIn(
  index: Map<string, Highlighter[]>,
  subjectId: string,
  kind: "q" | "c" = "q",
): Map<string, Highlighter[]> {
  const prefix = `${kind}:${subjectId}:`;
  const out = new Map<string, Highlighter[]>();
  for (const [k, who] of index) if (k.startsWith(prefix)) out.set(k.slice(prefix.length), who);
  return out;
}

/** Wer in einer Auswahl von Fragen etwas markiert hat (ohne Doppelte, eigenes Konto zuerst). */
export function highlightersOf(byId: Map<string, Highlighter[]>, ids: Iterable<string>): Highlighter[] {
  const out = new Map<string, Highlighter>();
  for (const id of ids) for (const h of byId.get(id) ?? []) out.set(h.uid, h);
  return [...out.values()].sort((a, b) => (a.me ? -1 : b.me ? 1 : a.name.localeCompare(b.name, "de")));
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
  return `${whoText(list)} ${verb} ${noun} markiert`;
}

function setMine(uid: string, name: string, keys: string[], on: boolean) {
  const docs = useHighlights.getState().docs;
  const mine = docs.find((d) => d.uid === uid);
  const items = mine ? mine.items.filter((k) => !keys.includes(k)) : [];
  if (on) items.push(...keys);
  const next: HighlightDoc = { uid, name, items, at: Date.now() };
  useHighlights.setState({ docs: mine ? docs.map((d) => (d.uid === uid ? next : d)) : [...docs, next] });
}

/** Lokale Fragen-Markierungen ausschalten (sie liegen dann in der gemeinsamen Liste). */
function clearLocal(keys: string[]) {
  if (!keys.length) return;
  const at = Date.now();
  useApp.setState((s) => ({ marks: { ...s.marks, ...Object.fromEntries(keys.map((k) => [k, { on: false, at }])) } }));
}

/**
 * Markiert eine Frage für die Lerngruppe bzw. nimmt die Markierung zurück (sofort sichtbar, dann gespeichert).
 * Ohne Konto bleibt die Markierung lokal.
 */
export async function toggleQuestionMark(key: string): Promise<void> {
  const session = useAuth.getState().session;
  const local = !!useApp.getState().marks[key]?.on;
  if (!session || !cloudConfigured()) {
    useApp.getState().toggleMark(key);
    return;
  }
  const shared = useHighlights.getState().docs.some((d) => d.uid === session.uid && d.items.includes(key));
  const on = !(shared || local);
  if (local) clearLocal([key]);
  // nur lokal markiert → ist damit schon zurückgenommen
  if (!on && !shared) return;
  setMine(session.uid, session.name, [key], on);
  try {
    await highlightSet(session.uid, await getIdToken(), session.name, [key], on);
  } catch (e) {
    setMine(session.uid, session.name, [key], !on);
    if (local) useApp.getState().toggleMark(key);
    useToasts.getState().push({
      kind: "info",
      eyebrow: "Markieren",
      title: on ? "Markieren hat nicht geklappt" : "Zurücknehmen hat nicht geklappt",
      body: (e as Error).message,
      icon: "bookmark",
    });
  }
}

/** Übernimmt eigene, bisher nur lokal markierte Fragen in die gemeinsame Liste (z. B. nach dem Anmelden). */
async function shareLocalMarks(): Promise<void> {
  const session = useAuth.getState().session;
  if (!session) return;
  const marks = useApp.getState().marks;
  const keys = Object.keys(marks).filter((k) => marks[k].on && k.startsWith("q:"));
  if (!keys.length) return;
  const mine = new Set(useHighlights.getState().docs.find((d) => d.uid === session.uid)?.items ?? []);
  const missing = keys.filter((k) => !mine.has(k));
  if (missing.length) {
    await highlightSet(session.uid, await getIdToken(), session.name, missing, true);
    setMine(session.uid, session.name, missing, true);
  }
  clearLocal(keys);
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
      await shareLocalMarks().catch(() => undefined);
    } catch {
      useHighlights.setState({ status: "error" });
    } finally {
      loading = null;
    }
  })();
  return loading;
}

const REFRESH_MS = 3 * 60_000;

/** Lädt die Markierungen beim Start, beim Zurückkehren in die App und alle paar Minuten. Gibt eine Aufräumfunktion zurück. */
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
      // neuer Name auch bei den eigenen Markierungen
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
