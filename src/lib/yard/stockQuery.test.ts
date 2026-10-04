import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCatalogItem } from "./catalog.ts";
import { rememberCatalogItem } from "./foundStock.ts";
import { localStockQuery, measuredProduct, stockHint, stockOffer, typedStockQuery, withStoreHit } from "./stockQuery.ts";
import { promptWithHomeStock } from "./promptHelpers.ts";

describe("home stock chip", () => {
  it("fills a sentence that names no stock", () => {
    assert.equal(
      promptWithHomeStock("laundry hamper cabinet 18 wide 32 tall 16 deep", "from 3/4 plywood"),
      "laundry hamper cabinet 18 wide 32 tall 16 deep from 3/4 plywood",
    );
    assert.equal(
      promptWithHomeStock("plant stand 18 wide 30 tall", "from 1/2 inch dowel"),
      "plant stand 18 wide 30 tall from 1/2 inch dowel",
    );
  });

  it("switching class chips replaces the previous class clause", () => {
    assert.equal(
      promptWithHomeStock("plant stand 18 wide 30 tall from 3/4 plywood", "from 1/2 inch dowel"),
      "plant stand 18 wide 30 tall from 1/2 inch dowel",
    );
  });

  it("keeps a stock the sentence already names", () => {
    assert.equal(
      promptWithHomeStock("cardboard birdhouse 8 wide 10 tall", "from 3/4 plywood"),
      "cardboard birdhouse 8 wide 10 tall",
    );
    assert.equal(
      promptWithHomeStock("1/2 inch dowel plant stand 18 wide 30 tall", "from popsicle sticks"),
      "1/2 inch dowel plant stand 18 wide 30 tall",
    );
  });
});

describe("stock query", () => {
  it("turns 2x4 scraps said as 5x5 into a real 2x4 at 5 inches", () => {
    const item = localStockQuery("pile of 2x4 scraps all 5x5 inches");
    assert.ok(item);
    assert.equal(item?.dims.length, 5);
    assert.equal(item?.dims.width, 3.5);
    assert.equal(item?.dims.height, 1.5);
    assert.equal(item?.unitCostUsd, 0);
    assert.match(item?.notes ?? "", /not 5×5|not 5x5|actually/i);
    assert.match(item?.notes ?? "", /\$0/);
  });

  it("asks for a length when the scraps have none", () => {
    assert.equal(localStockQuery("pile of 2x4 scraps"), null);
    assert.match(stockHint("pile of 2x4 scraps") ?? "", /how long/i);
  });

  it("keeps a bought 10 ft 2x6 as that length without a fake price", () => {
    const item = localStockQuery("2x6 10 foot");
    assert.equal(item?.dims.length, 120);
    assert.equal(item?.dims.width, 5.5);
    assert.equal(item?.unitCostUsd, undefined);
  });

  it("uses a measured bottle as that bottle, not a pipe", () => {
    const item = typedStockQuery("dasani water bottles 8 inch tall 2.5 inch diameter");
    assert.ok(item);
    assert.equal(item?.dims.length, 8);
    assert.equal(item?.dims.diameter, 2.5);
    assert.equal(item?.shape, "bottle");
    assert.notEqual(item?.formFactor, "tube");
    assert.match(item?.name ?? "", /dasani/i);
    assert.match(item?.notes ?? "", /typed/i);
  });

  it("returns a bare Dasani search as the 16.9 oz bottle", () => {
    const item = stockOffer("dasani water bottles");
    assert.ok(item);
    assert.equal(item?.shape, "bottle");
    assert.equal(item?.dims.length, 8.86);
    assert.equal(item?.dims.diameter, 2.58);
    assert.match(item?.name ?? "", /16\.9 oz/);
    assert.match(item?.notes ?? "", /8 7\/8/);
    assert.notEqual(item?.formFactor, "tube");
  });

  it("uses the 20 oz Dasani spec when the size is named", () => {
    const item = stockOffer("dasani 20 oz bottle");
    assert.equal(item?.dims.length, 8.95);
    assert.equal(item?.dims.diameter, 2.89);
  });

  it("turns a named product that is not in the library into stock", () => {
    const driver = stockOffer("phillips screwdriver");
    assert.equal(driver?.shape, "tool");
    assert.notEqual(driver?.formFactor, "tube");
    const tank = stockOffer("scuba tank");
    assert.equal(tank?.shape, "tank");
    assert.equal(tank?.dims.length, 26);
    assert.equal(tank?.dims.diameter, 7.25);
    const goggles = stockOffer("swimming goggles");
    assert.equal(goggles?.shape, "eyewear");
    const frog = stockOffer("ceramic frog");
    assert.equal(frog?.shape, "object");
    assert.match(frog?.notes ?? "", /listing photo/i);
  });

  it("keeps a library stick as the library stick", () => {
    assert.equal(stockOffer("popsicle stick"), null);
  });

  it("keeps a listing photo on the piece", () => {
    const base = stockOffer("scuba tank");
    assert.ok(base);
    const next = withStoreHit(base!, {
      title: "Aluminum Scuba Tank",
      merchant: "Amazon",
      image: "https://example.com/tank.jpg",
      priceUsd: 180,
    });
    assert.equal(next.image, "https://example.com/tank.jpg");
    assert.equal(next.shape, "tank");
    assert.match(next.name, /Scuba Tank/);
    assert.match(next.notes ?? "", /picture/i);
  });

  it("uses a usual bottle when the brand has no drawing", () => {
    const item = stockOffer("poland spring water bottle");
    assert.equal(item?.shape, "bottle");
    assert.equal(item?.dims.length, 8.02);
    assert.equal(item?.dims.diameter, 2.57);
    assert.match(item?.notes ?? "", /type a size to match yours/i);
  });

  it("offers a 1x6 the seed library does not sell, without a fake price", () => {
    const item = stockOffer("1x6");
    assert.ok(item);
    assert.equal(item?.dims.length, 96);
    assert.equal(item?.dims.width, 5.5);
    assert.equal(item?.dims.height, 0.75);
    assert.equal(item?.unitCostUsd, undefined);
    assert.equal(stockOffer("2x4"), null);
  });

  it("remembers a measured bottle under the real listing name", () => {
    const item = measuredProduct("dasani water bottles", 8, 2.5, true, {
      title: "Dasani Purified Water - 20 fl oz Bottle",
      brand: "DASANI",
      merchant: "Walgreens",
      priceUsd: 2.59,
    });
    assert.ok(item);
    assert.equal(item?.dims.length, 8);
    assert.equal(item?.dims.diameter, 2.5);
    assert.equal(item?.shape, "bottle");
    assert.notEqual(item?.formFactor, "tube");
    assert.equal(item?.unitCostUsd, 2.59);
    assert.match(item?.name ?? "", /Dasani Purified Water/);
    assert.match(item?.notes ?? "", /Walgreens/);
    assert.equal(item?.exampleUrl, undefined);
    rememberCatalogItem(item!);
    assert.equal(getCatalogItem(item!.id)?.name, item?.name);
  });
});
