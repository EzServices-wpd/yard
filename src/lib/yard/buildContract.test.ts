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
import { CONSTRUCTION_READINGS, JOINT_LIBRARY, constructionReading, jointPattern } from "./jointLibrary.ts";
import {
  BUILD_GRAPH_VERSION,
  compileBuildGraph,
  liftBuildGraph,
  memberFact,
  panelFact,
  planFacts,
  quarterPlyProblems,
  readingForPanels,
  substituteStock,
  type BuildFamily,
  type GraphPart,
  type YardBuildGraph,
} from "./buildContract.ts";
import type { BuildPlan, Panel, YardProject } from "./types.ts";

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
    const report = readFileSync(new URL("./report.ts", import.meta.url), "utf8");
    assert.equal(report.includes("liftBuildGraph"), false);
    assert.equal(report.includes("compileBuildGraph"), false);
  });
});

function pair(joint: { a: string; b: string }): string {
  return [joint.a, joint.b].sort().join("|");
}

describe("construction readings", () => {
  it("renames useOf so the helper is not a React hook", () => {
    const src = readFileSync(new URL("./buildContract.ts", import.meta.url), "utf8");
    assert.doesNotMatch(src, /\buseOf\b/);
    assert.doesNotMatch(src, /\bfunction use[A-Z0-9]/);
    assert.match(src, /function projectBuildUse/);
  });

  it("names a reading only for a library pattern, and contact is still not a pattern", () => {
    for (const reading of CONSTRUCTION_READINGS) {
      assert.ok(jointPattern(reading.patternId), reading.id);
      assert.equal(constructionReading(reading.id)?.id, reading.id);
      assert.ok(reading.provenance.includes("src/lib/yard") || reading.provenance.includes("Panel.joints") || reading.provenance.includes("solve.") || reading.provenance.includes("hingedLeaf") || reading.provenance.includes("formTemplates") || reading.provenance.includes("fittedBuild") || reading.provenance.includes("petGear") || reading.provenance.includes("recipeBuild") || reading.provenance.includes("tableFitted"), reading.id);
      assert.ok(reading.notWhen.length > 20, reading.id);
    }
  });

  it("keeps pin shelves, a screwed back, and glue sticks as contact", () => {
    offline(() => {
      const book = roundTrip(CASEWORK, "casework");
      const shelfIds = new Set(book.graph.parts.filter((part) => part.role === "shelf").map((part) => part.id));
      const shelfJoints = book.graph.joints.filter((joint) => shelfIds.has(joint.a) || shelfIds.has(joint.b));
      assert.ok(shelfJoints.length > 0);
      assert.ok(shelfJoints.every((joint) => joint.basis === "contact" && joint.reviewedJoin === false && joint.patternId === undefined));
      const back = book.graph.parts.find((part) => part.source === "panel" && part.type === "back")!;
      const backJoints = book.graph.joints.filter((joint) => joint.a === back.id || joint.b === back.id);
      assert.ok(backJoints.length > 0);
      assert.ok(backJoints.every((joint) => joint.basis === "contact" && joint.contactClass === "back" && joint.patternId === undefined));
      assert.equal(book.graph.joints.some((joint) => joint.reviewedJoin), false);

      const tower = roundTrip(LANDMARK, "landmark");
      assert.equal(tower.graph.joints.some((joint) => joint.reviewedJoin), false);
      assert.ok(tower.graph.joints.every((joint) => joint.basis === "contact" && joint.contactClass === "frame"));
      assert.equal(tower.graph.fastener, "glue");
    });
  });

  it("declares a hinge on a door the Buy list hangs, and a ridge miter the cut note already wrote", () => {
    offline(() => {
      const cabinet = roundTrip("bookcase with a door", "casework");
      const hinges = cabinet.graph.joints.filter((joint) => joint.patternId === "hinge");
      assert.equal(hinges.length, 1);
      assert.equal(hinges[0].basis, "declared");
      assert.equal(hinges[0].reviewedJoin, true);
      assert.equal(hinges[0].reading, "hinge-leaf");
      const door = cabinet.project.panels.find((panel) => panel.type === "door")!;
      const hostId = hinges[0].a === door.id ? hinges[0].b : hinges[0].a;
      const host = cabinet.project.panels.find((panel) => panel.id === hostId);
      assert.equal(host?.type, "upright");
      assert.equal(cabinet.graph.joints.filter((joint) => joint.basis === "contact" && pair(joint) === pair(hinges[0])).length, 0);
      const shelves = cabinet.graph.joints.filter((joint) => {
        const part = cabinet.project.panels.find((panel) => panel.id === joint.a || panel.id === joint.b);
        return part?.type === "shelf" && (joint.a === part.id || joint.b === part.id);
      });
      assert.ok(shelves.every((joint) => joint.basis === "contact"));

      const house = roundTrip("birdhouse", "casework");
      const miters = house.graph.joints.filter((joint) => joint.reading === "ridge-miter");
      assert.equal(miters.length, 1);
      assert.equal(miters[0].patternId, "miter");
      const roofs = house.project.panels.filter((panel) => panel.name === "Roof panel");
      assert.equal(roofs.length, 2);
      assert.equal(pair(miters[0]), pair({ a: roofs[0].id, b: roofs[1].id }));
      const gable = house.graph.joints.filter((joint) => house.project.panels.find((panel) => panel.id === joint.a || panel.id === joint.b)?.name.endsWith("gable"));
      assert.ok(gable.length > 0);
      assert.ok(gable.every((joint) => joint.basis === "contact" && joint.patternId === undefined));
    });
  });

  it("keeps a panel-field rabbet and notch, and does not also store that pair as contact", () => {
    offline(() => {
      const medicine = roundTrip("medicine cabinet", "casework");
      const rabbets = medicine.graph.joints.filter((joint) => joint.patternId === "rabbet");
      assert.equal(rabbets.length, 1);
      assert.equal(rabbets[0].reading, undefined);
      assert.equal(rabbets[0].reviewedJoin, true);
      const mirror = medicine.project.panels.find((panel) => panel.type === "mirror")!;
      assert.equal(rabbets[0].a === mirror.id || rabbets[0].b === mirror.id, true);
      assert.equal(medicine.graph.joints.some((joint) => joint.basis === "contact" && pair(joint) === pair(rabbets[0])), false);
      assert.ok(medicine.graph.joints.some((joint) => joint.patternId === "hinge" && joint.reading === "hinge-leaf"));

      const coop = roundTrip("chicken coop", "frame-storage");
      const notches = coop.graph.joints.filter((joint) => joint.patternId === "notch");
      assert.ok(notches.length >= 4);
      assert.ok(notches.every((joint) => joint.basis === "declared" && joint.reviewedJoin && joint.reading === undefined));
      for (const notch of notches) {
        assert.equal(coop.graph.joints.some((joint) => joint.basis === "contact" && pair(joint) === pair(notch)), false);
      }
      const hinged = coop.project.panels.filter((panel) => panel.hinged);
      assert.ok(hinged.length >= 1);
      for (const panel of hinged) {
        const hit = coop.graph.joints.find((joint) => joint.patternId === "hinge" && (joint.a === panel.id || joint.b === panel.id));
        assert.ok(hit);
        assert.equal(hit?.reading, undefined);
      }
    });
  });

  it("declares a dado only when an end is let into a face", () => {
    const side: Panel = {
      id: "side",
      type: "upright",
      name: "Side",
      materialId: "plywood-3-4-4x8",
      position: { x: 0, y: 0, z: 0 },
      size: { width: 0.75, height: 10, depth: 8 },
    };
    const housed: Panel = {
      id: "shelf",
      type: "shelf",
      name: "Shelf",
      materialId: "plywood-3-4-4x8",
      position: { x: 0.5, y: 4, z: 0 },
      size: { width: 8, height: 0.75, depth: 8 },
    };
    const flush: Panel = { ...housed, id: "flush", position: { x: 0.75, y: 4, z: 0 } };
    const pinned: Panel = { ...housed, id: "pinned", cutNote: "Drill 13/64\" pin holes for the shelf." };
    assert.equal(readingForPanels(side, housed), "housed-dado");
    assert.equal(readingForPanels(side, flush), undefined);
    assert.equal(readingForPanels(side, pinned), undefined);
    const project: YardProject = {
      id: "hand",
      name: "Housed shelf",
      prompt: "",
      kind: "closet",
      overall: { width: 10, height: 10, depth: 8 },
      instances: [],
      panels: [side, housed],
      primaryMaterialId: "plywood-3-4-4x8",
      notes: [],
      assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
    };
    const plan: BuildPlan = {
      feasibility: { status: "ok", summary: "", issues: [] },
      cutList: [],
      bom: [],
      instructions: [],
      totals: { pieces: 2, estCostUsd: 0, packs: 0 },
      generatedAt: "1970-01-01T00:00:00.000Z",
    };
    const graph = liftBuildGraph(project, plan, "casework");
    const dado = graph.joints.find((joint) => joint.patternId === "dado");
    assert.equal(dado?.reading, "housed-dado");
    assert.equal(dado?.reviewedJoin, true);
    assert.equal(graph.joints.some((joint) => joint.basis === "contact" && pair(joint) === "shelf|side"), false);
  });
});

