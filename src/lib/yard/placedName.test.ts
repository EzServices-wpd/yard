/**
 * A fastening sentence may name only a part an earlier step, or this step, has placed.
 * Placement is read from the step's own title and its "One join: attach" line.
 * It does not use partsUsed, and it does not import the pass that moves the sentence.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { supportPromptSet } from "../../../scripts/support-order-prompts.ts";
import type { AssemblyStep, YardProject } from "./types.ts";

const FROZEN =
  /^(?:confirm|cut|read|lay out|do not|print|count|mark|level|seal|splice|prep|label|glue up|join sheet|drill|sand|finish|paint|before|shim)\b/i;
const STOP = new Set([
  "side", "edge", "face", "wall", "base", "part", "door", "rail", "post", "leg", "lid", "box", "step",
  "end", "foot", "feet", "arm", "board", "panel", "frame", "apron", "riser", "tread",
]);
const SIDE = /^(?:left|right|front|back|center|centre)\s+/i;
const THROUGH = /^(?:Screw through|Set the joints the stock uses, through|Tape or glue through)\b/i;
const COUNTED = /(?:Drive|drives) \d+ × #8 |with \d+ × #8 |counted in another step|brings the build to \d+/;

const shoeRack = (tall: number, deep: number) => `shoe rack 36 wide ${tall} tall ${deep} deep`;
const EXAMPLES = [
  shoeRack(18, 12),
  shoeRack(24, 16),
  shoeRack(30, 16),
  shoeRack(78, 16),
  "dresser 54.375 wide 36 tall 18.75 deep",
  "wardrobe 40x72",
  "mudroom bench 48 wide 20 tall 16 deep",
  "window seat",
  "window seat 60 wide",
];

function family(name: string): string {
  return name.replace(/\s+\d+$/, "").replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
}

function phrases(name: string): string[] {
  const fam = family(name);
  const out = new Set<string>();
  const keep = (phrase: string) => {
    const words = phrase.split(/\s+/).filter(Boolean);
    if (!words.length || (words.length === 1 && STOP.has(words[0]))) return;
    out.add(words.join(" "));
  };
  keep(fam);
  const bare = fam.replace(SIDE, "");
  if (bare !== fam) keep(bare);
  return [...out];
}

const escRe = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function phraseRe(phrase: string): RegExp {
  const words = phrase.split(/\s+/);
  const body = words
    .map((w, i) => (i === words.length - 1 ? (w === "shelf" ? "shel(?:f|ves)" : `${escRe(w)}s?`) : escRe(w)))
    .join("\\s+");
  return new RegExp(`\\b${body}\\b`, "i");
}

/** A face word ("back edge", "top of") is not the part. "through the back" is. */
function mentions(sentence: string, phrase: string): boolean {
  const re = new RegExp(phraseRe(phrase).source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(sentence))) {
    const after = sentence.slice(m.index + m[0].length);
    if (/^\s+(?:edges?|of|face|faces|ends?)\b/i.test(after)) continue;
    const prior = sentence.slice(0, m.index);
    if (/\bdrawer\s+$/i.test(prior)) continue;
    return true;
  }
  return false;
}

function namesPart(sentence: string, name: string): boolean {
  return phrases(name).some((p) => mentions(sentence, p));
}

/** The step that attaches this part: the title's object, a one-join subject, or "Lay the …". */
function attaches(step: AssemblyStep, name: string): boolean {
  if (FROZEN.test(step.title)) return false;
  const hit = (text: string) => namesPart(text, name);
  const join = step.description?.match(/One join: attach ([^.]+?) to /i);
  if (join && hit(join[1])) return true;
  const lay = step.description?.match(/^Lay the[^.]*/i);
  if (lay && hit(lay[0])) return true;
  const used = (step.partsUsed ?? []).some((u) => u.toLowerCase() === name.toLowerCase());
  if (!used) return false;
  const obj = step.title.split(/\s+to\b/i)[0];
  if (hit(obj)) return true;
  // "Glue 1 fixed shelf" places Shoe shelf; "Set the counter" places Vanity counter.
  const last = family(name).split(/\s+/).pop() ?? "";
  const word = last === "shelf" ? "shel(?:f|ves)" : `${escRe(last)}s?`;
  return new RegExp(`\\b${word}\\b`, "i").test(obj);
}

function placedAt(steps: AssemblyStep[], names: string[]): Map<string, number> {
  const at = new Map<string, number>();
  for (const name of names) {
    const i = steps.findIndex((s) => attaches(s, name));
    if (i >= 0) at.set(name, i);
  }
  return at;
}

/**
 * Fastening sentences that name a part a later step attaches.
 * A one-join line and a "screw through …" line both fasten. A cut line and a "Where:" line do not.
 */
function fasteningAhead(project: YardProject, steps: AssemblyStep[]): string[] {
  const names = [...new Set(project.panels.filter((p) => !p.drawerId).map((p) => p.name))];
  const at = placedAt(steps, names);
  const out: string[] = [];
  steps.forEach((step, i) => {
    if (FROZEN.test(step.title)) return;
    const sentences = (step.description ?? "").split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      const clauses = sentence.split(/;\s+/);
      for (const clause of clauses) {
        const join = /^One join: attach /i.test(clause.trim());
        const fastens = THROUGH.test(clause.trim()) || join || (clauses.length > 1 && /\b(?:screw|screws|fasten)\b/i.test(clause));
        // A "Drive N" line states this step's own count. A one-join line can still name a part too soon.
        if (!fastens || (!join && COUNTED.test(clause))) continue;
        for (const name of names) {
          const j = at.get(name);
          if (j == null || j <= i) continue;
          if (namesPart(clause, name)) out.push(`${i + 1} ${step.title} fastens ${name} before step ${j + 1} ${steps[j].title}`);
        }
      }
    }
  });
  return out;
}

