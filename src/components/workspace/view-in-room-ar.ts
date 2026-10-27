/**
 * View in your room, the heavy half (loaded on tap): the bench model copied at true size in metres, then
 * handed to iOS Quick Look (USDZExporter) or placed with WebXR hit-test on Android. Only parts travel: the
 * scale figure and props live outside the bench's model group and on their own layer, and lines, outlines,
 * click targets and the step glow are left behind, so the piece in your room is the piece on the bench.
 */
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Plan inches to AR metres. */
export const INCH_M = 0.0254;

/** Quick Look link: fixed scale (no pinch to resize), so the piece always stands at its true size. */
export function quickLookHref(blobUrl: string): string {
  return `${blobUrl.split("#")[0]}#allowsContentScaling=0`;
}

type AnyLine = { isLine?: boolean; isLineSegments?: boolean; isLine2?: boolean; isLineSegments2?: boolean; isPoints?: boolean };
const isLine = (o: THREE.Object3D) => {
  const l = o as unknown as AnyLine;
  return !!(l.isLine || l.isLineSegments || l.isLine2 || l.isLineSegments2 || l.isPoints);
};

/** The part a mesh draws: its own tag, or a bought-hardware glyph group's (pulls, hinges, bands carry none). */
function partOf(o: THREE.Object3D): string | null {
  if (o.userData?.yardPart) return o.userData.yardPart as string;
  for (let q = o.parent, i = 0; q && i < 4; q = q.parent, i++) if (q.userData?.yardPartGlyph) return q.userData.yardPart as string;
  return null;
}

/** The surface as built: colour, grain, roughness and glass kept; the step glow dropped (real tone, not the cue). */
function arMaterial(src: THREE.Material, tint: THREE.Color | null, cache: Map<string, THREE.MeshStandardMaterial>) {
  const key = `${src.uuid}|${tint?.getHexString() ?? ""}`;
  let m = cache.get(key);
  if (m) return m;
  const s = src as THREE.MeshStandardMaterial;
  const img = s.map?.image as unknown;
  const drawable = typeof HTMLCanvasElement !== "undefined" && (img instanceof HTMLCanvasElement || img instanceof HTMLImageElement);
  m = new THREE.MeshStandardMaterial({
    color: (s.color ?? new THREE.Color(1, 1, 1)).clone().multiply(tint ?? new THREE.Color(1, 1, 1)),
    map: drawable ? s.map : null,
    roughness: s.roughness ?? 0.8,
    metalness: s.metalness ?? 0,
    transparent: s.transparent && s.opacity < 1,
    opacity: s.opacity ?? 1,
    side: s.side,
  });
  cache.set(key, m);
  return m;
}

/**
 * The bench model at true size: every visible mesh in the model group, transforms baked into metres, the
 * floor at y = 0 and the footprint centred on the origin. Instanced sticks are baked one by one at their own
 * pose, then joined into one indexed mesh per material ("members", userData.yardMembers = how many), so a
 * 784-stick Eiffel is one light mesh, not 784 copies of a 468-vertex stick.
 * Leaves out lines, hidden click planes, anything off layer 0 (props) or under the scale layer.
 */
export function arModel(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true);
  const out = new THREE.Group();
  out.name = "yard-ar-model";
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  const indexed = new Map<string, THREE.BufferGeometry>();
  const members = new Map<THREE.MeshStandardMaterial, THREE.BufferGeometry[]>();
  const tint = new THREE.Color();
  const m4 = new THREE.Matrix4();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, world: THREE.Matrix4, part: string | null) => {
    const mesh = new THREE.Mesh(geo.clone().applyMatrix4(world), arMaterial(mat, null, cache));
    mesh.name = part ? `part:${part}` : "detail";
    if (part) mesh.userData.yardPart = part;
    out.add(mesh);
  };
  const walk = (o: THREE.Object3D) => {
    if (!o.visible || o.userData?.yardScale || isLine(o)) return;
    const mesh = o as THREE.Mesh;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (mesh.isMesh && mesh.geometry && mat && mat.visible !== false && mesh.layers.isEnabled(0)) {
      const inst = o as THREE.InstancedMesh;
      if (inst.isInstancedMesh) {
        let geo = indexed.get(inst.geometry.uuid);
        if (!geo) indexed.set(inst.geometry.uuid, (geo = inst.geometry.index ? inst.geometry : mergeVertices(inst.geometry)));
        for (let i = 0; i < inst.count; i++) {
          inst.getMatrixAt(i, m4);
          if (inst.instanceColor) inst.getColorAt(i, tint);
          const m = arMaterial(mat, inst.instanceColor ? tint : null, cache);
          members.set(m, [...(members.get(m) ?? []), geo.clone().applyMatrix4(m4.premultiply(inst.matrixWorld))]);
        }
      } else add(mesh.geometry, mat, mesh.matrixWorld, partOf(o));
    }
    o.children.forEach(walk);
  };
  walk(root);
  for (const [mat, list] of members) {
    const joined = new THREE.Mesh(mergeGeometries(list) ?? list[0], mat);
    joined.name = "members";
    joined.userData.yardMembers = list.length;
    out.add(joined);
  }
  // Inches to metres, footprint centred, feet on the floor.
  const box = new THREE.Box3().setFromObject(out);
  if (box.isEmpty()) return out;
  const c = box.getCenter(new THREE.Vector3());
  const toM = new THREE.Matrix4().makeScale(INCH_M, INCH_M, INCH_M).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
  out.children.forEach((k) => (k as THREE.Mesh).geometry.applyMatrix4(toM));
  return out;
}

