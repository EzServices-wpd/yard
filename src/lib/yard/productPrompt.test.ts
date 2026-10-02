import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./prompt.ts";
import { getCatalogItem } from "./catalog.ts";

describe("named product on the bench", () => {
  it("places a Dasani bottle instead of a storage unit", () => {
    const project = generateFromPrompt("Dasani bottle");
    assert.match(project.name, /Dasani/);
    assert.equal(project.kind, "custom");
    assert.equal(project.instances.length, 1);
    const item = getCatalogItem(project.instances[0].catalogId);
    assert.equal(item?.shape, "bottle");
    assert.ok((item?.dims.length ?? 0) > 8);
    assert.ok((item?.dims.diameter ?? 0) > 2);
  });

  it("still builds a wine rack, not a single bottle", () => {
    const project = generateFromPrompt("wine rack");
    assert.notEqual(project.kind, "custom");
    assert.ok(project.panels.length + project.instances.length > 1);
  });

  it("places goggles and a screwdriver as those products", () => {
    const goggles = generateFromPrompt("goggles");
    assert.equal(getCatalogItem(goggles.instances[0].catalogId)?.shape, "eyewear");
    const driver = generateFromPrompt("screwdriver");
    assert.equal(getCatalogItem(driver.instances[0].catalogId)?.shape, "tool");
  });
});

describe("a stand keeps the tank", () => {
  it("builds a 20 lb propane tank stand around the cylinder", () => {
    const project = generateFromPrompt("stand for a 20 lb propane tank");
    assert.match(project.name, /propane/i);
    assert.equal(project.kind, "custom");
    const item = getCatalogItem(project.instances[0].catalogId);
    assert.equal(item?.shape, "tank");
    assert.ok((item?.dims.diameter ?? 0) > 10);
    assert.ok((item?.dims.length ?? 0) > 14);
    assert.ok(project.panels.some((panel) => /post/i.test(panel.name)));
    assert.ok(!project.notes.some((note) => /popsicle|creature|quadruped/i.test(note)));
  });
});
