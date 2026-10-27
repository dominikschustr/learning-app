import { beforeAll, describe, expect, it } from "vitest";

/**
 * Prüft firestore.rules zusammen mit src/lib/cloud.ts gegen den lokalen Firestore-Emulator.
 * Läuft nur über `npm run test:rules` (braucht Java); bei `npm test` übersprungen.
 */
const EMULATOR = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR;
const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-lernwerk";
const ROOT = `http://${EMULATOR}/v1/projects/${PROJECT}/databases/(default)/documents`;

const cloud = await import("@/lib/cloud");

const secret = (c: string) => c.repeat(22);
const syncKey = (c: string) => c.repeat(43);
const stats = (patch = {}) => ({
  name: "Anna",
  xp: 420,
  today: 12,
  day: "2026-10-27",
  goal: 30,
  streak: 3,
  streakDay: "2026-10-27",
  ...patch,
});

/** Rohe Anfrage am Client-Code vorbei, wie sie ein Angreifer schicken könnte. */
async function raw(writes: unknown[]) {
  const res = await fetch(`${ROOT}:commit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ writes }),
  });
  return res.status;
}
const entryWrite = (id: string, name = "Hacker") => ({
  update: {
    name: `projects/${PROJECT}/databases/(default)/documents/leaderboard/${id}`,
    fields: {
      name: { stringValue: name },
      xp: { integerValue: "9999999" },
      today: { integerValue: "1" },
      day: { stringValue: "2026-10-27" },
      goal: { integerValue: "30" },
      streak: { integerValue: "1" },
      streakDay: { nullValue: null },
    },
  },
  updateTransforms: [{ fieldPath: "at", setToServerValue: "REQUEST_TIME" }],
});
const proofWrite = (id: string, s: string) => ({
  update: { name: `projects/${PROJECT}/databases/(default)/documents/leaderboardKeys/${id}`, fields: { s: { stringValue: s } } },
  updateTransforms: [{ fieldPath: "at", setToServerValue: "REQUEST_TIME" }],
});

describe.skipIf(!EMULATOR)("Firestore-Regeln", () => {
  beforeAll(async () => {
    await fetch(`http://${EMULATOR}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  });

  it("Synchronisation: anlegen, laden, Konflikte erkennen, löschen", async () => {
    const key = syncKey("k");
    expect(await cloud.syncGet(key)).toEqual({ data: null, etag: null });

    const e1 = await cloud.syncPut(key, { xp: 1 }, null);
    expect(e1).toBeTruthy();
    expect(await cloud.syncGet(key)).toEqual({ data: { xp: 1 }, etag: e1 });

    // zweites Gerät mit veraltetem Stand → Konflikt statt Überschreiben
    expect(await cloud.syncPut(key, { xp: 2 }, null)).toBeNull();
    const e2 = await cloud.syncPut(key, { xp: 3 }, e1);
    expect(e2).toBeTruthy();
    expect(await cloud.syncPut(key, { xp: 4 }, e1)).toBeNull();
    expect((await cloud.syncGet(key)).data).toEqual({ xp: 3 });

    await cloud.syncDelete(key);
    expect((await cloud.syncGet(key)).data).toBeNull();
  });

  it("Synchronisation: niemand kann die Lernstände auflisten", async () => {
    await cloud.syncPut(syncKey("x"), { geheim: true }, null);
    const res = await fetch(`${ROOT}/sync`);
    expect(res.status).toBe(403);
  });

  it("Rangliste: melden, lesen, ersetzen, austreten", async () => {
    const a = secret("A");
    const id = await cloud.boardUpsert(a, stats());
    expect(id).toBe(cloud.boardId(a));
    let list = await cloud.boardList();
    expect(list.find((e) => e.id === id)).toMatchObject({ ...stats(), id });
    expect(Math.abs(list.find((e) => e.id === id)!.at - Date.now())).toBeLessThan(60_000);

    await cloud.boardUpsert(a, stats({ xp: 500, streakDay: null }));
    expect((await cloud.boardList()).find((e) => e.id === id)).toMatchObject({ xp: 500, streakDay: null });

    // Profil vom anderen Gerät übernommen: alter Eintrag wird ersetzt
    const b = secret("B");
    await cloud.boardUpsert(b, stats({ name: "Anna (Handy)" }), a);
    list = await cloud.boardList();
    expect(list.map((e) => e.id)).toContain(cloud.boardId(b));
    expect(list.map((e) => e.id)).not.toContain(id);

    await cloud.boardDelete(b);
    expect((await cloud.boardList()).map((e) => e.id)).not.toContain(cloud.boardId(b));
  });

  it("Rangliste: fremde Einträge lassen sich nicht ändern oder löschen", async () => {
    const victim = secret("V");
    const vid = await cloud.boardUpsert(victim, stats({ name: "Opfer" }));
    const attacker = secret("Z");

    expect(await raw([entryWrite(vid)])).toBe(403); // ohne Nachweis
    expect(await raw([proofWrite(vid, attacker), entryWrite(vid)])).toBe(403); // falscher Schlüssel
    expect(await raw([proofWrite(cloud.boardId(attacker), attacker), entryWrite(vid)])).toBe(403); // eigener Nachweis, fremde id
    expect(await raw([{ delete: `projects/${PROJECT}/databases/(default)/documents/leaderboard/${vid}` }])).toBe(403);
    expect((await cloud.boardList()).find((e) => e.id === vid)?.name).toBe("Opfer");

    // geheime Schlüssel sind nicht lesbar
    expect((await fetch(`${ROOT}/leaderboardKeys/${vid}`)).status).toBe(403);
    expect((await fetch(`${ROOT}/leaderboardKeys`)).status).toBe(403);
  });

  it("Rangliste: ungültige Einträge werden abgelehnt", async () => {
    const s = secret("C");
    await expect(cloud.boardUpsert(s, stats({ name: "x".repeat(25) }))).rejects.toThrow();
    await expect(cloud.boardUpsert(s, stats({ xp: -1 }))).rejects.toThrow();
    await expect(cloud.boardUpsert(s, stats({ day: "heute" }))).rejects.toThrow();
    const id = cloud.boardId(s);
    expect(await raw([proofWrite(id, s), { ...entryWrite(id), update: { ...entryWrite(id).update, fields: { ...entryWrite(id).update.fields, extra: { stringValue: "x" } } } }])).toBe(403);
  });
});
