"use client";

import { useMemo, useState } from "react";
import { useYard } from "@/lib/yard/store";
import type { BuildPlan } from "@/lib/yard/types";
import { ExportDialog } from "./export-dialog";
import {
  downloadFlatSvg,
  bestFlatPlane,
  flatSvgString,
  type FlatPlane,
  type PaperSize,
} from "@/lib/yard/flat";

export function PlanDrawer({
  plan,
  onClose,
}: {
  plan: BuildPlan;
  onClose: () => void;
}) {
  const project = useYard((s) => s.project);
  const activeStep = useYard((s) => s.activeStep);
  const setActiveStep = useYard((s) => s.setActiveStep);
  const setRender = useYard((s) => s.setRender);
  const liftTo3d = useYard((s) => s.liftTo3d);
  const [exportOpen, setExportOpen] = useState(false);
  const [scene, setScene] = useState(project.render?.scene ?? "");
  const [renderBusy, setRenderBusy] = useState(false);
  const [renderErr, setRenderErr] = useState<string | null>(null);
  const [flatPlane, setFlatPlane] = useState<FlatPlane | "auto">("auto");
  const [flatPaper, setFlatPaper] = useState<PaperSize>("letter");
  const [flatNote, setFlatNote] = useState<string | null>(null);
  const [showFlatPreview, setShowFlatPreview] = useState(false);
  const render = plan.render ?? project.render;

  const flatPreview = useMemo(() => {
    if (!showFlatPreview) return null;
    try {
      const plane = flatPlane === "auto" ? bestFlatPlane(project) : flatPlane;
      const { svg, map, paper } = flatSvgString(project, { plane, paper: flatPaper });
      return { svg, map, paper, plane };
    } catch {
      return null;
    }
  }, [showFlatPreview, flatPlane, flatPaper, project]);

  function printFlatMap() {
    try {
      const plane = flatPlane === "auto" ? bestFlatPlane(project) : flatPlane;
      const { paperLabel } = downloadFlatSvg(project, { plane, paper: flatPaper });
      setFlatNote(`2D map downloaded (${paperLabel}, ${plane} view). Open the SVG and print — scale to fit page, no margins crop.`);
    } catch (err) {
      setFlatNote(err instanceof Error ? err.message : "Could not build the 2D map.");
    }
  }

  async function grokSteps() {
    useYard.setState({ grokBusy: true, grokError: null });
    try {
      const res = await fetch("/api/grok/instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseline: plan.steps.map((s) => ({ title: s.title, body: s.body, role: s.role })),
          kind: project.kind,
          material: project.primaryMaterialId,
          joints: plan.joints?.length ?? project.instances.length,
          envelope: project.overall,
          name: project.name,
          notes: project.notes,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { steps?: { title: string; body: string; role?: string }[] };
      if (data.steps?.length) {
        useYard.getState().setPlan({
          ...plan,
          steps: data.steps.map((s, i) => ({
            id: plan.steps[i]?.id ?? `s${i}`,
            title: s.title,
            body: s.body,
            role: s.role ?? plan.steps[i]?.role,
          })),
        });
      }
    } catch (err) {
      useYard.setState({
        grokError: err instanceof Error ? err.message : "Could not enrich instructions",
      });
    } finally {
      useYard.setState({ grokBusy: false });
    }
  }

  async function makeRender() {
    setRenderBusy(true);
    setRenderErr(null);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          name: project.name,
          scene: scene || undefined,
          kind: project.kind,
          material: project.primaryMaterialId,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { url: string; prompt: string; scene?: string };
      setRender({ url: data.url, prompt: data.prompt, scene: data.scene ?? scene });
    } catch (err) {
      setRenderErr(err instanceof Error ? err.message : "Render failed");
    } finally {
      setRenderBusy(false);
    }
  }

  const steps = plan.steps ?? [];
  const grokBusy = useYard((s) => s.grokBusy);
  const grokError = useYard((s) => s.grokError);

  return (
    <>
      <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-border bg-panel shadow-xl">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="font-display text-xl text-fg">Build plan</h2>
            <p className="text-xs text-muted">{project.name}</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-11 place-items-center text-muted hover:text-fg" aria-label="Close">
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          <section>
            <h3 className="font-display text-lg text-fg">Overview</h3>
            <p className="mt-1 text-sm text-muted">{plan.summary ?? project.notes?.[0]}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-border p-2">
                <dt className="text-faint">Pieces</dt>
                <dd className="text-fg">{plan.stats?.pieceCount ?? project.instances.length}</dd>
              </div>
              <div className="rounded-md border border-border p-2">
                <dt className="text-faint">Joints</dt>
                <dd className="text-fg">{plan.joints?.length ?? "—"}</dd>
              </div>
              <div className="rounded-md border border-border p-2">
                <dt className="text-faint">Stock</dt>
                <dd className="text-fg">{project.primaryMaterialId}</dd>
              </div>
              <div className="rounded-md border border-border p-2">
                <dt className="text-faint">Size</dt>
                <dd className="text-fg">
                  {project.overall.width}" × {project.overall.height}" × {project.overall.depth}"
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-lg text-fg">Steps</h3>
              <button
                type="button"
                onClick={() => void grokSteps()}
                disabled={grokBusy}
                className="h-8 rounded-md border border-border px-2 text-xs text-fg disabled:opacity-50"
              >
                {grokBusy ? "Enriching…" : "Add more instructions"}
              </button>
            </div>
            {grokError && <p className="mt-1 text-xs text-danger">{grokError}</p>}
            <ol className="mt-3 space-y-3">
              {steps.map((step, i) => {
                const active = activeStep === i;
                return (
                  <li key={step.id ?? i}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveStep(active ? null : i);
                      }}
                      className={`w-full rounded-md border p-3 text-left transition ${
                        active ? "border-accent bg-accent/10" : "border-border hover:border-fg/30"
                      }`}
                    >
                      <span className="text-xs text-faint">Step {i + 1}{step.role ? ` · ${step.role}` : ""}</span>
                      <span className="mt-0.5 block font-medium text-fg">{step.title}</span>
                      <span className="mt-1 block text-sm text-muted whitespace-pre-wrap">{step.body}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          <section>
            <h3 className="font-display text-lg text-fg">2D map</h3>
            <p className="mt-1 text-xs text-muted">
              Flat stock layout for print — parents, kids, and the bench. Same pieces as the 3D model, orthographic.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="text-xs text-faint">
                Face
                <select
                  value={flatPlane}
                  onChange={(e) => setFlatPlane(e.target.value as FlatPlane | "auto")}
                  className="ml-1.5 h-8 rounded-md border border-border bg-bg px-2 text-sm text-fg"
                >
                  <option value="auto">Auto</option>
                  <option value="front">Front</option>
                  <option value="top">Top</option>
                  <option value="side">Side</option>
                </select>
              </label>
              <label className="text-xs text-faint">
                Paper
                <select
                  value={flatPaper}
                  onChange={(e) => setFlatPaper(e.target.value as PaperSize)}
                  className="ml-1.5 h-8 rounded-md border border-border bg-bg px-2 text-sm text-fg"
                >
                  <option value="letter">Letter</option>
                  <option value="letter-landscape">Letter landscape</option>
                  <option value="8x10">8×10</option>
                  <option value="a4">A4</option>
                </select>
              </label>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowFlatPreview((v) => !v)}
                className="h-10 rounded-md border border-border text-sm text-fg"
              >
                {showFlatPreview ? "Hide preview" : "Live preview"}
              </button>
              <button
                type="button"
                onClick={printFlatMap}
                className="h-10 rounded-md border border-border text-sm text-fg"
              >
                Download SVG
              </button>
            </div>
            {showFlatPreview && flatPreview && (
              <div className="mt-3 overflow-hidden rounded-md border border-border bg-[#f3eee4]">
                <div className="border-b border-border/60 px-2 py-1 text-[10px] text-muted">
                  {flatPreview.plane} · {flatPreview.map.pieceCount} pieces · {flatPreview.paper.label}
                </div>
                <div
                  className="max-h-72 w-full overflow-auto p-1 [&_svg]:h-auto [&_svg]:w-full"
                  dangerouslySetInnerHTML={{
                    __html: flatPreview.svg
                      .replace(/width="[^"]*"/, 'width="100%"')
                      .replace(/height="[^"]*"/, 'height="auto"'),
                  }}
                />
              </div>
            )}
            {showFlatPreview && !flatPreview && (
              <p className="mt-2 text-xs text-danger">Could not build preview for this layout.</p>
            )}
            {project.flat && !project.flat.lifted && (
              <button
                type="button"
                onClick={() => {
                  const next = liftTo3d();
                  if (next) {
                    setFlatNote(
                      `Lifted to 3D — ${next.instances.length} pieces. Same outline ratios, dual face + cross-ties. Close and reopen Build plan for a fresh plan.`,
                    );
                  }
                }}
                className="mt-2 h-10 w-full rounded-md bg-accent text-sm font-medium text-accent-fg"
              >
                Convert to 3D
              </button>
            )}
            {project.flat?.lifted && (
              <p className="mt-2 text-xs text-muted">Already lifted from 2D paper layout.</p>
            )}
            {flatNote && <p className="mt-2 text-xs text-muted">{flatNote}</p>}
          </section>

          <section>
            <h3 className="font-display text-lg text-fg">Render</h3>
            <p className="mt-1 text-xs text-muted">
              After the design is set, generate a photograph of the finished piece to sit with the instructions.
            </p>
            {render?.url && (
              <img
                src={render.url}
                alt={`Finished render of ${project.name}`}
                className="mt-3 w-full rounded-md border border-border object-cover"
              />
            )}
            <textarea
              value={scene}
              onChange={(e) => setScene(e.target.value)}
              placeholder="Optional scene notes for the photo…"
              className="mt-2 h-20 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg"
            />
            <button
              type="button"
              onClick={() => void makeRender()}
              disabled={renderBusy}
              className="mt-2 h-10 w-full rounded-md border border-border text-sm text-fg disabled:opacity-50"
            >
              {renderBusy ? "Rendering…" : render?.url ? "Re-render photo" : "Generate photo"}
            </button>
            {renderErr && <p className="mt-1 text-xs text-danger">{renderErr}</p>}
          </section>
        </div>

        <footer className="border-t border-border p-4">
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-fg"
          >
            Export PDF / share
          </button>
        </footer>
      </div>

      {exportOpen && <ExportDialog plan={plan} onClose={() => setExportOpen(false)} />}
    </>
  );
}
