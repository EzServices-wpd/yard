"use client";

import { useMemo, useState } from "react";
import { CATALOG_CATEGORIES, FORGE_CATALOG, searchCatalog, getCatalogItem } from "@/lib/yard/catalog";
import { JOIN_LABELS } from "@/lib/yard/joints";
import { useYard } from "@/lib/yard/store";
import { inches } from "@/lib/utils";
import type { JoinMethod } from "@/lib/yard/types";

export function CatalogPanel() {
  const [q, setQ] = useState("");
  const project = useYard((s) => s.project);
  const generate = useYard((s) => s.generate);
  const makePlan = useYard((s) => s.makePlan);
  const setJoinMethod = useYard((s) => s.setJoinMethod);
  const commit = useYard((s) => s.commit);
  const items = useMemo(() => {
    const list = q.trim() ? searchCatalog(q, 40) : FORGE_CATALOG;
    return list.filter((i) => !i.tags?.includes("binder") && i.id !== "wire-frame" && !i.tags?.includes("wire"));
  }, [q]);
  const active = getCatalogItem(project.primaryMaterialId);
  const joins = (active?.preferredJoins ?? []) as JoinMethod[];
  const currentJoin = project.joinMethod ?? joins[0];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <h2 className="font-display text-lg text-fg">Stock</h2>
        <p className="mt-1 text-xs text-muted">Pick the real piece. The bench rebuilds at that stock’s density.</p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="popsicle, PVC, dowel…"
          className="mt-3 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg outline-none placeholder:text-faint"
        />
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
        {CATALOG_CATEGORIES.map((cat) => {
          const group = items.filter((i) => i.category === cat.id);
          if (!group.length) return null;
          return (
            <div key={cat.id} className="mb-3">
              <p className="px-2 py-1 text-xs font-medium uppercase tracking-wider text-faint">
                {cat.label}
              </p>
              <ul>
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
                        onClick={() => {
                          if (project.prompt.trim()) {
                            generate(project.prompt, item.id, undefined, {
                              includeSpine: project.supportOffer?.included,
                              joinMethod: project.joinMethod,
                            });
                            makePlan();
                          } else {
                            commit({ ...project, primaryMaterialId: item.id });
                          }
                        }}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
