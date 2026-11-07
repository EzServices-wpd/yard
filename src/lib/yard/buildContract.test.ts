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
  deriveStockPacks,
  fastenerBuyLines,
  fastenerDemandLedger,
  isCarcassScrewLine,
  liftBuildGraph,
  memberFact,
  panelFact,
  planFacts,
  quarterPlyProblems,
  readingForPanels,
  reviewedFastenerUses,
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
  assert.deepEqual(compiled.buy.filter((line) => !isCarcassScrewLine(line)), facts.buy.filter((line) => !isCarcassScrewLine(line)));
  assert.deepEqual(compiled.buy.filter(isCarcassScrewLine), fastenerBuyLines(graph));
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
    assert.equal(live.includes("reviewedFastenerUses"), false);
    assert.equal(live.includes("fastenerBuyLines"), false);
    assert.equal(live.includes("fastenerDemandLedger"), false);
    const report = readFileSync(new URL("./report.ts", import.meta.url), "utf8");
    assert.equal(report.includes("liftBuildGraph"), false);
    assert.equal(report.includes("compileBuildGraph"), false);
    assert.equal(report.includes("reviewedFastenerUses"), false);
    assert.equal(report.includes("fastenerBuyLines"), false);
    assert.equal(report.includes("fastenerDemandLedger"), false);
    assert.equal(report.includes("realizeCuttablePieces"), false);
    assert.equal(report.includes("deriveStockPacks"), false);
    assert.equal(report.includes("stockCompile"), false);
    assert.equal(live.includes("realizeCuttablePieces"), false);
    assert.equal(live.includes("deriveStockPacks"), false);
    assert.equal(live.includes("stockCompile"), false);
    const stock = readFileSync(new URL("./stockCompile.ts", import.meta.url), "utf8");
    assert.doesNotMatch(stock, /lengthReader|promptMain|from "\.\/report|modelJoints|YARD_AI_READER|VITE_PUBLIC_AI_READER|VITE_PUBLIC_YARD_AI_READER/);
    assert.doesNotMatch(stock, /graph\.stock/);
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

  it("requires an end inside the host, and a lap only when each board passes through the other", () => {
    const divider: Panel = {
      id: "divider",
      type: "divider",
      name: "Divider",
      materialId: "plywood-3-4-4x8",
      position: { x: 0, y: 0, z: 0 },
      size: { width: 0.75, height: 10, depth: 8 },
    };
    const housedEnd: Panel = {
      id: "shelf",
      type: "shelf",
      name: "Shelf",
      materialId: "plywood-3-4-4x8",
      position: { x: 0.5, y: 4, z: 0 },
      size: { width: 8, height: 0.75, depth: 8 },
    };
    assert.equal(readingForPanels(divider, housedEnd), "housed-dado");
    const upright: Panel = { ...divider, id: "side", type: "upright", name: "Side" };
    assert.equal(readingForPanels(upright, housedEnd), "housed-dado");
    const crossingDivider: Panel = { ...divider, position: { x: 4, y: 0, z: 0 } };
    const crossingShelf: Panel = { ...housedEnd, position: { x: 0, y: 4, z: 0 }, size: { width: 8, height: 0.75, depth: 8 } };
    assert.equal(readingForPanels(crossingDivider, crossingShelf), "cross-lap");
    offline(() => {
      const cubby = roundTrip("cubby shelf 48 wide 36 tall 12 deep", "casework");
      assert.equal(cubby.project.panels.some((panel) => panel.joints?.length), false);
      assert.equal(cubby.graph.joints.some((joint) => joint.reviewedJoin), false);
      const named = cubby.graph.joints.filter((joint) => {
        const a = cubby.project.panels.find((panel) => panel.id === joint.a);
        const b = cubby.project.panels.find((panel) => panel.id === joint.b);
        return /front rail/i.test(`${a?.name} ${b?.name}`) && /center support/i.test(`${a?.name} ${b?.name}`);
      });
      assert.ok(named.length >= 3);
      assert.ok(named.every((joint) => joint.basis === "contact" && joint.reading === undefined && joint.patternId === undefined));
    });
  });

  it("reads a housed end on the face entered when the part is thinner than the insertion, in any axis order", () => {
    const upright: Panel = {
      id: "side",
      type: "upright",
      name: "Side",
      materialId: "plywood-3-4-4x8",
      position: { x: 0, y: 0, z: 0 },
      size: { width: 0.75, height: 10, depth: 8 },
    };
    const halfShelf: Panel = {
      id: "half",
      type: "shelf",
      name: "Half shelf",
      materialId: "plywood-1-2-4x8",
      position: { x: 0.125, y: 4, z: 0 },
      size: { width: 8, height: 0.5, depth: 8 },
    };
    const sheet = (type: Panel["type"], name: string, x: number): Panel => ({
      id: name,
      type,
      name,
      materialId: "plywood-1-4-4x8",
      position: { x, y: 1, z: 3 },
      size: { width: 8, height: 8, depth: 0.25 },
    });
    const turn = (panel: Panel, rot: number): Panel => {
      const pos = [panel.position.x, panel.position.y, panel.position.z];
      const size = [panel.size.width, panel.size.height, panel.size.depth];
      const pick = (xs: number[]) => [xs[rot], xs[(rot + 1) % 3], xs[(rot + 2) % 3]];
      const nextPos = pick(pos);
      const nextSize = pick(size);
      return {
        ...panel,
        position: { x: nextPos[0], y: nextPos[1], z: nextPos[2] },
        size: { width: nextSize[0], height: nextSize[1], depth: nextSize[2] },
      };
    };
    const expectReading = (host: Panel, part: Panel, reading: string) => {
      for (const rot of [0, 1, 2]) {
        const turnedHost = turn(host, rot);
        const turnedPart = turn(part, rot);
        assert.equal(readingForPanels(turnedHost, turnedPart), reading, `${part.name} rot ${rot}`);
        assert.equal(readingForPanels(turnedPart, turnedHost), reading, `${part.name} rot ${rot} swapped`);
      }
    };
    expectReading(upright, halfShelf, "housed-dado");
    expectReading(upright, sheet("back", "Back", 0.5), "housed-rabbet");
    expectReading(upright, sheet("mirror", "Mirror", 0.5), "housed-rabbet");
    expectReading(upright, sheet("back", "Deep back", 0.25), "housed-rabbet");
    expectReading(upright, sheet("mirror", "Deep mirror", 0.25), "housed-rabbet");
    expectReading(upright, sheet("back", "Deeper back", 0.125), "housed-rabbet");
    expectReading(upright, sheet("mirror", "Deeper mirror", 0.125), "housed-rabbet");
    const through: Panel = { ...halfShelf, id: "through", position: { x: 0, y: 4, z: 0 } };
    assert.equal(readingForPanels(upright, through), undefined);
    const crossing: Panel = { ...halfShelf, id: "cross", position: { x: -2, y: 4, z: 0 } };
    assert.equal(readingForPanels(upright, crossing), undefined);
  });

  it("keeps an edge butt as contact and reads an end in a thicker host face", () => {
    const edgeHost: Panel = {
      id: "side",
      type: "upright",
      name: "Side",
      materialId: "plywood-3-4-4x8",
      position: { x: 0, y: 0, z: 0 },
      size: { width: 0.75, height: 10, depth: 8 },
    };
    const edgeShelf: Panel = {
      id: "shelf",
      type: "shelf",
      name: "Edge shelf",
      materialId: "plywood-3-4-4x8",
      position: { x: 0.5, y: 10, z: 0 },
      size: { width: 8, height: 0.75, depth: 8 },
    };
    const wideHost: Panel = {
      ...edgeHost,
      id: "wide",
      name: "Wide side",
      size: { width: 1.5, height: 10, depth: 0.75 },
    };
    const entered: Panel = {
      ...edgeShelf,
      id: "entered",
      name: "Entered shelf",
      materialId: "plywood-1-2-4x8",
      position: { x: 1, y: 4, z: 0 },
      size: { width: 8, height: 0.5, depth: 8 },
    };
    const turn = (panel: Panel, rot: number): Panel => {
      const pos = [panel.position.x, panel.position.y, panel.position.z];
      const size = [panel.size.width, panel.size.height, panel.size.depth];
      const pick = (xs: number[]) => [xs[rot], xs[(rot + 1) % 3], xs[(rot + 2) % 3]];
      const nextPos = pick(pos);
      const nextSize = pick(size);
      return {
        ...panel,
        position: { x: nextPos[0], y: nextPos[1], z: nextPos[2] },
        size: { width: nextSize[0], height: nextSize[1], depth: nextSize[2] },
      };
    };
    for (const rot of [0, 1, 2]) {
      const host = turn(edgeHost, rot);
      const shelf = turn(edgeShelf, rot);
      assert.equal(readingForPanels(host, shelf), undefined, `edge rot ${rot}`);
      assert.equal(readingForPanels(shelf, host), undefined, `edge rot ${rot} swapped`);
      const wide = turn(wideHost, rot);
      const end = turn(entered, rot);
      assert.equal(readingForPanels(wide, end), "housed-dado", `wide rot ${rot}`);
      assert.equal(readingForPanels(end, wide), "housed-dado", `wide rot ${rot} swapped`);
    }
    const plan: BuildPlan = {
      feasibility: { status: "ok", summary: "", issues: [] },
      cutList: [],
      bom: [],
      instructions: [],
      totals: { pieces: 2, estCostUsd: 0, packs: 0 },
      generatedAt: "1970-01-01T00:00:00.000Z",
    };
    const edgeGraph = liftBuildGraph({
      id: "edge",
      name: "Edge",
      prompt: "",
      kind: "closet",
      overall: { width: 10, height: 11, depth: 8 },
      instances: [],
      panels: [edgeHost, edgeShelf],
      primaryMaterialId: "plywood-3-4-4x8",
      notes: [],
      assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
    }, plan, "casework");
    const edgeJoint = edgeGraph.joints.find((joint) => pair(joint) === "shelf|side");
    assert.equal(edgeJoint?.basis, "contact");
    assert.equal(edgeJoint?.patternId, undefined);
    assert.equal(edgeGraph.joints.some((joint) => joint.reviewedJoin), false);
    const wideGraph = liftBuildGraph({
      id: "wide",
      name: "Wide",
      prompt: "",
      kind: "closet",
      overall: { width: 10, height: 10, depth: 8 },
      instances: [],
      panels: [wideHost, entered],
      primaryMaterialId: "plywood-3-4-4x8",
      notes: [],
      assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
    }, plan, "casework");
    assert.equal(wideGraph.joints.find((joint) => pair(joint) === "entered|wide")?.reading, "housed-dado");
  });

  it("lifts a housed end the screw finder would skip when the face overlap is under 1/4 inch", () => {
    const host: Panel = {
      id: "side",
      type: "upright",
      name: "Side",
      materialId: "plywood-3-4-4x8",
      position: { x: 0, y: 0, z: 0 },
      size: { width: 0.75, height: 10, depth: 8 },
    };
    const shelf: Panel = {
      id: "shelf",
      type: "shelf",
      name: "Shelf",
      materialId: "plywood-3-4-4x8",
      position: { x: 0.625, y: 9.875, z: 0 },
      size: { width: 8, height: 0.75, depth: 8 },
    };
    const turn = (panel: Panel, rot: number): Panel => {
      const pos = [panel.position.x, panel.position.y, panel.position.z];
      const size = [panel.size.width, panel.size.height, panel.size.depth];
      const pick = (xs: number[]) => [xs[rot], xs[(rot + 1) % 3], xs[(rot + 2) % 3]];
      const nextPos = pick(pos);
      const nextSize = pick(size);
      return {
        ...panel,
        position: { x: nextPos[0], y: nextPos[1], z: nextPos[2] },
        size: { width: nextSize[0], height: nextSize[1], depth: nextSize[2] },
      };
    };
    const plan: BuildPlan = {
      feasibility: { status: "ok", summary: "", issues: [] },
      cutList: [],
      bom: [],
      instructions: [],
      totals: { pieces: 2, estCostUsd: 0, packs: 0 },
      generatedAt: "1970-01-01T00:00:00.000Z",
    };
    for (const rot of [0, 1, 2]) {
      const turnedHost = turn(host, rot);
      const turnedShelf = turn(shelf, rot);
      assert.equal(readingForPanels(turnedHost, turnedShelf), "housed-dado", `rot ${rot}`);
      assert.equal(readingForPanels(turnedShelf, turnedHost), "housed-dado", `rot ${rot} swapped`);
      for (const panels of [[turnedHost, turnedShelf], [turnedShelf, turnedHost]]) {
        const graph = liftBuildGraph({
          id: "band",
          name: "Band",
          prompt: "",
          kind: "closet",
          overall: { width: 10, height: 11, depth: 8 },
          instances: [],
          panels,
          primaryMaterialId: "plywood-3-4-4x8",
          notes: [],
          assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
        }, plan, "casework");
        const joint = graph.joints.find((row) => pair(row) === "shelf|side");
        assert.equal(joint?.reading, "housed-dado", `lift rot ${rot}`);
        assert.equal(joint?.reviewedJoin, true);
        assert.equal(joint?.basis, "declared");
      }
    }
  });

  it("does not infer a dado for a part that turns on a pin or for purchased hardware", () => {
    const upright: Panel = {
      id: "side",
      type: "upright",
      name: "Side",
      materialId: "plywood-3-4-4x8",
      position: { x: 0, y: 0, z: 0 },
      size: { width: 0.75, height: 10, depth: 8 },
    };
    const arm: Panel = {
      id: "arm",
      type: "rail",
      name: "Pivot arm",
      materialId: "plywood-3-4-4x8",
      position: { x: 0.5, y: 4, z: 0 },
      size: { width: 8, height: 0.75, depth: 8 },
      turns: true,
      cutNote: "Bore the arm 1/16 over its pivot pin; keep free to rotate.",
    };
    const bracket: Panel = {
      id: "bracket",
      type: "rail",
      name: "A-frame bracket 1",
      materialId: "swing-a-frame-bracket",
      position: { x: 0.5, y: 4, z: 1 },
      size: { width: 5, height: 4, depth: 2 },
    };
    const turn = (panel: Panel, rot: number): Panel => {
      const pos = [panel.position.x, panel.position.y, panel.position.z];
      const size = [panel.size.width, panel.size.height, panel.size.depth];
      const pick = (xs: number[]) => [xs[rot], xs[(rot + 1) % 3], xs[(rot + 2) % 3]];
      const nextPos = pick(pos);
      const nextSize = pick(size);
      return {
        ...panel,
        position: { x: nextPos[0], y: nextPos[1], z: nextPos[2] },
        size: { width: nextSize[0], height: nextSize[1], depth: nextSize[2] },
      };
    };
    const plan: BuildPlan = {
      feasibility: { status: "ok", summary: "", issues: [] },
      cutList: [],
      bom: [],
      instructions: [],
      totals: { pieces: 2, estCostUsd: 0, packs: 0 },
      generatedAt: "1970-01-01T00:00:00.000Z",
    };
    const lift = (panels: Panel[]) => liftBuildGraph({
      id: "elig",
      name: "Eligibility",
      prompt: "",
      kind: "closet",
      overall: { width: 10, height: 10, depth: 8 },
      instances: [],
      panels,
      primaryMaterialId: "plywood-3-4-4x8",
      notes: [],
      assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
    }, plan, "casework");
    for (const rot of [0, 1, 2]) {
      const host = turn(upright, rot);
      const turning = turn(arm, rot);
      const fixed = turn({ ...arm, id: "fixed", turns: undefined, cutNote: undefined }, rot);
      const bought = turn(bracket, rot);
      assert.equal(readingForPanels(host, turning), undefined, `turn rot ${rot}`);
      assert.equal(readingForPanels(turning, host), undefined, `turn rot ${rot} swapped`);
      assert.equal(readingForPanels(host, fixed), "housed-dado", `fixed rot ${rot}`);
      assert.equal(readingForPanels(fixed, host), "housed-dado", `fixed rot ${rot} swapped`);
      assert.equal(readingForPanels(host, bought), undefined, `bought rot ${rot}`);
      assert.equal(readingForPanels(bought, host), undefined, `bought rot ${rot} swapped`);
      for (const panels of [[host, turning], [turning, host]] as Panel[][]) {
        const graph = lift(panels);
        assert.equal(graph.joints.some((joint) => joint.reviewedJoin), false, `turn lift rot ${rot}`);
      }
      for (const panels of [[host, fixed], [fixed, host]] as Panel[][]) {
        const joint = lift(panels).joints.find((row) => pair(row) === "fixed|side");
        assert.equal(joint?.reading, "housed-dado", `fixed lift rot ${rot}`);
        assert.equal(joint?.reviewedJoin, true);
      }
      for (const panels of [[host, bought], [bought, host]] as Panel[][]) {
        const graph = lift(panels);
        assert.equal(graph.joints.some((joint) => joint.reviewedJoin), false, `bought lift rot ${rot}`);
      }
    }
  });

  it("keeps cubby rails that cross a support as contact", () => {
    offline(() => {
      for (const prompt of [
        "cubby shelf 48 wide 36 tall 12 deep",
        "cubby shelf 40 wide 36 tall 12 deep",
        "cubby shelf 44 wide 36 tall 12 deep",
        "cubby shelf 52 wide 36 tall 12 deep",
        "cubby shelf 60 wide 48 tall 12 deep",
        "cubby shelf 48 wide 48 tall 16 deep",
      ]) {
        const graph = roundTrip(prompt, "casework").graph;
        assert.equal(graph.joints.some((joint) => joint.reviewedJoin), false, prompt);
      }
    });
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
      const halfLive = planFacts(buildPlan(generateFromPrompt(`${CASEWORK} in 1/2 inch plywood`)));
      assert.deepEqual(
        compileBuildGraph(halfSwitch).buy.filter((line) => !isCarcassScrewLine(line)),
        halfLive.buy.filter((line) => !isCarcassScrewLine(line)),
      );
      assert.deepEqual(reviewedFastenerUses(halfSwitch), []);
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
      assert.deepEqual(reviewedFastenerUses(frame.graph), []);
      assert.deepEqual(frame.compiled.buy.filter(isCarcassScrewLine), []);
    });
  });
});

