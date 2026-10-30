/**
 * Probe record for the author-run grade kit (/workspace/critic-precheck/grade-kit.sh): one build -> the record Critic's
 * dump chunks hash, a per-build Buy audit, and the 1/2" vs 3/4" stock-switch check (row 672). Pure functions: the engine,
 * catalog and offline wrapper are passed in, so the kit can load THIS file from the base tree and point it at the head's
 * engine (a PR can't change how it is measured). Read-only, offline, no xAI. No engine behaviour lives here.
 */
import { createHash } from "node:crypto";

export type Cat = { getCatalogItem?: (id: string) => any };
export type Engine = { generateFromPrompt: (q: string, mat?: string) => any; buildPlan: (p: any) => any; checkBuild: (p: any, q: string, pl?: any) => { id: string; msg: string }[]; headerTitle: (p: any) => string };

const nestOf = (n: any) => n ? (n.sheets ?? []).map((s: any) => ({ w: s.width, h: s.height, m: s.material, parts: s.parts.map((x: any) => ({ id: String(x.id), n: x.name, m: x.material, w: x.width, h: x.height, x: x.x, y: x.y })) })) : null;

/** The build record, field for field as Critic's dump-chunk.mts writes it (its sha1 is the `full` hash the dumps compare). */
export function record(E: Engine, q: string, p: any, pl: any): any {
  let inv: string[] = []; try { inv = E.checkBuild(p, q, pl).map((v) => `${v.id}:${v.msg}`); } catch (e: any) { inv = ["ERR:" + e?.message]; }
  return {
    title: E.headerTitle(p), refused: p.refused ?? null, notes: p.notes ?? [], overall: p.overall, prim: p.primaryMaterialId ?? null,
    panels: p.panels.map((x: any) => [x.type, x.name, x.materialId, x.position, x.size, x.yaw ?? 0]),
    bom: pl.bom.map((b: any) => ({ n: b.name, q: b.quantity, id: b.catalogId ?? null, u: b.unit ?? "", cost: b.estimatedCost ?? null, notes: b.notes ?? "", offers: (b.offers ?? []).map((o: any) => [o.href ?? null, o.packPrice ?? null, o.best ?? null]) })),
    steps: pl.instructions.map((s: any) => [s.title, s.description, s.partsUsed ?? [], s.fastenersUsed ?? null]),
    cut: pl.cutList.map((c: any) => ({ id: c.id ?? null, n: c.name, q: c.quantity, l: c.lengthIn, w: c.widthIn, th: c.thicknessIn, mat: c.material, whole: !!c.whole })),
    totals: pl.totals, nest: nestOf(pl.sheetNest?.sheets), backer: nestOf(pl.sheetNest?.backer),
    unplaced: (pl.sheetNest?.sheets?.unplaced ?? []).length + (pl.sheetNest?.backer?.unplaced ?? []).length, inv,
  };
}
export const hash = (o: unknown) => createHash("sha1").update(JSON.stringify(o)).digest("hex").slice(0, 16);

/** Buy audit: flags for one build. "UNAUDITABLE ..." flags are counted lines (no "(N used)"), not failures by themselves. */
export function audit(cat: Cat, pl: any): string[] {
  const f: string[] = []; const sum = (a: number[]) => a.reduce((s, x) => s + (x || 0), 0); const item = (id: any) => cat.getCatalogItem?.(id ?? "");
  const sheetQty = sum(pl.bom.filter((b: any) => item(b.catalogId)?.formFactor === "sheet").map((b: any) => b.quantity));
  const nestN = (pl.sheetNest?.sheets?.sheets?.length ?? 0) + (pl.sheetNest?.backer?.sheets?.length ?? 0);
  if (pl.sheetNest && sheetQty !== nestN) f.push(`sheet lines ${sheetQty} != nest sheets ${nestN}`);
  const cutQ = sum(pl.cutList.map((c: any) => c.quantity));
  if (pl.totals?.pieces != null && cutQ && cutQ !== pl.totals.pieces) f.push(`pieces ${pl.totals.pieces} != cut list ${cutQ}`);
  const bomUsd = Math.round(sum(pl.bom.map((b: any) => b.estimatedCost)) * 100) / 100;
  if (pl.totals?.estCostUsd != null && Math.abs(bomUsd - pl.totals.estCostUsd) > 0.011) f.push(`total $${pl.totals.estCostUsd} != Buy sum $${bomUsd}`);
  for (const b of pl.bom) {
    const m = (b.unit ?? "").match(/\bpacks? of (\d+)/i), u = (b.unit ?? "").match(/\((\d+) [a-z ]*used\)/i);
    if (m && u && b.quantity !== Math.ceil(Number(u[1]) / Number(m[1]))) f.push(`pack ${b.name}: ${b.quantity}x${m[1]} != ceil(${u[1]}/${m[1]})`);
    const best = (b.offers ?? []).find((o: any) => o.best); const used = u ? Number(u[1]) : null;
    if (best && used && best.packQty > 1) { if (best.packsNeeded * best.packQty < used) f.push(`pack ${b.name}: best under`); if ((best.packsNeeded - 1) * best.packQty >= used) f.push(`pack ${b.name}: best over`); }
    const it = item(b.catalogId); const ff = it?.formFactor;
    if (b.catalogId && ff !== "sheet" && /\bpacks?\b|\bbox\b|\bct\b/i.test(b.unit ?? "") && !u) f.push(`UNAUDITABLE ${b.name} (${b.unit})`);
    if (!["board", "stick", "dowel"].includes(ff) || !(it?.dims?.length > 0)) continue;
    const L = it.dims.length, W = it.dims.width || 0; const cuts = pl.cutList.filter((c: any) => String(c.id ?? "").split("|")[0] === b.catalogId);
    if (!cuts.length) continue;
    const lens: number[] = []; let whole = 0;
    for (const c of cuts) { const strips = ff === "board" && W > 0 && c.widthIn > W + 1e-6 ? Math.ceil(c.widthIn / W - 1e-6) : 1;
      for (let k = 0; k < c.quantity * strips; k++) { if (c.whole) whole++; else lens.push(c.lengthIn); } }
    const long = lens.filter((x) => x > L + 1e-6).length; if (long) f.push(`stock ${b.name}: ${long} pieces longer than ${L}"`);
    const bins: number[] = []; for (const c of lens.filter((x) => x <= L + 1e-6).sort((a, z) => z - a)) { const k = bins.findIndex((r) => r >= c - 1e-6); if (k >= 0) bins[k] -= c; else bins.push(L - c); }
    const need = bins.length + whole + long; const bought = m ? b.quantity * Number(m[1]) : b.quantity; const allow = Math.max(m ? Number(m[1]) : 1, Math.ceil(0.1 * need));
    if (bought < need) f.push(`stock under ${b.name}: buys ${bought} < needs ${need} (first-fit)`);
    else if (bought - need > allow) f.push(`stock over ${b.name}: buys ${bought} for ${need} (allowed +${allow})`);
  }
  return f;
}

