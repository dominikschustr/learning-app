/**
 * Mitteilungen per Web Push (läuft tagsüber alle 10 Minuten über .github/workflows/remind.yml).
 *
 * Liest mit einem Firebase-Dienstkonto alle Push-Abos (push/{id}) und den Ranglisten-Stand jedes Kontos
 * (users/{uid}) und verschickt zwei Arten von Mitteilungen:
 * - Erinnerung ans Tagesziel (Abo mit daily ≠ false): ab der gewählten Uhrzeit, wenn das Konto sein Tagesziel
 *   heute noch nicht geschafft hat, höchstens einmal pro Tag.
 * - Rangliste (Abo mit social = true): wenn jemand anderes aus der Rangliste seit dem letzten Lauf gelernt hat,
 *   pro lernender Person höchstens alle drei Stunden. Den Stand vom letzten Lauf merkt sich das Skript in
 *   notify/activity (für Konten über die Regeln gesperrt).
 *
 * Secrets: FIREBASE_SERVICE_ACCOUNT (JSON des Dienstkontos), VAPID_PRIVATE_KEY.
 * Der öffentliche VAPID-Schlüssel und die Projekt-id kommen aus src/config.ts.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { accessToken, appConfig, firestore, serviceAccount } from "./firebase-admin.mjs";

// ---------- Logik (getestet in tests/reminders.test.ts) ----------

/** Pro lernender Person höchstens alle drei Stunden eine Mitteilung. */
export const QUIET_MS = 3 * 3600_000;
/** Nur Lernen der letzten Stunde zählt als „lernt gerade“ (falls ein Lauf ausfällt oder sich verspätet). */
export const FRESH_MS = 3600_000;
/** Ranglisten-Mitteilungen nur zwischen 7 und 22 Uhr (Ortszeit des Empfängers). */
export const SOCIAL_FROM = 7;
export const SOCIAL_UNTIL = 22;

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

function localOrBerlin(now, tz) {
  try {
    return localNow(now, tz || "Europe/Berlin");
  } catch {
    return localNow(now, "Europe/Berlin");
  }
}

function previousDay(day) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * Erinnerung ans Tagesziel für ein Abo – oder null, wenn (noch) keine fällig ist.
 * push: { hour, tz, sent, daily }, user: { today, day, goal, streak, streakDay } oder null (noch nie gemeldet).
 */
export function reminderFor(push, user, now) {
  if (push.daily === false) return null;
  const local = localOrBerlin(now, push.tz);
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
  return { day: local.day, title: done === 0 ? "Zeit fürs Tagesziel" : "Tagesziel noch offen", body, tag: "daily-goal" };
}

/**
 * Wer hat seit dem letzten Lauf gelernt? Vergleicht den Ranglisten-Stand (users: { id, name, today, day, goal, at })
 * mit dem gemerkten Stand prev ({ [uid]: { day, today, notified } }; null beim allerersten Lauf → nur merken).
 * Liefert die Lernenden, über die jetzt berichtet wird, und den neuen Stand zum Merken.
 */
export function learners(users, prev, now) {
  const t = now.getTime();
  /** @type {Record<string, { day: string, today: number, notified: number }>} */
  const state = {};
  /** @type {{ uid: string, name: string, today: number, goal: number }[]} */
  const out = [];
  for (const u of users) {
    if (!u.name || typeof u.day !== "string" || !Number.isFinite(u.today)) continue;
    const p = prev?.[u.id];
    let notified = p?.notified ?? 0;
    const before = p && p.day === u.day ? p.today : 0;
    const fresh = t - (u.at || 0) <= FRESH_MS;
    if (prev && u.today > before && fresh && t - notified >= QUIET_MS) {
      out.push({ uid: u.id, name: u.name, today: u.today, goal: u.goal });
      notified = t;
    }
    state[u.id] = { day: u.day, today: u.today, notified };
  }
  return { learners: out, state };
}

/** Ranglisten-Mitteilung für ein Abo (push: { uid, tz, social }) – oder null. */
export function activityFor(push, active, now) {
  if (push.social !== true) return null;
  const others = active.filter((l) => l.uid !== push.uid);
  if (!others.length) return null;
  const { hour } = localOrBerlin(now, push.tz);
  if (hour < SOCIAL_FROM || hour >= SOCIAL_UNTIL) return null;

  const [a, b] = others;
  let title;
  let body;
  if (others.length === 1) {
    title = `${a.name} lernt gerade`;
    body =
      a.goal > 0 && a.today >= a.goal
        ? `Tagesziel schon geschafft (${a.today} Antworten heute) – zieh mit!`
        : `Schon ${a.today} ${a.today === 1 ? "Antwort" : "Antworten"} heute – zieh mit!`;
  } else {
    title =
      others.length === 2
        ? `${a.name} und ${b.name} lernen gerade`
        : `${a.name}, ${b.name} und ${others.length - 2} weitere lernen gerade`;
    body = "Zieh mit und halte deinen Platz in der Rangliste.";
  }
  return { title, body, tag: "activity", url: "leaderboard/" };
}

// ---------- Versand ----------

async function main() {
  const sa = serviceAccount();
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!sa || !vapidPrivate) {
    console.log("::warning::Secrets FIREBASE_SERVICE_ACCOUNT / VAPID_PRIVATE_KEY fehlen – keine Mitteilungen verschickt.");
    return;
  }
  // require statt import: so findet Node web-push auch über NODE_PATH (Workflow installiert es separat)
  const webpush = createRequire(import.meta.url)("web-push");
  const cfg = appConfig();
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://dominikschustr.github.io/learning-app/", cfg.vapidPublicKey, vapidPrivate);

  const db = firestore(sa.project_id || cfg.projectId, await accessToken(sa));
  const [subs, users, saved] = await Promise.all([db.list("push"), db.list("users"), db.get("notify/activity")]);
  const byUid = new Map(users.map((u) => [u.id, u]));
  const now = new Date();

  let prev = null;
  try {
    prev = saved?.state ? JSON.parse(saved.state) : null;
  } catch {}
  const { learners: active, state } = learners(users, prev, now);
  // erst merken, dann senden: lieber eine Mitteilung verpassen als sie doppelt schicken
  await db.setStrings("notify/activity", { state: JSON.stringify(state) });

  const count = { daily: 0, activity: 0, removed: 0 };
  for (const p of subs) {
    const daily = reminderFor(p, byUid.get(p.uid) ?? null, now);
    const activity = activityFor(p, active, now);
    for (const msg of [daily, activity]) {
      if (!msg) continue;
      try {
        await webpush.sendNotification(
          JSON.parse(p.sub),
          JSON.stringify({ title: msg.title, body: msg.body, tag: msg.tag, url: msg.url }),
          { TTL: msg === daily ? 3 * 3600 : 1800, urgency: "normal" },
        );
        if (msg === daily) {
          count.daily++;
          await db.setStrings(`push/${p.id}`, { sent: msg.day });
        } else count.activity++;
      } catch (e) {
        // Abo abgelaufen oder abbestellt → entfernen
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await db.remove(`push/${p.id}`);
          count.removed++;
          break;
        }
        console.error(`Versand an ${p.id} fehlgeschlagen:`, e?.statusCode ?? "", e?.body ?? e?.message ?? e);
      }
    }
  }
  console.log(
    `${subs.length} Abos, ${active.length} lernen gerade${active.length ? ` (${active.map((l) => l.name).join(", ")})` : ""}: ` +
      `${count.daily} Erinnerungen, ${count.activity} Ranglisten-Mitteilungen, ${count.removed} abgelaufene Abos entfernt.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
