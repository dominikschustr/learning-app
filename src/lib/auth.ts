"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { firebaseSettings } from "./cloud";
import { NAME_MAX } from "./ranking";

/**
 * Konten über Firebase Authentication (E-Mail + Passwort), angesprochen über die REST-API.
 * Die Sitzung (inkl. Refresh-Token) liegt in localStorage; das ID-Token gilt eine Stunde und wird bei Bedarf erneuert.
 */

export type Session = {
  uid: string;
  email: string;
  name: string;
  idToken: string;
  refreshToken: string;
  /** ms seit 1970, wann das ID-Token abläuft */
  expiresAt: number;
};

type AuthState = { session: Session | null };

export const useAuth = create<AuthState>()(
  persist((): AuthState => ({ session: null }), {
    name: "lernwerk-auth",
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
  }),
);

const subscribeHydration = (cb: () => void) => useAuth.persist.onFinishHydration(cb);

/** true, sobald die gespeicherte Sitzung geladen ist (auf dem Server immer false). */
export function useAuthHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, () => useAuth.persist.hasHydrated(), () => false);
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

const MESSAGES: Record<string, string> = {
  EMAIL_EXISTS: "Für diese E-Mail-Adresse gibt es schon ein Konto. Melde dich an.",
  EMAIL_NOT_FOUND: "E-Mail-Adresse oder Passwort stimmen nicht.",
  INVALID_PASSWORD: "E-Mail-Adresse oder Passwort stimmen nicht.",
  INVALID_LOGIN_CREDENTIALS: "E-Mail-Adresse oder Passwort stimmen nicht.",
  INVALID_EMAIL: "Das ist keine gültige E-Mail-Adresse.",
  MISSING_EMAIL: "Bitte gib deine E-Mail-Adresse ein.",
  MISSING_PASSWORD: "Bitte gib ein Passwort ein.",
  WEAK_PASSWORD: "Das Passwort muss mindestens 6 Zeichen haben.",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Zu viele Versuche. Bitte warte ein paar Minuten.",
  USER_DISABLED: "Dieses Konto ist gesperrt.",
  USER_NOT_FOUND: "Dieses Konto gibt es nicht mehr.",
  TOKEN_EXPIRED: "Bitte melde dich erneut an.",
  INVALID_REFRESH_TOKEN: "Bitte melde dich erneut an.",
  INVALID_ID_TOKEN: "Bitte melde dich erneut an.",
  CREDENTIAL_TOO_OLD_LOGIN_AGAIN: "Bitte melde dich erneut an.",
  OPERATION_NOT_ALLOWED: "Die Anmeldung mit E-Mail und Passwort ist in Firebase noch nicht eingeschaltet.",
  PASSWORD_LOGIN_DISABLED: "Die Anmeldung mit E-Mail und Passwort ist in Firebase noch nicht eingeschaltet.",
  CONFIGURATION_NOT_FOUND: "Die Anmeldung ist in Firebase noch nicht eingerichtet (Authentication → Jetzt starten).",
};

/** Fehlercode der REST-API in eine deutsche Meldung übersetzen, z. B. "WEAK_PASSWORD : Password should …". */
export function authMessage(code: string): string {
  const key = code.split(/[\s:]/)[0];
  return MESSAGES[key] ?? `Anmeldung fehlgeschlagen (${key}).`;
}

function endpoints() {
  const s = firebaseSettings();
  const emu = s.authEmulator;
  return {
    key: s.apiKey || "emulator",
    identity: emu ? `http://${emu}/identitytoolkit.googleapis.com/v1` : "https://identitytoolkit.googleapis.com/v1",
    token: emu ? `http://${emu}/securetoken.googleapis.com/v1/token` : "https://securetoken.googleapis.com/v1/token",
  };
}

type TokenResponse = { idToken: string; refreshToken: string; expiresIn: string; localId: string; email: string; displayName?: string };

