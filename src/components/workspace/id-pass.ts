/**
 * ID-buffer passes over the live scene (See inside, PLAN §1). Each engine part's main mesh carries
 * userData.yardPart = panel id (PanelMesh). An ID pass renders those meshes alone, each in one flat colour
 * (id = index + 1 in RGB, no lighting, no tone mapping, linear output) into a render target at canvas size
 * and DPR 1, from the same renderer, camera and pose the user sees, then reads it back.
 *
 * Used by the explode solver (quarter resolution, its own box scene) and by the ?test=1 hook that the
 * every-piece-visible e2e reads (scripts/e2e/see-inside-every-piece.py). Never runs on its own.
 */
import * as THREE from "three";

export const ID_LAYER = 7;

/** Flat id colour, exact under linear output (k / 255 per channel). */
export function idMaterial(id: number): THREE.MeshBasicMaterial {
  const c = new THREE.Color().setRGB((id & 255) / 255, ((id >> 8) & 255) / 255, ((id >> 16) & 255) / 255, THREE.LinearSRGBColorSpace);
  const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false, side: THREE.DoubleSide });
  m.fog = false;
  return m;
}

/** The engine part a scene object draws (its main mesh, or a hook glyph group), else null. */
export function partIdOf(o: THREE.Object3D): string | null {
  if ((o as unknown as { isLineSegments2?: boolean }).isLineSegments2 || (o as unknown as { isLine2?: boolean }).isLine2) return null;
  if (!(o as THREE.Mesh).isMesh || (o as THREE.InstancedMesh).isInstancedMesh) return null;
  // The main mesh carries its part id; a bought-hardware glyph (coat hook) tags its group instead.
  // Decoration siblings (pulls, hinges, edge bands) carry nothing, so they never count as a part.
  if (o.userData?.yardPart) return o.userData.yardPart as string;
  for (let q = o.parent, i = 0; q && i < 4; q = q.parent, i++) if (q.userData?.yardPartGlyph) return q.userData.yardPart as string;
  return null;
}

type Target = { rt: THREE.WebGLRenderTarget; buf: Uint8Array };
let cache: Target | null = null;
function target(w: number, h: number): Target {
  if (!cache || cache.rt.width !== w || cache.rt.height !== h) {
    cache?.rt.dispose();
    cache = { rt: new THREE.WebGLRenderTarget(w, h, { depthBuffer: true, samples: 0, type: THREE.UnsignedByteType }), buf: new Uint8Array(w * h * 4) };
  }
  return cache;
}

/**
 * Render `meshes` (each with its id, 1-based) from `camera` into a w × h target; returns top-down ids
 * (0 = nothing). Everything else in the scene is off for the pass (camera on ID_LAYER only); the live
 * materials, layers, background and fog are put back after.
 */
export function renderIds(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  meshes: { mesh: THREE.Mesh; id: number }[],
  w: number,
  h: number,
): Uint32Array {
  const saved = meshes.map(({ mesh }) => ({ mesh, mat: mesh.material, layers: mesh.layers.mask }));
  const mats = new Map<number, THREE.MeshBasicMaterial>();
  for (const { mesh, id } of meshes) {
    let m = mats.get(id);
    if (!m) mats.set(id, (m = idMaterial(id)));
    mesh.material = m;
    mesh.layers.enable(ID_LAYER);
  }
  const camLayers = camera.layers.mask;
  const bg = scene.background, fog = scene.fog, env = scene.environment, ov = scene.overrideMaterial;
  const prevTarget = gl.getRenderTarget();
  const prevClear = gl.getClearColor(new THREE.Color()), prevAlpha = gl.getClearAlpha();
  const prevShadow = gl.shadowMap.autoUpdate;
  const t = target(w, h);
  try {
    camera.layers.set(ID_LAYER);
    scene.background = null; scene.fog = null; scene.environment = null; scene.overrideMaterial = null;
    gl.shadowMap.autoUpdate = false;
    gl.setRenderTarget(t.rt);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, true, true);
    gl.render(scene, camera);
    gl.readRenderTargetPixels(t.rt, 0, 0, w, h, t.buf);
  } finally {
    gl.setRenderTarget(prevTarget);
    gl.setClearColor(prevClear, prevAlpha);
    gl.shadowMap.autoUpdate = prevShadow;
    camera.layers.mask = camLayers;
    scene.background = bg; scene.fog = fog; scene.environment = env; scene.overrideMaterial = ov;
    for (const s of saved) { s.mesh.material = s.mat; s.mesh.layers.mask = s.layers; }
    for (const m of mats.values()) m.dispose();
  }
  const out = new Uint32Array(w * h);
  const buf = t.buf;
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w, dst = y * w;
    for (let x = 0; x < w; x++) {
      const i = (src + x) * 4;
      out[dst + x] = buf[i] | (buf[i + 1] << 8) | (buf[i + 2] << 16);
    }
  }
  return out;
}

/** Every visible engine part's meshes in the live scene, grouped by part id (scene order). */
export function partMeshes(scene: THREE.Scene): Map<string, THREE.Mesh[]> {
  const out = new Map<string, THREE.Mesh[]>();
  scene.traverseVisible((o) => {
    const id = partIdOf(o);
    if (!id) return;
    const list = out.get(id) ?? [];
    list.push(o as THREE.Mesh);
    out.set(id, list);
  });
  return out;
}