/** Text bytes USDZ spends per vertex (point, normal, uv) and per index (face index + its share of counts). */
const USD_VERTEX = 88, USD_INDEX = 12, USD_TEXTURE = 64 * 1024;
/**
 * The model's measured size (inches, W × D × H, from its own box: what the bench draws, hardware included)
 * and the file it makes: Quick Look's USDZ estimated from its vertex and index counts (within about 10% of
 * the real export; a tap still checks the real bytes).
 */
export function arStats(model: THREE.Group): { inches: [number, number, number]; bytes: number } {
  const s = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).divideScalar(INCH_M);
  let bytes = 0;
  const maps = new Set<string>();
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const n = m.geometry.attributes.position.count;
    bytes += n * USD_VERTEX + (m.geometry.index?.count ?? n) * USD_INDEX;
    const map = (m.material as THREE.MeshStandardMaterial).map;
    if (map) maps.add(map.uuid);
  });
  return { inches: [s.x, s.z, s.y], bytes: bytes + maps.size * USD_TEXTURE };
}

/**
 * iOS: USDZ in memory, opened in Quick Look at fixed scale through an a rel="ar" link (blob URL, never
 * uploaded). Over the cap it is not opened; the real byte count comes back either way.
 */
export async function openQuickLook(model: THREE.Group, name: string, cap: number): Promise<number> {
  const { USDZExporter } = await import("three/examples/jsm/exporters/USDZExporter.js");
  const bytes = await new USDZExporter().parseAsync(model, { quickLookCompatible: true, maxTextureSize: 512 });
  if (bytes.byteLength > cap) return bytes.byteLength;
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "model/vnd.usdz+zip" }));
  const a = document.createElement("a");
  a.rel = "ar";
  a.href = quickLookHref(url);
  a.download = `${name.replace(/[^\w-]+/g, "-").toLowerCase() || "yard"}.usdz`;
  a.appendChild(document.createElement("img"));
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return bytes.byteLength;
}

/** Test hook only (?test=1): the same model as GLB, so an e2e can load it back and check every part and the size. */
export async function arGlb(model: THREE.Group): Promise<ArrayBuffer> {
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  return (await new GLTFExporter().parseAsync(model, { binary: true })) as ArrayBuffer;
}

/**
 * Android: an immersive-ar session with hit-test. A ring follows the floor; a tap stands the piece there at
 * true size; a second tap moves it. Close (or the system back) ends it. Camera frames stay with the browser.
 */
export async function startWebXR(model: THREE.Group, onEnd: () => void) {
  const xr = (navigator as Navigator & { xr: XRSystem }).xr;
  const overlay = document.createElement("div");
  overlay.setAttribute("data-yard-ar-overlay", "");
  overlay.style.cssText = "position:fixed;inset:0;pointer-events:none;font:600 14px system-ui,sans-serif;color:#eceae6";
  overlay.innerHTML =
    '<p style="position:absolute;left:50%;top:16px;transform:translateX(-50%);margin:0;padding:10px 14px;border-radius:999px;background:#1c1f23e6;border:1px solid #2c3136">Point at the floor, then tap to place</p>' +
    '<button type="button" style="pointer-events:auto;position:absolute;right:16px;bottom:24px;min-width:88px;min-height:44px;border-radius:10px;background:#1c1f23;border:1px solid #2c3136;color:#eceae6;font:inherit">Close</button>';
  document.body.appendChild(overlay);
  const session = await xr
    .requestSession("immersive-ar", { requiredFeatures: ["hit-test"], optionalFeatures: ["dom-overlay"], domOverlay: { root: overlay } })
    .catch((e: unknown) => (overlay.remove(), Promise.reject(e)));
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local");
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#fff4e6", "#3a3530", 1.6), Object.assign(new THREE.DirectionalLight("#fff1dd", 1.4), { position: new THREE.Vector3(1, 3, 2) }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.15, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#7cb2ff" }));
  ring.matrixAutoUpdate = false;
  ring.visible = model.visible = false;
  scene.add(ring, model);
  await renderer.xr.setSession(session);
  const hits = await session.requestHitTestSource?.({ space: await session.requestReferenceSpace("viewer") });
  const hint = overlay.querySelector("p");
  session.addEventListener("select", () => {
    if (!ring.visible) return;
    model.position.setFromMatrixPosition(ring.matrix);
    model.visible = true;
    if (hint) hint.textContent = "True size. Tap again to move it.";
  });
  overlay.querySelector("button")?.addEventListener("click", () => void session.end());
  renderer.setAnimationLoop((_t, frame) => {
    const ref = renderer.xr.getReferenceSpace();
    const hit = frame && hits && ref ? frame.getHitTestResults(hits)[0]?.getPose(ref) : undefined;
    ring.visible = !!hit;
    if (hit) ring.matrix.fromArray(hit.transform.matrix);
    renderer.render(scene, renderer.xr.getCamera());
  });
  session.addEventListener("end", () => {
    renderer.setAnimationLoop(null);
    hits?.cancel();
    renderer.dispose();
    overlay.remove();
    onEnd();
  });
}