async function identity<T>(method: string, body: object): Promise<T> {
  const e = endpoints();
  const res = await fetch(`${e.identity}/accounts:${method}?key=${e.key}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-firebase-locale": "de" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = String(json?.error?.message ?? `HTTP_${res.status}`);
    throw new AuthError(authMessage(code), code.split(/[\s:]/)[0]);
  }
  return json as T;
}

function toSession(r: TokenResponse, name: string): Session {
  return {
    uid: r.localId,
    email: r.email,
    name,
    idToken: r.idToken,
    refreshToken: r.refreshToken,
    expiresAt: Date.now() + Number(r.expiresIn || 3600) * 1000,
  };
}

export function cleanName(name: string): string {
  return name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, NAME_MAX);
}

/** Neues Konto anlegen; der Name erscheint in der Rangliste. */
export async function signUp(name: string, email: string, password: string): Promise<Session> {
  const n = cleanName(name);
  if (!n) throw new AuthError("Bitte gib einen Namen ein.", "MISSING_NAME");
  const r = await identity<TokenResponse>("signUp", { email: email.trim(), password, returnSecureToken: true });
  const u = await identity<Partial<TokenResponse>>("update", { idToken: r.idToken, displayName: n, returnSecureToken: true });
  const session = toSession({ ...r, ...u, localId: r.localId, email: r.email } as TokenResponse, n);
  useAuth.setState({ session });
  return session;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const r = await identity<TokenResponse>("signInWithPassword", { email: email.trim(), password, returnSecureToken: true });
  // die Antwort enthält den Namen nicht immer → nachschlagen
  let name = r.displayName;
  if (!name) {
    const look = await identity<{ users?: { displayName?: string }[] }>("lookup", { idToken: r.idToken });
    name = look.users?.[0]?.displayName;
  }
  const session = toSession(r, name || r.email.split("@")[0]);
  useAuth.setState({ session });
  return session;
}

export async function sendPasswordReset(email: string): Promise<void> {
  await identity("sendOobCode", { requestType: "PASSWORD_RESET", email: email.trim() });
}

let refreshing: Promise<string> | null = null;

/** Gültiges ID-Token der aktuellen Sitzung (erneuert es bei Bedarf). */
export function getIdToken(): Promise<string> {
  const s = useAuth.getState().session;
  if (!s) return Promise.reject(new AuthError("Nicht angemeldet.", "NO_SESSION"));
  if (s.expiresAt - 60_000 > Date.now()) return Promise.resolve(s.idToken);
  refreshing ??= (async () => {
    try {
      const e = endpoints();
      const res = await fetch(`${e.token}?key=${e.key}`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: s.refreshToken }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = String(json?.error?.message ?? `HTTP_${res.status}`).split(/[\s:]/)[0];
        // Konto gelöscht/gesperrt oder Sitzung widerrufen → abmelden
        if (res.status === 400) useAuth.setState({ session: null });
        throw new AuthError(authMessage(code), code);
      }
      const current = useAuth.getState().session;
      if (current && current.uid === json.user_id) {
        useAuth.setState({
          session: {
            ...current,
            idToken: json.id_token,
            refreshToken: json.refresh_token,
            expiresAt: Date.now() + Number(json.expires_in || 3600) * 1000,
          },
        });
      }
      return json.id_token as string;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function renameAccount(name: string): Promise<void> {
  const n = cleanName(name);
  if (!n) throw new AuthError("Bitte gib einen Namen ein.", "MISSING_NAME");
  await identity("update", { idToken: await getIdToken(), displayName: n });
  const s = useAuth.getState().session;
  if (s) useAuth.setState({ session: { ...s, name: n } });
}

/** Prüft das Passwort erneut (für Konto löschen) und liefert ein frisches ID-Token. */
export async function reauthenticate(password: string): Promise<string> {
  const s = useAuth.getState().session;
  if (!s) throw new AuthError("Nicht angemeldet.", "NO_SESSION");
  const r = await identity<TokenResponse>("signInWithPassword", { email: s.email, password, returnSecureToken: true });
  useAuth.setState({ session: { ...s, ...toSession(r, s.name) } });
  return r.idToken;
}

export async function deleteAuthAccount(idToken: string): Promise<void> {
  await identity("delete", { idToken });
}

export function clearSession() {
  useAuth.setState({ session: null });
}
