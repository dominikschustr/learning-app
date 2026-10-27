import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { boardId, isBoardSecret, isSyncKey } from "@/lib/cloud";
import { sha256 } from "@/lib/sha256";

describe("sha256", () => {
  it("stimmt mit node:crypto überein", () => {
    for (const s of ["", "abc", "lb:AAAAAAAAAAAAAAAAAAAAAA", "äöü€😀".repeat(40), "x".repeat(55), "x".repeat(56), "y".repeat(1000)]) {
      expect(sha256(s)).toBe(createHash("sha256").update(s).digest("hex"));
    }
  });
});

describe("Schlüssel", () => {
  it("leitet die öffentliche Ranglisten-id aus dem geheimen Schlüssel ab", () => {
    const secret = "AbCdEfGhIjKlMnOpQrStUv";
    expect(isBoardSecret(secret)).toBe(true);
    expect(boardId(secret)).toBe(createHash("sha256").update(`lb:${secret}`).digest("hex").slice(0, 16));
  });

  it("erkennt gültige Schlüssel", () => {
    expect(isSyncKey("a".repeat(43))).toBe(true);
    expect(isSyncKey("a".repeat(42))).toBe(false);
    expect(isBoardSecret("kurz")).toBe(false);
  });
});
