"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PUSH } from "@/config";
import { getIdToken, useAuth } from "./auth";
import { cloudConfigured, pushDelete, pushPut } from "./cloud";

/**
 * Erinnerung ans Tagesziel per Web Push – pro Gerät ein- und ausschaltbar.
 * Das Gerät meldet sein Push-Abo in Firestore (push/{id}); abends prüft ein GitHub-Workflow
 * (scripts/reminders.mjs), wer sein Tagesziel noch nicht erreicht hat, und schickt die Benachrichtigung.
 */

export const REMINDER_HOURS = [17, 18, 19, 20, 21, 22] as const;
const DEFAULT_HOUR = 20;
/** Abo spätestens nach einer Woche erneut melden, damit Uhrzeit und Konto sicher stimmen. */
const RESAVE_MS = 7 * 24 * 3600_000;

type ReminderState = {
  on: boolean;
  hour: number;
  /** Hinweis auf der Startseite weggeklickt */
  dismissed: boolean;
  /** zuletzt gemeldet: Konto|Abo|Uhrzeit und wann */
  saved: string | null;
  savedAt: number;
};

export const useReminder = create<ReminderState>()(
  persist(
    (): ReminderState => ({ on: false, hour: DEFAULT_HOUR, dismissed: false, saved: null, savedAt: 0 }),
    { name: "lernwerk-reminder", storage: createJSONStorage(() => localStorage) },
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

async function save(sub: PushSubscription, hour: number, force = false): Promise<void> {
  const uid = useAuth.getState().session?.uid;
  if (!uid) return;
  const id = await endpointId(sub.endpoint);
  const key = `${uid}|${id}|${hour}`;
  const { saved, savedAt } = useReminder.getState();
  if (!force && saved === key && Date.now() - savedAt < RESAVE_MS) return;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin";
  await pushPut(id, await getIdToken(), { uid, sub: JSON.stringify(sub.toJSON()), hour, tz });
  useReminder.setState({ saved: key, savedAt: Date.now() });
}

/** Einschalten (fragt nach der Erlaubnis für Mitteilungen). Wirft mit verständlicher Meldung. */
export async function enableReminder(hour = useReminder.getState().hour): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Mitteilungen sind für Lernwerk blockiert – erlaube sie in den Einstellungen des Browsers bzw. des iPhones."
        : "Ohne Erlaubnis für Mitteilungen geht es nicht.",
    );
  }
  const sub = await subscription(await registration());
  await save(sub, hour, true);
  useReminder.setState({ on: true, hour, dismissed: true });
}

/** Ausschalten: Abo in Firestore löschen und beim Browser abmelden. */
export async function disableReminder(): Promise<void> {
  useReminder.setState({ on: false, saved: null, savedAt: 0 });
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration(`${base}/`);
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  if (useAuth.getState().session) await pushDelete(await endpointId(sub.endpoint), await getIdToken()).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

export async function setReminderHour(hour: number): Promise<void> {
  useReminder.setState({ hour });
  if (!useReminder.getState().on) return;
  await save(await subscription(await registration()), hour, true);
}

/** Beim Start: Abo prüfen und bei Bedarf neu melden (z. B. anderes Konto, erneuertes Abo). */
export async function refreshReminder(): Promise<void> {
  const { on, hour } = useReminder.getState();
  if (!on || reminderSupport() !== "ok") return;
  if (Notification.permission !== "granted") {
    // Erlaubnis entzogen → Schalter passend zurücksetzen
    if (Notification.permission === "denied") await disableReminder();
    return;
  }
  await save(await subscription(await registration()), hour);
}
