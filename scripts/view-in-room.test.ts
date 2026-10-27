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
import { AR_CAP_BYTES, FAILED, NOT_WHOLE, arMode, inchText, openAr, prepareAr, sizeLine, tooBig } from "../src/components/workspace/view-in-room";
import { INCH_M, arGlb, arModel, arStats, openQuickLook, quickLookHref } from "../src/components/workspace/view-in-room-ar";
import { getCatalogItem } from "../src/lib/yard/catalog";
import { toPrimitive } from "../src/lib/yard/geometry";
import { applyMemberPose, flatBarGeometry } from "../src/components/workspace/stick-helpers";
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

test("instanced sticks are baked one by one at their own place and tint, then joined into one indexed mesh", () => {
  const g = new THREE.Group();
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.375, 0.0625, 4.5), new THREE.MeshStandardMaterial({ color: "#ffffff" }), 3);
  [0, 10, 20].forEach((x, i) => {
    inst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0, 0));
    inst.setColorAt(i, new THREE.Color("#e2c99a"));
  });
  g.add(inst);
  const ar = arModel(g);
  assert.equal(ar.children.length, 1);
  const m = ar.children[0] as THREE.Mesh;
  assert.equal(m.name, "members");
  assert.equal(m.userData.yardMembers, 3);
  assert.ok(m.geometry.index, "indexed");
  assert.equal(m.geometry.attributes.position.count, 3 * 24);
  close(sizeOf(ar).x, (20 + 0.375) * INCH_M, 1e-6, "span in metres");
  assert.equal((m.material as THREE.MeshStandardMaterial).color.getHexString(), new THREE.Color("#e2c99a").getHexString());
});

/** The 3 ft Eiffel as the bench draws it: the craft cloud's flat-bar stick at each member's own pose. */
function eiffelBench() {
  const project = generateFromPrompt("3 ft popsicle stick eiffel tower");
  const item = getCatalogItem(project.instances[0].catalogId)!;
  const inst = new THREE.InstancedMesh(flatBarGeometry(), new THREE.MeshStandardMaterial({ color: "#e0b86a" }), project.instances.length);
  const d = new THREE.Object3D();
  project.instances.forEach((i, k) => {
    applyMemberPose(d, i, toPrimitive(item, i.cutLength), false, 1, i.position, i.rotation, project.overall, true, false);
    d.updateMatrix();
    inst.setMatrixAt(k, d.matrix);
  });
  const g = new THREE.Group();
  g.add(inst);
  return { project, g, inst };
}

test("3 ft Eiffel: the export measures what the bench draws (14 3/8 W × 14 3/8 D × 37 1/4 H), not the plan's padded 15.2 × 37.4", () => {
  const { project, g, inst } = eiffelBench();
  // The bench's own vertices, each stick at its instance pose (exact, not the per-instance bounding boxes).
  const box = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), pos = inst.geometry.attributes.position;
  for (let i = 0; i < inst.count; i++) {
    inst.getMatrixAt(i, m);
    for (let k = 0; k < pos.count; k++) box.expandByPoint(v.fromBufferAttribute(pos, k).applyMatrix4(m));
  }
  const bench = box.getSize(new THREE.Vector3());
  const ar = arModel(g);
  assert.equal((ar.children[0] as THREE.Mesh).userData.yardMembers, 784, "all 784 sticks");
  const s = sizeOf(ar);
  close(s.x / INCH_M, bench.x, 1e-3, "W = bench");
  close(s.y / INCH_M, bench.y, 1e-3, "H = bench");
  close(s.z / INCH_M, bench.z, 1e-3, "D = bench");
  const st = arStats(ar);
  assert.equal(sizeLine(...st.inches), `14 3/8" W × 14 3/8" D × 37 1/4" H`);
  assert.equal(project.overall.width, 15.2, "the plan's number is the engine's own extent, wider than the drawn sticks");
});

