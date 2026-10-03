import { describe, expect, it } from "vitest";
import { generateFromPrompt } from "./promptMain";
import { weekendUsesLatticeGraph } from "./weekendFamily";
import { detectForm } from "./form";

describe("open notes — rack tiers, closed shaft, cabinet", () => {
  it("a rack on member stock keeps tiers", () => {
    const p = generateFromPrompt("dowel rack 24 wide 36 tall");
    const shelves = p.panels.filter((panel) => panel.type === "shelf" || /shelf/i.test(panel.name));
    expect(shelves.length).toBeGreaterThan(0);
    expect(p.primaryMaterialId).toMatch(/dowel/);
  });

  it("a closed shaft is not a lattice graph", () => {
    expect(weekendUsesLatticeGraph("lighthouse 18 wide 48 tall", "tower")).toBe(false);
    expect(detectForm("lighthouse 18 wide 48 tall", { width: 18, height: 48, depth: 18 }).kind).not.toBe("lattice");
    const p = generateFromPrompt("lighthouse 18 wide 48 tall from cardboard");
    expect(p.kind).not.toBe("lattice");
    expect(p.kind).not.toBe("eiffel");
  });

  it("a cabinet stays a cabinet", () => {
    const p = generateFromPrompt("spice cabinet 12 wide 20 tall 6 deep");
    expect(p.name.toLowerCase()).toContain("cabinet");
    expect(p.name.toLowerCase()).not.toContain("rack");
    expect(p.fitted?.unit.doors).toBe(true);
    expect((p.fitted?.unit.shelfCount ?? 0) > 0 || p.panels.some((panel) => panel.type === "shelf")).toBe(true);
  });
});
