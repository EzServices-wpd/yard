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

  it("keeps a named product in a rack instead of a closet or a creature", () => {
    const ball = generateFromPrompt("Wilson GST football");
    const ballItem = getCatalogItem(ball.instances[0].catalogId);
    assert.equal(ballItem?.shape, "ball");
    assert.ok((ballItem?.dims.length ?? 0) > 10);
    assert.ok(!ball.notes.some((note) => /quadruped|creature|popsicle/i.test(note)));

    const rack = generateFromPrompt("rack for an Estwing claw hammer");
    assert.notEqual(rack.kind, "closet");
    const hammer = getCatalogItem(rack.instances[0].catalogId);
    assert.equal(hammer?.shape, "tool");
    assert.equal(hammer?.dims.length, 13);
    assert.ok(rack.panels.some((panel) => /post/i.test(panel.name)));
    assert.ok(!rack.notes.some((note) => /quadruped|creature|popsicle/i.test(note)));
    assert.ok(!rack.panels.some((panel) => /plywood/i.test(panel.materialId)));
  });
});

describe("a cooler stays the cooler", () => {
  it("places an Igloo cooler, and a shelf keeps it, instead of a dome or a closet", () => {
    const cooler = generateFromPrompt("Igloo Latitude 16 qt cooler");
    assert.equal(cooler.kind, "custom");
    assert.notEqual(cooler.kind, "dome");
    const item = getCatalogItem(cooler.instances[0].catalogId);
    assert.equal(item?.shape, "block");
    assert.equal(item?.dims.length, 14.5);
    assert.equal(item?.dims.width, 10.9);
    assert.equal(item?.dims.height, 13.91);
    assert.match(item?.notes ?? "", /14\.5/);
    assert.ok(!cooler.notes.some((note) => /popsicle|craft stick|birch/i.test(note)));

    const shelf = generateFromPrompt("shelf for an Igloo cooler");
    assert.notEqual(shelf.kind, "closet");
    assert.notEqual(shelf.kind, "dome");
    const held = getCatalogItem(shelf.instances[0].catalogId);
    assert.equal(held?.shape, "block");
    assert.ok((held?.dims.length ?? 0) > 12);
    assert.ok(shelf.panels.some((panel) => /post/i.test(panel.name)));
    assert.ok(!shelf.panels.some((panel) => /plywood/i.test(panel.materialId)));
  });
});

describe("a storage box stays the box", () => {
  it("places a Sterilite 6 qt box, and a shelf keeps it, instead of a closet", () => {
    const box = generateFromPrompt("Sterilite 6 qt storage box");
    assert.equal(box.kind, "custom");
    assert.notEqual(box.kind, "closet");
    const item = getCatalogItem(box.instances[0].catalogId);
    assert.equal(item?.shape, "block");
    assert.equal(item?.dims.length, 13.5);
    assert.equal(item?.dims.width, 8);
    assert.equal(item?.dims.height, 4.625);
    assert.match(item?.notes ?? "", /13\.5/);
    assert.ok(!box.notes.some((note) => /carcase|plywood/i.test(note)));

    const shelf = generateFromPrompt("shelf for a Sterilite 6 qt box");
    assert.notEqual(shelf.kind, "closet");
    const held = getCatalogItem(shelf.instances[0].catalogId);
    assert.equal(held?.shape, "block");
    assert.equal(held?.dims.length, 13.5);
    assert.ok(shelf.panels.some((panel) => /post/i.test(panel.name)));
    assert.ok(!shelf.panels.some((panel) => /plywood/i.test(panel.materialId)));
  });
});
