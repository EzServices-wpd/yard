import assert from "node:assert/strict";
import test from "node:test";
import { backReachesTwoStuds, shallowWallCabinetFace, STUD_CENTER_IN } from "../src/lib/yard/fitted.ts";
import { parseBrief, buildFitted } from "../src/lib/yard/fitted.ts";
import { uniqueSteps } from "../src/lib/yard/steps.ts";
import { buildPlan } from "../src/lib/yard/report.ts";

test("shallow wall cabinet keeps typed depth and clears the hinge", () => {
  const face = shallowWallCabinetFace(4, 0.75);
  assert.equal(face.outer, 4);
  assert.equal(face.doorZ + face.doorT, 4, "door outer face is the typed depth, not depth + slab");
  assert.equal(face.mirrorZ + face.mirrorT, 4, "mirror sits on the outer face");
  assert.ok(face.mirrorZ > face.doorZ, "mirror is not buried in the door slab");
  assert.ok(face.doorZ - 0.75 >= face.shelfDepth, "shelf stops short of the hinge arm");
  assert.equal(backReachesTwoStuds(14.5), false);
  assert.equal(backReachesTwoStuds(STUD_CENTER_IN), true);
});

test("16x24x4 medicine cabinet matches the shallow rule", () => {
  const spec = parseBrief("bathroom medicine cabinet 16 wide 24 high 4 deep");
  assert.ok(spec);
  const project = buildFitted(spec, "bathroom medicine cabinet 16 wide 24 high 4 deep");
  assert.equal(project.overall.depth, 4);
  const door = project.panels.find((p) => p.type === "door");
  const mirror = project.panels.find((p) => p.type === "mirror");
  const shelf = project.panels.find((p) => p.type === "shelf");
  const back = project.panels.find((p) => p.type === "back");
  assert.ok(door && mirror && shelf && back);
  assert.equal(door.position.z + door.size.depth, 4);
  assert.ok(door.position.z + door.size.depth <= 4 + 1e-6);
  assert.equal(mirror.position.z + mirror.size.depth, 4);
  assert.ok(mirror.position.z >= door.position.z + door.size.depth - mirror.size.depth - 1e-6);
  assert.ok(shelf.position.z + shelf.size.depth <= door.position.z - 0.5);
  assert.equal(back.size.width, 14.5);
  const steps = uniqueSteps(project);
  const hang = steps.find((s) => /hang it on studs/i.test(s.title));
  assert.ok(hang);
  assert.match(hang.description, /cannot hit two studs/i);
  assert.doesNotMatch(hang.description, /4 screws, one near each corner/);
  const plan = buildPlan(project);
  const anchors = plan.bom.find((l) => /anchor/i.test(l.name));
  assert.ok(anchors, "buy list includes anchors when the back misses a stud");
  const screws = plan.bom.find((l) => /structural screws/i.test(l.name));
  assert.match(screws?.notes ?? "", /cannot take a screw in two studs/i);
});
