"use client";

import { useMemo, useState } from "react";
import { CATALOG_CATEGORIES, FORGE_CATALOG, searchCatalog } from "@/lib/yard/catalog";
import { useYard } from "@/lib/yard/store";
import { inches } from "@/lib/utils";

export function CatalogPanel() {
  const [q, setQ] = useState("");
  const project = useYard((s) => s.project);
  const commit = useYard((s) => s.commit);
  const items = useMemo(() => (q.trim() ? searchCatalog(q, 40) : FORGE_CATALOG), [q]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <h2 className="font-display text-lg text-fg">Stock</h2>
        <p className="mt-1 text-xs text-muted">Real retail sizes. Select, then click the floor to place.</p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="popsicle, PVC, dowel…"
          className="mt-3 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg outline-none placeholder:text-faint"
        />
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
                  const active = project.primaryMaterialId === item.id;
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
                        onClick={() =>
                          commit({
                            ...project,
                            primaryMaterialId: item.id,
                          })
                        }
                        className={`flex w-full items-start justify-between gap-2 rounded-md px-2 py-2 text-left ${
                          active ? "bg-elevated" : "hover:bg-elevated/60"
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
