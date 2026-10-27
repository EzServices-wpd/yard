// PR 14b (plan concept 8, L591, L600): View in your room. The AR model is the bench model at true size in
// metres with every part, never the scale figure or props; the chip shows only when the AR feature test
// passes; the exporters load only on tap; the Quick Look link fixes the scale.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { INCH_M, arMode, quickLookHref } from "../src/components/workspace/view-in-room";
import { arGlb, arModel } from "../src/components/workspace/view-in-room-ar";
import { PROP_LAYER } from "../src/components/workspace/scale-props";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (f: string) => fs.readFileSync(path.join(root, f), "utf8");

// GLTFExporter's binary path reads Blobs with FileReader (a browser API): the smallest stand-in for node.
(globalThis as Record<string, unknown>).FileReader ??= class {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(b: Blob) { void b.arrayBuffer().then((r) => ((this.result = r), this.onloadend?.())); }
  readAsDataURL(b: Blob) { void b.arrayBuffer().then((r) => ((this.result = `data:${b.type};base64,${Buffer.from(r).toString("base64")}`), this.onloadend?.())); }
};

/** A stand-in for the bench's model group, shaped like BenchScene: a tagged mesh per part, plus the things AR must drop. */
function benchLike(prompt: string) {
  const project = generateFromPrompt(prompt);
  const model = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: "#cbab6e", roughness: 0.8, emissive: "#c4a574", emissiveIntensity: 0.1 });
  for (const p of project.panels) {
    const g = new THREE.Group();
    g.position.set(p.position.x + p.size.width / 2, p.position.y + p.size.height / 2, p.position.z + p.size.depth / 2);
    const m = new THREE.Mesh(new THREE.BoxGeometry(p.size.width, p.size.height, p.size.depth), wood);
    m.userData = { yardPart: p.id };
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry));
    edges.layers.set(1);
    m.add(edges);
    g.add(m);
    model.add(g);
  }
  // A pull beside the first part (a decoration sibling: kept, untagged).
  const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4), new THREE.MeshStandardMaterial({ color: "#8a8f96", metalness: 0.8 }));
  pull.position.set(project.panels[0].position.x + 1, project.panels[0].position.y + 3, project.panels[0].position.z + 8);
  model.add(pull);
  // Things that must never travel: a prop on its own layer, a fat line (a mesh with isLine2), a hidden click plane.
  const towel = new THREE.Mesh(new THREE.BoxGeometry(13, 2.25, 10), new THREE.MeshStandardMaterial({ color: "#d9d2c3" }));
  towel.layers.set(PROP_LAYER);
  towel.position.set(0, 500, 0);
  const fat = Object.assign(new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial()), { isLine2: true });
  const click = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ visible: false }));
  const figure = new THREE.Group();
  figure.userData.yardScale = true;
  figure.add(new THREE.Mesh(new THREE.PlaneGeometry(22, 76), new THREE.MeshBasicMaterial()));
  model.add(towel, fat, click, figure);
  return { project, model };
}

const sizeOf = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
/** The parts' own extent in inches (what the bench draws; doors sit proud of the carcase). */
function extent(panels: { position: { x: number; y: number; z: number }; size: { width: number; height: number; depth: number } }[]) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of panels) {
    [p.position.x, p.position.y, p.position.z].forEach((v, i) => (lo[i] = Math.min(lo[i], v)));
    [p.position.x + p.size.width, p.position.y + p.size.height, p.position.z + p.size.depth].forEach((v, i) => (hi[i] = Math.max(hi[i], v)));
  }
  return hi.map((v, i) => v - lo[i]);
}
const close = (a: number, b: number, tol: number, msg: string) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test("linen closet: the AR model has every part once, the pull, and no prop, line, click plane or figure", () => {
  const { project, model } = benchLike("linen closet 31.5 wide 78 tall 16 deep");
  assert.equal(project.panels.length, 11, "the linen canary is 11 parts");
  const ar = arModel(model);
  const parts = ar.children.filter((c) => c.name.startsWith("part:")).map((c) => c.name.slice(5)).sort();
  assert.deepEqual(parts, project.panels.map((p) => p.id).sort(), "every part, once");
  assert.equal(ar.children.length, 12, "11 parts and one pull; nothing else");
  assert.ok(ar.children.every((c) => (c as THREE.Mesh).isMesh && !(c as THREE.Mesh & { isLine2?: boolean }).isLine2));
});

