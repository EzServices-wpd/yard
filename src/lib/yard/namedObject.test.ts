/**
 * The built object is the object the person named. Head noun owns the class (a "with a rod" feature, a
 * "vanity" / "dog" / "record" / "TV" / "bar" modifier never does); real objects build in lumber at real size
 * unless craft stock is typed; "N by N" is a size, never a title word; a scale word sets the target scale;
 * a stored item (cups, LPs, a TV) sizes the build.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";

type Want = { title: RegExp; kind?: string; stock?: RegExp; w?: [number, number]; h?: [number, number]; d?: [number, number]; parts?: RegExp[]; note?: RegExp };
const near = (v: number, [a, b]: [number, number]) => v >= a && v <= b;

const CASES: Record<string, Want> = {
  "coat closet 36 wide 80 tall 24 deep with a rod": { title: /^Coat closet\b/, kind: "closet", w: [36, 36], h: [80, 80], d: [24, 24], parts: [/^Hanging rod$/, /^Left upright$/] },
  "vanity mirror 24 wide": { title: /^Vanity mirror 24" ×/, stock: /^lumber-/, w: [26, 30], parts: [/^Mirror glass$/, /stile/, /^Backer$/] },
  "dog crate 36 long": { title: /^Dog crate\b/, w: [36, 36], h: [22, 28], d: [20, 26], parts: [/^Door$/, /slat/] },
  "record crate": { title: /^Record crate\b/, stock: /^lumber-1x12/, w: [14, 17], d: [15, 16], parts: [/^Left end$/, /^Bottom$/] },
  "firewood rack": { title: /^Firewood rack\b/, stock: /^lumber-2x4/, w: [48, 120], h: [36, 60], parts: [/^Base rail/, /^Upright/, /^Sleeper/] },
  "Stanley Quencher 40 oz shelf": { title: /quencher shelf/i, h: [28, 32], d: [7, 9], parts: [/^Shelf$/], note: /Quencher/ },
  "shelf for a Yeti 20 oz tumbler": { title: /tumbler shelf/i, h: [17, 21], d: [5, 7], parts: [/^Shelf$/], note: /tumblers/ },
  "TV stand 55 inch": { title: /^TV stand\b/, w: [54, 62], h: [18, 30] },
  "bar stool 30 tall": { title: /^Bar stool\b/, h: [30, 30], parts: [/footrest$/] },
  "baby gate 30 wide": { title: /^Baby gate\b/, stock: /^lumber-/, w: [30, 30], h: [28, 34], parts: [/^Picket/, /stile$/] },
  "doll bed from popsicle sticks": { title: /^Doll bed\b/, stock: /popsicle/, w: [16, 24], h: [4, 12], d: [9, 14] },
  "mirror frame 24 by 36": { title: /^Mirror frame 24" × 36"/, stock: /^lumber-/, parts: [/^Mirror glass$/] },
  "sandbox cover 4 by 4": { title: /^Sandbox cover 4' × 4'/, stock: /^lumber-/, w: [48, 48], d: [48, 48], parts: [/^Board/, /^Cleat/] },
};

describe("the built object is the object named", () => {
  for (const [prompt, want] of Object.entries(CASES)) {
    it(prompt, () => {
      const p = generateFromPrompt(prompt);
      const o = p.overall;
      assert.match(p.name, want.title, p.name);
      assert.doesNotMatch(p.name, /\bBy\b|\bFrom\b/, `title leaks words: ${p.name}`);
      if (want.kind) assert.equal(p.kind, want.kind);
      if (want.stock) assert.match(p.primaryMaterialId, want.stock, p.primaryMaterialId);
      if (want.w) assert.ok(near(o.width, want.w), `width ${o.width}`);
      if (want.h) assert.ok(near(o.height, want.h), `height ${o.height}`);
      if (want.d) assert.ok(near(o.depth, want.d), `depth ${o.depth}`);
      for (const re of want.parts ?? []) assert.ok(p.panels.some((x) => re.test(x.name)), `${re} in ${p.panels.map((x) => x.name).join(", ")}`);
      if (want.note) assert.ok((p.notes ?? []).some((n) => want.note!.test(n)), `${want.note} in notes`);
    });
  }

  it("baby gate pickets leave less than 2 3/8 in between", () => {
    const xs = generateFromPrompt("baby gate 30 wide").panels.filter((x) => /^Picket/.test(x.name)).map((x) => x.position.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] - 1.5 < 2.375, `gap ${xs[i] - xs[i - 1] - 1.5}`);
  });

  it("a feature after 'with' never names the class; a hanging head noun still does", () => {
    assert.match(generateFromPrompt("coat rack with hooks").name, /^Coat rack/);
    assert.doesNotMatch(generateFromPrompt("entry bench 42 wide with shoe shelf").name, /^Shoe/);
  });

  it("craft stock or a model word keeps the stick model", () => {
    assert.match(generateFromPrompt("popsicle stick picture frame 6 inch").primaryMaterialId, /popsicle/);
    assert.equal(generateFromPrompt("baby gate from popsicle sticks").primaryMaterialId.startsWith("lumber-"), false);
  });
});
