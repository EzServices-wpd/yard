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
import { compileConservation, type ConservationLedger } from "./conservationCompile.ts";
import {
  BUILD_GRAPH_VERSION,
  compileAssembly,
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
  type DerivedAssemblyStep,
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
  assertAssembly(graph, compiled, plan);
  return { project, plan, graph, compiled };
}

function assemblyUses(steps: readonly DerivedAssemblyStep[]): { id: string; qty: number }[] {
  const by = new Map<string, number>();
  for (const step of steps) {
    for (const use of step.fasteners ?? []) by.set(use.id, (by.get(use.id) ?? 0) + use.qty);
  }
  return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([id, qty]) => ({ id, qty }));
}

/** Derived steps follow the ledger, the cuts, and the reviewed joints. They are not the live step text. */
function assertAssembly(graph: YardBuildGraph, compiled: ReturnType<typeof compileBuildGraph>, plan?: BuildPlan) {
  const assembly = compiled.assembly;
  assert.ok(assembly.length >= 1);
  assert.deepEqual(assembly.map((step) => step.step), assembly.map((_, index) => index + 1));
  assert.equal(assembly[0]?.kind, "prepare");
  const prepare = assembly[0];
  assert.deepEqual([...prepare.partIds].sort(), [...new Set(compiled.cuts.map((cut) => cut.partId))].sort());
  if (compiled.cuts.length === 0) assert.equal(prepare.title, "No derived cuts");
  else {
    assert.equal(prepare.title, "Cut derived pieces");
    assert.match(prepare.detail, new RegExp(`\\b${compiled.cuts.length} derived\\b`));
  }
  const known = new Set(graph.parts.map((part) => part.id));
  for (const step of assembly) {
    for (const id of step.partIds) assert.ok(known.has(id), id);
    for (const id of [...(step.hosts ?? []), ...(step.guests ?? [])]) assert.ok(known.has(id), id);
  }
  assert.deepEqual(assemblyUses(assembly), reviewedFastenerUses(graph));
  const ledger = new Map(fastenerDemandLedger(graph).map((row) => [row.pair, row]));
  const reviewed = graph.joints.filter((joint) => joint.reviewedJoin);
  const pairs = new Set(reviewed.map((joint) => pair(joint)));
  const covered = assembly.filter((step) => step.kind === "fasten" || step.kind === "hang");
  assert.equal(covered.length, pairs.size);
  for (const step of covered) {
    const key = step.id.slice(step.kind === "hang" ? "hang:".length : "fasten:".length);
    assert.equal(pairs.has(key), true, step.id);
    const qty = (step.fasteners ?? []).reduce((sum, use) => sum + use.qty, 0);
    assert.equal(qty, ledger.get(key)?.screws ?? 0, step.id);
    const sample = graph.joints.find((joint) => joint.id === step.jointIds[0]);
    const role = jointPattern(sample?.patternId ?? "")?.role;
    const machine = assembly.find((row) => row.kind === "machine" && row.jointIds.includes(sample?.id ?? ""));
    if (role === "shop") {
      if (step.seat === "unresolved") {
        assert.equal(machine, undefined, step.id);
        assert.doesNotMatch(`${step.detail}\n${compiled.assemblyDisclosure ?? ""}`, /both parts are machined/i, step.id);
      } else {
        assert.ok(machine, step.id);
        assert.ok(machine.step < step.step, step.id);
      }
    } else {
      assert.equal(machine, undefined, step.id);
      if (sample?.patternId === "hinge") assert.equal(step.kind, "hang");
    }
  }
  if (pairs.size === 0) {
    assert.equal(assembly.some((step) => step.kind === "machine" || step.kind === "fasten" || step.kind === "hang"), false);
    assert.match(compiled.assemblyDisclosure ?? "", /No reviewed joints/);
    const placed = assembly.filter((step) => step.kind === "place").flatMap((step) => step.partIds);
    assert.deepEqual(placed.slice().sort(), graph.parts.map((part) => part.id).sort());
  }
  const blob = `${assembly.map((step) => `${step.title}\n${step.detail}`).join("\n")}\n${compiled.assemblyDisclosure ?? ""}`;
  assert.doesNotMatch(blob, /Pin 1 adjustable shelf/);
  if (plan) {
    for (const live of plan.instructions) {
      assert.equal(assembly.some((step) => step.title === live.title), false, live.title);
      assert.equal(assembly.some((step) => step.detail === live.description), false, live.title);
    }
  }
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
    assert.equal(live.includes("compileAssembly"), false);
    assert.equal(live.includes("assemblyCompile"), false);
    assert.equal(live.includes("compileConservation"), false);
    assert.equal(live.includes("conservationCompile"), false);
    assert.equal(report.includes("compileAssembly"), false);
    assert.equal(report.includes("assemblyCompile"), false);
    assert.equal(report.includes("compileConservation"), false);
    assert.equal(report.includes("conservationCompile"), false);
    const stock = readFileSync(new URL("./stockCompile.ts", import.meta.url), "utf8");
    assert.doesNotMatch(stock, /lengthReader|promptMain|from "\.\/report|modelJoints|YARD_AI_READER|VITE_PUBLIC_AI_READER|VITE_PUBLIC_YARD_AI_READER/);
    assert.doesNotMatch(stock, /graph\.stock/);
    const assembly = readFileSync(new URL("./assemblyCompile.ts", import.meta.url), "utf8");
    assert.doesNotMatch(assembly, /lengthReader|promptMain|from ["']\.\/report|modelJoints|panelJoints|stickJoints|YARD_AI_READER|VITE_PUBLIC_AI_READER|VITE_PUBLIC_YARD_AI_READER/);
    assert.doesNotMatch(assembly, /graph\.operations|graph\.stock|\b0\.25\b/);
    const conservation = readFileSync(new URL("./conservationCompile.ts", import.meta.url), "utf8");
    assert.doesNotMatch(conservation, /lengthReader|promptMain|from ["']\.\/report|modelJoints|panelJoints|stickJoints|YARD_AI_READER|VITE_PUBLIC_AI_READER|VITE_PUBLIC_YARD_AI_READER/);
    assert.doesNotMatch(conservation, /stockCompile|assemblyCompile|deriveStockPacks|realizeCuttablePieces|compileAssembly|planSheetNest|packLengths|\b0\.25\b/);
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
        const trip = roundTrip(prompt, "casework");
        const graph = trip.graph;
        assert.equal(graph.joints.some((joint) => joint.reviewedJoin), false, prompt);
        assert.equal(trip.compiled.assembly.some((step) => step.kind === "machine"), false, prompt);
        const rails = graph.joints.filter((joint) => {
          const a = trip.project.panels.find((panel) => panel.id === joint.a);
          const b = trip.project.panels.find((panel) => panel.id === joint.b);
          return /front rail/i.test(`${a?.name} ${b?.name}`) && /center support/i.test(`${a?.name} ${b?.name}`);
        });
        if (prompt.startsWith("cubby shelf 48 wide 36")) assert.ok(rails.length >= 3, prompt);
        assert.ok(rails.every((joint) => joint.basis === "contact" && joint.reviewedJoin === false), prompt);
        assert.ok(rails.every((joint) => !trip.compiled.assembly.some((step) => step.jointIds.includes(joint.id))), prompt);
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

  it("glued layers cover the finished thickness", () => {
    const covered = (materialId: string, stock: number, thickness: number, face: number) => {
      const compiled = compileBuildGraph(stockGraph([
        stockPart("part", { width: 36, height: thickness, depth: face }, materialId),
      ]));
      const cuts = compiled.cuts.filter((cut) => cut.partId === "part");
      const stack = cuts.reduce((sum, cut) => sum + cut.thicknessIn, 0);
      assert.equal(cuts.length > 0, true, `${thickness} on ${stock}`);
      assert.ok(stack + 1e-9 >= thickness, `${thickness} on ${stock} covered ${stack}`);
      assert.ok(stack < thickness + stock + 1e-9, `${thickness} on ${stock} used ${stack}`);
      return cuts.length;
    };
    // Between n and n+0.5 stock thicknesses. Round leaves these short.
    assert.equal(covered("plywood-3-4-4x8", 0.75, 1.75, 12), 3);
    assert.equal(covered("lumber-1x4-8", 0.75, 2.5, 3.5), 4);
    assert.equal(covered("lumber-2x4-8", 1.5, 3.5, 3.5), 3);
    // Exact multiples, and a 1" part, already landed on a count that covers.
    assert.equal(covered("plywood-3-4-4x8", 0.75, 1, 12), 2);
    assert.equal(covered("plywood-3-4-4x8", 0.75, 1.5, 12), 2);
    assert.equal(covered("plywood-3-4-4x8", 0.75, 2.25, 12), 3);
    assert.equal(covered("lumber-2x4-8", 1.5, 3, 3.5), 2);
    for (const [materialId, stock, face] of [
      ["plywood-3-4-4x8", 0.75, 18],
      ["lumber-1x4-8", 0.75, 3.5],
      ["lumber-2x4-8", 1.5, 3.5],
    ] as const) {
      const limit = materialId.startsWith("lumber") ? face : stock * 5;
      for (let n = 1; n <= Math.round((limit - stock) * 8); n++) {
        const thickness = Math.round((stock + n / 8) * 8) / 8;
        if (!(thickness > stock + 0.05) || thickness > limit + 1e-9) continue;
        covered(materialId, stock, thickness, face);
      }
    }
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
        assert.equal(row.compiled.assembly[0]?.title, "No derived cuts", row.prompt);
        assert.match(row.compiled.assembly[0]?.detail ?? "", /whole craft stock/i, row.prompt);
        assert.doesNotMatch(`${row.compiled.assembly[0]?.detail}\n${row.compiled.assemblyDisclosure ?? ""}`, /1000|800|pack of/, row.prompt);
        assert.equal(row.compiled.assembly.some((step) => step.kind === "machine" || step.kind === "fasten"), false, row.prompt);
      }
      const assemblyText = (row: (typeof rows)[number]) => [
        ...row.compiled.assembly.map((step) => `${step.title}\n${step.detail}`),
        row.compiled.assemblyDisclosure ?? "",
      ].join("\n");
      assert.match(book.compiled.assembly[0]?.detail ?? "", /\b16 derived cuts\b/);
      assert.equal(book.compiled.assembly.some((step) => step.kind === "machine"), false);
      const bookBack = book.graph.parts.find((part) => part.source === "panel" && part.type === "back");
      assert.ok(bookBack);
      assert.ok(book.compiled.assembly.some((step) => step.kind === "place" && step.partIds.includes(bookBack.id)));
      assert.equal(book.compiled.assembly.some((step) => step.kind === "machine" && step.partIds.includes(bookBack.id)), false);
      const rewritten = compileBuildGraph({
        ...book.graph,
        operations: [{ id: "copied", order: 1, title: "Pin 1 adjustable shelf", description: book.plan.instructions[0]?.description ?? "live", labels: ["*"], partIds: book.graph.parts.map((part) => part.id) }],
        stock: book.graph.stock.map((line) => ({ ...line, quantity: 99 })),
      });
      assert.deepEqual(rewritten.assembly, book.compiled.assembly);
      assert.equal(rewritten.assemblyDisclosure, book.compiled.assemblyDisclosure);
      assert.equal(rewritten.steps[0]?.title, "Pin 1 adjustable shelf");
      assert.notEqual(rewritten.steps[0]?.title, rewritten.assembly[0]?.title);
      assert.match(oak.compiled.assembly[0]?.detail ?? "", /\b61 derived cuts\b/);
      assert.doesNotMatch(assemblyText(oak), /\b24\b|\b25\b/);
      assert.match(assemblyText(bench), /No reviewed joints/);
      assert.doesNotMatch(assemblyText(bench), /pin 1 adjustable shelf|anti-tip/i);
      const benchShelf = bench.graph.parts.find((part) => part.role === "shelf");
      assert.ok(benchShelf);
      assert.ok(bench.compiled.assembly.some((step) => step.kind === "place" && step.partIds.includes(benchShelf.id)));
      assert.equal(bench.compiled.assembly.some((step) => step.kind === "fasten" && step.partIds.includes(benchShelf.id)), false);
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
      assertAssembly(screwed, both);
      const groove = both.assembly.find((step) => step.kind === "machine");
      const screwedFasten = both.assembly.find((step) => step.kind === "fasten");
      assert.equal(groove?.seat, "host");
      assert.deepEqual(groove?.hosts, ["side"]);
      assert.deepEqual(groove?.guests, ["shelf"]);
      assert.ok(groove && screwedFasten && groove.step < screwedFasten.step);
      assert.deepEqual(screwedFasten?.fasteners, [{ id: "screws-8", qty: 3 }]);
      assert.equal(both.steps.length, 0);
    });
  });
});

describe("assembly steps come from joints and parts", () => {
  const housed = () => {
    const side = stockPart("side", { width: 0.75, height: 10, depth: 8 }, "plywood-3-4-4x8", "upright");
    const shelf = stockPart("shelf", { width: 8, height: 0.75, depth: 8 });
    side.position = { x: 0, y: 0, z: 0 };
    shelf.position = { x: 0.5, y: 4, z: 0 };
    const graph = stockGraph([side, shelf]);
    graph.joints = [{ id: "j1", a: "side", b: "shelf", basis: "declared", patternId: "dado", reviewedJoin: true }];
    return graph;
  };

  it("seats the part that enters, and copies the ledger instead of recounting it", () => {
    const graph = housed();
    const compiled = compileBuildGraph(graph);
    assertAssembly(graph, compiled);
    const machine = compiled.assembly.find((step) => step.kind === "machine");
    assert.equal(machine?.machining, "groove");
    assert.deepEqual(machine?.hosts, ["side"]);
    assert.deepEqual(machine?.guests, ["shelf"]);
    const trusted = compileAssembly(graph, {
      cuts: [{ partId: "shelf" }, { partId: "shelf" }, { partId: "side" }],
      fasteners: [{ pair: pair({ a: "side", b: "shelf" }), patternId: "dado", screws: 7 }],
      fastenerId: "screws-8",
    });
    assert.equal(trusted.steps.find((step) => step.kind === "fasten")?.fasteners?.[0]?.qty, 7);
    assert.match(trusted.steps[0]?.detail ?? "", /3 derived cuts for 2 parts/);
    assert.notEqual(compiled.assembly.find((step) => step.kind === "fasten")?.fasteners?.[0]?.qty, 7);
    const planed = compileAssembly(graph, {
      cuts: [],
      fasteners: [{ pair: pair({ a: "side", b: "shelf" }), patternId: "dado", screws: 0, noScrew: "planed" }],
    });
    assert.equal(planed.steps.find((step) => step.kind === "fasten")?.noScrew, "planed");
    assert.equal(planed.steps.find((step) => step.kind === "fasten")?.fasteners, undefined);
    const twice: YardBuildGraph = {
      ...graph,
      joints: [
        graph.joints[0],
        { id: "j2", a: "shelf", b: "side", basis: "declared", patternId: "dado", reviewedJoin: true },
      ],
    };
    const doubled = compileBuildGraph(twice);
    const fastens = doubled.assembly.filter((step) => step.kind === "fasten");
    assert.equal(fastens.length, 1);
    assert.deepEqual(fastens[0]?.jointIds, ["j1", "j2"]);
    assert.equal(fastens[0]?.fasteners?.[0]?.qty, fastenerDemandLedger(twice)[0]?.screws);
    assertAssembly(twice, doubled);
    const contactOnly = stockGraph(graph.parts);
    contactOnly.joints = [{ id: "c1", a: "shelf", b: "side", basis: "contact", contactClass: "butt", reviewedJoin: false }];
    assert.equal(compileBuildGraph(contactOnly).assembly.some((step) => step.kind === "machine" || step.kind === "fasten"), false);
    const cycleBox = (rot: number) => {
      const pos = [0, 0, 0];
      const hostSize = [1.5, 10, 0.75];
      const guestPos = [1, 4, 0];
      const guestSize = [8, 0.5, 8];
      const pick = (xs: number[]) => [xs[rot], xs[(rot + 1) % 3], xs[(rot + 2) % 3]];
      const hostAt = pick(pos);
      const guestAt = pick(guestPos);
      const hostBox = pick(hostSize);
      const guestBox = pick(guestSize);
      const part = (id: string, at: number[], box: number[], materialId: string, type: Panel["type"]): GraphPart => ({
        source: "panel",
        role: type,
        id,
        type,
        name: id,
        materialId,
        position: { x: at[0], y: at[1], z: at[2] },
        size: { width: box[0], height: box[1], depth: box[2] },
      });
      const wide = part("wide", hostAt, hostBox, "plywood-3-4-4x8", "upright");
      const entered = part("entered", guestAt, guestBox, "plywood-1-2-4x8", "shelf");
      const faced = stockGraph([entered, wide]);
      faced.joints = [{ id: "w1", a: "wide", b: "entered", basis: "declared", patternId: "dado", reviewedJoin: true }];
      return faced;
    };
    for (const rot of [0, 1, 2]) {
      const faced = cycleBox(rot);
      const seated = compileBuildGraph(faced);
      const groove = seated.assembly.find((step) => step.kind === "machine");
      assert.deepEqual(groove?.hosts, ["wide"], `rot ${rot}`);
      assert.deepEqual(groove?.guests, ["entered"], `rot ${rot}`);
      assert.equal(groove?.seat, "host", `rot ${rot}`);
    }
  });

  it("groups a drawer, hangs a counted hinge, and leaves glue without screws", () => {
    const side = stockPart("side", { width: 0.75, height: 20, depth: 12 }, "plywood-3-4-4x8", "upright");
    side.position = { x: 0, y: 0, z: 0 };
    const drawer = (id: string, y: number, materialId = "plywood-3-4-4x8", type: Panel["type"] = "drawer") => {
      const part = stockPart(id, { width: 8, height: type === "drawer" && id === "bottom" ? 0.25 : 0.75, depth: 8 }, materialId, type);
      part.position = { x: 1, y, z: 1 };
      part.drawerId = "box";
      if (id === "bottom") part.drawerPart = "bottom";
      return part;
    };
    const front = drawer("front", 10);
    const left = drawer("left", 12);
    const bottom = drawer("bottom", 14, "plywood-1-4-4x8");
    const drawerGraph = stockGraph([left, side, bottom, front]);
    const grouped = compileBuildGraph(drawerGraph);
    assertAssembly(drawerGraph, grouped);
    const places = grouped.assembly.filter((step) => step.kind === "place");
    assert.deepEqual(places.map((step) => step.partIds), [["side"], ["front", "left", "bottom"]]);
    const group = grouped.assembly.find((step) => step.kind === "group");
    assert.equal(group?.subassemblyId, "drawer:box");
    assert.ok(group && places[1] && group.step > places[1].step);
    assert.equal(group?.fasteners, undefined);
    assert.equal(grouped.assembly.some((step) => step.kind === "machine"), false);

    const door = stockPart("door", { width: 12, height: 18, depth: 0.75 }, "plywood-3-4-4x8", "door");
    door.position = { x: 0, y: 1, z: 12 };
    door.hinged = { to: "side", edge: "left", hinges: 2 };
    const hingeGraph = stockGraph([door, side]);
    hingeGraph.joints = [{ id: "h1", a: "door", b: "side", basis: "declared", patternId: "hinge", reviewedJoin: true, reading: "hinge-leaf" }];
    const hung = compileBuildGraph(hingeGraph);
    assertAssembly(hingeGraph, hung);
    const hang = hung.assembly.find((step) => step.kind === "hang");
    assert.equal(hang?.noScrew, "hinge");
    assert.deepEqual(hang?.hardware, { kind: "hinge", qty: 2 });
    assert.deepEqual(hang?.hosts, ["side"]);
    assert.deepEqual(hang?.guests, ["door"]);
    assert.equal(hang?.fasteners, undefined);
    assert.equal(hung.assembly.some((step) => step.kind === "machine"), false);
    const uncounted = stockPart("leaf", { width: 12, height: 18, depth: 0.75 }, "plywood-3-4-4x8", "door");
    uncounted.position = { x: 0, y: 1, z: 12 };
    const bare = stockGraph([uncounted, side]);
    bare.joints = [{ id: "h2", a: "leaf", b: "side", basis: "declared", patternId: "hinge", reviewedJoin: true, reading: "hinge-leaf" }];
    const bareHung = compileBuildGraph(bare);
    assert.match(bareHung.assembly.find((step) => step.kind === "hang")?.detail ?? "", /does not carry a hinge count/);
    assert.equal(bareHung.assembly.find((step) => step.kind === "hang")?.hardware, undefined);

    const glued = compileBuildGraph({ ...housed(), fastener: "glue" });
    assert.equal(glued.assembly.find((step) => step.kind === "fasten")?.noScrew, "glue-stock");
    assert.equal(glued.assembly.find((step) => step.kind === "fasten")?.fasteners, undefined);
    assert.match(glued.assemblyDisclosure ?? "", /ledger is empty/);
    assert.deepEqual(reviewedFastenerUses({ ...housed(), fastener: "glue" }), []);
  });

  it("machines a lap on both parts and still fastens a cycle after the groove", () => {
    const left = stockPart("left", { width: 8, height: 0.75, depth: 8 });
    const right = stockPart("right", { width: 8, height: 0.75, depth: 8 });
    right.position = { x: 1, y: 0, z: 0 };
    const lap = stockGraph([right, left]);
    lap.joints = [{ id: "lap", a: "left", b: "right", basis: "declared", patternId: "lap", reviewedJoin: true }];
    const lapped = compileBuildGraph(lap);
    assertAssembly(lap, lapped);
    const machine = lapped.assembly.find((step) => step.kind === "machine");
    assert.equal(machine?.machining, "half-lap");
    assert.equal(machine?.seat, "both");
    assert.deepEqual(machine?.hosts?.slice().sort(), ["left", "right"]);
    assert.equal(lapped.assemblyDisclosure, undefined);

    const board = (id: string, y: number) => {
      const part = stockPart(id, { width: 4, height: 0.75, depth: 4 });
      part.position = { x: 0, y, z: 0 };
      return part;
    };
    const cycle = stockGraph([board("c", 6), board("a", 0), board("b", 3)]);
    cycle.joints = [
      { id: "ab", a: "b", b: "a", basis: "declared", patternId: "dado", reviewedJoin: true },
      { id: "bc", a: "c", b: "b", basis: "declared", patternId: "dado", reviewedJoin: true },
      { id: "ca", a: "a", b: "c", basis: "declared", patternId: "dado", reviewedJoin: true },
    ];
    const cycled = compileBuildGraph(cycle);
    assert.match(cycled.assemblyDisclosure ?? "", /cycle/);
    assertAssembly(cycle, cycled);
    for (const fasten of cycled.assembly.filter((step) => step.kind === "fasten")) {
      const groove = cycled.assembly.find((step) => step.kind === "machine" && step.id === `machine:${fasten.id.slice("fasten:".length)}`);
      assert.ok(groove && groove.step < fasten.step, fasten.id);
    }
  });

  it("machines the board a notch passes through, not the part named first", () => {
    const carries = (part: GraphPart | undefined) => part?.source === "panel" && /\bnotch(?:ed|es|ing)?\b/i.test(part.cutNote ?? "");
    const notedBoard = (graph: YardBuildGraph, joint: YardBuildGraph["joints"][number]) => {
      const parts = [joint.a, joint.b].map((id) => graph.parts.find((part) => part.id === id));
      const noted = parts.filter(carries);
      assert.equal(noted.length, 1, `${parts.map((part) => (part?.source === "panel" ? part.name : part?.id)).join(" / ")}`);
      return noted[0]!.id;
    };
    const assertNotchRule = (label: string, graph: YardBuildGraph, compiled: ReturnType<typeof compileBuildGraph>) => {
      const notches = graph.joints.filter((joint) => joint.reviewedJoin && joint.patternId === "notch");
      assert.ok(notches.length > 0, label);
      const seen = new Set<string>();
      for (const joint of notches) {
        const key = pair(joint);
        if (seen.has(key)) continue;
        seen.add(key);
        const board = notedBoard(graph, joint);
        const machine = compiled.assembly.find((step) => step.kind === "machine" && step.jointIds.includes(joint.id));
        assert.deepEqual(machine?.hosts, [board], `${label} ${key}`);
        assert.equal(machine?.machining, "notch", label);
        const other = joint.a === board ? joint.b : joint.a;
        assert.equal(machine?.hosts?.includes(other), false, label);
        assert.doesNotMatch(`${machine?.detail}\n${compiled.assemblyDisclosure ?? ""}`, /both parts are machined/i, label);
      }
    };
    offline(() => {
      for (const prompt of ["utility cart", "rolling utility cart"]) {
        const trip = roundTrip(prompt, "frame-storage");
        assertNotchRule(prompt, trip.graph, trip.compiled);
      }
      const coop = roundTrip("chicken coop", "frame-storage");
      assertNotchRule("chicken coop", coop.graph, coop.compiled);
      const floor = coop.graph.parts.find((part) => part.source === "panel" && part.name === "Floor");
      const legs = coop.graph.parts.filter((part) => part.source === "panel" && /^Leg /.test(part.name));
      assert.ok(floor && legs.length >= 4);
      const floorNotches = coop.compiled.assembly.filter((step) => step.kind === "machine" && step.machining === "notch" && step.hosts?.includes(floor.id));
      assert.equal(floorNotches.length, legs.length);
      assert.ok(floorNotches.every((step) => step.hosts?.length === 1 && !step.guests?.some((id) => coop.graph.parts.find((part) => part.id === id && part.source === "panel" && part.name === "Floor"))));
    });

    const board = stockPart("board", { width: 20, height: 0.75, depth: 12 }, "plywood-3-4-4x8", "shelf");
    board.position = { x: 0, y: 10, z: 0 };
    board.cutNote = "Notch the corner 1 1/2\" × 1 1/2\" so the board fits around the post.";
    const post = stockPart("post", { width: 1.5, height: 30, depth: 1.5 }, "lumber-2x2-8", "upright");
    post.position = { x: 0, y: 0, z: 0 };
    for (const first of ["board", "post"] as const) {
      const graph = stockGraph([board, post]);
      graph.joints = [{
        id: "n1",
        a: first,
        b: first === "board" ? "post" : "board",
        basis: "declared",
        patternId: "notch",
        reviewedJoin: true,
      }];
      const compiled = compileBuildGraph(graph);
      assertNotchRule(`declared ${first}-first`, graph, compiled);
      assert.deepEqual(compiled.assembly.find((step) => step.kind === "machine")?.hosts, ["board"]);
    }

    const idle = stockPart("idle", { width: 8, height: 0.75, depth: 8 });
    idle.position = { x: 0, y: 0, z: 0 };
    const apart = stockPart("apart", { width: 1.5, height: 20, depth: 1.5 }, "lumber-2x2-8", "upright");
    apart.position = { x: 30, y: 0, z: 0 };
    const unread = stockGraph([idle, apart]);
    unread.joints = [{ id: "n2", a: "idle", b: "apart", basis: "declared", patternId: "notch", reviewedJoin: true }];
    const open = compileBuildGraph(unread);
    assert.equal(open.assembly.some((step) => step.kind === "machine"), false);
    assert.match(open.assemblyDisclosure ?? "", /unresolved/);
    assert.doesNotMatch(`${open.assembly.map((step) => step.detail).join("\n")}\n${open.assemblyDisclosure ?? ""}`, /both parts are machined/i);

    const flat = stockPart("flat", { width: 10, height: 0.75, depth: 2 });
    flat.position = { x: 0, y: 4, z: 0 };
    flat.cutNote = "Notch where the boards cross.";
    const upright = stockPart("upright", { width: 0.75, height: 10, depth: 2 }, "plywood-3-4-4x8", "divider");
    upright.position = { x: 4, y: 0, z: 0 };
    upright.cutNote = "Notch where the boards cross.";
    const tied = stockGraph([flat, upright]);
    tied.joints = [{ id: "n3", a: "flat", b: "upright", basis: "declared", patternId: "notch", reviewedJoin: true }];
    const tie = compileBuildGraph(tied);
    assert.equal(tie.assembly.find((step) => step.kind === "machine")?.hosts, undefined);
    assert.match(tie.assemblyDisclosure ?? "", /unresolved/);
    assert.doesNotMatch(`${tie.assembly.map((step) => step.detail).join("\n")}\n${tie.assemblyDisclosure ?? ""}`, /both parts are machined/i);
  });

  it("keeps a part id out of the seating status, and seats a thin corner crossing", () => {
    const declare = (graph: YardBuildGraph, first: string, second: string, patternId: "notch" | "dado") => {
      graph.joints = [{ id: "j", a: first, b: second, basis: "declared", patternId, reviewedJoin: true }];
    };
    const textOf = (compiled: ReturnType<typeof compileBuildGraph>) =>
      `${compiled.assembly.map((step) => step.detail).join("\n")}\n${compiled.assemblyDisclosure ?? ""}`;
    for (const boardId of ["board", "tie", ""]) {
      const board = stockPart(boardId, { width: 20, height: 0.75, depth: 12 }, "plywood-3-4-4x8", "shelf");
      board.name = "board";
      board.position = { x: 0, y: 10, z: 0 };
      const post = stockPart("post", { width: 1.5, height: 30, depth: 1.5 }, "lumber-2x2-8", "upright");
      post.name = "post";
      post.position = { x: 0, y: 0, z: 0 };
      for (const first of [boardId, "post"]) {
        const graph = stockGraph([board, post]);
        declare(graph, first, first === boardId ? "post" : boardId, "notch");
        const compiled = compileBuildGraph(graph);
        const machine = compiled.assembly.find((step) => step.kind === "machine");
        assert.deepEqual(machine?.hosts, [boardId], `${JSON.stringify(boardId)} declared ${JSON.stringify(first)}-first`);
        assert.equal(machine?.machining, "notch");
        assert.equal(compiled.assemblyDisclosure, undefined, boardId);
      }
    }
    for (const guestId of ["shelf", "tie", ""]) {
      const side = stockPart("side", { width: 0.75, height: 10, depth: 20 }, "plywood-3-4-4x8", "upright");
      side.position = { x: 0, y: 0, z: 0 };
      const shelf = stockPart(guestId, { width: 8, height: 0.75, depth: 20 });
      shelf.name = "shelf";
      shelf.position = { x: 0.5, y: 4, z: 0 };
      for (const first of ["side", guestId]) {
        const graph = stockGraph([side, shelf]);
        declare(graph, first, first === "side" ? guestId : "side", "dado");
        const compiled = compileBuildGraph(graph);
        const machine = compiled.assembly.find((step) => step.kind === "machine");
        assert.equal(machine?.machining, "groove", `${JSON.stringify(guestId)} declared ${JSON.stringify(first)}-first`);
        assert.deepEqual(machine?.hosts, ["side"], JSON.stringify(guestId));
        assert.deepEqual(machine?.guests, [guestId], JSON.stringify(guestId));
        assert.equal(compiled.assembly.find((step) => step.kind === "fasten")?.fasteners?.[0]?.qty, 3, JSON.stringify(guestId));
      }
    }
    for (const doorId of ["door", ""]) {
      const side = stockPart("side", { width: 0.75, height: 20, depth: 12 }, "plywood-3-4-4x8", "upright");
      side.position = { x: 0, y: 0, z: 0 };
      const door = stockPart(doorId, { width: 12, height: 18, depth: 0.75 }, "plywood-3-4-4x8", "door");
      door.name = "door";
      door.position = { x: 0, y: 1, z: 12 };
      door.hinged = { to: "side", edge: "left", hinges: 2 };
      for (const first of [doorId, "side"]) {
        const graph = stockGraph([door, side]);
        graph.joints = [{
          id: "h",
          a: first,
          b: first === doorId ? "side" : doorId,
          basis: "declared",
          patternId: "hinge",
          reviewedJoin: true,
          reading: "hinge-leaf",
        }];
        const compiled = compileBuildGraph(graph);
        const hang = compiled.assembly.find((step) => step.kind === "hang");
        assert.deepEqual(hang?.hosts, ["side"], `${JSON.stringify(doorId)} declared ${JSON.stringify(first)}-first`);
        assert.deepEqual(hang?.guests, [doorId], JSON.stringify(doorId));
        assert.deepEqual(hang?.hardware, { kind: "hinge", qty: 2 }, JSON.stringify(doorId));
        assert.equal(hang?.noScrew, "hinge");
        assert.equal(compiled.assembly.some((step) => step.kind === "machine"), false);
      }
    }
    for (const [label, overlap, seats] of [
      ["1/8", 1 / 8, true],
      ["1/16", 1 / 16, true],
      ["1/32", 1 / 32, true],
      ["zero", 0, false],
      ["gap", -1 / 16, false],
    ] as const) {
      const board = stockPart("board", { width: 20, height: 0.75, depth: 12 }, "plywood-3-4-4x8", "shelf");
      board.name = "board";
      board.position = { x: 0, y: 10, z: 0 };
      const post = stockPart("post", { width: 1.5, height: 30, depth: 1.5 }, "lumber-2x2-8", "upright");
      post.name = "post";
      post.position = { x: 20 - overlap, y: 0, z: 0 };
      for (const first of ["board", "post"] as const) {
        const graph = stockGraph([board, post]);
        declare(graph, first, first === "board" ? "post" : "board", "notch");
        const compiled = compileBuildGraph(graph);
        const machine = compiled.assembly.find((step) => step.kind === "machine");
        if (seats) {
          assert.deepEqual(machine?.hosts, ["board"], `${label} ${first}-first`);
          assert.equal(compiled.assemblyDisclosure, undefined, label);
        } else {
          assert.equal(machine, undefined, `${label} ${first}-first`);
          assert.match(compiled.assemblyDisclosure ?? "", /unresolved/, label);
          assert.doesNotMatch(textOf(compiled), /both parts are machined/i, label);
          assert.equal(compiled.assembly.some((step) => step.kind === "fasten"), true, label);
        }
      }
    }
  });
});

const STRUCTURAL = ["cut-identity", "joint-work", "allocation", "packs", "invention"] as const;

function structuralStatus(ledger: ConservationLedger, check: (typeof STRUCTURAL)[number]): string {
  return ledger.findings.find((row) => row.id === check)?.status ?? "missing";
}

function assertStructuralHolds(ledger: ConservationLedger, label: string) {
  for (const check of STRUCTURAL) {
    const row = ledger.findings.find((finding) => finding.id === check);
    assert.equal(row?.status, "holds", `${label} ${check}: ${row?.detail ?? "missing"}`);
  }
}

describe("conservation checks the compiled graph without becoming it", () => {
  it("keeps an empty part id, and reports a tampered host, pack, and invented cut", () => {
    const sheet = stockPart("", { width: 12, height: 0.75, depth: 8 }, "plywood-3-4-4x8", "shelf");
    sheet.name = "Board";
    const dropped = compileBuildGraph(stockGraph([sheet], { stock: [] }));
    assert.equal(dropped.model.panels[0]?.id, "");
    assert.deepEqual(dropped.cuts, []);
    assert.equal(structuralStatus(dropped.conservation, "allocation"), "gap");
    assert.match(dropped.conservation.findings.find((row) => row.id === "allocation")?.detail ?? "", /no derived cut/);
    assert.equal(dropped.conservation.findings.find((row) => row.id === "allocation")?.subjects.includes(""), true);
    assert.doesNotMatch(dropped.conservation.findings.map((row) => row.detail).join("\n"), /invalid|rejected/);
    assert.equal(structuralStatus(dropped.conservation, "invention"), "holds");
    assert.equal(structuralStatus(dropped.conservation, "cut-identity"), "holds");

    const board = stockPart("", { width: 30, height: 1.5, depth: 3.5 }, "lumber-2x4-8", "rail");
    board.name = "Rail";
    const graph = stockGraph([board], { stock: [] });
    const compiled = compileBuildGraph(graph);
    assert.equal(compiled.cuts[0]?.partId, "");
    assert.equal(compiled.model.panels[0]?.id, "");
    assertStructuralHolds(compiled.conservation, "empty id");
    assert.equal(compiled.conservation.findings.some((row) => row.id.startsWith("disclosed:pack:")), false);

    const swapped = compileConservation(graph, {
      ...compiled,
      assembly: compiled.assembly.map((step) => ({ ...step, partIds: step.partIds.filter((id) => id !== "") })),
    });
    assert.equal(structuralStatus(swapped, "cut-identity"), "gap");
    assert.match(swapped.findings.find((row) => row.id === "cut-identity")?.detail ?? "", /no assembly step/);

    const invented = compileConservation(graph, {
      ...compiled,
      cuts: [...compiled.cuts, {
        partId: "nope",
        materialId: "lumber-2x4-8",
        lengthIn: 4,
        widthIn: 3.5,
        thicknessIn: 1.5,
        kind: "lumber",
      }],
    });
    assert.equal(structuralStatus(invented, "invention"), "gap");
    assert.equal(structuralStatus(invented, "cut-identity"), "gap");
    assert.match(invented.findings.find((row) => row.id === "cut-identity")?.detail ?? "", /nope/);

    const short = compileConservation(graph, {
      ...compiled,
      packs: compiled.packs.map((pack) => ({ ...pack, quantity: 0 })),
    });
    assert.equal(structuralStatus(short, "packs"), "gap");
    assert.equal(compiled.packs[0]?.quantity, 1);
  });

  it("recomputes the machined part, and does not treat contact as a joint", () => {
    const side = stockPart("side", { width: 0.75, height: 10, depth: 20 }, "plywood-3-4-4x8", "upright");
    const shelf = stockPart("shelf", { width: 8, height: 0.75, depth: 20 });
    side.position = { x: 0, y: 0, z: 0 };
    shelf.position = { x: 0.5, y: 4, z: 0 };
    const graph = stockGraph([side, shelf], { stock: [] });
    graph.joints = [{ id: "j1", a: "shelf", b: "side", basis: "declared", patternId: "dado", reviewedJoin: true }];
    const compiled = compileBuildGraph(graph);
    assertStructuralHolds(compiled.conservation, "dado");
    assert.match(compiled.conservation.findings.find((row) => row.id === "joint-work")?.detail ?? "", /not a joint/);
    const machine = compiled.assembly.find((step) => step.kind === "machine");
    assert.ok(machine);
    const wrongHost = compileConservation(graph, {
      ...compiled,
      assembly: compiled.assembly.map((step) => step.kind === "machine"
        ? { ...step, partIds: ["shelf"], hosts: ["shelf"], guests: ["side"] }
        : step),
    });
    assert.equal(structuralStatus(wrongHost, "joint-work"), "gap");
    assert.match(wrongHost.findings.find((row) => row.id === "joint-work")?.detail ?? "", /side/);
    assert.deepEqual(compiled.assembly.find((step) => step.kind === "machine")?.hosts, ["side"]);

    const contactOnly = stockGraph([side, shelf], { stock: [] });
    contactOnly.joints = [{ id: "c1", a: "shelf", b: "side", basis: "contact", contactClass: "butt", reviewedJoin: false }];
    const touched = compileBuildGraph(contactOnly);
    assertStructuralHolds(touched.conservation, "contact");
    assert.equal(touched.assembly.some((step) => step.kind === "machine" || step.kind === "fasten"), false);
    const pretend = compileConservation(contactOnly, {
      ...touched,
      assembly: [...touched.assembly, {
        step: touched.assembly.length + 1,
        kind: "machine",
        partIds: ["side"],
        jointIds: ["c1"],
        machining: "groove",
        hosts: ["side"],
        guests: ["shelf"],
      }],
    });
    assert.equal(structuralStatus(pretend, "joint-work"), "gap");
    assert.match(pretend.findings.find((row) => row.id === "joint-work")?.detail ?? "", /Contact is not a joint/);
  });

  it("records the honest family gaps and does not copy the live quantities onto the derived packs", () => {
    offline(() => {
      const prompts = [
        [CASEWORK, "casework"],
        [`${CASEWORK} in 3/4 inch plywood`, "casework"],
        [`${CASEWORK} in 1/2 inch plywood`, "casework"],
        [`${CASEWORK} from oak`, "casework"],
        [FRAME, "frame-storage"],
        [LANDMARK, "landmark"],
        ["eiffel tower from toothpicks", "landmark"],
        ["utility cart", "frame-storage"],
      ] as const;
      for (const [prompt, family] of prompts) {
        const trip = roundTrip(prompt, family);
        assertStructuralHolds(trip.compiled.conservation, prompt);
        assert.equal(trip.compiled.steps.map((step) => step.title).join("|"), trip.plan.instructions.map((step) => step.title).join("|"), prompt);
      }
      const book = roundTrip(CASEWORK, "casework");
      const back = book.graph.parts.find((part) => part.source === "panel" && part.type === "back");
      assert.ok(back);
      const backGap = book.compiled.conservation.findings.find((row) => row.id === `disclosed:back:${back.id}`);
      assert.equal(backGap?.status, "gap");
      assert.match(backGap?.detail ?? "", /placed, not rebated/);
      assert.equal(book.compiled.assembly.some((step) => step.kind === "machine" && step.partIds.includes(back.id)), false);
      assert.equal(book.compiled.conservation.findings.some((row) => row.id.startsWith("disclosed:pack:")), false);
      const pin = book.compiled.conservation.findings.find((row) => row.id.startsWith("disclosed:copied:") && /pin/i.test(row.detail));
      assert.match(pin?.detail ?? "", /places/);
      assert.match(pin?.detail ?? "", /does not fasten/);

      const oak = roundTrip(`${CASEWORK} from oak`, "casework");
      const boards = oak.compiled.packs.find((pack) => pack.catalogId === "lumber-1x4-8");
      assert.equal(boards?.quantity, 25);
      assert.equal(oak.graph.stock.find((line) => line.catalogId === "lumber-1x4-8")?.quantity, 24);
      const oakGap = oak.compiled.conservation.findings.find((row) => row.id === "disclosed:pack:lumber-1x4-8");
      assert.equal(oakGap?.status, "gap");
      assert.match(oakGap?.detail ?? "", /\b25\b/);
      assert.match(oakGap?.detail ?? "", /\b24\b/);
      assert.match(oakGap?.detail ?? "", /not written onto the pack/);
      const oakAssembly = [...oak.compiled.assembly.map((step) => `${step.title}\n${step.detail}`), oak.compiled.assemblyDisclosure ?? ""].join("\n");
      assert.doesNotMatch(oakAssembly, /\b24\b|\b25\b/);
      assert.equal(oak.compiled.conservation.findings.find((row) => row.id === "packs")?.status, "holds");

      const bench = roundTrip(FRAME, "frame-storage");
      const shelf = bench.graph.parts.find((part) => part.role === "shelf");
      assert.ok(shelf);
      const shelfGap = bench.compiled.conservation.findings.find((row) => row.subjects.includes(shelf.id) && row.id.startsWith("disclosed:copied:"));
      assert.match(shelfGap?.detail ?? "", /Pin 1 adjustable shelf/i);
      assert.match(shelfGap?.detail ?? "", /does not fasten/);
      assert.equal(bench.compiled.assembly.some((step) => step.kind === "fasten" && step.partIds.includes(shelf.id)), false);
      assert.ok(bench.compiled.assembly.some((step) => step.kind === "place" && step.partIds.includes(shelf.id)));
      assert.equal(bench.compiled.steps.some((step) => /pin 1 adjustable shelf/i.test(step.title)), true);
      assert.equal(bench.compiled.conservation.findings.some((row) => row.id.startsWith("disclosed:back:")), false);

      for (const [prompt, materialId] of [[LANDMARK, "popsicle-standard"], ["eiffel tower from toothpicks", "toothpick"]] as const) {
        const trip = roundTrip(prompt, "landmark");
        assert.deepEqual(trip.compiled.cuts, [], prompt);
        assert.deepEqual(trip.compiled.packs, [], prompt);
        const whole = trip.compiled.conservation.findings.find((row) => row.id === `disclosed:whole:${materialId}`);
        assert.equal(whole?.status, "gap", prompt);
        assert.match(whole?.detail ?? "", /0 derived cuts and 0 derived packs/, prompt);
        assert.match(whole?.detail ?? "", /not written into packs/, prompt);
        const copied = trip.graph.stock.find((line) => line.catalogId === materialId);
        assert.ok(copied, prompt);
        assert.match(whole?.detail ?? "", new RegExp(`\\b${copied.quantity}\\b`), prompt);
        assert.equal((whole?.detail ?? "").includes(copied.unit), true, prompt);
        const derived = `${trip.compiled.stockDisclosure ?? ""}\n${trip.compiled.assembly.map((step) => step.detail).join("\n")}`;
        assert.doesNotMatch(derived, /1000|800/, prompt);
        assert.equal(trip.compiled.packs.some((pack) => pack.quantity === copied.quantity), false, prompt);
      }
    });
  });

  it("gaps a cut list that is short, split, duplicated, or the wrong thickness", () => {
    const railPart = stockPart("rail", { width: 30, height: 1.5, depth: 3.5 }, "lumber-2x4-8", "rail");
    railPart.name = "Rail";
    const railGraph = stockGraph([railPart], { stock: [] });
    const rail = compileBuildGraph(railGraph);
    assertStructuralHolds(rail.conservation, "30 inch rail");
    const shortened = compileConservation(railGraph, {
      ...rail,
      cuts: rail.cuts.map((cut) => ({ ...cut, lengthIn: 1 })),
    });
    assert.equal(structuralStatus(shortened, "allocation"), "gap");
    assert.match(shortened.findings.find((row) => row.id === "allocation")?.detail ?? "", /do not match/);

    const thin = compileConservation(railGraph, {
      ...rail,
      cuts: rail.cuts.map((cut) => ({ ...cut, thicknessIn: 0.25 })),
    });
    assert.equal(structuralStatus(thin, "allocation"), "gap");

    const side = stockPart("side", { width: 0.75, height: 10, depth: 20 }, "plywood-3-4-4x8", "upright");
    const shelf = stockPart("shelf", { width: 8, height: 0.75, depth: 20 });
    side.position = { x: 0, y: 0, z: 0 };
    shelf.position = { x: 0.5, y: 4, z: 0 };
    const housedGraph = stockGraph([side, shelf], { stock: [] });
    housedGraph.joints = [{ id: "j1", a: "shelf", b: "side", basis: "declared", patternId: "dado", reviewedJoin: true }];
    const housed = compileBuildGraph(housedGraph);
    assertStructuralHolds(housed.conservation, "housed");
    const shelfCut = housed.cuts.find((cut) => cut.partId === "shelf");
    assert.ok(shelfCut);
    const duplicated = compileConservation(housedGraph, {
      ...housed,
      cuts: [...housed.cuts, { ...shelfCut }],
    });
    assert.equal(structuralStatus(duplicated, "allocation"), "gap");
    assert.match(duplicated.findings.find((row) => row.id === "allocation")?.detail ?? "", /asks for/);
    const split = compileConservation(housedGraph, {
      ...housed,
      cuts: housed.cuts.flatMap((cut) => cut.partId === "shelf"
        ? [{ ...cut, widthIn: cut.widthIn / 2 }, { ...cut, widthIn: cut.widthIn / 2 }]
        : [cut]),
    });
    assert.equal(structuralStatus(split, "allocation"), "gap");

    const bothOne = compileConservation(housedGraph, {
      ...housed,
      fasteners: housed.fasteners.map((row) => ({ ...row, screws: 1 })),
      assembly: housed.assembly.map((step) => step.kind === "fasten"
        ? { ...step, fasteners: [{ id: "screws-8", qty: 1 }] }
        : step),
    });
    assert.equal(structuralStatus(bothOne, "joint-work"), "gap");
    assert.match(bothOne.findings.find((row) => row.id === "joint-work")?.detail ?? "", /boxes ask for 3/);
    assert.equal(structuralStatus(bothOne, "invention"), "gap");
  });

  it("does not certify a pack from the compiled cuts, or let a copied Buy quantity erase the oak gap", () => {
    offline(() => {
      const cart = roundTrip("utility cart", "frame-storage");
      assert.ok(cart.compiled.cuts.some((cut) => cut.kind === "lumber"));
      const shortCart = compileConservation(cart.graph, {
        ...cart.compiled,
        cuts: cart.compiled.cuts.map((cut) => cut.kind === "lumber" ? { ...cut, lengthIn: 1 } : cut),
        packs: cart.compiled.packs.map((pack) => pack.kind === "lumber" ? { ...pack, quantity: 1 } : pack),
      });
      assert.equal(structuralStatus(shortCart, "allocation"), "gap");
      assert.equal(structuralStatus(shortCart, "packs"), "gap");
      assert.match(shortCart.findings.find((row) => row.id === "packs")?.detail ?? "", /geometry needs/);

      const book = roundTrip(CASEWORK, "casework");
      const sheetCut = book.compiled.cuts.find((cut) => cut.kind === "sheet");
      assert.ok(sheetCut);
      const extraSheet = compileConservation(book.graph, {
        ...book.compiled,
        cuts: [...book.compiled.cuts, { ...sheetCut }],
      });
      assert.equal(structuralStatus(extraSheet, "allocation"), "gap");

      const oak = roundTrip(`${CASEWORK} from oak`, "casework");
      const rewritten = compileConservation(oak.graph, {
        ...oak.compiled,
        packs: oak.compiled.packs.map((pack) => pack.catalogId === "lumber-1x4-8" ? { ...pack, quantity: 24 } : pack),
      });
      const oakGap = rewritten.findings.find((row) => row.id === "disclosed:pack:lumber-1x4-8");
      assert.equal(oakGap?.status, "gap");
      assert.equal(oakGap?.basis, "geometry");
      assert.match(oakGap?.detail ?? "", /geometry is 25/);
      assert.match(oakGap?.detail ?? "", /\b24\b/);
      assert.equal(structuralStatus(rewritten, "packs"), "gap");
      assert.match(rewritten.findings.find((row) => row.id === "packs")?.detail ?? "", /needs 25/);

      const long = stockPart("rail", { width: 120, height: 1.5, depth: 3.5 }, "lumber-2x4-8", "rail");
      long.name = "Long rail";
      const longGraph = stockGraph([long], { stock: [] });
      const compiledLong = compileBuildGraph(longGraph);
      assert.equal(compiledLong.cuts.some((cut) => cut.lengthIn === 120), true);
      const packedLong = compileConservation(longGraph, {
        ...compiledLong,
        cuts: [{ partId: "rail", materialId: "lumber-2x4-8", lengthIn: 120, widthIn: 3.5, thicknessIn: 1.5, kind: "lumber" }],
        packs: [{ kind: "lumber", catalogId: "lumber-2x4-8", quantity: 2, partIds: ["rail"] }],
      });
      assert.equal(structuralStatus(packedLong, "allocation"), "holds");
      assert.equal(structuralStatus(packedLong, "packs"), "gap");
      assert.match(packedLong.findings.find((row) => row.id === "packs")?.detail ?? "", /not certified as packed/);
      assert.equal(packedLong.findings.some((row) => row.id === "disclosed:splice:rail" && row.status === "gap"), true);
      assert.equal(structuralStatus(compiledLong.conservation, "packs"), "gap");
    });
  });

  it("rejects work with no reviewed joint, and does not let that work erase a disclosure", () => {
    offline(() => {
      const bench = roundTrip(FRAME, "frame-storage");
      const shelf = bench.graph.parts.find((part) => part.role === "shelf");
      assert.ok(shelf);
      const pinned = compileConservation(bench.graph, {
        ...bench.compiled,
        assembly: [...bench.compiled.assembly, {
          step: bench.compiled.assembly.length + 1,
          kind: "fasten",
          partIds: [shelf.id],
          jointIds: [],
        }],
      });
      assert.equal(structuralStatus(pinned, "joint-work"), "gap");
      assert.match(pinned.findings.find((row) => row.id === "joint-work")?.detail ?? "", /not justified by a reviewed joint/);
      const shelfGap = pinned.findings.find((row) => row.subjects.includes(shelf.id) && row.id.startsWith("disclosed:copied:"));
      assert.match(shelfGap?.detail ?? "", /Pin 1 adjustable shelf/i);
      assert.match(shelfGap?.detail ?? "", /does not fasten/);

      const book = roundTrip(CASEWORK, "casework");
      const back = book.graph.parts.find((part) => part.source === "panel" && part.type === "back");
      assert.ok(back);
      const rebated = compileConservation(book.graph, {
        ...book.compiled,
        assembly: [...book.compiled.assembly, {
          step: book.compiled.assembly.length + 1,
          kind: "machine",
          partIds: [back.id],
          jointIds: [],
          machining: "rebate",
        }],
      });
      assert.equal(structuralStatus(rebated, "joint-work"), "gap");
      const backGap = rebated.findings.find((row) => row.id === `disclosed:back:${back.id}`);
      assert.equal(backGap?.status, "gap");
      assert.match(backGap?.detail ?? "", /placed, not rebated/);

      const cart = roundTrip("utility cart", "frame-storage");
      const leg = cart.graph.parts.find((part) => part.source === "panel" && /\b(?:leg|post)\b/i.test(part.name));
      assert.ok(leg);
      const inventedNotch = compileConservation(cart.graph, {
        ...cart.compiled,
        assembly: [...cart.compiled.assembly, {
          step: cart.compiled.assembly.length + 1,
          kind: "machine",
          partIds: [leg.id],
          jointIds: [],
          machining: "notch",
        }],
      });
      assert.equal(structuralStatus(inventedNotch, "joint-work"), "gap");
      assert.match(inventedNotch.findings.find((row) => row.id === "joint-work")?.detail ?? "", /not justified by a reviewed joint/);

      const row = cart.compiled.fasteners.find((entry) => entry.screws > 0);
      assert.ok(row);
      const dropped = compileConservation(cart.graph, {
        ...cart.compiled,
        fasteners: cart.compiled.fasteners.filter((entry) => entry.pair !== row.pair),
        assembly: cart.compiled.assembly.map((step) => step.kind === "fasten" && step.jointIds.some((id) => {
          const joint = cart.graph.joints.find((item) => item.id === id);
          return joint !== undefined && [joint.a, joint.b].sort().join("|") === row.pair;
        })
          ? { ...step, fasteners: undefined }
          : step),
      });
      assert.equal(structuralStatus(dropped, "joint-work"), "gap");
      assert.equal(structuralStatus(dropped, "invention"), "gap");
      assert.match(dropped.findings.find((entry) => entry.id === "invention")?.detail ?? "", /no fastener row/);

      const cubby = roundTrip("cubby shelf 48 wide 36 tall 12 deep", "casework");
      assertStructuralHolds(cubby.compiled.conservation, "cubby");
      const prepareOnly = compileConservation(cubby.graph, {
        ...cubby.compiled,
        assembly: cubby.compiled.assembly.filter((step) => step.kind === "prepare"),
      });
      assert.equal(structuralStatus(prepareOnly, "cut-identity"), "gap");
      assert.match(prepareOnly.findings.find((entry) => entry.id === "cut-identity")?.detail ?? "", /besides prepare/);
      for (const check of STRUCTURAL) {
        assert.equal(cubby.compiled.conservation.findings.find((entry) => entry.id === check)?.basis, "geometry", check);
      }
    });
  });
});