describe("furniture screws come from reviewed joints", () => {
  const panel = (id: string, type: Panel["type"], position: Panel["position"], size: Panel["size"]): GraphPart => ({
    source: "panel",
    role: type,
    id,
    type,
    name: id,
    materialId: "plywood-3-4-4x8",
    position,
    size,
  });

  const base = (parts: GraphPart[], joints: YardBuildGraph["joints"], stock: YardBuildGraph["stock"] = []): YardBuildGraph => ({
    version: 1,
    shadow: true,
    id: "screws",
    name: "Screws",
    family: "casework",
    use: "human",
    origin: "panels",
    envelope: { width: 32, height: 10, depth: 20 },
    primaryMaterialId: "plywood-3-4-4x8",
    parts,
    joints,
    constraints: [],
    operations: [{ id: "op", order: 1, title: "Assemble", description: "Glue and screw the joint.", labels: ["*"], partIds: parts.map((part) => part.id) }],
    stock,
    assumptions: [],
  });

  it("counts a reviewed shop joint on the live screw schedule and ignores contact and hinges", () => {
    const side = panel("side", "upright", { x: 0, y: 0, z: 0 }, { width: 0.75, height: 10, depth: 20 });
    const shelf = panel("shelf", "shelf", { x: 0.5, y: 4, z: 0 }, { width: 8, height: 0.75, depth: 20 });
    const dado = base([side, shelf], [{ id: "j1", a: "shelf", b: "side", basis: "declared", patternId: "dado", reviewedJoin: true }]);
    assert.deepEqual(reviewedFastenerUses(dado), [{ id: "screws-8", qty: 3 }]);
    assert.deepEqual(fastenerBuyLines(dado), [{
      name: '#8 x 1-1/4" wood screws',
      quantity: 1,
      unit: "box (50 ct)",
      catalogId: "screws-8",
    }]);
    const withContact = base(dado.parts, [
      ...dado.joints,
      { id: "c1", a: "shelf", b: "side", basis: "contact", contactClass: "butt", reviewedJoin: false },
    ]);
    assert.deepEqual(reviewedFastenerUses(withContact), reviewedFastenerUses(dado));
    const contactOnly = base(dado.parts, [{ id: "c1", a: "shelf", b: "side", basis: "contact", contactClass: "back", reviewedJoin: false }]);
    assert.deepEqual(reviewedFastenerUses(contactOnly), []);
    const hinge = base(dado.parts, [{ id: "h1", a: "shelf", b: "side", basis: "declared", patternId: "hinge", reviewedJoin: true }]);
    assert.deepEqual(reviewedFastenerUses(hinge), []);
    const faceA = panel("a", "upright", { x: 0, y: 0, z: 0 }, { width: 32, height: 0.75, depth: 8 });
    const faceB = panel("b", "upright", { x: 0, y: 0, z: 0 }, { width: 32, height: 0.75, depth: 8 });
    const lap = base([faceA, faceB], [{ id: "lap", a: "a", b: "b", basis: "declared", patternId: "lap", reviewedJoin: true }]);
    assert.deepEqual(reviewedFastenerUses(lap), [{ id: "screws-8", qty: 4 }]);
    const glued = { ...dado, fastener: "glue" as const };
    assert.deepEqual(reviewedFastenerUses(glued), []);
    const miniature = { ...dado, use: "miniature" as const, primaryMaterialId: "popsicle-standard" };
    assert.deepEqual(reviewedFastenerUses(miniature), []);
    const copied = base(dado.parts, dado.joints, [{ id: "copied", name: '#8 x 1-1/4" wood screws', quantity: 9, unit: "box (50 ct)", catalogId: "screws-8", partIds: [] }]);
    const compiled = compileBuildGraph(copied);
    assert.deepEqual(compiled.buy.filter(isCarcassScrewLine), fastenerBuyLines(dado));
    assert.equal(compiled.buy.filter(isCarcassScrewLine)[0]?.quantity, 1);
    assert.equal(compiled.steps[0]?.title, "Assemble");
  });

  it("checks derived screws against the live Buy fastener lines on the compile-back families", () => {
    offline(() => {
      const prompts: { prompt: string; family: BuildFamily; liveScrews: number }[] = [
        { prompt: CASEWORK, family: "casework", liveScrews: 1 },
        { prompt: `${CASEWORK} in 3/4 inch plywood`, family: "casework", liveScrews: 1 },
        { prompt: `${CASEWORK} in 1/2 inch plywood`, family: "casework", liveScrews: 1 },
        { prompt: `${CASEWORK} from oak`, family: "casework", liveScrews: 1 },
        { prompt: FRAME, family: "frame-storage", liveScrews: 1 },
        { prompt: LANDMARK, family: "landmark", liveScrews: 0 },
        { prompt: "eiffel tower from toothpicks", family: "landmark", liveScrews: 0 },
      ];
      const rows = prompts.map(({ prompt, family }) => {
        const trip = roundTrip(prompt, family);
        return { prompt, ...trip };
      });
      const [book, threeQuarter, half, oak, bench, tower, tooth] = rows;
      for (const row of rows) {
        assert.equal(row.graph.joints.some((joint) => joint.reviewedJoin), false, row.prompt);
        assert.ok(row.graph.joints.some((joint) => joint.basis === "contact"), row.prompt);
        assert.deepEqual(reviewedFastenerUses(row.graph), [], row.prompt);
        assert.deepEqual(row.compiled.buy.filter(isCarcassScrewLine), [], row.prompt);
        assert.equal(row.plan.bom.filter(isCarcassScrewLine).length, prompts.find((item) => item.prompt === row.prompt)?.liveScrews, row.prompt);
      }
      assert.deepEqual(book.plan.bom.filter(isCarcassScrewLine), threeQuarter.plan.bom.filter(isCarcassScrewLine));
      const bookScrew = book.plan.bom.find(isCarcassScrewLine)!;
      const halfScrew = half.plan.bom.find(isCarcassScrewLine)!;
      const oakScrew = oak.plan.bom.find(isCarcassScrewLine)!;
      const benchScrew = bench.plan.bom.find(isCarcassScrewLine)!;
      assert.equal(bookScrew.name, '#8 x 1-1/4" wood screws');
      assert.equal(bookScrew.quantity, 1);
      assert.match(bookScrew.notes ?? "", /44 screws/);
      assert.match(bookScrew.notes ?? "", /butt/);
      assert.match(bookScrew.notes ?? "", /back/);
      assert.equal(halfScrew.name, '#8 x 1" wood screws');
      assert.match(halfScrew.notes ?? "", /33 screws/);
      assert.equal(oakScrew.name, bookScrew.name);
      assert.match(oakScrew.notes ?? "", /44 screws/);
      assert.equal(benchScrew.name, '#8 x 2-1/2" wood screws');
      assert.match(benchScrew.notes ?? "", /28 screws/);
      assert.match(benchScrew.notes ?? "", /butt/);
      for (const row of [book, threeQuarter, half, oak]) {
        const back = row.graph.parts.find((part) => part.source === "panel" && part.type === "back");
        assert.ok(back && /^plywood-1-4/.test(back.materialId), row.prompt);
        assert.ok(row.compiled.buy.some((line) => /^plywood-1-4/.test(line.catalogId ?? "")), row.prompt);
        assert.ok(row.compiled.buy.some((line) => /glue/i.test(line.name)), row.prompt);
      }
      assert.ok(book.compiled.buy.some((line) => line.catalogId === "plywood-3-4-4x8"));
      assert.ok(half.compiled.buy.some((line) => line.catalogId === "plywood-1-2-4x8"));
      assert.ok(oak.compiled.buy.some((line) => line.catalogId === "lumber-1x4-8"));
      assert.ok(bench.compiled.buy.some((line) => line.catalogId === "lumber-2x4-8"));
      assert.ok(bench.compiled.buy.some((line) => /glue/i.test(line.name)));
      for (const row of [tower, tooth]) {
        assert.equal(row.graph.use, "miniature");
        assert.equal(row.graph.fastener, "glue");
        assert.deepEqual(row.plan.bom.filter(isCarcassScrewLine), []);
        assert.deepEqual(row.compiled.buy.filter(isCarcassScrewLine), row.plan.bom.filter(isCarcassScrewLine));
        assert.ok(row.compiled.buy.some((line) => /glue/i.test(line.name)), row.prompt);
      }
      assert.ok(tower.compiled.buy.some((line) => line.catalogId === "popsicle-standard"));
      assert.ok(tooth.compiled.buy.some((line) => line.catalogId === "toothpick"));
      assert.equal(book.compiled.steps.find((step) => /anti-tip/i.test(step.title))?.fastenersUsed?.[0]?.id, "buy:Furniture anti-tip kit");
    });
  });
});

