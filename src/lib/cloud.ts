import { FIREBASE } from "@/config";
import type { Entry, Stats } from "./ranking";

/**
 * Zugriff auf Firestore über die REST-API direkt aus dem Browser (kein eigener Server nötig).
 * Jede Anfrage trägt das ID-Token des angemeldeten Kontos; was erlaubt ist, regelt firestore.rules:
 * - progress/{uid}: Lernstand als JSON mit Versionsnummer – nur das eigene Konto darf lesen und schreiben.
 * - users/{uid}: Name und Stand für die Rangliste – alle Angemeldeten dürfen lesen, nur das eigene Konto schreiben.
 */

const env = (k: string) => (typeof process !== "undefined" ? process.env[k] : undefined);

export function firebaseSettings() {
  const projectId = env("NEXT_PUBLIC_FIREBASE_PROJECT_ID") || FIREBASE.projectId;
  const apiKey = env("NEXT_PUBLIC_FIREBASE_API_KEY") || FIREBASE.apiKey;
  // für Tests gegen die lokalen Emulatoren, z. B. "127.0.0.1:8080" und "127.0.0.1:9099"
  const emulator = env("NEXT_PUBLIC_FIRESTORE_EMULATOR");
  const authEmulator = env("NEXT_PUBLIC_AUTH_EMULATOR");
  const host = emulator ? `http://${emulator}` : "https://firestore.googleapis.com";
  return { projectId, apiKey, emulator, authEmulator, root: `projects/${projectId}/databases/(default)/documents`, host };
}

export function cloudConfigured(): boolean {
  const s = firebaseSettings();
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

async function call(token: string, method: string, path: string, query: Record<string, string> = {}, body?: unknown) {
  if (!cloudConfigured()) throw new CloudError("Die App ist noch nicht mit Firebase verbunden.", 503);
  const s = firebaseSettings();
  const params = new URLSearchParams(query);
  if (s.apiKey && !s.emulator) params.set("key", s.apiKey);
  const qs = params.toString();
  return fetch(`${s.host}/v1/${path}${qs ? `?${qs}` : ""}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    keepalive: method !== "GET" && JSON.stringify(body ?? "").length < 60_000,
  });
}

async function fail(res: Response, what: string): Promise<never> {
  const msg =
    res.status === 401
      ? "Sitzung abgelaufen – bitte melde dich neu an."
      : res.status === 403
        ? "Zugriff verweigert – sind die Firestore-Regeln veröffentlicht?"
        : `${what} fehlgeschlagen (${res.status})`;
  throw new CloudError(msg, res.status);
}

const doc = (path: string) => `${firebaseSettings().root}/${path}`;

// ---------- Lernstand ----------

export type Remote<T> = { data: T | null; etag: string | null };

type ProgressFields = { d?: { stringValue?: string }; v?: { integerValue?: string } };

export async function progressGet<T>(uid: string, token: string): Promise<Remote<T>> {
  const res = await call(token, "GET", doc(`progress/${uid}`));
  if (res.status === 404) return { data: null, etag: null };
  if (!res.ok) return fail(res, "Laden");
  const json = (await res.json()) as { fields?: ProgressFields };
  const d = json.fields?.d?.stringValue;
  return { data: d ? (JSON.parse(d) as T) : null, etag: json.fields?.v?.integerValue ?? null };
}

/**
 * Schreibt die nächste Version (etag = gelesene Versionsnummer, null = es gibt noch keinen Stand).
 * Die Regeln lassen nur Version + 1 zu; hat ein anderes Gerät inzwischen geschrieben, wird abgelehnt.
 * null = Konflikt (neu laden und zusammenführen).
 */
export async function progressPut(uid: string, token: string, data: unknown, etag: string | null): Promise<string | null> {
  const json = JSON.stringify(data);
  if (json.length > 900_000) throw new CloudError("Der Lernstand ist zu groß für die Synchronisation.", 413);
  const v = (etag ? Number(etag) : 0) + 1;
  const res = await call(token, "PATCH", doc(`progress/${uid}`), {}, {
    fields: { d: { stringValue: json }, v: { integerValue: String(v) } },
  });
  if (res.ok) return String(v);
  if (res.status === 403) {
    // abgelehnt: entweder war ein anderes Gerät schneller (Version passt nicht mehr) oder die Regeln fehlen
    const now = await progressGet(uid, token).catch(() => null);
    if (now && now.etag !== etag) return null;
  }
  return fail(res, "Speichern");
}

export async function progressDelete(uid: string, token: string): Promise<void> {
  const res = await call(token, "DELETE", doc(`progress/${uid}`));
  if (!res.ok && res.status !== 404) await fail(res, "Löschen");
}

// ---------- Rangliste ----------

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

/** Alle Konten mit ihrem Stand. */
export async function userList(token: string): Promise<Entry[]> {
  const out: Entry[] = [];
  let pageToken = "";
  do {
    const res = await call(token, "GET", doc("users"), { pageSize: "300", ...(pageToken ? { pageToken } : {}) });
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

/** Eigenen Eintrag (Name + Stand) schreiben. */
export async function userPut(uid: string, token: string, stats: Stats): Promise<void> {
  const res = await call(token, "POST", `${firebaseSettings().root}:commit`, {}, {
    writes: [
      {
        update: {
          name: doc(`users/${uid}`),
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
    ],
  });
  if (!res.ok) await fail(res, "Melden");
}

export async function userDelete(uid: string, token: string): Promise<void> {
  const res = await call(token, "DELETE", doc(`users/${uid}`));
  if (!res.ok && res.status !== 404) await fail(res, "Löschen");
}
