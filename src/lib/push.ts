"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PUSH } from "@/config";
import { getIdToken, useAuth } from "./auth";
import { cloudConfigured, pushDelete, pushPut } from "./cloud";

/**
 * Mitteilungen per Web Push – pro Gerät ein- und ausschaltbar:
 * - Erinnerung ans Tagesziel (on): abends zur gewählten Uhrzeit, falls das Tagesziel noch offen ist
 * - Rangliste (social): wenn jemand aus der Rangliste gerade lernt
 * Das Gerät meldet sein Push-Abo in Firestore (push/{id}); ein GitHub-Workflow (scripts/reminders.mjs)
 * prüft regelmäßig, wem eine Mitteilung zusteht, und verschickt sie.
 */

export const REMINDER_HOURS = [17, 18, 19, 20, 21, 22] as const;
const DEFAULT_HOUR = 20;
/** Abo spätestens nach einer Woche erneut melden, damit Uhrzeit und Konto sicher stimmen. */
const RESAVE_MS = 7 * 24 * 3600_000;

type ReminderState = {
  /** Erinnerung ans Tagesziel */
  on: boolean;
  /** Mitteilung, wenn jemand aus der Rangliste lernt */
  social: boolean;
  hour: number;
  /** Hinweis auf der Startseite weggeklickt */
  dismissed: boolean;
  /** zuletzt gemeldet: Konto|Abo|Uhrzeit|Schalter und wann */
  saved: string | null;
  savedAt: number;
};

type Choice = Pick<ReminderState, "on" | "social" | "hour">;

export const useReminder = create<ReminderState>()(
  persist(
    (): ReminderState => ({ on: false, social: false, hour: DEFAULT_HOUR, dismissed: false, saved: null, savedAt: 0 }),
    {
      name: "lernwerk-reminder",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // v0 kannte nur die Erinnerung: wer sie an hatte, bekommt auch die Ranglisten-Mitteilungen
      migrate: (state, version) => {
        const s = state as Partial<ReminderState>;
        return (version < 1 ? { ...s, social: !!s.on, saved: null } : s) as ReminderState;
      },
    },
  ),
);

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export type ReminderSupport = "ok" | "ios-install" | "unsupported";

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** Kann dieses Gerät Erinnerungen bekommen? Auf dem iPhone nur aus der Home-Bildschirm-App. */
export function reminderSupport(): ReminderSupport {
  if (!PUSH.vapidPublicKey || !cloudConfigured() || typeof window === "undefined") return "unsupported";
  const api = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIos() && !isStandalone()) return "ios-install";
  return api ? "ok" : "unsupported";
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (b64url + "=".repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function endpointId(endpoint: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` });
  return navigator.serviceWorker.ready;
}

async function subscription(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  return (
    (await reg.pushManager.getSubscription()) ??
    reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUSH.vapidPublicKey) })
  );
}

async function save(sub: PushSubscription, c: Choice, force = false): Promise<void> {
  const uid = useAuth.getState().session?.uid;
  if (!uid) return;
  const id = await endpointId(sub.endpoint);
  const key = `${uid}|${id}|${c.hour}|${+c.on}${+c.social}`;
  const { saved, savedAt } = useReminder.getState();
  if (!force && saved === key && Date.now() - savedAt < RESAVE_MS) return;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin";
  await pushPut(id, await getIdToken(), { uid, sub: JSON.stringify(sub.toJSON()), hour: c.hour, tz, daily: c.on, social: c.social });
  useReminder.setState({ saved: key, savedAt: Date.now() });
}

function choice(): Choice {
  const { on, social, hour } = useReminder.getState();
  return { on, social, hour };
}

/** Schalter ändern (fragt beim Einschalten nach der Erlaubnis für Mitteilungen). Wirft mit verständlicher Meldung. */
async function change(patch: Partial<Choice>): Promise<void> {
  const next = { ...choice(), ...patch };
  if (!next.on && !next.social) return disableReminder();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Mitteilungen sind für Lernwerk blockiert – erlaube sie in den Einstellungen des Browsers bzw. des iPhones."
        : "Ohne Erlaubnis für Mitteilungen geht es nicht.",
    );
  }
  await save(await subscription(await registration()), next, true);
  useReminder.setState({ ...next, dismissed: true });
}

/** Alle Mitteilungen einschalten (Hinweis auf der Startseite). */
export const enableReminder = () => change({ on: true, social: true });
/** Erinnerung ans Tagesziel ein-/ausschalten. */
export const setDailyReminder = (on: boolean) => change({ on });
/** Mitteilung, wenn jemand aus der Rangliste lernt, ein-/ausschalten. */
export const setSocialPush = (social: boolean) => change({ social });

/** Alles ausschalten: Abo in Firestore löschen und beim Browser abmelden. */
export async function disableReminder(): Promise<void> {
  useReminder.setState({ on: false, social: false, saved: null, savedAt: 0 });
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration(`${base}/`);
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  if (useAuth.getState().session) await pushDelete(await endpointId(sub.endpoint), await getIdToken()).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

export async function setReminderHour(hour: number): Promise<void> {
  useReminder.setState({ hour });
  const c = choice();
  if (!c.on) return;
  await save(await subscription(await registration()), c, true);
}

/** Beim Start: Abo prüfen und bei Bedarf neu melden (z. B. anderes Konto, erneuertes Abo). */
export async function refreshReminder(): Promise<void> {
  const c = choice();
  if ((!c.on && !c.social) || reminderSupport() !== "ok") return;
  if (Notification.permission !== "granted") {
    // Erlaubnis entzogen → Schalter passend zurücksetzen
    if (Notification.permission === "denied") await disableReminder();
    return;
  }
  await save(await subscription(await registration()), c);
}
