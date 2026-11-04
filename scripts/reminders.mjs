/**
 * Erinnerung ans Tagesziel (läuft abends stündlich über .github/workflows/remind.yml).
 *
 * Liest mit einem Firebase-Dienstkonto alle Push-Abos (push/{id}) und den Stand jedes Kontos (users/{uid}:
 * today, day, goal, streak) und schickt jedem Gerät, dessen Erinnerungszeit erreicht ist, eine Mitteilung –
 * aber nur, wenn das Konto sein Tagesziel heute noch nicht geschafft hat, und höchstens einmal pro Tag.
 *
 * Secrets: FIREBASE_SERVICE_ACCOUNT (JSON des Dienstkontos), VAPID_PRIVATE_KEY.
 * Der öffentliche VAPID-Schlüssel und die Projekt-id kommen aus src/config.ts.
 */
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// ---------- Logik (getestet in tests/reminders.test.ts) ----------

/** Lokaler Tag (YYYY-MM-DD) und Stunde in der Zeitzone tz. */
export function localNow(now, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

function previousDay(day) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * Mitteilung für ein Abo – oder null, wenn (noch) keine fällig ist.
 * push: { hour, tz, sent }, user: { today, day, goal, streak, streakDay } oder null (noch nie gemeldet).
 */
export function reminderFor(push, user, now) {
  let local;
  try {
    local = localNow(now, push.tz || "Europe/Berlin");
  } catch {
    local = localNow(now, "Europe/Berlin");
  }
  if (local.hour < push.hour || push.sent === local.day) return null;
  const goal = user?.goal > 0 ? user.goal : 30;
  const done = user && user.day === local.day ? user.today : 0;
  if (done >= goal) return null;

  const left = goal - done;
  const atRisk = user && user.streak > 0 && user.streakDay === previousDay(local.day);
  const body =
    (done === 0
      ? `Heute noch nichts gelernt – ${goal} Fragen oder Karten sind dein Ziel.`
      : `${done} von ${goal} geschafft – noch ${left} bis zum Tagesziel.`) +
    (atRisk ? ` Deine Serie von ${user.streak} ${user.streak === 1 ? "Tag" : "Tagen"} läuft heute ab.` : "");
  return { day: local.day, title: done === 0 ? "Zeit fürs Tagesziel" : "Tagesziel noch offen", body };
}

// ---------- Firestore (REST, Dienstkonto) ----------

function config() {
  const src = readFileSync(new URL("../src/config.ts", import.meta.url), "utf8");
  const pick = (k) => src.match(new RegExp(`${k}:\\s*"([^"]*)"`))?.[1] ?? "";
  return { projectId: pick("projectId"), vapidPublicKey: pick("vapidPublicKey") };
}

async function accessToken(sa) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const iat = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "RS256", typ: "JWT" });
  const claim = b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp: iat + 3600,
  });
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

const value = (v) => v?.stringValue ?? (v?.integerValue !== undefined ? Number(v.integerValue) : null);

async function list(root, token, collection) {
  const out = [];
  let pageToken = "";
  do {
    const qs = new URLSearchParams({ pageSize: "300", ...(pageToken ? { pageToken } : {}) });
    const res = await fetch(`${root}/${collection}?${qs}`, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`${collection} laden fehlgeschlagen (${res.status}): ${await res.text()}`);
    const json = await res.json();
    for (const d of json.documents ?? []) {
      const fields = Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, value(v)]));
      out.push({ id: d.name.split("/").pop(), ...fields });
    }
    pageToken = json.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

// ---------- Versand ----------

async function main() {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!saJson || !vapidPrivate) {
    console.log("Secrets FIREBASE_SERVICE_ACCOUNT / VAPID_PRIVATE_KEY fehlen – keine Erinnerungen verschickt.");
    return;
  }
  // require statt import: so findet Node web-push auch über NODE_PATH (Workflow installiert es separat)
  const webpush = createRequire(import.meta.url)("web-push");
  const cfg = config();
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://dominikschustr.github.io/learning-app/", cfg.vapidPublicKey, vapidPrivate);

  const sa = JSON.parse(saJson);
  const token = await accessToken(sa);
  const root = `https://firestore.googleapis.com/v1/projects/${sa.project_id || cfg.projectId}/databases/(default)/documents`;
  const auth = { authorization: `Bearer ${token}` };

  const [subs, users] = await Promise.all([list(root, token, "push"), list(root, token, "users")]);
  const byUid = new Map(users.map((u) => [u.id, u]));
  const now = new Date();
  let sent = 0;
  let removed = 0;

  for (const p of subs) {
    const msg = reminderFor(p, byUid.get(p.uid) ?? null, now);
    if (!msg) continue;
    try {
      await webpush.sendNotification(JSON.parse(p.sub), JSON.stringify({ title: msg.title, body: msg.body, tag: "daily-goal" }), {
        TTL: 3 * 3600,
        urgency: "normal",
      });
      sent++;
      await fetch(`${root}/push/${p.id}?updateMask.fieldPaths=sent`, {
        method: "PATCH",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ fields: { sent: { stringValue: msg.day } } }),
      });
    } catch (e) {
      // Abo abgelaufen oder abbestellt → entfernen
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await fetch(`${root}/push/${p.id}`, { method: "DELETE", headers: auth });
        removed++;
      } else {
        console.error(`Versand an ${p.id} fehlgeschlagen:`, e?.statusCode ?? "", e?.body ?? e?.message ?? e);
      }
    }
  }
  console.log(`${subs.length} Abos, ${sent} Erinnerungen verschickt, ${removed} abgelaufene entfernt.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