describe("fastener demand ledger", () => {
  const board = (
    id: string,
    type: Panel["type"],
    name: string,
    position: Panel["position"],
    size: Panel["size"],
    materialId = "plywood-3-4-4x8",
    extra: Partial<Panel> = {},
  ): GraphPart => ({
    source: "panel",
    role: type,
    id,
    type,
    name,
    materialId,
    position,
    size,
    ...extra,
  });

  const graph = (
    parts: GraphPart[],
    joints: YardBuildGraph["joints"],
    extra: Partial<YardBuildGraph> = {},
  ): YardBuildGraph => ({
    version: 1,
    shadow: true,
    id: "ledger",
    name: "Ledger",
    family: "casework",
    use: "human",
    origin: "panels",
    envelope: { width: 48, height: 96, depth: 12 },
    primaryMaterialId: "plywood-3-4-4x8",
    parts,
    joints,
    constraints: [],
    operations: [],
    stock: [
      { id: "struct", name: "GRK RSS #9 x 3-1/8 structural screws", quantity: 1, unit: "box", catalogId: "structural-screws", partIds: [] },
    ],
    assumptions: [],
    ...extra,
  });

  const shop = (a: string, b: string, patternId: string, id = `${a}-${b}`): YardBuildGraph["joints"][number] => ({
    id,
    a,
    b,
    basis: "declared",
    patternId,
    reviewedJoin: true,
  });

  it("counts a wide thin back on the long edge, and keeps a narrow back edge at the same count", () => {
    const side = board("side", "upright", "Side", { x: 0, y: 0, z: 0 }, { width: 48, height: 96, depth: 0.75 });
    const wide = board("back", "back", "Back", { x: 0, y: 0, z: 0 }, { width: 48, height: 96, depth: 0.25 }, "plywood-1-4-4x8");
    const liveWide = panelJoints([
      { id: "side", type: "upright", name: "Side", materialId: "plywood-3-4-4x8", position: side.position, size: side.size },
      { id: "back", type: "back", name: "Back", materialId: "plywood-1-4-4x8", position: wide.position, size: wide.size },
    ]);
    assert.equal(liveWide[0]?.kind, "back");
    assert.equal(liveWide[0]?.screws, 12);
    for (const joint of [shop("side", "back", "rabbet"), shop("back", "side", "rabbet")]) {
      const row = fastenerDemandLedger(graph([side, wide], [joint]));
      assert.equal(row.length, 1);
      assert.equal(row[0]?.meeting, "back");
      assert.equal(row[0]?.screws, 12);
      assert.equal(row[0]?.noScrew, undefined);
      assert.deepEqual(reviewedFastenerUses(graph([side, wide], [joint])), [{ id: "screws-8", qty: 12 }]);
      assert.equal(fastenerBuyLines(graph([side, wide], [joint]))[0]?.quantity, 1);
      const compiled = compileBuildGraph(graph([side, wide], [joint]));
      assert.equal(compiled.fasteners[0]?.screws, 12);
      assert.equal(compiled.buy.find((line) => line.catalogId === "structural-screws")?.quantity, 1);
    }
    const upright = board("side", "upright", "Side", { x: 0, y: 0, z: 0 }, { width: 0.75, height: 96, depth: 12 });
    const edge = board("back", "back", "Back", { x: 0.5, y: 0, z: 11.25 }, { width: 48, height: 96, depth: 0.25 }, "plywood-1-4-4x8");
    for (const joint of [shop("side", "back", "rabbet"), shop("back", "side", "rabbet")]) {
      const row = fastenerDemandLedger(graph([upright, edge], [joint]));
      assert.equal(row[0]?.meeting, "back");
      assert.equal(row[0]?.screws, 12);
    }
  });

  it("buys no carcass screws for a planed glue housing or purchased hardware, and keeps the joint", () => {
    const host: Panel = {
      id: "side",
      type: "upright",
      name: "Side",
      materialId: "plywood-3-4-4x8",
      position: { x: 0, y: 0, z: 0 },
      size: { width: 0.75, height: 10, depth: 20 },
    };
    const shelf: Panel = {
      id: "shelf",
      type: "shelf",
      name: "Shelf",
      materialId: "plywood-3-4-4x8",
      position: { x: 0.5, y: 4, z: 0 },
      size: { width: 8, height: 0.5, depth: 20 },
      cutNote: "Plane to 1/2 inch thickness; glue into its dado, no screws",
    };
    assert.deepEqual(panelJoints([host, shelf]), []);
    assert.equal(readingForPanels(host, shelf), "housed-dado");
    const plan: BuildPlan = {
      feasibility: { status: "ok", summary: "", issues: [] },
      cutList: [],
      bom: [],
      instructions: [],
      totals: { pieces: 2, estCostUsd: 0, packs: 0 },
      generatedAt: "1970-01-01T00:00:00.000Z",
    };
    const project: YardProject = {
      id: "planed",
      name: "Planed shelf",
      prompt: "",
      kind: "closet",
      overall: { width: 10, height: 10, depth: 20 },
      instances: [],
      panels: [host, shelf],
      primaryMaterialId: "plywood-3-4-4x8",
      notes: [],
      assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
    };
    assert.equal(buildPlan(project).bom.some(isCarcassScrewLine), false);
    const lifted = liftBuildGraph(project, plan, "casework");
    const dado = lifted.joints.find((joint) => joint.patternId === "dado");
    assert.equal(dado?.reading, "housed-dado");
    assert.equal(dado?.reviewedJoin, true);
    const compiled = compileBuildGraph(lifted);
    assert.equal(compiled.fasteners.find((row) => row.pair === pair(dado!))?.noScrew, "planed");
    assert.equal(compiled.fasteners.find((row) => row.pair === pair(dado!))?.screws, 0);
    assert.deepEqual(reviewedFastenerUses(lifted), []);
    assert.ok(lifted.joints.some((joint) => joint.patternId === "dado" && joint.reviewedJoin));

    const fullHalf = board("shelf", "shelf", "Shelf", { x: 0.5, y: 4, z: 0 }, { width: 8, height: 0.5, depth: 20 }, "plywood-1-2-4x8");
    const upright = board("side", "upright", "Side", { x: 0, y: 0, z: 0 }, { width: 0.75, height: 10, depth: 20 }, "plywood-1-2-4x8");
    const halfGraph = graph([upright, fullHalf], [shop("shelf", "side", "dado")], { primaryMaterialId: "plywood-1-2-4x8" });
    assert.equal(fastenerDemandLedger(halfGraph)[0]?.noScrew, undefined);
    assert.equal(fastenerDemandLedger(halfGraph)[0]?.screws, 3);

    const bracket = board("bracket", "rail", "A-frame bracket 1", { x: 0.5, y: 4, z: 0 }, { width: 5, height: 4, depth: 2 }, "swing-a-frame-bracket");
    const bought = graph([upright, bracket], [shop("bracket", "side", "dado")]);
    assert.equal(fastenerDemandLedger(bought)[0]?.noScrew, "hardware");
    assert.equal(fastenerDemandLedger(bought)[0]?.screws, 0);
    assert.deepEqual(reviewedFastenerUses(bought), []);
    assert.equal(bought.joints[0]?.reviewedJoin, true);
    const contact = graph([upright, bracket], [{ id: "c", a: "bracket", b: "side", basis: "contact", contactClass: "butt", reviewedJoin: false }]);
    assert.deepEqual(fastenerDemandLedger(contact), []);
  });

  it("counts each physical pair once and still adds distinct pairs", () => {
    const host = board("side", "upright", "Side", { x: 0, y: 0, z: 0 }, { width: 0.75, height: 10, depth: 400 });
    const shelf = board("shelf", "shelf", "Shelf", { x: 0.5, y: 4, z: 0 }, { width: 8, height: 0.75, depth: 400 });
    const one = graph([host, shelf], [shop("shelf", "side", "dado")]);
    assert.equal(fastenerDemandLedger(one)[0]?.screws, 50);
    assert.equal(fastenerBuyLines(one)[0]?.quantity, 1);
    const bothWays = graph([host, shelf], [shop("shelf", "side", "dado", "ab"), shop("side", "shelf", "dado", "ba")]);
    assert.equal(fastenerDemandLedger(bothWays).length, 1);
    assert.equal(fastenerDemandLedger(bothWays)[0]?.screws, 50);
    assert.equal(fastenerBuyLines(bothWays)[0]?.quantity, 1);
    const other = board("shelf2", "shelf", "Shelf 2", { x: 0.5, y: 6, z: 0 }, { width: 8, height: 0.75, depth: 400 });
    const two = graph([host, shelf, other], [shop("shelf", "side", "dado"), shop("shelf2", "side", "dado")]);
    assert.equal(fastenerDemandLedger(two).length, 2);
    assert.equal(reviewedFastenerUses(two)[0]?.qty, 100);
    assert.equal(fastenerBuyLines(two)[0]?.quantity, 2);
  });

  it("chooses the outdoor screw item from the build name, not the copied screw count", () => {
    offline(() => {
      for (const prompt of ["birdhouse", "outdoor birdhouse"]) {
        const project = generateFromPrompt(prompt);
        const plan = buildPlan(project);
        const lifted = liftBuildGraph(project, plan, "casework");
        const live = plan.bom.find((line) => line.catalogId === "outdoor-screws");
        assert.ok(live);
        assert.match(live.notes ?? "", /30 screws/);
        assert.equal(lifted.joints.filter((joint) => joint.patternId === "miter" && joint.reviewedJoin).length, 1);
        assert.deepEqual(reviewedFastenerUses(lifted), [{ id: "outdoor-screws", qty: 2 }]);
        const derived = fastenerBuyLines(lifted);
        assert.equal(derived.length, 1);
        assert.equal(derived[0]?.catalogId, "outdoor-screws");
        assert.equal(derived[0]?.name, '#8 x 1-1/4" exterior-coated or stainless wood screws');
        assert.equal(derived[0]?.quantity, 1);
        assert.equal(derived[0]?.notes, undefined);
        const compiled = compileBuildGraph(lifted);
        assert.deepEqual(compiled.buy.filter(isCarcassScrewLine), derived);
        assert.equal(compiled.fasteners.length, 1);
        assert.equal(compiled.fasteners[0]?.screws, 2);
      }
      const project = generateFromPrompt("chicken coop");
      const plan = buildPlan(project);
      const lifted = liftBuildGraph(project, plan, "frame-storage");
      const live = plan.bom.find((line) => line.catalogId === "outdoor-screws");
      const structural = plan.bom.find((line) => line.catalogId === "structural-screws");
      assert.equal(live?.quantity, 3);
      assert.equal(structural?.quantity, 1);
      assert.equal(lifted.joints.filter((joint) => joint.patternId === "notch" && joint.reviewedJoin).length, 6);
      assert.equal(lifted.joints.filter((joint) => joint.patternId === "hinge").length, 2);
      assert.deepEqual(reviewedFastenerUses(lifted), [{ id: "outdoor-screws", qty: 12 }]);
      const derived = fastenerBuyLines(lifted);
      assert.equal(derived[0]?.catalogId, "outdoor-screws");
      assert.equal(derived[0]?.name, '#8 x 2-1/2" exterior-coated or stainless wood screws');
      assert.equal(derived[0]?.quantity, 1);
      const compiled = compileBuildGraph(lifted);
      assert.deepEqual(compiled.buy.filter(isCarcassScrewLine), derived);
      assert.equal(compiled.buy.find((line) => line.catalogId === "structural-screws")?.quantity, 1);
      assert.equal(compiled.buy.find((line) => line.catalogId === "structural-screws")?.name, structural?.name);
      assert.equal(compiled.fasteners.filter((row) => row.patternId === "hinge").length, 0);
      assert.equal(compiled.fasteners.reduce((sum, row) => sum + row.screws, 0), 12);
    });
  });

  it("buys no carcass screws for a thin dowel or a thin polygon, and keeps the joint", () => {
    const upright: Panel = {
      id: "side",
      type: "upright",
      name: "Side",
      materialId: "plywood-3-4-4x8",
      position: { x: 0, y: 0, z: 0 },
      size: { width: 0.75, height: 10, depth: 20 },
    };
    const perch: Panel = {
      id: "perch",
      type: "rail",
      name: "Perch",
      materialId: "dowel-1-4-36",
      position: { x: 0.5, y: 4, z: 2 },
      size: { width: 8, height: 0.25, depth: 0.25 },
    };
    const shaped: Panel = {
      id: "back",
      type: "back",
      name: "Shaped Back",
      materialId: "plywood-1-4-4x8",
      position: { x: 0.5, y: 4, z: 0 },
      size: { width: 8, height: 0.25, depth: 20 },
      polygon: { plane: "xz", pts: [[0, 0], [8, 0], [8, 20], [0, 20]] },
    };
    const side = board("side", "upright", "Side", upright.position, upright.size);
    const dowel = board("perch", "rail", "Perch", perch.position, perch.size, "dowel-1-4-36");
    const back = board("back", "back", "Shaped Back", shaped.position, shaped.size, "plywood-1-4-4x8", { polygon: shaped.polygon });
    for (const panels of [[upright, perch], [perch, upright]] as Panel[][]) {
      assert.deepEqual(panelJoints(panels), []);
    }
    for (const panels of [[upright, shaped], [shaped, upright]] as Panel[][]) {
      assert.deepEqual(panelJoints(panels), []);
    }
    for (const joint of [shop("perch", "side", "mortise"), shop("side", "perch", "mortise")]) {
      const row = graph([side, dowel], [joint]);
      assert.equal(row.joints[0]?.reviewedJoin, true);
      const ledger = fastenerDemandLedger(row);
      assert.equal(ledger.length, 1);
      assert.equal(ledger[0]?.screws, 0);
      assert.equal(ledger[0]?.noScrew, "thin-not-sheet");
      assert.deepEqual(reviewedFastenerUses(row), []);
      assert.deepEqual(fastenerBuyLines(row), []);
      const compiled = compileBuildGraph(row);
      assert.equal(compiled.fasteners[0]?.screws, 0);
      assert.equal(compiled.fasteners[0]?.noScrew, "thin-not-sheet");
      assert.equal(compiled.buy.some(isCarcassScrewLine), false);
    }
    for (const joint of [shop("back", "side", "rabbet"), shop("side", "back", "rabbet")]) {
      const row = graph([side, back], [joint]);
      assert.equal(row.joints[0]?.reviewedJoin, true);
      assert.equal(quarterPlyProblems(row.parts).length, 0);
      const ledger = fastenerDemandLedger(row);
      assert.equal(ledger.length, 1);
      assert.equal(ledger[0]?.screws, 0);
      assert.equal(ledger[0]?.noScrew, "thin-not-sheet");
      assert.deepEqual(reviewedFastenerUses(row), []);
      const compiled = compileBuildGraph(row);
      assert.equal(compiled.fasteners[0]?.noScrew, "thin-not-sheet");
      assert.equal(compiled.buy.some(isCarcassScrewLine), false);
      assert.equal(compiled.model.panels.some((part) => part.id === "back"), true);
    }
  });
});

