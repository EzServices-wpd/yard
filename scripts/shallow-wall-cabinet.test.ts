import assert from "node:assert/strict";
import test from "node:test";
import { backReachesTwoStuds, shallowWallCabinetFace, STUD_CENTER_IN } from "../src/lib/yard/fitted.ts";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { uniqueSteps } from "../src/lib/yard/steps.ts";
import { buildPlan } from "../src/lib/yard/report.ts";

test("shallow wall cabinet keeps typed depth and clears the hinge", () => {
  const face = shallowWallCabinetFace(4, 0.75, true);
  assert.equal(face.outer, 4);
  assert.equal(face.box, face.doorZ, "carcase stops where the door begins");
  assert.equal(face.mirrorZ + face.mirrorT, 4, "mirror's face is the typed depth, not depth + slab");
  assert.equal(face.mirrorZ, face.doorZ + face.doorT, "mirror sits on the door's outer face, not buried in it");
  const plain = shallowWallCabinetFace(4, 0.75);
  assert.equal(plain.doorZ + plain.doorT, 4, "no mirror: door outer face is the typed depth");
  assert.ok(face.doorZ - 0.75 >= face.shelfDepth, "shelf stops short of the hinge arm");
  assert.equal(backReachesTwoStuds(14.5), false);
  assert.equal(backReachesTwoStuds(STUD_CENTER_IN), true);
});

test("16x24x4 medicine cabinet: the solved layout matches the shallow rule", () => {
  const project = generateFromPrompt("bathroom medicine cabinet 16 wide 24 high 4 deep");
  assert.equal(project.overall.depth, 4);
  const door = project.panels.find((p) => p.type === "door");
  const mirror = project.panels.find((p) => p.type === "mirror");
  const shelf = project.panels.find((p) => p.type === "shelf");
  const back = project.panels.find((p) => p.type === "back");
  const upright = project.panels.find((p) => p.type === "upright");
  assert.ok(door && mirror && shelf && back && upright);
  const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.01, `${a} vs ${b}`);
  near(upright.position.z + upright.size.depth, door.position.z); // door closes on the carcase front
  near(mirror.position.z, door.position.z + door.size.depth); // mirror on the door's outer face
  near(mirror.position.z + mirror.size.depth, 4); // nothing past the typed depth
  for (const p of project.panels) assert.ok(p.position.z + p.size.depth <= 4 + 0.01, `${p.name} stands past 4"`);
  assert.ok(shelf.position.z + shelf.size.depth <= door.position.z - 0.5);
  assert.doesNotMatch(project.notes?.[0] ?? "", /stand proud/);
  assert.equal(back.size.width, 14.5);
  const steps = uniqueSteps(project);
  const hang = steps.find((s) => /hang it on studs/i.test(s.title));
  assert.ok(hang);
  assert.match(hang.description, /cannot hit two studs|reaches only one stud/i);
  assert.doesNotMatch(hang.description, /4 screws, one near each corner/);
  const plan = buildPlan(project);
  const anchors = plan.bom.find((l) => /anchor/i.test(l.name));
  assert.ok(anchors, "buy list includes anchors when the back misses a stud");
  const screws = plan.bom.find((l) => /structural screws/i.test(l.name));
  assert.match(screws?.notes ?? "", /cannot take a screw in two studs|reaches only one stud/i);
});
