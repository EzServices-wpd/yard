import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { meshKind } from "./geometry.ts";
import { shopLinks } from "./shop.ts";
import { measuredProduct, stockOffer, withStoreHit } from "./stockQuery.ts";

describe("end user critiques of stock", () => {
  it("Maya: a Dasani search is the real bottle, not a tube, and she does not have to measure it", () => {
    const item = stockOffer("dasani water bottles");
    assert.ok(item);
    assert.equal(item.shape, "bottle");
    assert.notEqual(item.formFactor, "tube");
    assert.equal(item.dims.length, 8.86);
    assert.equal(item.dims.diameter, 2.58);
    assert.match(item.notes ?? "", /8\.86/);
    assert.equal(item.unitCostUsd, undefined);
    const links = shopLinks(item.searchQuery || item.name);
    assert.equal(links.length, 4);
    assert.ok(links.every((link) => !/\/dp\//.test(link.href)));
  });

  it("Andre: scraps stay the board he has, and a bare 2x4 is not a made-up object", () => {
    const scrap = stockOffer("pile of 2x4 scraps all 5x5 inches");
    assert.ok(scrap);
    assert.equal(scrap.dims.length, 5);
    assert.equal(scrap.dims.width, 3.5);
    assert.equal(scrap.dims.height, 1.5);
    assert.equal(scrap.unitCostUsd, 0);
    assert.match(scrap.notes ?? "", /actually/i);
    const deck = stockOffer("I already own one 5/4 x 6 x 53 cedar deck board. Make a boot scraper from that board.");
    assert.ok(deck);
    assert.equal(deck.dims.length, 53);
    assert.equal(deck.dims.width, 5.5);
    assert.equal(deck.dims.height, 1);
    assert.equal(deck.unitCostUsd, 0);
    assert.match(deck.name, /5\/4/);
    assert.equal(stockOffer("2x4"), null);
    assert.equal(stockOffer("popsicle stick"), null);
  });

  it("Priya: a tank, a screwdriver, goggles, and a frog are all stock, and none pretend to be a checked drawing", () => {
    const tank = stockOffer("scuba tank");
    const driver = stockOffer("phillips screwdriver");
    const goggles = stockOffer("swimming goggles");
    const frog = stockOffer("ceramic frog");
    assert.equal(tank?.shape, "tank");
    assert.equal(driver?.shape, "tool");
    assert.equal(goggles?.shape, "eyewear");
    assert.equal(frog?.shape, "object");
    for (const item of [tank, driver, goggles, frog]) {
      assert.ok(item);
      assert.notEqual(item.formFactor, "tube");
      assert.equal(item.unitCostUsd, undefined);
      assert.match(item.notes ?? "", /not this|no drawing/i);
    }
    const pictured = withStoreHit(tank!, {
      title: "Diving cylinder",
      image: "https://example.com/tank.jpg",
    });
    assert.equal(pictured.image, "https://example.com/tank.jpg");
    assert.equal(pictured.name, "scuba tank");
    assert.equal(meshKind(pictured), "photo");
    assert.match(pictured.notes ?? "", /reference photo/i);
  });

  it("Elena: the inches she measured win, and the bottle stays a bottle", () => {
    const item = measuredProduct("dasani water bottles", 8, 2.5, true, {
      title: "Dasani Purified Water - 20 fl oz Bottle",
      merchant: "Walgreens",
      priceUsd: 2.59,
    });
    assert.ok(item);
    assert.equal(item.shape, "bottle");
    assert.notEqual(item.formFactor, "tube");
    assert.equal(item.dims.length, 8);
    assert.equal(item.dims.diameter, 2.5);
    assert.equal(item.unitCostUsd, 2.59);
    assert.equal(item.exampleUrl, undefined);
  });

  it("random products keep a real family instead of one shared box", () => {
    const ball = stockOffer("basketball");
    assert.equal(ball?.shape, "ball");
    assert.equal(ball?.dims.diameter, 9.43);
    const can = stockOffer("watering can");
    assert.equal(can?.shape, "bucket");
    assert.notEqual(can?.shape, "can");
    assert.match(can?.notes ?? "", /not a drink can/i);
    const bucket = stockOffer("5 gallon bucket");
    assert.equal(bucket?.dims.length, 14.5);
    assert.equal(bucket?.dims.diameter, 11.9);
    const driver = stockOffer("philips screw driver");
    assert.equal(driver?.shape, "tool");
    const ketchup = stockOffer("heinz ketchup");
    assert.equal(ketchup?.shape, "bottle");
    const towel = stockOffer("paper towel roll");
    assert.ok(towel == null || towel.shape === "roll");
    const brick = stockOffer("brick");
    assert.equal(brick?.shape, "block");
    assert.notEqual(brick?.id, "lego-2x4");
    const block = stockOffer("cinder block");
    assert.equal(block?.dims.length, 16);
    assert.equal(block?.dims.width, 8);
    assert.equal(stockOffer("popsicle stick"), null);
    assert.notEqual(stockOffer("canvas drop cloth")?.shape, "can");
  });

  it("the leftover boxes are real pieces you can build with", () => {
    const expectPiece = (query: string, shape: string, length: number) => {
      const item = stockOffer(query);
      assert.ok(item, query);
      assert.equal(item.shape, shape, query);
      assert.equal(item.dims.length, length, query);
      assert.notEqual(item.formFactor, "tube", query);
      assert.equal(item.unitCostUsd, undefined, query);
      const generic = item.shape === "object" && item.dims.length === 6 && item.dims.width === 4 && item.dims.height === 3;
      assert.equal(generic, false, query);
    };
    expectPiece("wd-40", "can", 7.75);
    expectPiece("sharpie marker", "tool", 5.5);
    expectPiece("flashlight", "tool", 6.5);
    expectPiece("tape measure", "roll", 1.5);
    expectPiece("extension cord", "roll", 2.5);
    expectPiece("canvas drop cloth", "object", 108);
    expectPiece("sawhorse", "object", 36);
    expectPiece("cat tree", "object", 60);
    expectPiece("rubber duck", "object", 4.2);
    expectPiece("garden gnome", "object", 12);
  });
});