describe("stock substitution keeps the form", () => {
  it("compile-backs the bookcase family, the potting bench, and both towers", () => {
    offline(() => {
      roundTrip(CASEWORK, "casework");
      roundTrip(`${CASEWORK} in 1/2 inch plywood`, "casework");
      roundTrip(`${CASEWORK} from oak`, "casework");
      roundTrip(FRAME, "frame-storage");
      roundTrip(LANDMARK, "landmark");
      roundTrip("eiffel tower from toothpicks", "landmark");
    });
  });

  it("follows plywood, oak, and toothpicks without changing roles, envelope, or reviewed joints", () => {
    offline(() => {
      const lift = (prompt: string, family: BuildFamily) => liftBuildGraph(generateFromPrompt(prompt), buildPlan(generateFromPrompt(prompt)), family);
      const ply = lift(CASEWORK, "casework");
      const half = lift(`${CASEWORK} in 1/2 inch plywood`, "casework");
      const oak = lift(`${CASEWORK} from oak`, "casework");
      const halfSwitch = substituteStock(ply, half);
      const oakSwitch = substituteStock(ply, oak);
      assert.equal(halfSwitch.substitution?.fromMaterialId, "plywood-3-4-4x8");
      assert.equal(halfSwitch.substitution?.toMaterialId, "plywood-1-2-4x8");
      assert.deepEqual(halfSwitch.substitution?.kept.roles, ply.form?.roles);
      assert.deepEqual(halfSwitch.substitution?.kept.envelope, ply.envelope);
      assert.deepEqual(halfSwitch.substitution?.kept.reviewedPatterns, []);
      assert.deepEqual(halfSwitch.form?.quarterInchRoles, ["back"]);
      assert.ok(halfSwitch.stock.some((line) => line.catalogId === "plywood-1-2-4x8"));
      assert.equal(halfSwitch.stock.some((line) => line.catalogId === "plywood-3-4-4x8"), false);
      assert.ok(halfSwitch.stock.some((line) => /^plywood-1-4/.test(line.catalogId ?? "")));
      assert.deepEqual(compileBuildGraph(halfSwitch).buy, planFacts(buildPlan(generateFromPrompt(`${CASEWORK} in 1/2 inch plywood`))).buy);
      assert.equal(oakSwitch.substitution?.toMaterialId, "lumber-1x4-8");
      assert.deepEqual(oakSwitch.substitution?.kept.roles, oak.form?.roles);
      assert.deepEqual(oakSwitch.envelope, ply.envelope);
      assert.ok(oakSwitch.stock.some((line) => line.catalogId === "lumber-1x4-8"));
      assert.equal(oakSwitch.stock.some((line) => line.catalogId === "plywood-3-4-4x8"), false);
      const back = oakSwitch.parts.find((part) => part.source === "panel" && part.type === "back");
      assert.ok(back && /^plywood-1-4/.test(back.materialId));

      const popsicle = lift(LANDMARK, "landmark");
      const tooth = lift("eiffel tower from toothpicks", "landmark");
      const stickSwitch = substituteStock(popsicle, tooth);
      assert.equal(stickSwitch.substitution?.toMaterialId, "toothpick");
      assert.deepEqual(
        [...new Set(stickSwitch.substitution?.kept.roles)].sort(),
        [...new Set(tooth.parts.map((part) => part.role))].sort(),
      );
      assert.notEqual(popsicle.parts.length, tooth.parts.length);
      assert.ok(stickSwitch.stock.some((line) => line.catalogId === "toothpick"));
      assert.equal(stickSwitch.stock.some((line) => line.catalogId === "popsicle-standard"), false);
      assert.equal(stickSwitch.joints.some((joint) => joint.reviewedJoin), false);
      assert.deepEqual(compileBuildGraph(stickSwitch).model.envelope, tooth.envelope);

      const broken = substituteStock.bind(null, ply, { ...half, parts: half.parts.filter((part) => part.role !== "back") });
      assert.throws(broken, /quarter-inch|roles/);
    });
  });
});

