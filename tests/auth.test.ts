import { describe, expect, it } from "vitest";
import { authMessage, cleanName } from "@/lib/auth";

describe("Konto", () => {
  it("übersetzt Fehlercodes von Firebase", () => {
    expect(authMessage("EMAIL_EXISTS")).toMatch(/schon ein Konto/);
    expect(authMessage("WEAK_PASSWORD : Password should be at least 6 characters")).toMatch(/mindestens 6 Zeichen/);
    expect(authMessage("INVALID_LOGIN_CREDENTIALS")).toMatch(/Passwort stimmen nicht/);
    expect(authMessage("CONFIGURATION_NOT_FOUND")).toMatch(/noch nicht eingerichtet/);
    expect(authMessage("UNBEKANNT")).toMatch(/UNBEKANNT/);
  });

  it("bereinigt Namen für die Rangliste", () => {
    expect(cleanName("  Anna\u0007 ")).toBe("Anna");
    expect(cleanName("x".repeat(40))).toHaveLength(24);
  });
});
