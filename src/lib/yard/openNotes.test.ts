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

  it("a picked sheet outside the sheet-good class is every panel", () => {
    const p = generateFromPrompt("console table 54 wide 30 tall 14 deep from cardboard");
    expect(p.primaryMaterialId).toMatch(/cardboard/);
    expect(p.panels.length).toBeGreaterThan(0);
    expect(p.panels.every((panel) => /cardboard/.test(panel.materialId ?? ""))).toBe(true);
    expect(p.overall.width).toBeGreaterThan(50);
    expect(p.overall.height).toBeGreaterThan(28);
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

  it("a form that already places members stays that form on a named sheet", () => {
    const p = generateFromPrompt("cardboard robot 14 tall");
    expect(p.kind).toBe("figure");
    expect(p.name.toLowerCase()).toContain("robot");
    expect(p.primaryMaterialId).toMatch(/cardboard/);
    expect(p.panels.some((panel) => /wall|floor/i.test(panel.name))).toBe(false);
    expect(p.overall.height).toBeGreaterThan(12);
    expect(p.overall.height).toBeLessThan(18);
  });

  it("a named sheet with no form of its own stays a shell", () => {
    const p = generateFromPrompt("cardboard mailbox 8 wide 18 tall");
    expect(p.panels.length).toBeGreaterThan(0);
    expect(p.kind).not.toBe("figure");
    expect(p.primaryMaterialId).toMatch(/cardboard/);
  });
});
