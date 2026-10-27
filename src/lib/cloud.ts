import { FIREBASE } from "@/config";
import type { Entry, Stats } from "./ranking";
import { sha256 } from "./sha256";

/**
 * Zugriff auf Firestore über die REST-API direkt aus dem Browser (kein eigener Server nötig).
 * Was erlaubt ist, regelt firestore.rules:
 * - sync/{SHA-256 des Sync-Schlüssels}: Lernstand als JSON; nur wer den Schlüssel kennt, findet das Dokument.
 * - leaderboard/{öffentliche id}: Ranglisten-Eintrag; ändern darf nur, wer den geheimen Schlüssel dazu kennt
 *   (Nachweis in leaderboardKeys/{id}, in derselben Anfrage geschrieben).
 */

const env = (k: string) => (typeof process !== "undefined" ? process.env[k] : undefined);

function settings() {
  const projectId = env("NEXT_PUBLIC_FIREBASE_PROJECT_ID") || FIREBASE.projectId;
  const apiKey = env("NEXT_PUBLIC_FIREBASE_API_KEY") || FIREBASE.apiKey;
  // für Tests gegen den lokalen Emulator, z. B. "127.0.0.1:8080"
  const emulator = env("NEXT_PUBLIC_FIRESTORE_EMULATOR");
  const host = emulator ? `http://${emulator}` : "https://firestore.googleapis.com";
  return { projectId, apiKey, emulator, root: `projects/${projectId}/databases/(default)/documents`, host };
}

export function cloudConfigured(): boolean {
  const s = settings();
  return !!s.projectId && (!!s.apiKey || !!s.emulator);
}

