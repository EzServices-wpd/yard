// PR C (madera comparison, feature 2): Options > View has a "Shop drawing" toggle on sheet builds only, and its print
// sheet (black on white, model parts only) mounts only while the mode is on. The sheet is rendered with
// react-dom/server; the Options panel and shell import auth (import.meta.env), so their wiring is read from source.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { shopDrawable } from "../src/components/workspace/shop-drawing";
import type { YardProject } from "../src/lib/yard/types";
import { ShopDrawingSheet } from "../src/components/workspace/shop-drawing-print";

const src = (f: string) => fs.readFileSync(new URL(`../src/components/workspace/${f}`, import.meta.url), "utf8");
const sheet = (project: YardProject, on: boolean) => renderToStaticMarkup(createElement(ShopDrawingSheet, { project, on }));

test("Options > View: one touch Toggle labelled Shop drawing, shown only for sheet builds", () => {
  const ui = src("bench-options.tsx");
  const view = ui.slice(ui.indexOf('<Section id="view"'), ui.indexOf("</Section>", ui.indexOf('<Section id="view"')));
  assert.match(view, /\{shopDrawable\(project\) && <Toggle touch on=\{shopDrawing\} onClick=\{\(\) => setShopDrawing\(!shopDrawing\)\} label="Shop drawing" \/>\}/);
  assert.equal(ui.match(/Shop drawing/g)?.length, 1, "the one new string, once");
});

test("the app chrome hides in print only while on; off, its class is release's", () => {
  const shell = src("shell.tsx");
  assert.match(shell, /className=\{`flex h-dvh flex-col bg-bg text-fg\$\{shopDrawing \? " print:hidden" : ""\}`\}/);
  assert.match(shell, /<ShopDrawingSheet on=\{shopDrawing\} project=\{project\} \/>/);
  assert.match(shell, /const shopDrawing = useShopDrawingOn\(\);/);
});

test("sheet build: the print sheet mounts only while on, black on white, model parts only", () => {
  const project = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
  assert.ok(shopDrawable(project));
  assert.equal(sheet(project, false), "", "nothing mounted while off");
  const html = sheet(project, true);
  assert.match(html, /^<div data-yard-shop-print="true" aria-hidden="true" class="hidden [^"]*print:block/, "hidden on screen, shown in print");
  assert.match(html, /\[&amp;_path\]:fill-white/, "faces fill white");
  assert.match(html, /\[&amp;_path\]:stroke-black/, "lines print black");
  const model = new Set([...project.panels.map((p) => p.id), ...project.instances.map((i) => i.id)]);
  const ids = [...html.matchAll(/data-part="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length > 0);
  for (const id of ids) assert.ok(model.has(id), `${id} is a model part (no prop or scale figure)`);
});

test("stick build: the mode never mounts a sheet", () => {
  const project = generateFromPrompt("adirondack chair");
  assert.ok(!shopDrawable(project), "a stick build");
  assert.equal(sheet(project, true), "");
});
