// PR B (madera comparison, feature 3): tapping a cut-list letter shows that part's drawing under its row, from the
// live vector renderer. Rendered with react-dom/server: the active row with part ids mounts its drawing with exactly
// those ids hot, the "alone" picture is labelled exactly with the row's size (or not at all), and a row without ids or not active renders nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { buildPlan } from "../src/lib/yard/report";
import { inchFrac } from "../src/lib/yard/inchText";
import { CutRowDrawing } from "../src/components/workspace/part-drawing";
import type { CutLine, YardProject, BuildPlan } from "../src/lib/yard/types";

const render = (project: YardProject, plan: BuildPlan, row: CutLine, active: boolean) =>
  renderToStaticMarkup(createElement("table", null, createElement("tbody", null, createElement(CutRowDrawing, { project, plan, row, active }))));
const pic = (html: string, k: string) => new RegExp(`data-yard-part-pic="${k}"[^>]*>(<svg[\\s\\S]*?</svg>)`).exec(html)?.[1] ?? "";
const parts = (svg: string) => new Set([...svg.matchAll(/data-part="([^"]+)"/g)].map((m) => m[1]));
const labels = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)</g)].map((m) => m[1].replace(/&quot;/g, '"'));

for (const prompt of ["linen closet 31.5 wide 78 tall 16 deep", "pocket vanity 48 wide"]) {
  test(`selecting a row mounts its drawing with its part ids (${prompt})`, () => {
    const project = generateFromPrompt(prompt);
    const plan = buildPlan(project);
    const model = new Set([...project.panels.map((p) => p.id), ...project.instances.map((i) => i.id)]);
    for (const row of plan.cutList.filter((c) => c.partIds?.length)) {
      assert.equal(render(project, plan, row, false), "<table><tbody></tbody></table>", `${row.label}: nothing until tapped`);
      const html = render(project, plan, row, true);
      assert.match(html, new RegExp(`data-yard-part-drawing="${row.partIds!.join(" ")}"`), `${row.label}: drawing for its ids`);
      assert.match(html, /aria-hidden="true"/, "decorative: the row already names the part");
      const place = pic(html, "place"), alone = pic(html, "alone");
      // In place: the whole build (model parts only, so no prop or scale figure), the row's own letter bubble.
      for (const id of parts(place)) assert.ok(model.has(id), `${id} is a model part`);
      assert.ok(labels(place).includes(row.label!), `${row.label}: letter in place`);
      // In place: exactly the row's parts are hot (the hot edge ink), every other part ghosted.
      const hotEdge = "rgb(150,64,12)";
      const hot = new Set([...place.matchAll(/<g data-part="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g)].filter((m) => m[2].includes(hotEdge)).map((m) => m[1]));
      assert.deepEqual([...hot].sort(), row.partIds!.filter((id) => model.has(id)).sort(), `${row.label}: hot parts are the row's`);
      // Alone: one of the row's parts; its lines read exactly the row's length, width and thickness, no other number.
      const one = [...parts(alone)];
      assert.equal(one.length, 1);
      assert.ok(row.partIds!.includes(one[0]), `${row.label}: alone is one of its parts`);
      const size = [row.lengthIn, row.widthIn, row.thicknessIn ?? 0.75].map((v) => `${inchFrac(v)}"`).sort();
      const got = labels(alone).sort();
      if (got.length || prompt.startsWith("linen")) assert.deepEqual(got, size, `${row.label} ${row.name}: alone labels`);
    }
  });
}

test("a row without part ids gets no drawing", () => {
  const project = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
  const plan = buildPlan(project);
  const row = { ...plan.cutList[0], partIds: undefined };
  assert.equal(render(project, plan, row, true), "<table><tbody></tbody></table>");
  assert.equal(render(project, plan, { ...row, partIds: [] }, true), "<table><tbody></tbody></table>");
});

test("the plan drawer mounts it under the tapped row only, with the aria-label unchanged", () => {
  const src = fs.readFileSync(new URL("../src/components/workspace/plan-drawer.tsx", import.meta.url), "utf8");
  assert.match(src, /<CutRowDrawing project=\{project\} plan=\{plan\} row=\{c\} active=\{!!L && L === activeLetter\} \/>/);
  assert.match(src, /aria-label=\{`Show \$\{L\} on the sheet`\}/);
});