function stockPart(
  id: string,
  size: Panel["size"],
  materialId = "plywood-3-4-4x8",
  type: Panel["type"] = "shelf",
): GraphPart {
  return {
    source: "panel",
    role: type,
    id,
    type,
    name: id,
    materialId,
    position: { x: 0, y: 0, z: 0 },
    size,
  };
}

function stockGraph(parts: GraphPart[], extra: Partial<YardBuildGraph> = {}): YardBuildGraph {
  return {
    version: 1,
    shadow: true,
    id: "stock",
    name: "Stock",
    family: "casework",
    use: "human",
    origin: parts.some((part) => part.source === "member") ? "structure-graph" : "panels",
    envelope: { width: 48, height: 48, depth: 48 },
    primaryMaterialId: parts[0]?.materialId ?? "plywood-3-4-4x8",
    parts,
    joints: [],
    constraints: [],
    operations: [],
    stock: [{ id: "copied", name: "Copied sheet", quantity: 99, unit: "sheets", catalogId: "plywood-3-4-4x8", partIds: [] }],
    assumptions: [],
    ...extra,
  };
}

describe("shadow cuts and sheet/lumber packs", () => {
  it("nests sheet cuts and ignores a copied Buy quantity", () => {
    const squares = ["a", "b", "c"].map((id) => stockPart(id, { width: 48, height: 0.75, depth: 48 }));
    const graph = stockGraph(squares);
    const compiled = compileBuildGraph(graph);
    assert.equal(compiled.buy.find((line) => line.catalogId === "plywood-3-4-4x8")?.quantity, 99);
    assert.equal(compiled.packs.length, 1);
    assert.equal(compiled.packs[0]?.catalogId, "plywood-3-4-4x8");
    assert.equal(compiled.packs[0]?.kind, "sheet");
    assert.equal(compiled.packs[0]?.quantity, 3);
    assert.notEqual(compiled.packs[0]?.quantity, compiled.buy[0]?.quantity);
    assert.deepEqual(compiled.packs[0]?.partIds, ["a", "b", "c"]);
    const cleared = compileBuildGraph({ ...graph, stock: [] });
    assert.deepEqual(cleared.packs, compiled.packs);
    assert.deepEqual(cleared.cuts, compiled.cuts);
    assert.deepEqual(deriveStockPacks(compiled.cuts).packs, compiled.packs);
    const small = compileBuildGraph(stockGraph([
      stockPart("a", { width: 10, height: 0.75, depth: 8 }),
      stockPart("b", { width: 12, height: 0.75, depth: 6 }),
    ]));
    assert.equal(small.packs[0]?.quantity, 1);
    assert.equal(small.stockDisclosure, undefined);
  });

  it("packs lumber from the cut lengths, including edge-glued strips", () => {
    const sticks = [0, 1, 2, 3, 4].map((n) => stockPart(`b${n}`, { width: 40, height: 1.5, depth: 3.5 }, "lumber-2x4-8", "upright"));
    const packed = compileBuildGraph(stockGraph(sticks));
    assert.equal(packed.cuts.length, 5);
    assert.equal(packed.packs.length, 1);
    assert.equal(packed.packs[0]?.kind, "lumber");
    assert.equal(packed.packs[0]?.catalogId, "lumber-2x4-8");
    assert.equal(packed.packs[0]?.quantity, 3);
    assert.equal(packed.stockDisclosure, undefined);
    const one = compileBuildGraph(stockGraph([stockPart("shelf", { width: 30, height: 0.75, depth: 10 }, "lumber-1x4-8")]));
    assert.equal(one.cuts.length, 3, "a 10 inch face is three rips of a 3 1/2 inch board");
    assert.equal(one.packs[0]?.quantity, 1);
    const four = compileBuildGraph(stockGraph([0, 1, 2, 3].map((n) => stockPart(`s${n}`, { width: 30, height: 0.75, depth: 10 }, "lumber-1x4-8"))));
    assert.equal(four.packs[0]?.quantity, 4);
    const member: GraphPart = {
      source: "member",
      materialId: "lumber-2x4-8",
      id: "rail",
      catalogId: "lumber-2x4-8",
      role: "rail",
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      cutLength: 40,
      section: { width: 3.5, height: 1.5 },
    };
    const fromMember = compileBuildGraph(stockGraph([member]));
    assert.equal(fromMember.cuts.length, 1);
    assert.equal(fromMember.cuts[0]?.partId, "rail");
    assert.equal(fromMember.packs[0]?.quantity, 1);
    assert.equal(fromMember.packs[0]?.kind, "lumber");
  });

  it("keeps a quarter-inch back on its own sheet", () => {
    const back = compileBuildGraph(stockGraph([stockPart("Back", { width: 20, height: 0.25, depth: 10 }, "plywood-1-4-4x8", "back")]));
    assert.deepEqual(back.packs.map((pack) => pack.catalogId), ["plywood-1-4-4x8"]);
    assert.equal(back.packs[0]?.quantity, 1);
    assert.equal(back.cuts[0]?.kind, "sheet");
    const mixed = compileBuildGraph(stockGraph([
      stockPart("Side", { width: 0.75, height: 40, depth: 12 }, "plywood-3-4-4x8", "upright"),
      stockPart("Back", { width: 30, height: 0.25, depth: 40 }, "plywood-1-4-4x8", "back"),
    ]));
    assert.deepEqual(mixed.packs.map((pack) => pack.catalogId).sort(), ["plywood-1-4-4x8", "plywood-3-4-4x8"]);
    assert.equal(mixed.packs.find((pack) => pack.catalogId === "plywood-3-4-4x8")?.partIds.includes("Back"), false);
    assert.deepEqual(mixed.packs.find((pack) => pack.catalogId === "plywood-1-4-4x8")?.partIds, ["Back"]);
  });

  it("leaves packs empty when the parts are not cuttable sheet or lumber", () => {
    const stick = (id: string, materialId: string): GraphPart => ({
      source: "member",
      materialId,
      id,
      catalogId: materialId,
      role: "leg",
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      from: { x: 0, y: 0, z: 0 },
      to: { x: 4, y: 0, z: 0 },
      join: "glue",
    });
    const craft = compileBuildGraph(stockGraph(
      [stick("a", "popsicle-standard"), stick("b", "popsicle-standard")],
      { family: "landmark", use: "miniature", primaryMaterialId: "popsicle-standard" },
    ));
    assert.deepEqual(craft.cuts, []);
    assert.deepEqual(craft.packs, []);
    assert.match(craft.stockDisclosure ?? "", /No cuttable sheet or lumber parts/);
    assert.match(craft.stockDisclosure ?? "", /Whole craft stock/);
    assert.match(craft.stockDisclosure ?? "", /2 popsicle-standard/);
    assert.doesNotMatch(craft.stockDisclosure ?? "", /1000|pack of/);
    const hook = compileBuildGraph(stockGraph([stockPart("Coat hook 1", { width: 1.25, height: 2.75, depth: 3.5 }, "hardware")]));
    assert.deepEqual(hook.packs, []);
    assert.match(hook.stockDisclosure ?? "", /bought hardware/);
    const missing = compileBuildGraph(stockGraph([stockPart("Mystery", { width: 10, height: 0.75, depth: 10 }, "not-a-stock")]));
    assert.deepEqual(missing.packs, []);
    assert.match(missing.stockDisclosure ?? "", /No catalog stock: 1 not-a-stock/);
  });

  it("derives the compile-back families from their parts", () => {
    offline(() => {
      const prompts = [
        [CASEWORK, "casework"],
        [`${CASEWORK} in 3/4 inch plywood`, "casework"],
        [`${CASEWORK} in 1/2 inch plywood`, "casework"],
        [`${CASEWORK} from oak`, "casework"],
        [FRAME, "frame-storage"],
        [LANDMARK, "landmark"],
        ["eiffel tower from toothpicks", "landmark"],
      ] as const;
      const rows = prompts.map(([prompt, family]) => ({ prompt, ...roundTrip(prompt, family) }));
      for (const row of rows) {
        const rewritten = compileBuildGraph({
          ...row.graph,
          stock: row.graph.stock.map((line) => ({ ...line, quantity: 99 })),
        });
        assert.deepEqual(rewritten.packs, row.compiled.packs, row.prompt);
        assert.deepEqual(rewritten.cuts, row.compiled.cuts, row.prompt);
        assert.deepEqual(deriveStockPacks(row.compiled.cuts).packs, row.compiled.packs, row.prompt);
        for (const pack of row.compiled.packs) {
          assert.notEqual(pack.quantity, 99, `${row.prompt} ${pack.catalogId}`);
          assert.match(pack.catalogId, /^(?:plywood|lumber)-/);
        }
      }
      const [book, , half, oak, bench, tower, tooth] = rows;
      for (const part of book.graph.parts) {
        assert.ok(book.compiled.cuts.some((cut) => cut.partId === part.id), part.id);
        assert.ok(book.compiled.packs.some((pack) => pack.partIds.includes(part.id)), part.id);
      }
      assert.equal(book.compiled.stockDisclosure, undefined);
      assert.ok(book.compiled.packs.some((pack) => pack.catalogId === "plywood-3-4-4x8"));
      assert.ok(book.compiled.packs.some((pack) => pack.catalogId === "plywood-1-4-4x8"));
      const grown = compileBuildGraph({
        ...book.graph,
        parts: book.graph.parts.map((part) => part.source === "panel" && part.role === "shelf"
          ? { ...part, size: { width: 80, height: 0.75, depth: 40 } }
          : part),
      });
      assert.notDeepEqual(grown.packs, book.compiled.packs);
      assert.ok(half.compiled.packs.some((pack) => pack.catalogId === "plywood-1-2-4x8"));
      assert.equal(half.compiled.packs.some((pack) => pack.catalogId === "plywood-3-4-4x8"), false);
      assert.ok(half.compiled.packs.some((pack) => pack.catalogId === "plywood-1-4-4x8"));
      const upright = oak.graph.parts.find((part) => part.source === "panel" && part.name === "Left upright");
      assert.equal(oak.compiled.cuts.filter((cut) => cut.partId === upright?.id).length, 4);
      const oakBoards = oak.compiled.packs.find((pack) => pack.catalogId === "lumber-1x4-8");
      assert.equal(oakBoards?.quantity, 25);
      assert.match(oakBoards?.notes ?? "", /extra piece/);
      assert.equal(oak.plan.bom.find((line) => line.catalogId === "lumber-1x4-8")?.quantity, 24);
      assert.ok(oak.compiled.packs.some((pack) => pack.kind === "lumber" && pack.catalogId === "lumber-1x4-8"));
      assert.ok(oak.compiled.packs.some((pack) => pack.catalogId === "plywood-1-4-4x8"));
      assert.equal(oak.compiled.packs.some((pack) => pack.catalogId === "plywood-3-4-4x8"), false);
      const top = bench.graph.parts.find((part) => part.role === "top");
      assert.equal(bench.compiled.cuts.filter((cut) => cut.partId === top?.id).length, 2);
      assert.ok(bench.compiled.packs.some((pack) => pack.catalogId === "lumber-2x4-8"));
      assert.ok(bench.compiled.packs.some((pack) => pack.catalogId === "plywood-3-4-4x8"));
      for (const row of [tower, tooth]) {
        assert.deepEqual(row.compiled.cuts, [], row.prompt);
        assert.deepEqual(row.compiled.packs, [], row.prompt);
        assert.match(row.compiled.stockDisclosure ?? "", /No cuttable sheet or lumber parts/, row.prompt);
        assert.match(row.compiled.stockDisclosure ?? "", /whole craft stock/i, row.prompt);
        assert.doesNotMatch(row.compiled.stockDisclosure ?? "", /1000|800|pack of/, row.prompt);
        assert.ok(row.compiled.buy.some((line) => line.catalogId === row.graph.primaryMaterialId), row.prompt);
      }
      const side = stockPart("side", { width: 0.75, height: 10, depth: 20 }, "plywood-3-4-4x8", "upright");
      const shelf = stockPart("shelf", { width: 8, height: 0.75, depth: 20 });
      const screwed = stockGraph([side, shelf]);
      screwed.joints = [{ id: "j1", a: "shelf", b: "side", basis: "declared", patternId: "dado", reviewedJoin: true }];
      side.position = { x: 0, y: 0, z: 0 };
      shelf.position = { x: 0.5, y: 4, z: 0 };
      const both = compileBuildGraph(screwed);
      assert.deepEqual(both.buy.filter(isCarcassScrewLine), fastenerBuyLines(screwed));
      assert.equal(both.fasteners[0]?.screws, 3);
      assert.ok(both.packs.some((pack) => pack.kind === "sheet"));
    });
  });
});
