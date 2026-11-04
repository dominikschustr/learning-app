import { describe, expect, it } from "vitest";
import { localNow, reminderFor } from "../scripts/reminders.mjs";

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
