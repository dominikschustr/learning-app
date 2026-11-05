/**
 * Kleine Helfer für Firebase mit Dienstkonto über REST (ohne firebase-admin, damit der Workflow nichts
 * Großes installieren muss). Genutzt von scripts/reminders.mjs und scripts/deploy-rules.mjs.
 */
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

/** Dienstkonto aus dem Secret FIREBASE_SERVICE_ACCOUNT (JSON) oder null. */
export function serviceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT ist kein gültiges JSON – den kompletten Inhalt der Schlüsseldatei als Secret eintragen.");
  }
}

/** Projekt-id und öffentlicher VAPID-Schlüssel aus src/config.ts. */
export function appConfig() {
  const src = readFileSync(new URL("../src/config.ts", import.meta.url), "utf8");
  const pick = (k) => src.match(new RegExp(`${k}:\\s*"([^"]*)"`))?.[1] ?? "";
  return { projectId: pick("projectId"), vapidPublicKey: pick("vapidPublicKey") };
}

export async function accessToken(sa, scope = "https://www.googleapis.com/auth/datastore") {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const iat = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "RS256", typ: "JWT" });
  const claim = b64({ iss: sa.client_email, scope, aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 });
  const sig = createSign("RSA-SHA256").update(`${head}.${claim}`).sign(sa.private_key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${sig}` }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Dienstkonto-Anmeldung fehlgeschlagen: ${JSON.stringify(json)}`);
  return json.access_token;
}

/** Firestore-Wert → JS (nur die Typen, die Lernwerk schreibt). */
export function value(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return Date.parse(v.timestampValue) || 0;
  return null;
}

/** Firestore über REST mit Dienstkonto (umgeht die Regeln). */
export function firestore(projectId, token) {
  const root = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const headers = { authorization: `Bearer ${token}` };
  const fields = (d) => Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, value(v)]));
  return {
    async list(collection) {
      const out = [];
      let pageToken = "";
      do {
        const qs = new URLSearchParams({ pageSize: "300", ...(pageToken ? { pageToken } : {}) });
        const res = await fetch(`${root}/${collection}?${qs}`, { headers });
        if (!res.ok) throw new Error(`${collection} laden fehlgeschlagen (${res.status}): ${await res.text()}`);
        const json = await res.json();
        for (const d of json.documents ?? []) out.push({ id: d.name.split("/").pop(), ...fields(d) });
        pageToken = json.nextPageToken ?? "";
      } while (pageToken);
      return out;
    },
    async get(path) {
      const res = await fetch(`${root}/${path}`, { headers });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${path} laden fehlgeschlagen (${res.status}): ${await res.text()}`);
      return fields(await res.json());
    },
    /** Einzelne String-Felder setzen (andere Felder bleiben). */
    async setStrings(path, values) {
      const qs = new URLSearchParams(Object.keys(values).map((k) => ["updateMask.fieldPaths", k]));
      const res = await fetch(`${root}/${path}?${qs}`, {
        method: "PATCH",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ fields: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { stringValue: v }])) }),
      });
      if (!res.ok) throw new Error(`${path} speichern fehlgeschlagen (${res.status}): ${await res.text()}`);
    },
    async remove(path) {
      await fetch(`${root}/${path}`, { method: "DELETE", headers });
    },
  };
}
