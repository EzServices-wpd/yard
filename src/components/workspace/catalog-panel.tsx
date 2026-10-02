"use client";

import { useMemo, useState } from "react";
import { StockFind } from "@/components/workspace/stock-find";
import { CATALOG_CATEGORIES, FORGE_CATALOG, getCatalogItem, searchCatalog } from "@/lib/yard/catalog";
import { listFoundStock, rememberCatalogItem } from "@/lib/yard/foundStock";
import { JOIN_LABELS } from "@/lib/yard/joints";
import { useYard } from "@/lib/yard/store";
import { promptNamingStock, speakCatalogStock } from "@/lib/yard/promptHelpers";
import { stockOffer } from "@/lib/yard/stockQuery";
import { inches } from "@/lib/utils";
import type { CatalogItem, JoinMethod } from "@/lib/yard/types";

const KIND_SHORT: Partial<Record<CatalogItem["category"], string>> = {
  craft_wood: "Craft",
  paper_tube: "Tubes",
  pvc_plumbing: "PVC",
  dowel_rod: "Dowels",
  lumber: "Lumber",
  sheet_goods: "Sheet",
  foam: "Foam",
  cardboard: "Cardboard",
  metal: "Metal",
  plastic: "Plastic",
  recycled: "Free",
  hardware: "Hardware",
  other: "Other",
};

export function CatalogPanel() {
  const project = useYard((s) => s.project);
  const generate = useYard((s) => s.generate);
  const makePlan = useYard((s) => s.makePlan);
  const revealBench = useYard((s) => s.revealBench);
  const setJoinMethod = useYard((s) => s.setJoinMethod);
  const commit = useYard((s) => s.commit);
  const [rev, setRev] = useState(0);
  const [q, setQ] = useState("");
  const searching = q.trim().length > 0;
  const direct = searching ? stockOffer(q) : null;
  const items = useMemo(
    () =>
      FORGE_CATALOG.filter(
        (i) => !i.tags?.includes("binder") && i.id !== "wire-frame" && !i.tags?.includes("wire"),
      ),
    [],
  );
  const matches = useMemo(() => {
    if (!searching) return [];
    return searchCatalog(q, 40).filter(
      (i) => !i.tags?.includes("binder") && i.id !== "wire-frame" && !i.tags?.includes("wire") && i.id !== direct?.id,
    );
  }, [q, searching, direct?.id, rev]);
  const kinds = useMemo(
    () => CATALOG_CATEGORIES.filter((cat) => items.some((i) => i.category === cat.id)),
    [items],
  );
  const active = getCatalogItem(project.primaryMaterialId);
  const [kind, setKind] = useState(active?.category ?? kinds[0]?.id ?? "sheet_goods");
  const kindOk = kinds.some((k) => k.id === kind) ? kind : (kinds[0]?.id ?? kind);
  const kept = useMemo(() => (searching ? [] : listFoundStock().slice(0, 8)), [rev, searching]);
  const joins = (active?.preferredJoins ?? []) as JoinMethod[];
  const currentJoin = project.joinMethod ?? joins[0];

  function useStock(item: CatalogItem) {
    rememberCatalogItem(item);
    setRev((n) => n + 1);
    if (!project.prompt.trim()) {
      commit({ ...project, primaryMaterialId: item.id });
      return;
    }
    const nextPrompt = promptNamingStock(project.prompt, speakCatalogStock(item));
    const spine = project.supportOffer?.included;
    useYard.getState().beginBuild();
    window.setTimeout(() => {
      try {
        generate(nextPrompt, item.id, undefined, {
          includeSpine: spine,
          fresh: true,
          keepView: true,
          restock: true,
        });
        makePlan();
      } finally {
        revealBench();
      }
    }, 48);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <h2 className="font-display text-lg text-fg">Stock</h2>
        <p className="mt-1 text-xs text-muted">Search a product, or a cut you already have.</p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            const item = stockOffer(q);
            if (!item) return;
            e.preventDefault();
            useStock(item);
          }}
          placeholder="2×4 scraps 5 inches, Dasani, oak…"
          aria-label="Search stock"
          className="mt-3 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg outline-none placeholder:text-faint"
        />
        {!searching && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {kinds.map((cat) => {
            const on = cat.id === kindOk;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setKind(cat.id)}
                className={`h-9 shrink-0 rounded-full border px-3 text-xs ${
                  on ? "border-fg/40 bg-elevated text-fg" : "border-border text-muted hover:text-fg"
                }`}
              >
                {KIND_SHORT[cat.id] ?? cat.label}
              </button>
            );
          })}
        </div>
        )}
        {joins.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] uppercase tracking-wider text-faint">Join</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {joins.map((j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setJoinMethod(j)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    currentJoin === j ? "border-fg/40 bg-elevated text-fg" : "border-border text-muted hover:text-fg"
                  }`}
                >
                  {JOIN_LABELS[j]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {searching && (
          <div className="px-2">
            <StockFind query={q} onUse={useStock} />
          </div>
        )}
        {searching ? (
          matches.length > 0 && (
            <ul>
              {matches.map((item) => {
                const dim =
                  item.dims.length && item.dims.diameter
                    ? `${inches(item.dims.length)} · ⌀${item.dims.diameter}`
                    : item.dims.length && item.dims.width
                      ? `${inches(item.dims.length)} × ${inches(item.dims.width)}`
                      : "";
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => useStock(item)}
                      className="flex w-full items-start justify-between gap-2 rounded-md px-2 py-2 text-left hover:bg-elevated/60"
                    >
                      <span>
                        <span className="block text-sm text-fg">{item.name}</span>
                        {dim ? <span className="block text-xs text-muted">{dim}</span> : null}
                      </span>
                      {item.unitCostUsd != null && item.unitCostUsd > 0 && (
                        <span className="font-mono text-xs text-faint">${item.unitCostUsd.toFixed(2)}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          <>
            {kept.length > 0 && (
              <div className="mb-3">
                <p className="px-2 py-1 text-xs font-medium uppercase tracking-wider text-faint">On this device</p>
                <ul>
                  {kept.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => useStock(item)}
                        className="flex w-full items-start justify-between gap-2 rounded-md px-2 py-2 text-left hover:bg-elevated/60"
                      >
                        <span className="block text-sm text-fg">{item.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {CATALOG_CATEGORIES.filter((cat) => cat.id === kindOk).map((cat) => {
              const group = items.filter((i) => i.category === cat.id);
              if (!group.length) return null;
              return (
                <ul key={cat.id}>
                  {group.map((item) => {
                    const selected = project.primaryMaterialId === item.id;
                    const dim =
                      item.dims.length && item.dims.diameter
                        ? `${inches(item.dims.length)} · ⌀${item.dims.diameter}`
                        : item.dims.length && item.dims.width
                          ? `${inches(item.dims.length)} × ${inches(item.dims.width)}`
                          : "";
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => useStock(item)}
                          className={`flex w-full items-start justify-between gap-2 rounded-md px-2 py-2 text-left ${
                            selected ? "bg-elevated" : "hover:bg-elevated/60"
                          }`}
                        >
                          <span>
                            <span className="block text-sm text-fg">{item.name}</span>
                            <span className="block text-xs text-muted">{dim}</span>
                          </span>
                          {item.unitCostUsd != null && item.unitCostUsd > 0 && (
                            <span className="font-mono text-xs text-faint">${item.unitCostUsd.toFixed(2)}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
