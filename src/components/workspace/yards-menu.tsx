"use client";

import { useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { deleteLocalYard, listLocalYards, loadLocalYard, type YardCard } from "@/lib/yard/persist";
import { deleteRemoteYard, listRemoteYards, loadRemoteYard, saveRemoteYard } from "@/lib/yard/yards-api";
import { useYard } from "@/lib/yard/store";

export function YardsMenu() {
  const project = useYard((s) => s.project);
  const setProject = useYard((s) => s.setProject);
  const { user, isPending } = useCurrentUserState();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<YardCard[]>([]);
  const [remote, setRemote] = useState<{ id: string; name: string; prompt: string; kind: string; savedAt: string }[]>([]);

  const refresh = () => setLocal(listLocalYards());

  useEffect(() => {
    refresh();
  }, [project.id, project.prompt]);

  useEffect(() => {
    if (isPending || !user) {
      setRemote([]);
      return;
    }
    void listRemoteYards()
      .then((rows) => setRemote(rows))
      .catch(() => setRemote([]));
  }, [user, isPending, project.id]);

  async function openYard(id: string, from: "local" | "remote") {
    const loaded = from === "remote" ? await loadRemoteYard({ data: id }).catch(() => null) : loadLocalYard(id);
    if (!loaded) return;
    setProject(loaded);
    setOpen(false);
  }

  async function pushCloud() {
    if (!user) return;
    try {
      await saveRemoteYard({ data: project });
      const rows = await listRemoteYards();
      setRemote(rows);
    } catch {
      /* signed out or no db */
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          refresh();
          setOpen((v) => !v);
        }}
        className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-fg/30 hover:text-fg"
        data-yard-yards
      >
        Yards
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-md border border-border bg-surface p-3 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted">On this device</p>
            {user && (
              <button type="button" onClick={() => void pushCloud()} className="text-xs text-muted underline">
                Save to account
              </button>
            )}
          </div>
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
            {local.length === 0 && <li className="text-xs text-faint">Nothing saved yet.</li>}
            {local.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => void openYard(c.id, "local")}
                  className="truncate text-left text-xs text-fg hover:underline"
                >
                  {c.name || c.prompt || "Untitled"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteLocalYard(c.id);
                    refresh();
                  }}
                  className="text-[10px] text-faint hover:text-muted"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {user && remote.length > 0 && (
            <>
              <p className="mt-3 text-xs text-muted">On your account</p>
              <ul className="mt-2 max-h-32 space-y-1 overflow-auto">
                {remote.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => void openYard(c.id, "remote")}
                      className="truncate text-left text-xs text-fg hover:underline"
                    >
                      {c.name || c.prompt}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void deleteRemoteYard({ data: c.id }).then(() =>
                          setRemote((rows) => rows.filter((r) => r.id !== c.id)),
                        );
                      }}
                      className="text-[10px] text-faint hover:text-muted"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
