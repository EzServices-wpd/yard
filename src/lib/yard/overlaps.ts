/** I16 no interpenetration (F30): parts sharing space on all three axes with no modelled joint. */
import { isBoughtHardwareName } from "./boughtHardware";
import type { Panel, YardProject } from "./types";

const EPS = 1 / 16;
const plain = (p: Panel) => !p.strut && !p.form && !p.polygon && !p.outline && !p.yaw && !p.leaf && !isBoughtHardwareName(p.name) && Math.min(p.size.width, p.size.height, p.size.depth) > 0.1;
export function overlaps(project: YardProject): string[] {
  const ps = project.panels.filter(plain);
  const out: string[] = [];
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j];
      if (a.joints?.some((x) => x.with === b.id) || b.joints?.some((x) => x.with === a.id)) continue;
      const ov = (["x", "y", "z"] as const).map((k, n) => {
        const s = (["width", "height", "depth"] as const)[n];
        return Math.min(a.position[k] + a.size[s], b.position[k] + b.size[s]) - Math.max(a.position[k], b.position[k]);
      });
      if (ov.every((v) => v > EPS)) out.push(`${a.name} ∩ ${b.name}`);
    }
  return out;
}