describe("compile enforces the 1/4\" plywood rule", () => {
  it("rejects a shelf or other structural panel and accepts a back or a drawer bottom", () => {
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
    const graph = (parts: GraphPart[]): YardBuildGraph => ({
      version: 1,
      shadow: true,
      id: "quarter",
      name: "Quarter",
      family: "casework",
      use: "human",
      origin: "panels",
      envelope: { width: 10, height: 10, depth: 0.25 },
      primaryMaterialId: "plywood-1-4-4x8",
      parts,
      joints: [],
      constraints: [],
      operations: [],
      stock: [],
      assumptions: [],
    });
    assert.throws(() => compileBuildGraph(graph([sheet("Shelf", "shelf")])), /1\/4" plywood is a back or a drawer bottom, not: Shelf/);
    assert.throws(() => compileBuildGraph(graph([sheet("Divider", "divider"), sheet("Side", "upright")])), /Divider, Side/);
    const legal = compileBuildGraph(graph([sheet("Back", "back"), sheet("Drawer bottom", "drawer", "bottom")]));
    assert.equal(legal.model.panels.length, 2);
    assert.deepEqual(quarterPlyProblems(graph([sheet("Back", "back")]).parts), []);
  });
});

describe("the potting-bench lower shelf stays a disclosed contradiction", () => {
  it("keeps the glue note, the floating check, and the pin step, and does not declare a joint", () => {
    offline(() => {
      const frame = roundTrip(FRAME, "frame-storage");
      const parked = frame.graph.constraints.find((row) => row.id === "potting-shelf");
      assert.match(parked?.detail ?? "", /glues and screws/i);
      assert.match(parked?.detail ?? "", /floating/i);
      assert.match(parked?.detail ?? "", /pin shelf/i);
      assert.equal(frame.graph.constraints.find((row) => row.kind === "structure" && row.issues)?.issues?.some((issue) => issue.code === "floating" && /lower shelf/i.test(issue.part)), true);
      assert.ok(frame.plan.instructions.some((step) => /pin 1 adjustable shelf/i.test(step.title)));
      assert.ok(frame.project.notes.some((note) => /glue and screw it into the leg faces/i.test(note)));
      const shelf = frame.graph.parts.find((part) => part.role === "shelf")!;
      const shelfJoints = frame.graph.joints.filter((joint) => joint.a === shelf.id || joint.b === shelf.id);
      assert.equal(shelfJoints.length, 0);
      assert.equal(frame.graph.joints.some((joint) => joint.reviewedJoin), false);
    });
  });
});
