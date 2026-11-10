import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countPlural } from "./shopPlural.ts";

describe("countPlural", () => {
  it("says shelves, bodies, and chassis, and leaves regular words regular", () => {
    assert.equal(countPlural("shelf", 2), "shelves");
    assert.equal(countPlural("body", 2), "bodies");
    assert.equal(countPlural("chassis", 2), "chassis");
    assert.equal(countPlural("chassis", 150), "chassis");
    assert.equal(countPlural("leg", 4), "legs");
    assert.equal(countPlural("post", 2), "posts");
    assert.equal(countPlural("shelf", 1), "shelf");
    assert.equal(countPlural("body", 1), "body");
    assert.equal(countPlural("chassis", 1), "chassis");
  });
});