/** Stock-switch check (row 672) of a switched build against the default build's record: same parts, sizes equal except the
 * thinnest dimension and one axis growing or shrinking by up to 2 × the thickness change + 0.01, every cut thickness on Buy. */
export function switchCheck(cat: Cat, base: any, s: any, mat: string): string[] {
  if (base.err || s.err) return s.err && !base.err ? ["switch build errors"] : [];
  const f: string[] = []; if (!!base.refused !== !!s.refused) f.push("refusal differs from default build");
  const th = (id: any) => cat.getCatalogItem?.(id ?? "")?.dims?.thickness ?? null;
  const t0 = th(base.prim), t1 = th(mat); const tol = 2 * (t0 != null && t1 != null ? Math.abs(t0 - t1) : 0) + 0.01;
  if (base.panels.length !== s.panels.length) f.push(`panels ${base.panels.length} -> ${s.panels.length}`);
  else base.panels.forEach((x: any, k: number) => { const y = s.panels[k]; if (x[1] !== y[1]) { f.push(`panel ${k} ${x[1]} -> ${y[1]}`); return; }
    const d = (z: any) => [z.width, z.height, z.depth].sort((a, b) => a - b).slice(1); const a = d(x[4]), c = d(y[4]);
    const moved = a.map((v, j) => Math.abs(v - c[j])).filter((v) => v > 1e-3);
    if (moved.length > 1 || (moved.length === 1 && moved[0] > tol + 1e-9)) f.push(`size ${x[1]} ${a.join("x")} -> ${c.join("x")}`); });
  if (base.cut.length !== s.cut.length) f.push(`cut lines ${base.cut.length} -> ${s.cut.length}`);
  const T: number[] = []; for (const b of s.bom) for (const v of Object.values(cat.getCatalogItem?.(b.id ?? "")?.dims ?? {})) if (typeof v === "number") T.push(v);
  for (const c of s.cut) if (c.th != null && !T.some((t) => Math.abs(t - c.th) < 1e-3)) f.push(`cut part thickness ${c.th} not on Buy (${c.n})`);
  return [...new Set(f)].slice(0, 12);
}

/** Flag class for the kit's set ratchet: numbers dropped, names kept, so a swap between lines or parts shows as a new pair. */
export const flagClass = (flag: string) => flag.replace(/\d+(\.\d+)?/g, "N");

/** One prompt (optionally on a picked sheet): record + audit, or { err } when the engine throws. */
export function probe(E: Engine, cat: Cat, offline: <T>(f: () => T) => T, q: string, mat?: string): { rec: any; a: string[] } {
  return offline(() => {
    try {
      const p = mat ? E.generateFromPrompt(q, mat) : E.generateFromPrompt(q); const pl = E.buildPlan(p); const rec = record(E, q, p, pl);
      let a: string[]; try { a = audit(cat, pl); } catch (e: any) { a = ["AUDIT ERR " + String(e?.message ?? e).slice(0, 80)]; }
      return { rec, a };
    } catch (e: any) { return { rec: { err: String(e?.message ?? e).slice(0, 300) }, a: [] }; }
  });
}