test("linen closet: true size in metres, centred on the floor: the plan's 31.5 × 78 in, 16 in carcase + 3/4 in doors", () => {
  const { project, model } = benchLike("linen closet 31.5 wide 78 tall 16 deep");
  const ar = arModel(model);
  const box = new THREE.Box3().setFromObject(ar);
  const s = box.getSize(new THREE.Vector3());
  const o = project.overall;
  const [ew, eh, ed] = extent(project.panels);
  close(s.x, ew * INCH_M, 1e-6, "width = parts (m)");
  close(s.y, eh * INCH_M, 1e-6, "height = parts (m)");
  close(s.z, ed * INCH_M, 1e-6, "depth = parts (m)");
  close(s.x, o.width * INCH_M, 1e-6, "plan width 31.5 in = 0.8001 m");
  close(s.y, o.height * INCH_M, 1e-6, "plan height 78 in = 1.9812 m");
  close(s.z, (o.depth + 0.75) * INCH_M, 1e-6, "plan depth 16 in carcase + 0.75 in doors = 0.4255 m");
  close(box.min.y, 0, 1e-9, "feet on the floor");
  close((box.min.x + box.max.x) / 2, 0, 1e-6, "centred x");
  close((box.min.z + box.max.z) / 2, 0, 1e-6, "centred z");
});

test("wood keeps its real tone: colour and roughness carried, the step glow dropped", () => {
  const { model } = benchLike("linen closet 31.5 wide 78 tall 16 deep");
  const m = (arModel(model).children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
  assert.equal(m.color.getHexString(), new THREE.Color("#cbab6e").getHexString());
  assert.equal(m.roughness, 0.8);
  assert.equal(m.emissive.getHex(), 0, "no glow");
});

test("instanced sticks expand one by one at their own place and tint", () => {
  const g = new THREE.Group();
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.375, 0.0625, 4.5), new THREE.MeshStandardMaterial({ color: "#ffffff" }), 3);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  [0, 10, 20].forEach((x, i) => {
    inst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0, 0));
    inst.setColorAt(i, new THREE.Color("#e2c99a"));
  });
  g.add(inst);
  const ar = arModel(g);
  assert.equal(ar.children.length, 3);
  assert.ok(ar.children.every((c) => c.name === "member"));
  close(sizeOf(ar).x, (20 + 0.375) * INCH_M, 1e-6, "span in metres");
  assert.equal(((ar.children[1] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString(), new THREE.Color("#e2c99a").getHexString());
});

test("GLB round trip: GLTFLoader reads back every part and the same size in metres", async () => {
  const { project, model } = benchLike("pocket vanity");
  const ar = arModel(model);
  const glb = await arGlb(ar);
  const gltf = await new GLTFLoader().parseAsync(glb, "");
  const ids: string[] = [];
  gltf.scene.traverse((o) => (o as THREE.Mesh).isMesh && o.userData.yardPart && ids.push(o.userData.yardPart as string));
  assert.equal(project.panels.length, 50, "the pocket vanity canary is 50 parts");
  assert.deepEqual(ids.sort(), project.panels.map((p) => p.id).sort(), "the GLB carries every part id, once");
  const a = sizeOf(ar), b = sizeOf(gltf.scene);
  close(b.x, a.x, 1e-5, "x"); close(b.y, a.y, 1e-5, "y"); close(b.z, a.z, 1e-5, "z");
  const [ew, eh, ed] = extent(project.panels);
  close(b.x, ew * INCH_M, 1e-5, "38 in"); close(b.y, eh * INCH_M, 1e-5, "102 in"); close(b.z, ed * INCH_M, 1e-5, "17.75 in");
});

