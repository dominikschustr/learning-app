import { describe, expect, it } from "vitest";
import { QUIET_MS, activityFor, learners, localNow, reminderFor } from "../scripts/reminders.mjs";

// 4. November 2026, 19:30 UTC = 20:30 in Berlin (Winterzeit)
const now = new Date("2026-11-04T19:30:00Z");
const push = { hour: 20, tz: "Europe/Berlin", sent: null };
const user = { today: 12, day: "2026-11-04", goal: 30, streak: 4, streakDay: "2026-11-04" };

describe("Erinnerung ans Tagesziel", () => {
  it("rechnet in der Zeitzone des Geräts", () => {
    expect(localNow(now, "Europe/Berlin")).toEqual({ day: "2026-11-04", hour: 20 });
    expect(localNow(new Date("2026-07-01T18:30:00Z"), "Europe/Berlin")).toEqual({ day: "2026-07-01", hour: 20 });
    expect(localNow(now, "America/New_York")).toEqual({ day: "2026-11-04", hour: 14 });
  });

  it("erinnert ab der gewählten Uhrzeit, wenn das Ziel offen ist", () => {
    expect(reminderFor({ ...push, hour: 21 }, user, now)).toBeNull();
    const msg = reminderFor(push, user, now);
    expect(msg).toMatchObject({ day: "2026-11-04", title: "Tagesziel noch offen" });
    expect(msg?.body).toContain("12 von 30");
    expect(msg?.body).toContain("noch 18");
  });

  it("schweigt bei erreichtem Ziel und schickt höchstens eine pro Tag", () => {
    expect(reminderFor(push, { ...user, today: 30 }, now)).toBeNull();
    expect(reminderFor({ ...push, sent: "2026-11-04" }, user, now)).toBeNull();
    expect(reminderFor({ ...push, sent: "2026-11-03" }, user, now)).not.toBeNull();
  });

  it("zählt einen alten Stand als 0 und warnt, wenn die Serie abläuft", () => {
    const msg = reminderFor(push, { ...user, day: "2026-11-03", streakDay: "2026-11-03" }, now);
    expect(msg?.title).toBe("Zeit fürs Tagesziel");
    expect(msg?.body).toContain("Heute noch nichts gelernt");
    expect(msg?.body).toContain("Serie von 4 Tagen");
    // noch nie gemeldet → Standardziel
    expect(reminderFor(push, null, now)?.body).toContain("30 Fragen oder Karten");
  });
});

describe("Erinnerung: Schalter", () => {
  it("schweigt, wenn die Erinnerung ans Tagesziel aus ist (nur Rangliste)", () => {
    expect(reminderFor({ ...push, daily: false }, user, now)).toBeNull();
    expect(reminderFor({ ...push, daily: true }, user, now)).not.toBeNull();
  });
});

describe("Rangliste: jemand lernt gerade", () => {
  const t = now.getTime();
  const anna = { id: "anna", name: "Anna", today: 12, day: "2026-11-04", goal: 30, at: t - 5 * 60_000 };
  const ben = { id: "ben", name: "Ben", today: 0, day: "2026-11-03", goal: 20, at: t - 20 * 3600_000 };
  const prev = { anna: { day: "2026-11-04", today: 4, notified: 0 }, ben: { day: "2026-11-03", today: 0, notified: 0 } };

  it("merkt sich beim ersten Lauf nur den Stand", () => {
    const r = learners([anna, ben], null, now);
    expect(r.learners).toEqual([]);
    expect(r.state.anna).toEqual({ day: "2026-11-04", today: 12, notified: 0 });
  });

  it("meldet, wer seit dem letzten Lauf mehr gelernt hat", () => {
    const r = learners([anna, ben], prev, now);
    expect(r.learners).toEqual([{ uid: "anna", name: "Anna", today: 12, goal: 30 }]);
    expect(r.state.anna.notified).toBe(t);
    // unverändert → nichts
    expect(learners([anna, ben], r.state, now).learners).toEqual([]);
  });

  it("zählt einen neuen Tag ab 0 und neue Konten", () => {
    const newDay = learners([{ ...anna, today: 2 }], { anna: { day: "2026-11-03", today: 40, notified: 0 } }, now);
    expect(newDay.learners).toHaveLength(1);
    expect(learners([anna], {}, now).learners).toHaveLength(1);
  });

  it("höchstens alle drei Stunden pro Person und nur bei frischem Stand", () => {
    const recent = { anna: { ...prev.anna, notified: t - QUIET_MS + 60_000 } };
    const r = learners([anna], recent, now);
    expect(r.learners).toEqual([]);
    // der Stand wird trotzdem weitergeschrieben, die Sperrzeit bleibt
    expect(r.state.anna).toEqual({ day: "2026-11-04", today: 12, notified: t - QUIET_MS + 60_000 });
    expect(learners([{ ...anna, at: t - 2 * 3600_000 }], prev, now).learners).toEqual([]);
  });

  const sub = { uid: "ben", tz: "Europe/Berlin", social: true };
  const a = { uid: "anna", name: "Anna", today: 12, goal: 30 };

  it("schickt die Mitteilung an die anderen, nicht an sich selbst", () => {
    expect(activityFor(sub, [a], now)).toMatchObject({ title: "Anna lernt gerade", url: "leaderboard/", tag: "activity" });
    expect(activityFor(sub, [a], now)?.body).toContain("12 Antworten heute");
    expect(activityFor({ ...sub, uid: "anna" }, [a], now)).toBeNull();
    expect(activityFor(sub, [{ ...a, today: 30 }], now)?.body).toContain("Tagesziel schon geschafft");
  });

  it("nur mit eingeschaltetem Schalter und nicht nachts", () => {
    expect(activityFor({ ...sub, social: false }, [a], now)).toBeNull();
    expect(activityFor({ uid: "ben", tz: "Europe/Berlin" }, [a], now)).toBeNull();
    // 21:30 UTC = 22:30 in Berlin
    expect(activityFor(sub, [a], new Date("2026-11-04T21:30:00Z"))).toBeNull();
    expect(activityFor(sub, [a], new Date("2026-11-04T05:30:00Z"))).toBeNull();
  });

  it("fasst mehrere Lernende zusammen", () => {
    const c = { uid: "clara", name: "Clara", today: 3, goal: 30 };
    const d = { uid: "dana", name: "Dana", today: 8, goal: 30 };
    expect(activityFor(sub, [a, c], now)?.title).toBe("Anna und Clara lernen gerade");
    expect(activityFor(sub, [a, c, d], now)?.title).toBe("Anna, Clara und 1 weitere lernen gerade");
    expect(activityFor({ ...sub, uid: "clara" }, [a, c], now)?.title).toBe("Anna lernt gerade");
  });
});
