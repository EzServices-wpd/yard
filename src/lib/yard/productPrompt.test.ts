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

describe("a product the family list missed stays that product", () => {
  it("places a Stanley Quencher, and a shelf keeps the cup", () => {
    const cup = generateFromPrompt("Stanley Quencher 40 oz");
    assert.equal(cup.kind, "custom");
    assert.equal(cup.instances.length, 1);
    assert.equal(cup.panels.length, 0);
    const item = getCatalogItem(cup.instances[0].catalogId);
    assert.equal(item?.shape, "cup");
    assert.equal(item?.dims.length, 12.3);
    assert.equal(item?.dims.width, 5.82);
    assert.match(item?.notes ?? "", /12\.3/);
    assert.ok(!cup.notes.some((note) => /popsicle|craft stick/i.test(note)));

    const shelf = generateFromPrompt("shelf for a Stanley Quencher 40 oz");
    assert.notEqual(shelf.kind, "closet");
    const held = getCatalogItem(shelf.instances[0].catalogId);
    assert.equal(held?.shape, "cup");
    assert.equal(held?.dims.length, 12.3);
    assert.ok(shelf.panels.some((panel) => /post/i.test(panel.name)));
    assert.ok(!shelf.panels.some((panel) => /plywood/i.test(panel.materialId)));
  });

  it("places a tape measure, a knob, and a cube instead of craft sticks", () => {
    const tape = generateFromPrompt("Stanley 25 ft tape measure");
    assert.equal(tape.instances.length, 1);
    assert.equal(getCatalogItem(tape.instances[0].catalogId)?.shape, "roll");
    assert.equal(getCatalogItem(tape.instances[0].catalogId)?.dims.length, 3.13);

    const knob = generateFromPrompt("Schlage door knob");
    assert.equal(knob.instances.length, 1);
    assert.equal(getCatalogItem(knob.instances[0].catalogId)?.shape, "block");
    assert.equal(getCatalogItem(knob.instances[0].catalogId)?.dims.length, 2.31);

    const cube = generateFromPrompt("Rubik cube");
    assert.equal(cube.instances.length, 1);
    assert.equal(getCatalogItem(cube.instances[0].catalogId)?.dims.length, 2.24);
    assert.equal(cube.kind, "custom");
  });

  it("places a missed product as that product, and a shelf keeps it", () => {
    const bottle = generateFromPrompt("CamelBak Chute Mag 32 oz");
    assert.equal(bottle.instances.length, 1);
    assert.equal(getCatalogItem(bottle.instances[0].catalogId)?.shape, "bottle");
    assert.equal(getCatalogItem(bottle.instances[0].catalogId)?.dims.length, 10.83);
    assert.ok(!bottle.notes.some((note) => /popsicle|creature|quadruped|carcase/i.test(note)));

    const shelf = generateFromPrompt("shelf for a CamelBak Chute Mag 32 oz");
    assert.equal(shelf.instances.length, 1);
    assert.equal(getCatalogItem(shelf.instances[0].catalogId)?.shape, "bottle");
    assert.ok(shelf.panels.some((panel) => /post/i.test(panel.name)));
    assert.ok(!shelf.panels.some((panel) => /plywood/i.test(panel.materialId)));

    const owned = generateFromPrompt("my 11 inch Channellock pliers");
    assert.equal(getCatalogItem(owned.instances[0].catalogId)?.dims.length, 11);
    assert.match(getCatalogItem(owned.instances[0].catalogId)?.notes ?? "", /Size you typed/);

    const bird = generateFromPrompt("pink flamingo");
    assert.equal(bird.kind, "custom");
    assert.equal(bird.instances.length, 1);
    assert.equal(getCatalogItem(bird.instances[0].catalogId)?.dims.length, 24);
    assert.ok(!bird.notes.some((note) => /popsicle|quadruped|longneck/i.test(note)));
  });
});

describe("shoe rack stays the cubbies", () => {
  it("builds open shoe bays, not a stand around one shoe", () => {
    const project = generateFromPrompt("shoe rack with cubbies");
    assert.equal(project.kind, "closet");
    assert.equal(project.instances.length, 0);
    assert.equal(project.overall?.width, 36);
    assert.equal(project.overall?.height, 18);
    assert.equal(project.overall?.depth, 12);
    assert.ok(project.panels.some((panel) => /cubby divider/i.test(panel.name)));
    assert.ok(project.panels.some((panel) => /shoe shelf/i.test(panel.name)));
    assert.ok(!project.notes.some((note) => /no drawing|named product stays/i.test(note)));
  });
});
