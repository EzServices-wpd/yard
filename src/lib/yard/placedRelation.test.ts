/**
 * Where, placement, and fasten sentences name only parts placed on this step or earlier.
 * A relation does not name the part it is locating as its own support, and a step does not
 * repeat a sentence.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { partLetters } from "./pdfDraw.ts";
import { planStepParts } from "./stepParts.ts";
import { cutListName } from "./shopPlural.ts";
import { placeRole, POSITIONED_ROLES } from "./placement.ts";
import type { AssemblyStep, BuildPlan, Panel, YardProject } from "./types.ts";

const PROMPTS = JSON.parse(readFileSync(new URL("../../../plan-baselines/placed-relation-prompts.json", import.meta.url), "utf8")) as {
  cubby: string[];
  case: string[];
  vanity: string[];
  desk: string[];
  bench: string[];
  tv: string[];
  novel: string[];
};

const BROAD = [...PROMPTS.cubby, ...PROMPTS.case, ...PROMPTS.vanity, ...PROMPTS.desk, ...PROMPTS.bench, ...PROMPTS.tv];

function built(prompt: string) {
  const project = generateFromPrompt(prompt);
  const plan = buildPlan(project);
  return { project, plan };
}

function placedAt(project: YardProject, plan: BuildPlan): Map<string, number> {
  const at = new Map<string, number>();
  const sp = planStepParts(project, plan.instructions, partLetters(project, plan.cutList));
  sp.forEach((st, i) => {
    for (const id of st.fresh) if (!at.has(id)) at.set(id, i);
  });
  return at;
}

function famOf(p: Panel): string {
  return cutListName(p.name, p.type)
    .toLowerCase()
    .replace(/^(?:left|right|front|back|upper|lower|inner|outer|near|far)\s+/, "");
}

function stem(phrase: string): string {
  const words = phrase.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const last = words[words.length - 1].replace(/ies$/, "y").replace(/ves$/, "f").replace(/(?<=[a-z]{3})s$/, "");
  words[words.length - 1] = last;
  return words.join(" ");
}

function tokens(list: string): string[] {
  return list
    .replace(/,\s+and\s+/gi, ", ")
    .replace(/\s+and\s+/gi, ", ")
    .split(/\s*,\s*/)
    .map((s) => s.replace(/^(?:the\s+)?(?:inside face of|top of|tops of)\s+/i, "").trim())
    .filter(Boolean);
}

/** Panels a relation list names. A bare letter with several panels names the one the list picked; the caller treats "any placed" as enough. */
function namedBy(token: string, panels: Panel[], letters: Map<string, string>): { panels: Panel[]; strict: boolean } {
  const raw = token.replace(/^(?:both|each|all\s+\d+)\s+/i, "").trim();
  const strict = /^(?:both|each|all\s+\d+)\s+/i.test(token);
  const headed = raw.match(/^([A-Z]{1,2})(?:\s+(.*))?$/);
  if (headed) {
    const letter = headed[1];
    const rest = stem(headed[2] ?? "");
    const list = panels.filter((p) => letters.get(p.id) === letter && !p.drawerId);
    const matched = rest
      ? list.filter((p) => {
          const fam = famOf(p);
          return fam === rest || fam.endsWith(` ${rest}`) || rest.endsWith(fam);
        })
      : list;
    return { panels: matched.length ? matched : list, strict: strict || !!rest };
  }
  const want = stem(raw.replace(/^the\s+/i, ""));
  if (want.length < 3 || /\bor\b/.test(token)) return { panels: [], strict: false };
  const matched = panels.filter((p) => !p.drawerId && famOf(p) === want);
  return { panels: matched, strict: true };
}

const SUPPORT =
  /(?:underside rests on the top of|Set it on the top of|flush with the (?:top|bottom) ends of|flush with the tops of|flush with the front of|flush with the outside of|from the (?:front|outside|back) of|proud of the (?:front|outside|back) of|on the inside face of|Mark every (?:height|line) on)\s+([^.;]+?)(?=\s+(?:before|and line)\b|[,;.]|$)/gi;

const THROUGH = /Screw through\s+(.+?)\s+into\s+/gi;

function subjectsOf(step: AssemblyStep, panels: Panel[], letters: Map<string, string>): Set<string> {
  const ids = new Set<string>();
  const text = step.description ?? "";
  for (const m of text.matchAll(/Top(?: edge)?s? of (?:the |both |all \d+ |each )?([A-Z]{1,2})\b[^.]{0,40}/g)) {
    for (const p of panels) if (letters.get(p.id) === m[1] && POSITIONED_ROLES.includes(placeRole(p))) ids.add(p.id);
  }
  return ids;
}