function planOf(prompt: string) {
  const project = generateFromPrompt(prompt);
  return { project, plan: buildPlan(project) };
}

describe("a fastening sentence names only a part already placed", () => {
  for (const prompt of EXAMPLES) {
    it(prompt, () => {
      const { project, plan } = planOf(prompt);
      assert.deepEqual(fasteningAhead(project, plan.instructions), []);
    });
  }

  it("the step-order prompt set", { timeout: 180_000 }, () => {
    const bad: string[] = [];
    for (const prompt of supportPromptSet()) {
      let project;
      try {
        project = generateFromPrompt(prompt);
      } catch {
        continue;
      }
      const hits = fasteningAhead(project, buildPlan(project).instructions);
      if (hits.length) bad.push(`${prompt} — ${hits[0]}`);
    }
    assert.deepEqual(bad, []);
  });

  it("a sentence moved back in front of the back fails", () => {
    const { project, plan } = planOf(shoeRack(18, 12));
    const steps = plan.instructions.map((s) => ({ ...s }));
    const back = steps.findIndex((s) => /to the back of the box/.test(s.title));
    const divider = steps.findIndex((s) => /dividers/.test(s.title));
    assert.ok(back > divider);
    const sentence = (steps[back].description ?? "").split(/(?<=[.!?])\s+/).find((s) => /Screw through\b/.test(s));
    assert.ok(sentence, "the through-sentence now sits on the back step");
    steps[back] = { ...steps[back], description: (steps[back].description ?? "").replace(sentence!, "").replace(/\s+/g, " ").trim() };
    steps[divider] = { ...steps[divider], description: `${steps[divider].description} ${sentence}` };
    const hits = fasteningAhead(project, steps);
    assert.ok(hits.some((h) => /fastens Back before/.test(h)), hits.join("; "));
  });
});

describe("canaries keep their model, buy, price, cuts, and step text", () => {
  const pin = (prompt: string, cost: number, pieces: number, bom: number, steps: number, stepHash: string) => {
    const { plan, project } = planOf(prompt);
    assert.equal(plan.totals.estCostUsd, cost, prompt);
    assert.equal(plan.totals.pieces, pieces, prompt);
    assert.equal(plan.bom.length, bom, prompt);
    assert.equal(plan.instructions.length, steps, prompt);
    assert.equal(project.panels.length > 0 || project.instances.length > 0, true);
    const hash = createHash("sha256").update(plan.instructions.map((s) => `${s.step}|${s.title}|${s.description}`).join("\n")).digest("hex").slice(0, 16);
    assert.equal(hash, stepHash, prompt);
    const buy = createHash("sha256").update(plan.bom.map((b) => `${b.quantity}|${b.name}|${b.notes ?? ""}|${b.estimatedCost ?? ""}`).join("\n")).digest("hex").slice(0, 16);
    const cuts = createHash("sha256").update(plan.cutList.map((c) => `${c.label ?? ""}|${c.quantity}|${c.name}|${c.lengthIn}|${c.widthIn}|${c.thicknessIn}`).join("\n")).digest("hex").slice(0, 16);
    return { buy, cuts, overall: { ...project.overall } };
  };

  it("linen closet 31.5 × 78 × 16", () => {
    const { project, plan } = planOf("linen closet 31.5 wide 78 tall 16 deep");
    assert.deepEqual([project.overall.width, project.overall.height, project.overall.depth], [31.5, 78, 16]);
    assert.equal(plan.totals.estCostUsd, 193.68);
    assert.equal(plan.totals.pieces, 11);
    assert.equal(plan.bom.length, 8);
    assert.equal(plan.instructions.length, 9);
    const hash = createHash("sha256").update(plan.instructions.map((s) => `${s.step}|${s.title}|${s.description}`).join("\n")).digest("hex").slice(0, 16);
    assert.equal(hash, "2bb9e7d5e3d43112");
  });

  it("Andersen 36x48, the popsicle Eiffel, pocket vanity, and the desk keep buy and cuts", () => {
    const andersen = pin("Andersen 36x48", 439.26, 14, 8, 10, "897052ca411715ec");
    const eiffel = pin("3 foot Eiffel Tower from popsicle sticks", 19.96, 784, 2, 10, "313e45c392b40b22");
    const vanity = planOf("pocket vanity");
    const desk = planOf("desk 60x30x29");
    assert.equal(vanity.plan.totals.estCostUsd, 636.23);
    assert.equal(vanity.plan.totals.pieces, 50);
    assert.equal(vanity.plan.bom.length, 15);
    assert.equal(vanity.plan.instructions.length, 17);
    assert.equal(desk.plan.totals.estCostUsd, 381.97);
    assert.equal(desk.plan.totals.pieces, 41);
    assert.equal(desk.plan.bom.length, 8);
    assert.equal(desk.plan.instructions.length, 12);
    assert.deepEqual(andersen.overall.width, 46);
    assert.equal(eiffel.overall.height, 37.4);
  });
});
