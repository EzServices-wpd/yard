import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { PLANS } from "../src/lib/yard/plans.ts";
import { planPageData } from "../src/lib/yard/planPageData.ts";

// Class: every plan page is a real engine build, in the sitemap, with steps for HowTo and 3-4 FAQs.
test("plan pages build, list cuts and steps, and are in the sitemap", () => {
  const map = fs.readFileSync("public/sitemap.xml", "utf8");
  assert.ok(PLANS.length >= 10);
  for (const p of PLANS) {
    const d = planPageData(p.prompt);
    assert.ok(d.cuts.length && d.steps.length && d.svg.includes("<svg"), p.slug);
    assert.ok(p.faqs.length >= 3 && p.faqs.length <= 4, p.slug);
    assert.ok(map.includes(`/plans/${p.slug}<`), `${p.slug} in sitemap`);
  }
  const linen = planPageData(PLANS.find((p) => p.slug === "linen-closet")!.prompt).overall;
  assert.deepEqual([linen.width, linen.height, linen.depth], [31.5, 78, 16]);
});
