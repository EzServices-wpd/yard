import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { classSizeWarning, factsFromProject } from "./measureTabs.ts";
import { fitBadge } from "./fitBadge.ts";
import { decodeShare, encodeShare } from "./shareBuild.ts";

describe("fit badge and share", () => {
  it("linen 31.5x78x16 is green and the share link rebuilds those sizes", () => {
    const project = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
    assert.equal(project.overall.width, 31.5);
    assert.equal(project.overall.height, 78);
    assert.equal(project.overall.depth, 16);
    const badge = fitBadge({ warnings: [], hasSpace: true, width: 31.5, depth: 16 });
    assert.equal(badge.tone, "green");
    assert.equal(badge.text, "Fits your space");
    const token = encodeShare({
      prompt: "linen closet 31.5 wide 78 tall 16 deep",
      measure: { width: "31.5", height: "78", depth: "16", kind: "closet" },
    });
    const back = decodeShare(token);
    assert.equal(back?.measure.width, "31.5");
    assert.equal(back?.measure.height, "78");
    assert.equal(back?.measure.depth, "16");
    const rebuilt = generateFromPrompt(back!.prompt);
    assert.equal(rebuilt.overall.width, 31.5);
    assert.equal(rebuilt.overall.height, 78);
    assert.equal(rebuilt.overall.depth, 16);
  });

  it("a shallow bookcase is amber with the shallow-shelf line", () => {
    const project = generateFromPrompt("bookcase 30 wide 48 tall 6 deep");
    const facts = factsFromProject(project);
    const warn = classSizeWarning(facts, project.overall.width, project.overall.depth);
    assert.equal(warn?.id, "shallow-shelf");
    const badge = fitBadge({ warnings: warn ? [warn] : [], hasSpace: false, depth: project.overall.depth });
    assert.equal(badge.tone, "amber");
    assert.match(badge.text, /tight for towels/);
    assert.equal(badge.field, "depth");
  });
});
