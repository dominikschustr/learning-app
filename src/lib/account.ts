"use client";

import { clearSession, deleteAuthAccount, getIdToken, reauthenticate, useAuth } from "./auth";
import { progressDelete, userDelete } from "./cloud";
import { publishNow, useBoard, writePublished } from "./leaderboard";
import { useApp } from "./store";
import { syncNow, useSync } from "./sync";

/** Abläufe rund ums Konto, die Anmeldung, Lernstand und Rangliste gemeinsam betreffen. */

function clearLocal() {
  useApp.getState().reset();
  writePublished(null);
  useBoard.setState({ entries: [], status: "idle", error: null, loadedAt: null });
  useSync.setState({ lastSync: null, status: "idle", error: null });
}

/**
 * Abmelden: vorher den Stand hochladen, dann den lokalen Lernstand dieses Geräts entfernen,
 * damit die nächste Person auf dem Gerät bei null beginnt. force = auch ohne erfolgreiche Synchronisation.
 */
export async function signOut(force = false): Promise<boolean> {
  if (!force) {
    const synced = await syncNow();
    if (!synced) return false;
    await publishNow().catch(() => undefined);
  }
  clearSession();
  clearLocal();
  return true;
}

/** Konto samt Lernstand und Ranglisten-Eintrag endgültig löschen. */
export async function deleteAccount(password: string): Promise<void> {
  const token = await reauthenticate(password);
  const uid = useAuth.getState().session!.uid;
  await progressDelete(uid, token);
  await userDelete(uid, token);
  await deleteAuthAccount(token);
  clearSession();
  clearLocal();
}

/** Lernstand des Kontos auf allen Geräten zurücksetzen (Konto und Name bleiben). */
export async function resetProgress(): Promise<void> {
  const session = useAuth.getState().session;
  if (session) await progressDelete(session.uid, await getIdToken());
  useApp.getState().reset();
  writePublished(null);
  if (session) {
    await syncNow();
    await publishNow();
  }
}
