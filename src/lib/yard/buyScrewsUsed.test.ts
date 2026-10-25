import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { refineProject } from "./refine";
import { i46 } from "./invariants";
import { BACK_PART, fastensBack } from "./stepJointScrews";
import { dropPartText } from "./steps";
import type { YardProject } from "./types";

globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;

/**
 * I46 hits outside the invariants corpus (evals/invariants-baseline.json lists the ones inside it), each with its
 * exact reason. Every listed hit must still fire (no stale reason) and nothing else on these prompts may fire.
 */
export const I46_KNOWN: Record<string, string> = {
  "modern nightstand with drawer and shelf 27 wide 16 deep 20 tall":
    "WRONG BUILD (row 230): 'X with Y' builds two products side by side, drops the typed size (27→47 W) and never fastens either back. Its own PR fixes the class.",
  "raised planter box with shelf 48 wide 24 deep 36 tall":
    "WRONG BUILD (row 230): 'X with Y' builds two products side by side, drops the typed size (48→84 W) and never fastens either back. Its own PR fixes the class.",
};

const plan = (p: YardProject) => buildPlan(p);
const titles = (p: YardProject) => plan(p).instructions.map((s) => s.title);

test("I46 / row 199: a single-drawer bench goes through the same box and back steps as a multi-drawer one", () => {
  const box = (q: string | YardProject) => {
    const p = typeof q === "string" ? generateFromPrompt(q) : q;
    return titles(p).filter((t) => /^Attach |^Stand the main box$/.test(t));
  };
  assert.deepEqual(box("bench with a drawer"), box("bench with drawers"));
  for (const q of ["bench with a drawer", "entry bench with a drawer", "bench with drawers", "entry bench with 3 drawers"]) {
    const p = generateFromPrompt(q);
    assert.ok(titles(p).some((t) => /^Attach [A-Z]{1,2} Back to the back of the box$/.test(t)), `${q}: back step`);
    assert.ok(titles(p).some((t) => /^Attach [A-Z]{1,2} Seat to both [A-Z]{1,2} uprights$/.test(t)), `${q}: seat step`);
    assert.deepEqual(i46(p, plan(p)), [], q);
  }
  for (const q of ["entry bench 48 wide", "shoe bench"]) {
    const r = refineProject(generateFromPrompt(q), "add a drawer");
    assert.ok(r.project, q);
    const t = titles(r.project!);
    assert.ok(t.some((x) => /^Fit the drawer front/.test(x)), `${q} + add a drawer: fit step`);
    assert.ok(t.some((x) => /^Attach [A-Z]{1,2} Back to the back of the box$/.test(x)), `${q} + add a drawer: back step`);
    assert.deepEqual(i46(r.project!, plan(r.project!)), [], `${q} + add a drawer`);
  }
});

test("I46: every build with a back has a step that fastens it; every Buy screw is driven", () => {
  const carcasses = [
    "bench with a drawer", "bookshelf", "wine cabinet", "30 inch range hood", "bathroom medicine cabinet 16 wide 24 high 4 deep",
    "wall mounted ironing board cabinet 48 high 16 wide 6 deep", "laundry fold-down 48 wide 36 high 6 deep", "kitchen island",
    "small rolling kitchen island with drawer 33 wide 25 deep 36 tall", "over-toilet shelf", "mudroom locker", "closet 72 wide 96 tall 24 deep",
    "barn birdhouse", "knife block", "nightstand", "dresser", "tv stand", "queen platform bed frame", "twin farmhouse bed",
  ];
  for (const q of carcasses) {
    const p = generateFromPrompt(q);
    const pl = plan(p);
    for (const b of p.panels.filter((x) => !x.drawerId && BACK_PART.test(x.name))) {
      assert.ok(pl.instructions.some((s) => fastensBack(s, b.name)), `${q}: ${b.name} has no step that fastens it`);
    }
    assert.deepEqual(i46(p, pl), [], q);
  }
});

test("I46: each listed hit still fires with its reason", () => {
  for (const [q, why] of Object.entries(I46_KNOWN)) {
    assert.match(why, /^(?:WRONG (?:BUILD|TEXT) \(row \d+\)|DEFENSIBLE \([^)]*\)):/, q);
    const p = generateFromPrompt(q);
    assert.ok(i46(p, plan(p)).length > 0, `STALE ${q}: I46 no longer fires; delete it from I46_KNOWN`);
  }
});

test("row 195: a drawer front is fitted after its box is built and hung, after the carcass", () => {
  for (const q of ["kitchen island", "kitchen island on casters", "rolling kitchen island", "bench with a drawer", "nightstand"]) {
    const t = titles(generateFromPrompt(q));
    const at = (re: RegExp) => t.findIndex((x) => re.test(x));
    const fit = at(/^Fit (?:the drawer front|\d+ drawer fronts)/), build = at(/^Build (?:drawer|\d+ drawers)/), hang = at(/^Hang (?:the drawer|\d+ drawers)/);
    if (fit < 0) continue;
    assert.ok(build >= 0 && hang > build && fit > hang, `${q}: build ${build}, hang ${hang}, fit ${fit}`);
    const carcass = at(/^Stand |^Attach /);
    if (carcass >= 0) assert.ok(fit > carcass, `${q}: fit ${fit} before the carcass ${carcass}`);
  }
});

test("rows 196 and 198: dropping a part from a lettered cut line leaves no letter; a step title takes no plate letter", () => {
  assert.equal(dropPartText('A Front apron — 1 × 2"; G Drawer front — 3 × 4". Set the apron.', ["Drawer front"]), 'A Front apron — 1 × 2". Set the apron.');
  for (const q of ["nightstand with a door", "bathroom medicine cabinet 16 wide 24 high 4 deep"]) {
    for (const t of titles(generateFromPrompt(q))) assert.doesNotMatch(t, /^[A-Z]{1,2} (?:Hang|Set|Fit|Build|Attach|Stand) /, `${q}: "${t}"`);
  }
});
