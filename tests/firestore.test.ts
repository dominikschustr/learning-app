import { beforeAll, describe, expect, it } from "vitest";

/**
 * Prüft Konten (Auth-Emulator), firestore.rules und den Client-Code (src/lib/auth.ts, src/lib/cloud.ts)
 * gegen die lokalen Firebase-Emulatoren. Läuft nur über `npm run test:rules` (braucht Java);
 * bei `npm test` übersprungen.
 */
const EMULATOR = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR;
const AUTH = process.env.NEXT_PUBLIC_AUTH_EMULATOR;
const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-lernwerk";
const ROOT = `http://${EMULATOR}/v1/projects/${PROJECT}/databases/(default)/documents`;

const auth = await import("@/lib/auth");
const cloud = await import("@/lib/cloud");

const stats = (patch = {}) => ({
  name: "Anna",
  xp: 420,
  today: 12,
  day: "2026-10-28",
  goal: 30,
  streak: 3,
  streakDay: "2026-10-28",
  weekXp: 180,
  week: "2026-10-26",
  ...patch,
});

type Account = { uid: string; token: string };
let anna: Account;
let ben: Account;

async function register(name: string, email: string): Promise<Account> {
  const s = await auth.signUp(name, email, "geheim123");
  return { uid: s.uid, token: s.idToken };
}

/** Rohe Anfrage am Client-Code vorbei, wie sie ein Angreifer schicken könnte. */
async function raw(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${ROOT}/${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.status;
}

describe.skipIf(!EMULATOR || !AUTH)("Konten und Firestore-Regeln", () => {
  beforeAll(async () => {
    await fetch(`http://${EMULATOR}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
    await fetch(`http://${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
    anna = await register("Anna", "anna@example.com");
    ben = await register("Ben", "ben@example.com");
  });

  it("Konto: registrieren, anmelden, Fehler verständlich melden", async () => {
    expect(anna.uid).toBeTruthy();
    const s = await auth.signIn("anna@example.com", "geheim123");
    expect(s).toMatchObject({ uid: anna.uid, name: "Anna", email: "anna@example.com" });
    await expect(auth.signIn("anna@example.com", "falsch")).rejects.toThrow(/E-Mail-Adresse oder Passwort/);
    await expect(auth.signUp("Anna 2", "anna@example.com", "geheim123")).rejects.toThrow(/schon ein Konto/);
    await expect(auth.signUp("Kurz", "kurz@example.com", "123")).rejects.toThrow(/mindestens 6 Zeichen/);
    await expect(auth.signUp("   ", "leer@example.com", "geheim123")).rejects.toThrow(/Namen/);
  });

  it("Lernstand: anlegen, laden, Konflikte erkennen, löschen", async () => {
    const { uid, token } = anna;
    expect(await cloud.progressGet(uid, token)).toEqual({ data: null, etag: null });
    expect(await cloud.progressPut(uid, token, { xp: 1 }, null)).toBe("1");
    const r1 = await cloud.progressGet<{ xp: number }>(uid, token);
    expect(r1).toEqual({ data: { xp: 1 }, etag: "1" });

    // zweites Gerät mit veraltetem Stand → Konflikt statt Überschreiben
    expect(await cloud.progressPut(uid, token, { xp: 2 }, null)).toBeNull();
    expect(await cloud.progressPut(uid, token, { xp: 3 }, "1")).toBe("2");
    expect(await cloud.progressPut(uid, token, { xp: 4 }, "1")).toBeNull();
    expect((await cloud.progressGet(uid, token)).data).toEqual({ xp: 3 });

    await cloud.progressDelete(uid, token);
    expect((await cloud.progressGet(uid, token)).data).toBeNull();
  });

  it("Lernstand: nur das eigene Konto kommt heran", async () => {
    await cloud.progressPut(anna.uid, anna.token, { geheim: true }, null);
    expect(await raw("GET", `progress/${anna.uid}`, ben.token)).toBe(403);
    expect(await raw("GET", `progress/${anna.uid}`)).toBe(403);
    expect(await raw("GET", "progress", anna.token)).toBe(403);
    expect(
      await raw("PATCH", `progress/${anna.uid}`, ben.token, { fields: { d: { stringValue: "{}" }, v: { integerValue: "2" } } }),
    ).toBe(403);
    expect(await raw("DELETE", `progress/${anna.uid}`, ben.token)).toBe(403);
  });

  it("Rangliste: alle Konten sehen alle, ändern nur den eigenen Eintrag", async () => {
    await cloud.userPut(anna.uid, anna.token, stats());
    await cloud.userPut(ben.uid, ben.token, stats({ name: "Ben", xp: 90 }));
    const list = await cloud.userList(ben.token);
    expect(list.find((e) => e.id === anna.uid)).toMatchObject({ ...stats(), id: anna.uid });
    expect(list.find((e) => e.id === ben.uid)?.xp).toBe(90);
    expect(Math.abs(list[0].at - Date.now())).toBeLessThan(60_000);

    // ohne Anmeldung nichts sichtbar
    expect(await raw("GET", "users")).toBe(403);
    // Ben kann Annas Eintrag weder überschreiben noch löschen
    await expect(cloud.userPut(anna.uid, ben.token, stats({ name: "Hacker", xp: 9999999 }))).rejects.toThrow();
    expect(await raw("DELETE", `users/${anna.uid}`, ben.token)).toBe(403);
    expect((await cloud.userList(anna.token)).find((e) => e.id === anna.uid)?.name).toBe("Anna");
  });

  it("Rangliste: ungültige Einträge werden abgelehnt", async () => {
    const { uid, token } = ben;
    await expect(cloud.userPut(uid, token, stats({ name: "x".repeat(25) }))).rejects.toThrow();
    await expect(cloud.userPut(uid, token, stats({ xp: -1 }))).rejects.toThrow();
    await expect(cloud.userPut(uid, token, stats({ day: "heute" }))).rejects.toThrow();
    await expect(cloud.userPut(uid, token, stats({ weekXp: -5 }))).rejects.toThrow();
    await expect(cloud.userPut(uid, token, stats({ week: "KW44" }))).rejects.toThrow();
  });

  it("Rangliste: Einträge ohne Wochenliga (ältere App-Versionen) bleiben erlaubt", async () => {
    await cloud.userPut(ben.uid, ben.token, stats({ name: "Ben" }), true);
    const e = (await cloud.userList(anna.token)).find((x) => x.id === ben.uid);
    expect(e).toMatchObject({ name: "Ben", weekXp: 0, week: null });
  });

  it("Konto löschen: Lernstand, Eintrag und Konto sind weg", async () => {
    const c = await register("Clara", "clara@example.com");
    await cloud.progressPut(c.uid, c.token, { xp: 5 }, null);
    await cloud.userPut(c.uid, c.token, stats({ name: "Clara" }));
    const token = await auth.reauthenticate("geheim123");
    await cloud.progressDelete(c.uid, token);
    await cloud.userDelete(c.uid, token);
    await auth.deleteAuthAccount(token);
    expect((await cloud.userList(anna.token)).map((e) => e.id)).not.toContain(c.uid);
    await expect(auth.signIn("clara@example.com", "geheim123")).rejects.toThrow(/E-Mail-Adresse oder Passwort/);
  });
});
