import { describe, expect, it } from "vitest";
import { getAllContent } from "@/lib/content";

describe("Content", () => {
  it("alle Fächer sind gültig und reichen für eine Simulation", () => {
    const all = getAllContent();
    expect(all.length).toBeGreaterThan(0);
    for (const c of all) expect(c.questions.length).toBeGreaterThan(0);
  });
});