test("3 ft Eiffel: refused with a named reason (about 20 MB, cap 8 MB); the estimate tracks the real USDZ", async () => {
  const { g } = eiffelBench();
  const ar = arModel(g);
  const st = arStats(ar);
  const { USDZExporter } = await import("three/examples/jsm/exporters/USDZExporter.js");
  const real = (await new USDZExporter().parseAsync(ar, { quickLookCompatible: true })).byteLength;
  assert.ok(Math.abs(st.bytes - real) / real < 0.15, `estimate ${st.bytes} vs real ${real}`);
  const prep = await prepareAr(async () => st);
  assert.equal(prep.size, `14 3/8" W × 14 3/8" D × 37 1/4" H`);
  assert.match(prep.refused ?? "", /^This build is too detailed to open in AR \(about (19|20|21) MB; phones handle up to 8 MB\)\./);
});

test("normal builds are not refused: linen, bookcase, pocket vanity well under the cap", async () => {
  for (const [prompt, line] of [
    ["linen closet 31.5 wide 78 tall 16 deep", `31 1/2" W × 16 3/4" D × 78" H`],
    ["bookcase 36 wide 72 tall 12 deep", null],
    ["pocket vanity", null],
  ] as const) {
    const st = arStats(arModel(benchLike(prompt).model));
    assert.ok(st.bytes < AR_CAP_BYTES / 4, `${prompt}: ${st.bytes}`);
    const prep = await prepareAr(async () => st);
    assert.equal(prep.refused, null, prompt);
    if (line) assert.equal(prep.size, line);
  }
});

test("size text: inches to the nearest 1/8 as the app writes them", () => {
  assert.equal(inchText(78), `78"`);
  assert.equal(inchText(14.35), `14 3/8"`);
  assert.equal(inchText(16.75), `16 3/4"`);
  assert.equal(inchText(0.5), `1/2"`);
  assert.equal(inchText(31.49), `31 1/2"`);
  assert.equal(sizeLine(31.5, 16.75, 78), `31 1/2" W × 16 3/4" D × 78" H`);
  assert.equal(tooBig(21 * 1024 * 1024), "This build is too detailed to open in AR (about 21 MB; phones handle up to 8 MB). It still builds and measures the same here.");
});

test("failure paths: a throw, a missing model, an over-cap file all come back as plain words, never a throw", async () => {
  assert.deepEqual(await prepareAr(async () => { throw new Error("WebGL lost"); }), { size: null, refused: FAILED });
  assert.deepEqual(await prepareAr(async () => null), { size: null, refused: FAILED });
  assert.equal(await openAr(async () => { throw new DOMException("NotAllowedError"); }), FAILED, "camera denied / session refused");
  assert.equal(await openAr(async () => { throw new Error("USDZExporter: No valid image data"); }), FAILED, "export throws");
  assert.equal(await openAr(async () => AR_CAP_BYTES + 1), tooBig(AR_CAP_BYTES + 1), "real file over the cap");
  assert.equal(await openAr(async () => 300_000), null, "opened");
  assert.equal(await openAr(async () => undefined), null, "WebXR started");
  assert.match(FAILED, /didn't open/);
});

test("over the cap, Quick Look is never handed the file (no link, no blob URL)", async () => {
  const { model } = benchLike("linen closet 31.5 wide 78 tall 16 deep");
  // Node has no document or URL.createObjectURL for blobs here: reaching the link step would throw.
  const bytes = await openQuickLook(arModel(model), "Linen", 1);
  assert.ok(bytes > 1);
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

test("floor and centre from a raised, offset bench: feet land on y = 0, footprint centred", () => {
  const { model } = benchLike("linen closet 31.5 wide 78 tall 16 deep");
  const lifted = new THREE.Group();
  lifted.position.set(120, 9.5, -40);
  lifted.rotation.y = 0;
  lifted.add(model);
  const box = new THREE.Box3().setFromObject(arModel(lifted));
  close(box.min.y, 0, 1e-9, "feet on the floor, not 9.5 in up");
  close((box.min.x + box.max.x) / 2, 0, 1e-6, "centred x");
  close((box.min.z + box.max.z) / 2, 0, 1e-6, "centred z");
  close(box.max.y, 78 * INCH_M, 1e-6, "78 in tall");
});

test("a part the bench is ghosting (step or Watch it build, 0.16) goes fully opaque; real glass stays glass", () => {
  const g = new THREE.Group();
  const ghostMat = new THREE.MeshStandardMaterial({ color: "#cbab6e", transparent: true, opacity: 0.16 });
  const ghost = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 10), ghostMat);
  ghost.userData = { yardPart: "sh-1", yardGhost: true };
  const glass = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 0.25), new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.42 }));
  glass.userData = { yardPart: "gl-1", yardGhost: false };
  g.add(ghost, glass);
  const [a, b] = arModel(g).children.map((c) => (c as THREE.Mesh).material as THREE.MeshStandardMaterial);
  assert.equal(a.opacity, 1);
  assert.equal(a.transparent, false);
  assert.equal(b.opacity, 0.42, "glass keeps its see-through");
});