function faults(project: YardProject, plan: BuildPlan): string[] {
  const letters = partLetters(project, plan.cutList);
  const at = placedAt(project, plan);
  const out: string[] = [];
  plan.instructions.forEach((step, i) => {
    const desc = step.description ?? "";
    const sentences = desc.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    const seen = new Set<string>();
    for (const sentence of sentences) {
      if (seen.has(sentence)) out.push(`${step.title} repeats: ${sentence.slice(0, 80)}`);
      seen.add(sentence);
    }
    if (/Marked heights?:/.test(desc) && !/\b(?:pin|drill|shelf|mark)\b/i.test(`${step.title} ${desc}`)) {
      out.push(`${step.title} carries Marked heights away from the drilling step`);
    }
    const subjects = subjectsOf(step, project.panels, letters);
    const lists: { list: string; support: boolean }[] = [];
    for (const m of desc.matchAll(SUPPORT)) lists.push({ list: m[1], support: true });
    for (const m of desc.matchAll(THROUGH)) lists.push({ list: m[1], support: true });
    for (const { list, support } of lists) {
      for (const token of tokens(list)) {
        const hit = namedBy(token, project.panels, letters);
        if (!hit.panels.length) continue;
        const late = hit.panels.filter((p) => {
          const n = at.get(p.id);
          return n == null || n > i;
        });
        if (hit.strict ? late.length > 0 : late.length === hit.panels.length) {
          out.push(`${step.title} names ${token} before it is placed`);
        }
        if (support) {
          for (const p of hit.panels) if (subjects.has(p.id) && (at.get(p.id) ?? -1) === i) out.push(`${step.title} names ${p.name} as its own support`);
        }
      }
    }
  });
  return out;
}

describe("placement relations name only parts already placed", () => {
  for (const prompt of BROAD) {
    it(`${prompt}: relations, duplicates, and self-support`, () => {
      const { project, plan } = built(prompt);
      assert.deepEqual(faults(project, plan), []);
    });
  }

  it("novel prompts follow the same rule", () => {
    const bad: string[] = [];
    for (const prompt of PROMPTS.novel) {
      const { project, plan } = built(prompt);
      for (const fault of faults(project, plan)) bad.push(`${prompt} — ${fault}`);
    }
    assert.ok(PROMPTS.novel.length >= 10);
    assert.deepEqual(bad, []);
  });

  it("the reported lines drop only the unplaced name or the empty clause", () => {
    const shoe = built("shoe rack 36x18x12").plan;
    const top = shoe.instructions.find((s) => /Attach C Top/.test(s.title));
    assert.match(top?.description ?? "", /flush with the top ends of both D uprights/);
    assert.doesNotMatch(top?.description ?? "", /cubby divider/);
    const dividers = shoe.instructions.find((s) => /cubby dividers/.test(s.title));
    assert.match(dividers?.description ?? "", /Screw through the C top and bottom into each divider/);
    assert.doesNotMatch(dividers?.description ?? "", /and back/);

    const vanity = built("pocket vanity").plan.instructions.find((s) => /Attach G Top/.test(s.title));
    assert.match(vanity?.description ?? "", /flush with the top ends of both B uprights/);
    assert.doesNotMatch(vanity?.description ?? "", /rests on the top of D/);

    const desk = built("desk 60x30x29").plan.instructions.find((s) => /Stand the main box/.test(s.title));
    assert.match(desk?.description ?? "", /flush with the bottom ends of both C uprights\./);
    assert.match(desk?.description ?? "", /Front edge flush with the front of both C uprights\./);
    assert.doesNotMatch(desk?.description ?? "", /F dividers/);

    const tv = built("tv stand 55 inch").plan;
    const box = tv.instructions.find((s) => /Stand the main box/.test(s.title));
    assert.match(box?.description ?? "", /rests on the top of H,/);
    assert.doesNotMatch(box?.description ?? "", /rests on the top of C/);
    const kick = tv.instructions.find((s) => /kick strip/.test(s.title));
    assert.doesNotMatch(kick?.description ?? "", /rests on/);
  });
});

describe("canaries keep buy, cuts, and step text except the approved placement edits", () => {
  const hashOf = (prompt: string) => {
    const { plan } = built(prompt);
    return createHash("sha256")
      .update(plan.instructions.map((s) => `${s.step}|${s.title}|${s.description}`).join("\n"))
      .digest("hex")
      .slice(0, 16);
  };

  it("linen, Andersen, and the popsicle Eiffel are byte-identical", () => {
    assert.equal(hashOf("linen closet 31.5 wide 78 tall 16 deep"), "6de4416b65527f1c");
    assert.equal(hashOf("Andersen 36x48"), "897052ca411715ec");
    assert.equal(hashOf("3 foot Eiffel Tower from popsicle sticks"), "313e45c392b40b22");
  });

  it("pocket vanity and desk 60x30x29 keep cost, pieces, buy lines, and step count", () => {
    for (const [prompt, cost, pieces, bom, steps] of [
      ["pocket vanity", 636.23, 50, 15, 17],
      ["desk 60x30x29", 381.97, 41, 8, 12],
    ] as const) {
      const { plan } = built(prompt);
      assert.equal(plan.totals.estCostUsd, cost, prompt);
      assert.equal(plan.totals.pieces, pieces, prompt);
      assert.equal(plan.bom.length, bom, prompt);
      assert.equal(plan.instructions.length, steps, prompt);
    }
  });
});
