import { test } from "node:test";
import assert from "node:assert/strict";
import { OUTBOUND_REL, cleanSubId, outboundHref, storeOf, withSubId } from "../src/lib/yard/outbound";

const OFF = { amazonTag: "", homedepotTemplate: "", lowesTemplate: "" };
const ON = { amazonTag: "yard-20", homedepotTemplate: "https://homedepot.sjv.io/c/1/2/3?u={url}", lowesTemplate: "" };

test("Buy links are nofollow + sponsored", () => {
  assert.match(OUTBOUND_REL, /\bnofollow\b/);
  assert.match(OUTBOUND_REL, /\bsponsored\b/);
});

test("Rockler and Woodcraft are recognised by the outbound module", () => {
  assert.equal(storeOf("https://www.rockler.com/search?q=dowel"), "rockler");
  assert.equal(storeOf("https://www.woodcraft.com/products/x"), "woodcraft");
  assert.equal(storeOf("https://notrockler.com.evil.io/"), "other");
});

test("sub-IDs ride only on earning links; inert links stay byte-identical", () => {
  const amz = "https://www.amazon.com/dp/B0CD7PP3R1";
  assert.equal(outboundHref(amz, OFF, "buy-list"), amz);
  assert.equal(outboundHref(amz, ON, "buy-list"), "https://www.amazon.com/dp/B0CD7PP3R1?tag=yard-20"); // F49: no Amazon sub-ID
  const hd = "https://www.homedepot.com/s/wood%20glue";
  assert.equal(outboundHref(hd, OFF, "buy-list"), hd);
  assert.match(outboundHref(hd, ON, "buy-list"), /homedepot\.sjv\.io.*subId1=buy-list/);
  assert.equal(outboundHref(amz, ON), outboundHref(amz, ON, ""));
  assert.equal(cleanSubId("buy list/<x>"), "buy-list-x");
  assert.equal(withSubId("not a url", "impact", "a"), "not a url");
  for (const n of ["amazon", "rockler", "woodcraft", "other"] as const) assert.equal(withSubId("https://x.com/a", n, "buy-list"), "https://x.com/a");
});