test("half-built (Watch it build hid later parts): refused with the plain reason, never exported", async () => {
  const { project, model } = benchLike("linen closet 31.5 wide 78 tall 16 deep");
  model.children.filter((c) => c.children[0]?.userData?.yardPart && /do-/.test(c.children[0].userData.yardPart)).forEach((c) => (c.visible = false));
  const st = arStats(arModel(model));
  assert.equal(st.parts, 9, "the two doors are hidden");
  assert.deepEqual(await prepareAr(async () => st, project.panels.length), { size: null, refused: NOT_WHOLE });
  assert.match(NOT_WHOLE, /Watch it build/);
  const whole = arStats(arModel(benchLike("linen closet 31.5 wide 78 tall 16 deep").model));
  assert.equal((await prepareAr(async () => whole, 11)).refused, null);
});

test("feature test: Quick Look, then WebXR, else nothing; never throws", async () => {
  const doc = (ar: boolean | "throw") => ({ createElement: () => ({ relList: { supports: (t: string) => { if (ar === "throw") throw new Error("x"); return ar && t === "ar"; } } }) });
  const xr = (v: boolean | "reject") => ({ isSessionSupported: async () => { if (v === "reject") throw new Error("SecurityError"); return v; } });
  const iphone = { ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1" };
  const macSafari = { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15", platform: "MacIntel", touch: 0 };
  const ipadDesktop = { ...macSafari, touch: 5 };
  assert.equal(await arMode({ document: doc(true), xr: xr(true), ...iphone }), "quicklook");
  assert.equal(await arMode({ document: doc(true), ...ipadDesktop }), "quicklook", "iPad asking for the desktop site");
  assert.equal(await arMode({ document: doc(true), ...macSafari }), null, "desktop Mac Safari answers rel=ar but has no AR: no chip");
  assert.equal(await arMode({ document: doc(true), xr: xr(false) }), null, "rel=ar without an iOS device: no chip");
  assert.equal(await arMode({ document: doc(false), xr: xr(true), secure: true }), "webxr");
  assert.equal(await arMode({ document: doc("throw"), xr: xr(true), ...iphone }), "webxr");
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
  assert.doesNotMatch(heavy, /from "\.\/view-in-room"/, "the lazy half imports nothing from the bench half (its own chunk)");
  assert.doesNotMatch(heavy + button, /\bset(?:Project|Plan|Explode|Scale)\b|buy|affiliate/i, "AR never writes the project, plan or Buy list");
  const canvas = read("src/components/workspace/canvas.tsx");
  const bench = canvas.slice(canvas.indexOf("function BenchScene("));
  assert.match(bench, /<group ref=\{setArRoot\}>/, "the AR root is BenchScene's group");
  assert.doesNotMatch(bench, /ScaleLayer/, "the scale figure and props are not inside it");
  assert.match(button, /if \(!mode \|\| parts === 0\) return null;/, "no AR reported: no chip at all");
  assert.match(button, /scrubState\(\)\.open/, "Watch it build open: the chip waits");
  assert.match(button, /s\.explode \|\| s\.activeStep != null \|\| s\.facesOpen/, "See inside, a step, open doors: the chip waits");
  assert.match(button, /const note = moved \? NOT_WHOLE/, "and says why, as text under it");
  assert.doesNotMatch(light + heavy + button, /uses Scene Viewer/, "Android is WebXR");
  assert.doesNotMatch(light + heavy + button, /console\.(error|warn|log)/, "failures are lines under the chip, not console output");
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
