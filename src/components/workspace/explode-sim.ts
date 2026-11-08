/**
 * ?test=1 / unit tests only: split today's solid drawer boxes into the hollow 5-part drawers SWE is shipping
 * (stacked on #92): front, 2 sides, back, a 1/4" ply bottom and an open top, every part tagged with one
 * drawer id (SIM_DRAWER_TAG until SWE names the real field). Proves the explode and the every-drawer rule on
 * the geometry that is coming; never used by a real build.
 */
import type { Panel } from "@/lib/yard/types";

export const SIM_DRAWER_TAG = "yardDrawerSim";
const T_SIDE = 0.5, T_BOTTOM = 0.25, SIDE_DROP = 0.5;

export function simulateHollowDrawers(panels: readonly Panel[]): Panel[] {
  const out: Panel[] = [];
  const fronts = panels.filter((f) => /drawer front/i.test(f.name));
  let k = 0;
  for (const p of panels) {
    if (p.type !== "drawer") { out.push(p); continue; }
    const id = `sim-drw-${k++}`;
    const { x, y, z } = p.position, { width: w, height: h, depth: d } = p.size;
    // Its front: the drawer front overlapping this box most in X × Y.
    let best: Panel | undefined, bs = 0;
    for (const f of fronts) {
      const ox = Math.max(0, Math.min(x + w, f.position.x + f.size.width) - Math.max(x, f.position.x));
      const oy = Math.max(0, Math.min(y + h, f.position.y + f.size.height) - Math.max(y, f.position.y));
      if (ox * oy > bs) { bs = ox * oy; best = f; }
    }
    if (best) (best as unknown as Record<string, unknown>)[SIM_DRAWER_TAG] = id;
    const hs = Math.max(1, h - SIDE_DROP);
    const part = (name: string, type: string, pos: [number, number, number], size: [number, number, number]) =>
      out.push({ ...p, id: `${p.id}-${name.replace(/\s+/g, "-")}`, name: `${p.name} ${name}`, type: type as Panel["type"],
        position: { x: pos[0], y: pos[1], z: pos[2] }, size: { width: size[0], height: size[1], depth: size[2] },
        [SIM_DRAWER_TAG]: id } as Panel);
    part("left side", "side", [x, y, z], [T_SIDE, hs, d]);
    part("right side", "side", [x + w - T_SIDE, y, z], [T_SIDE, hs, d]);
    part("back", "back", [x + T_SIDE, y, z], [w - 2 * T_SIDE, hs, T_SIDE]);
    part("bottom", "bottom", [x + T_SIDE, y, z + T_SIDE], [w - 2 * T_SIDE, T_BOTTOM, d - T_SIDE]);
  }
  return out;
}
