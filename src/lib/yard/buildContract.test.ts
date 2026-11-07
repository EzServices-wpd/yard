/**
 * Shadow build graph: three families compile back to the live model, steps, and Buy.
 * The cases are representatives of a form, not a new honesty class per prompt.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { offline } from "../../../scripts/eval-lib.ts";
import { contactReport } from "./contact.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { structureIssues } from "./structureCheck.ts";
import { panelJoints, stickJoints } from "./modelJoints.ts";
import { JOINT_LIBRARY, jointPattern } from "./jointLibrary.ts";
import {
  BUILD_GRAPH_VERSION,
  compileBuildGraph,
  liftBuildGraph,
  memberFact,
  panelFact,
  planFacts,
  quarterPlyProblems,
  type BuildFamily,
  type GraphPart,
  type YardBuildGraph,
} from "./buildContract.ts";
import type { Panel } from "./types.ts";

const CASEWORK = "bookcase 36 wide 84 tall 12 deep";
const FRAME = "potting bench with a lower shelf";
const LANDMARK = "eiffel tower";

function roundTrip(prompt: string, family: BuildFamily) {
  const project = generateFromPrompt(prompt);
  const plan = buildPlan(project);
  const graph = liftBuildGraph(project, plan, family);
  const compiled = compileBuildGraph(graph);
  const facts = planFacts(plan);
  assert.equal(graph.version, BUILD_GRAPH_VERSION);
  assert.equal(graph.shadow, true);
  assert.equal(graph.family, family);
  assert.equal("prompt" in graph, false);
  assert.equal(compiled.model.name, project.name);
  assert.deepEqual(compiled.model.envelope, { ...project.overall });
  assert.deepEqual(compiled.model.panels, project.panels.map(panelFact));
  assert.deepEqual(compiled.model.members, project.instances.map(memberFact));
  assert.deepEqual(compiled.steps, facts.steps);
  assert.deepEqual(plan.instructions.map((step) => step.step), facts.steps.map((step) => step.step));
  assert.deepEqual(compiled.buy, facts.buy);
  assert.equal(graph.constraints.find((row) => row.kind === "contact")?.safeJoinery, false);
  for (const joint of graph.joints) {
    if (joint.basis === "contact") {
      assert.equal(joint.reviewedJoin, false);
      assert.equal(joint.patternId, undefined);
    } else {
      assert.equal(joint.reviewedJoin, !!jointPattern(joint.patternId ?? ""));
    }
  }
  const touch = contactReport(project);
  const contact = graph.constraints.find((row) => row.kind === "contact");
  assert.equal(contact?.pieces, touch.pieces);
  assert.equal(contact?.components, touch.components);
  assert.deepEqual(
    graph.constraints.find((row) => row.kind === "structure")?.issues,
    structureIssues(project).map((issue) => ({ code: issue.code, part: issue.part })),
  );
  for (const op of graph.operations) {
    for (const id of op.partIds) assert.ok(graph.parts.some((part) => part.id === id), id);
    if (op.labels.some((label) => label === "*" || label.toLowerCase() === "all")) {
      assert.equal(op.partIds.length, graph.parts.length);
    }
  }
  assert.deepEqual(quarterPlyProblems(graph.parts), []);
  return { project, plan, graph, compiled };
}

function roles(graph: YardBuildGraph): string[] {
  return graph.parts.map((part) => part.role).sort();
}

describe("joint library", () => {
  it("names only declared patterns, each with a provenance, and contact is not one of them", () => {
    assert.equal(new Set(JOINT_LIBRARY.map((pattern) => pattern.id)).size, JOINT_LIBRARY.length);
    for (const pattern of JOINT_LIBRARY) {
      assert.ok(pattern.provenance.includes("src/lib/yard/types.ts"), pattern.id);
      assert.ok(pattern.summary.length > 20, pattern.id);
      assert.notEqual(pattern.id, "contact");
      assert.notEqual(pattern.kind, "butt" as string);
    }
    assert.equal(jointPattern("dado")?.role, "shop");
    assert.equal(jointPattern("hinge")?.role, "hardware");
  });
});

describe("build graph compiles from its own facts", () => {
  it("orders steps, quantities, and part sizes from the graph", () => {
    const side: GraphPart = {
      source: "panel",
      role: "upright",
      id: "side",
      type: "upright",
      name: "Side",
      materialId: "plywood-3-4-4x8",
      position: { x: 0, y: 0, z: 0 },
      size: { width: 0.75, height: 8, depth: 4 },
    };
    const bottom: GraphPart = {
      source: "panel",
      role: "bottom",
      id: "bottom",
      type: "bottom",
      name: "Bottom",
      materialId: "plywood-3-4-4x8",
      position: { x: 0, y: 0, z: 0 },
      size: { width: 10, height: 0.75, depth: 4 },
    };
    const graph: YardBuildGraph = {
      version: 1,
      shadow: true,
      id: "hand",
      name: "Two boards",
      family: "casework",
      use: "human",
      origin: "panels",
      envelope: { width: 10, height: 8, depth: 4 },
      primaryMaterialId: "plywood-3-4-4x8",
      parts: [side, bottom],
      joints: [{ id: "j1", a: "bottom", b: "side", basis: "declared", patternId: "dado", reviewedJoin: true }],
      constraints: [],
      operations: [
        { id: "later", order: 2, title: "Stand the side", description: "Stand it on the bottom.", labels: ["Side"], partIds: ["side"] },
        { id: "first", order: 1, title: "Cut", description: "Cut both.", labels: ["*"], partIds: ["bottom", "side"] },
      ],
      stock: [{ id: "s1", name: "3/4\" Plywood 4×8", quantity: 1, unit: "sheet", catalogId: "plywood-3-4-4x8", partIds: ["bottom", "side"] }],
      assumptions: [],
    };
    const compiled = compileBuildGraph(graph);
    assert.deepEqual(compiled.steps.map((step) => step.title), ["Cut", "Stand the side"]);
    assert.deepEqual(compiled.steps.map((step) => step.step), [1, 2]);
    assert.equal(compiled.buy[0].quantity, 1);
    assert.equal(compiled.model.panels[0].size.width, 0.75);
    graph.stock[0].quantity = 4;
    bottom.size = { ...bottom.size, width: 12 };
    const again = compileBuildGraph(graph);
    assert.equal(again.buy[0].quantity, 4);
    assert.equal(again.model.panels.find((part) => part.id === "bottom")?.size.width, 12);
    assert.throws(() => compileBuildGraph({ ...graph, version: 2 } as YardBuildGraph), /version 2/);
  });

  it("keeps 1/4\" plywood to a back or a drawer bottom", () => {
    const sheet = (name: string, type: Panel["type"], drawerPart?: Panel["drawerPart"]): GraphPart => ({
      source: "panel",
      role: type,
      id: name,
      type,
      name,
      materialId: "plywood-1-4-4x8",
      position: { x: 0, y: 0, z: 0 },
      size: { width: 10, height: 10, depth: 0.25 },
      ...(drawerPart ? { drawerPart } : {}),
    });
    assert.deepEqual(quarterPlyProblems([sheet("Back", "back"), sheet("Drawer bottom", "drawer", "bottom")]), []);
    assert.deepEqual(quarterPlyProblems([sheet("Shelf", "shelf"), sheet("Divider", "divider")]), ["Shelf", "Divider"]);
  });
});

describe("three families compile back to today's model, steps, and Buy", () => {
  it("casework, a frame with a shelf, and the Eiffel landmark", () => {
    offline(() => {
      const casework = roundTrip(CASEWORK, "casework");
      const frame = roundTrip(FRAME, "frame-storage");
      const landmark = roundTrip(LANDMARK, "landmark");

      assert.equal(casework.graph.use, "human");
      assert.equal(casework.graph.origin, "panels");
      assert.equal(casework.graph.envelope.width, 36);
      assert.equal(casework.graph.envelope.height, 84);
      assert.equal(casework.graph.envelope.depth, 12);
      assert.ok(casework.graph.parts.some((part) => part.role === "upright"));
      assert.ok(casework.graph.parts.some((part) => part.role === "shelf"));
      assert.ok(casework.graph.parts.some((part) => part.role === "back"));
      assert.equal(casework.graph.parts.some((part) => part.source === "member"), false);
      assert.equal(casework.graph.spec?.noun, "Bookcase");
      assert.equal(casework.graph.spec?.typedWidth, true);
      assert.equal(casework.graph.spec?.width, 36);
      assert.equal(JSON.stringify(casework.graph).toLowerCase().includes(CASEWORK), false);
      const back = casework.graph.parts.find((part) => part.source === "panel" && part.type === "back");
      const backer = casework.graph.stock.find((line) => /^plywood-1-4/.test(line.catalogId ?? ""));
      assert.ok(back && backer?.partIds.includes(back.id), "the 1/4\" Buy line names the back part");
      assert.equal(casework.graph.joints.some((joint) => joint.reviewedJoin), false);
      assert.equal(casework.graph.joints.filter((joint) => joint.basis === "contact").length, panelJoints(casework.project.panels).length);

      assert.equal(frame.graph.use, "human");
      assert.equal(frame.graph.origin, "panels");
      const frameRoles = frame.graph.parts.map((part) => part.role);
      assert.ok(frameRoles.filter((role) => role === "upright").length >= 4);
      assert.ok(frameRoles.includes("rail"));
      assert.ok(frameRoles.includes("top"));
      assert.ok(frameRoles.includes("shelf"));
      assert.equal(frame.graph.spec?.noun, "Potting bench");
      assert.equal(frame.graph.joints.some((joint) => joint.reviewedJoin), false);

      assert.equal(landmark.graph.use, "miniature");
      assert.equal(landmark.graph.origin, "structure-graph");
      assert.equal(landmark.graph.fastener, "glue");
      assert.equal(landmark.graph.parts.length, landmark.project.instances.length);
      assert.ok(landmark.graph.parts.length > 100);
      assert.ok(landmark.graph.parts.every((part) => part.source === "member" && part.join === "glue"));
      for (const role of ["leg", "brace", "rail", "ring"]) assert.ok(landmark.graph.parts.some((part) => part.role === role), role);
      assert.equal(landmark.graph.joints.some((joint) => joint.reviewedJoin), false);
      assert.equal(landmark.graph.joints.filter((joint) => joint.basis === "contact").length, stickJoints(landmark.project.instances).length);
    });
  });

  it("the same casework form holds plywood and oak; the landmark keeps its tower when the stick changes", () => {
    offline(() => {
      const lift = (prompt: string, family: BuildFamily) => {
        const project = generateFromPrompt(prompt);
        return liftBuildGraph(project, buildPlan(project), family);
      };
      const ply = lift(CASEWORK, "casework");
      const half = lift(`${CASEWORK} in 1/2 inch plywood`, "casework");
      const oak = lift(`${CASEWORK} from oak`, "casework");
      assert.deepEqual(roles(half), roles(ply));
      assert.deepEqual(roles(oak), roles(ply));
      assert.deepEqual(half.envelope, ply.envelope);
      assert.deepEqual(oak.envelope, ply.envelope);
      assert.notEqual(half.primaryMaterialId, ply.primaryMaterialId);
      assert.notEqual(oak.primaryMaterialId, ply.primaryMaterialId);
      for (const graph of [ply, half, oak]) {
        assert.deepEqual(quarterPlyProblems(graph.parts), []);
        const back = graph.parts.find((part) => part.source === "panel" && part.type === "back");
        assert.ok(back && /^plywood-1-4/.test(back.materialId));
      }
      const buyNames = (graph: YardBuildGraph) => graph.stock.map((line) => `${line.quantity} ${line.name}`).join("|");
      assert.notEqual(buyNames(ply), buyNames(oak));

      const popsicle = lift(LANDMARK, "landmark");
      const toothpick = lift("eiffel tower from toothpicks", "landmark");
      assert.equal(popsicle.use, "miniature");
      assert.equal(toothpick.use, "miniature");
      assert.equal(popsicle.origin, "structure-graph");
      assert.equal(toothpick.origin, "structure-graph");
      assert.deepEqual(
        [...new Set(popsicle.parts.map((part) => part.role))].sort(),
        [...new Set(toothpick.parts.map((part) => part.role))].sort(),
      );
      assert.ok(Math.abs(popsicle.envelope.height - toothpick.envelope.height) < 1);
      assert.ok(Math.abs(popsicle.envelope.width - toothpick.envelope.width) < 1);
      assert.notEqual(popsicle.parts.length, toothpick.parts.length);
      assert.notEqual(popsicle.primaryMaterialId, toothpick.primaryMaterialId);
      assert.equal(toothpick.parts.every((part) => part.source === "member"), true);
    });
  });
});

describe("the shadow graph stays off the live path", () => {
  it("does not read the length reader, the prompt entry, or the AI reader flags", () => {
    const src = readFileSync(new URL("./buildContract.ts", import.meta.url), "utf8");
    const library = readFileSync(new URL("./jointLibrary.ts", import.meta.url), "utf8");
    assert.doesNotMatch(src, /lengthReader|promptMain|YARD_AI_READER|VITE_PUBLIC_AI_READER/);
    assert.doesNotMatch(library, /lengthReader|promptMain|YARD_AI_READER|VITE_PUBLIC_AI_READER/);
    const live = readFileSync(new URL("./promptMain.ts", import.meta.url), "utf8");
    assert.equal(live.includes("liftBuildGraph"), false);
    assert.equal(live.includes("compileBuildGraph"), false);
  });
});
