import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { applyInsideCount } from "./insideCount.ts";
import { classSizeWarning, factsFromProject } from "./measureTabs.ts";
import { fitBadge } from "./fitBadge.ts";
import { decodeShare, replayShare, shareFrom, shareUrl } from "./shareBuild.ts";
import { buildPlan } from "./report.ts";
import { uniqueSteps } from "./steps.ts";

function signature(project: ReturnType<typeof generateFromPrompt>): string {
  const plan = buildPlan(project);
  const cuts = plan.cutList.map((row) => `${row.name}x${row.qty}`).join("|");
  const buy = plan.bom.map((row) => `${row.name}:${row.qty}`).join("|");
  const steps = uniqueSteps(project).map((step) => step.title).join("|");
  return [project.overall.width, project.overall.height, project.overall.depth, project.primaryMaterialId, project.shopJoin ?? "", cuts, buy, steps].join("\n");
}

describe("fit badge and share", () => {
  it("linen 31.5x78x16 is green and a changed shelf count round-trips", () => {
    const base = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
    assert.equal(base.overall.width, 31.5);
    assert.equal(base.overall.height, 78);
    assert.equal(base.overall.depth, 16);
    const badge = fitBadge({ warnings: [], hasSpace: true, width: 31.5, depth: 16 });
    assert.equal(badge.tone, "green");
    assert.equal(badge.text, "Fits your space");

    const changed = applyInsideCount({ ...base, primaryMaterialId: "plywood-1-2-4x8" }, { shelves: 6 });
    const withJoin = { ...changed, shopJoin: "dowel" as const };
    const payload = shareFrom({
      prompt: withJoin.prompt,
      measure: { width: "31.5", height: "78", depth: "16", kind: "closet" },
      stockId: withJoin.primaryMaterialId,
      join: withJoin.shopJoin,
      shelves: 6,
      defaults: { stockId: "plywood-3-4-4x8", shelves: 4 },
    });
    assert.equal(payload.shelves, 6);
    assert.equal(payload.stockId, "plywood-1-2-4x8");
    assert.equal(payload.join, "dowel");
    const back = decodeShare(shareUrl(payload).split("?y=")[1]);
    assert.equal(back?.shelves, 6);
    assert.equal(back?.stockId, "plywood-1-2-4x8");
    assert.equal(back?.join, "dowel");
    const rebuilt = replayShare(back!);
    assert.equal(rebuilt.overall.width, 31.5);
    assert.equal(rebuilt.overall.height, 78);
    assert.equal(rebuilt.overall.depth, 16);
    assert.equal(signature(rebuilt), signature(withJoin));
  });

  it("a 6 inch shelf is amber from the real depth, not a book line", () => {
    const project = generateFromPrompt("bookcase 30 wide 48 tall 6 deep");
    const facts = factsFromProject(project);
    const warn = classSizeWarning(facts, project.overall.width, project.overall.depth);
    assert.equal(warn?.id, "shallow-shelf");
    const badge = fitBadge({ warnings: warn ? [warn] : [], hasSpace: false, depth: project.overall.depth });
    assert.equal(badge.tone, "amber");
    assert.equal(badge.text, "Shelves 6\u2033 deep \u2014 sized for spices, small jars and paperbacks");
    assert.equal(badge.field, "depth");
    assert.doesNotMatch(badge.text, /good for books/);
  });
});