export class CloudError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call(method: string, path: string, query: Record<string, string> = {}, body?: unknown): Promise<Response> {
  if (!cloudConfigured()) throw new CloudError("Synchronisation und Rangliste sind noch nicht eingerichtet.", 503);
  const s = settings();
  const params = new URLSearchParams(query);
  if (s.apiKey && !s.emulator) params.set("key", s.apiKey);
  const qs = params.toString();
  return fetch(`${s.host}/v1/${path}${qs ? `?${qs}` : ""}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    keepalive: method !== "GET" && JSON.stringify(body ?? "").length < 60_000,
  });
}

async function fail(res: Response, what: string): Promise<never> {
  const msg = res.status === 403 ? "Zugriff verweigert" : `${what} fehlgeschlagen (${res.status})`;
  throw new CloudError(msg, res.status);
}

const doc = (path: string) => `${settings().root}/${path}`;

// ---------- Synchronisation ----------

export const isSyncKey = (k: string) => /^[A-Za-z0-9_-]{43}$/.test(k);
const syncDoc = (key: string) => doc(`sync/${sha256(key)}`);

export type Remote<T> = { data: T | null; etag: string | null };

type SyncFields = { d?: { stringValue?: string }; v?: { integerValue?: string } };

export async function syncGet<T>(key: string): Promise<Remote<T>> {
  const res = await call("GET", syncDoc(key));
  if (res.status === 404) return { data: null, etag: null };
  if (!res.ok) return fail(res, "Laden");
  const json = (await res.json()) as { fields?: SyncFields };
  const d = json.fields?.d?.stringValue;
  return { data: d ? (JSON.parse(d) as T) : null, etag: json.fields?.v?.integerValue ?? null };
}

/**
 * Schreibt die nächste Version (etag = gelesene Versionsnummer, null = Dokument gibt es noch nicht).
 * Die Regeln lassen nur Version + 1 zu; hat ein anderes Gerät inzwischen geschrieben, wird abgelehnt.
 * null = Konflikt (neu laden und zusammenführen).
 */
export async function syncPut(key: string, data: unknown, etag: string | null): Promise<string | null> {
  const json = JSON.stringify(data);
  if (json.length > 900_000) throw new CloudError("Der Lernstand ist zu groß für die Synchronisation.", 413);
  const v = (etag ? Number(etag) : 0) + 1;
  const res = await call("PATCH", syncDoc(key), {}, { fields: { d: { stringValue: json }, v: { integerValue: String(v) } } });
  if (res.ok) return String(v);
  if (res.status === 403) {
    // abgelehnt: entweder war ein anderes Gerät schneller (Version passt nicht mehr) oder die Regeln fehlen
    const now = await syncGet(key).catch(() => null);
    if (now && now.etag !== etag) return null;
    throw new CloudError("Zugriff verweigert – sind die Firestore-Regeln veröffentlicht?", 403);
  }
  return fail(res, "Speichern");
}

export async function syncDelete(key: string): Promise<void> {
  const res = await call("DELETE", syncDoc(key));
  if (!res.ok && res.status !== 404) await fail(res, "Löschen");
}

// ---------- Rangliste ----------

export const isBoardSecret = (s: string) => /^[A-Za-z0-9_-]{22}$/.test(s);
/** Öffentliche id eines Ranglisten-Eintrags (muss zu firestore.rules passen). */
export const boardId = (secret: string) => sha256(`lb:${secret}`).slice(0, 16);

type Value = { stringValue?: string; integerValue?: string; nullValue?: null; timestampValue?: string };

function fromFields(id: string, f: Record<string, Value>): Entry | null {
  const str = (k: string) => f[k]?.stringValue;
  const int = (k: string) => Number(f[k]?.integerValue ?? NaN);
  const e: Entry = {
    id,
    name: str("name") ?? "",
    xp: int("xp"),
    today: int("today"),
    day: str("day") ?? "",
    goal: int("goal"),
    streak: int("streak"),
    streakDay: str("streakDay") ?? null,
    at: Date.parse(f.at?.timestampValue ?? "") || 0,
  };
  return e.name && [e.xp, e.today, e.goal, e.streak].every(Number.isFinite) ? e : null;
}

export async function boardList(): Promise<Entry[]> {
  const out: Entry[] = [];
  let pageToken = "";
  do {
    const res = await call("GET", doc("leaderboard"), { pageSize: "300", ...(pageToken ? { pageToken } : {}) });
    if (!res.ok) return fail(res, "Laden");
    const json = (await res.json()) as { documents?: { name: string; fields: Record<string, Value> }[]; nextPageToken?: string };
    for (const d of json.documents ?? []) {
      const e = fromFields(d.name.split("/").pop()!, d.fields ?? {});
      if (e) out.push(e);
    }
    pageToken = json.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

/** Nachweis, dass der Schreibende den geheimen Schlüssel zur id kennt (siehe firestore.rules). */
function proof(secret: string) {
  return {
    update: { name: doc(`leaderboardKeys/${boardId(secret)}`), fields: { s: { stringValue: secret } } },
    updateTransforms: [{ fieldPath: "at", setToServerValue: "REQUEST_TIME" }],
  };
}

async function commit(writes: unknown[]) {
  const res = await call("POST", `${settings().root}:commit`, {}, { writes });
  if (!res.ok) await fail(res, "Melden");
}

/** Eigenen Eintrag anlegen/aktualisieren; replaces = Schlüssel eines alten eigenen Eintrags, der entfernt wird. */
export async function boardUpsert(secret: string, stats: Stats, replaces?: string): Promise<string> {
  const id = boardId(secret);
  const writes: unknown[] = [
    proof(secret),
    {
      update: {
        name: doc(`leaderboard/${id}`),
        fields: {
          name: { stringValue: stats.name },
          xp: { integerValue: String(stats.xp) },
          today: { integerValue: String(stats.today) },
          day: { stringValue: stats.day },
          goal: { integerValue: String(stats.goal) },
          streak: { integerValue: String(stats.streak) },
          streakDay: stats.streakDay ? { stringValue: stats.streakDay } : { nullValue: null },
        },
      },
      updateTransforms: [{ fieldPath: "at", setToServerValue: "REQUEST_TIME" }],
    },
  ];
  if (replaces && replaces !== secret && isBoardSecret(replaces)) {
    writes.push(proof(replaces), { delete: doc(`leaderboard/${boardId(replaces)}`) });
  }
  await commit(writes);
  return id;
}

export async function boardDelete(secret: string): Promise<void> {
  await commit([proof(secret), { delete: doc(`leaderboard/${boardId(secret)}`) }]);
}
