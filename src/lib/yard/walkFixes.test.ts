import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { uniqueSteps } from "./steps.ts";
import { decodeShare, replayShare, shareFrom, shareUrl } from "./shareBuild.ts";

describe("live walk rules", () => {
  it("a pallet is the stock, and a 1x4 chair keeps a seat and a back", () => {
    const bed = generateFromPrompt("dog bed from a pallet");
    assert.equal(bed.primaryMaterialId, "pallet-board");
    assert.equal(/popsicle/.test(bed.primaryMaterialId), false);
    const chair = generateFromPrompt("kitchen chair from 1x4");
    assert.match(chair.primaryMaterialId, /lumber-1x4/);
    assert.equal(chair.panels.some((p) => /seat/i.test(p.name)), true);
    assert.equal(chair.panels.some((p) => /back/i.test(p.name)), true);
  });

  it("a cardboard robot stays a figure and is not a batten cloud", () => {
    const robot = generateFromPrompt("cardboard robot");
    assert.equal(robot.kind, "figure");
    assert.match(robot.primaryMaterialId, /cardboard/);
    assert.ok(robot.instances.length <= 16);
    assert.equal(/Ripped into/.test(robot.notes.join(" ")), false);
  });

  it("a cat tree does not set the base on the uprights after the posts are on the base", () => {
    const steps = uniqueSteps(generateFromPrompt("cat tree 5 feet"));
    const text = steps.map((s) => s.title).join(" | ");
    assert.equal(/Set the Base on the uprights/i.test(text), false);
    assert.match(text, /base/i);
  });

  it("a linen share link opens the workspace and keeps 0 drawers", () => {
    const payload = shareFrom({
      prompt: "linen closet 31.5 wide 78 tall 16 deep",
      measure: { width: "31.5", height: "78", depth: "16", kind: "closet" },
      drawers: 0,
    });
    const url = shareUrl(payload);
    assert.match(url, /\/workspace\?y=/);
    const back = decodeShare(url.split("?y=")[1]);
    assert.equal(back?.drawers, 0);
    const rebuilt = replayShare(back!);
    assert.equal(rebuilt.overall.width, 31.5);
    assert.equal(rebuilt.overall.height, 78);
    assert.equal(rebuilt.overall.depth, 16);
    assert.equal(rebuilt.panels.filter((p) => p.type === "drawer").length, 0);
  });
});