test("feature test: Quick Look, then WebXR, else nothing; never throws", async () => {
  const doc = (ar: boolean | "throw") => ({ createElement: () => ({ relList: { supports: (t: string) => { if (ar === "throw") throw new Error("x"); return ar && t === "ar"; } } }) });
  const xr = (v: boolean | "reject") => ({ isSessionSupported: async () => { if (v === "reject") throw new Error("SecurityError"); return v; } });
  assert.equal(await arMode({ document: doc(true), xr: xr(true) }), "quicklook");
  assert.equal(await arMode({ document: doc(false), xr: xr(true), secure: true }), "webxr");
  assert.equal(await arMode({ document: doc("throw"), xr: xr(true) }), "webxr");
  assert.equal(await arMode({ document: doc(false), xr: xr(false) }), null, "desktop Chrome: no AR");
  assert.equal(await arMode({ document: doc(false), xr: xr("reject") }), null, "a rejecting test is no AR");
  assert.equal(await arMode({ document: doc(false), xr: xr(true), secure: false }), null, "http: no WebXR");
  assert.equal(await arMode({ document: doc(false), xr: null }), null, "no navigator.xr");
  assert.equal(await arMode({}), null, "server");
});

test("Quick Look link fixes the scale", () => {
  assert.equal(quickLookHref("blob:https://yard.wiki/1234"), "blob:https://yard.wiki/1234#allowsContentScaling=0");
  assert.equal(quickLookHref("blob:x#old"), "blob:x#allowsContentScaling=0");
});

test("source guards: exporters load on tap; the figure and props stay outside the AR root; no store writes", () => {
  const light = read("src/components/workspace/view-in-room.ts");
  const button = read("src/components/workspace/view-in-room-button.tsx");
  const heavy = read("src/components/workspace/view-in-room-ar.ts");
  assert.doesNotMatch(light, /^import (?!type)/m, "the bench-side module has no runtime imports");
  assert.doesNotMatch(button, /^import .*view-in-room-ar/m, "the heavy half is a dynamic import only");
  assert.match(heavy, /await import\("three\/examples\/jsm\/exporters\/USDZExporter\.js"\)/);
  assert.doesNotMatch(heavy, /^import .*exporters/m);
  assert.doesNotMatch(heavy + button, /\bset(?:Project|Plan|Explode|Scale)\b|buy|affiliate/i, "AR never writes the project, plan or Buy list");
  const canvas = read("src/components/workspace/canvas.tsx");
  const bench = canvas.slice(canvas.indexOf("function BenchScene("));
  assert.match(bench, /<group ref=\{setArRoot\}>/, "the AR root is BenchScene's group");
  assert.doesNotMatch(bench, /ScaleLayer/, "the scale figure and props are not inside it");
});

test("USDZ (Quick Look): metres, horizontal plane anchoring, one mesh per AR mesh", async () => {
  const { USDZExporter } = await import("three/examples/jsm/exporters/USDZExporter.js");
  const { unzipSync, strFromU8 } = await import("three/examples/jsm/libs/fflate.module.js");
  const { model } = benchLike("linen closet 31.5 wide 78 tall 16 deep");
  const ar = arModel(model);
  const usda = strFromU8(unzipSync(await new USDZExporter().parseAsync(ar, { quickLookCompatible: true }))["model.usda"]);
  assert.match(usda, /metersPerUnit = 1\b/);
  assert.match(usda, /preliminary:planeAnchoring:alignment = "horizontal"/);
  assert.equal(usda.match(/def Mesh /g)?.length ?? usda.match(/prepend references = @/g)?.length, ar.children.length);
});
