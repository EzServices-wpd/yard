"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useYard } from "@/lib/yard/store";
import { writeInstructions, renderProject } from "@/lib/ai/grok";
import { planToMarkdown } from "@/lib/yard/report";
import { downloadFlatSvg, bestFlatPlane, flatSvgString, type FlatPlane, type PaperSize } from "@/lib/yard/flat";
import { usd } from "@/lib/utils";
import { tagNote } from "@/lib/yard/listings";
import { IsoPlate } from "@/components/workspace/iso-plate";
import { ExportDialog } from "@/components/workspace/export-dialog";
import type { BuildPlan } from "@/lib/yard/types";

export function PlanDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const project = useYard((s) => s.project);
  const plan = useYard((s) => s.plan);
  const setPlan = useYard((s) => s.setPlan);
  const grokBusy = useYard((s) => s.grokBusy);
  const grokError = useYard((s) => s.grokError);

  if (!open || !plan) return null;

  return (
    <PlanBody
      projectName={project.name}
      projectPrompt={project.prompt}
      plan={plan}
      setPlan={setPlan}
      grokBusy={grokBusy}
      grokError={grokError}
      onClose={onClose}
    />
  );
}

function PlanBody({
  projectName,
  projectPrompt,
  plan,
  setPlan,
  grokBusy,
  grokError,
  onClose,
}: {
  projectName: string;
  projectPrompt: string;
  plan: BuildPlan;
  setPlan: (plan: BuildPlan | null) => void;
  grokBusy: boolean;
  grokError: string | null;
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
      const itemName = project.primaryMaterialId?.replace(/_/g, " ") ?? undefined;
      const fullBaseline = plan.instructions.map((s) => ({
        step: s.step,
        title: s.title,
        description: s.description,
        tips: s.tips,
        partsUsed: s.partsUsed,
      }));

      async function callWrite(baseline: typeof fullBaseline) {
        return writeInstructions({
          data: {
            prompt: projectPrompt || projectName,
            planText: planToMarkdown(project, plan),
            baseline,
            kind: project.kind,
            materialName: itemName,
            pieceCount: project.instances.length || project.panels.length || undefined,
            joints: project.buildStats?.joints,
            envelope: `${project.overall.width.toFixed(0)}×${project.overall.height.toFixed(0)}×${project.overall.depth.toFixed(0)}"`,
          },
        });
      }

      let res = await callWrite(fullBaseline);

      // One-shot retry on parse fail: shorter baseline (title + first 120 chars) reduces truncation risk.
      if (!res.ok) {
        const shortBaseline = fullBaseline.map((s) => ({
          step: s.step,
          title: s.title,
          description: (s.description || "").slice(0, 120),
          tips: s.tips ? s.tips.slice(0, 80) : undefined,
          partsUsed: s.partsUsed,
        }));
        res = await callWrite(shortBaseline);
      }

      if (!res.ok) {
        useYard.setState({
          grokError:
            res.error ||
            "Could not add more instructions. Check that AI is available, then try again.",
        });
        return;
      }
      // Merge enriched text onto existing steps so photos + partsUsed survive.
      const byStep = new Map(res.steps.map((s) => [s.step, s]));
      const merged = plan.instructions.map((orig) => {
        const enriched = byStep.get(orig.step);
        if (!enriched) return orig;
        return {
          ...orig,
          title: enriched.title || orig.title,
          description: enriched.description || orig.description,
          tips: enriched.tips ?? orig.tips,
          // keep partsUsed + imageDataUrl from the deterministic baseline
        };
      });
      // If Grok added extra intermediate steps, append them (rare; max +2).
      const extra = res.steps.filter((s) => !plan.instructions.some((o) => o.step === s.step));
      setPlan({
        ...plan,
        instructions: [...merged, ...extra],
        grokNotes:
          "Steps enriched for this project — same order and counts, more detail on holds, square checks, and what good looks like. Bench photos kept.",
      });
    } catch {
      useYard.setState({
        grokError: "Could not reach the instruction service. Try again in a moment.",
      });
    } finally {
      useYard.setState({ grokBusy: false });
    }
  }

  async function makeRender() {
    setRenderBusy(true);
    setRenderErr(null);
    try {
      const brief = [
        project.notes.slice(0, 4).join(" "),
        project.pocket
          ? `Trapezoidal pocket vanity, ${project.pocket.unit.width} by ${project.pocket.unit.depth} by ${project.pocket.unit.height} inches, oak plywood, drawers, mirror, upper cabinets.`
          : "",
        project.fitted ? `${project.fitted.program} in ${project.fitted.unit.width} by ${project.fitted.unit.depth} by ${project.fitted.unit.height} inch plywood.` : "",
        project.instances.length
          ? `${project.instances.length} pieces of ${project.primaryMaterialId}, ${project.overall.height.toFixed(0)} inches tall.`
          : "",
      ]
        .filter(Boolean)
        .join(" ");
      const res = await renderProject({
        data: {
          name: project.name,
          prompt: project.prompt,
          brief,
          scene: scene.trim() || undefined,
        },
      });
      if (!res.ok) {
        setRenderErr(res.error);
        return;
      }
      setRender({ url: res.url, prompt: res.prompt, scene: res.scene });
    } catch {
      setRenderErr("Could not render.");
    } finally {
      setRenderBusy(false);
    }
  }

  const tone =
    plan.feasibility.status === "critical"
      ? "text-danger"
      : plan.feasibility.status === "warnings"
        ? "text-warn"
        : "text-ok";

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex justify-end print:static print:bg-paper print:text-ink">
      <div className="pointer-events-auto flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl sm:max-w-xl print:max-w-none print:border-0 print:bg-paper">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 print:hidden">
          <div>
            <p className="font-display text-xl text-fg">Build plan</p>
            <p className={`mt-0.5 text-xs ${tone}`}>{plan.feasibility.summary}</p>
            {plan.effort && (
              <p className="mt-1 text-[11px] text-faint">
                About {plan.effort} · {usd(plan.totals.estCostUsd)} all-in
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="grid size-11 place-items-center text-muted hover:text-fg" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-5 py-6 text-sm">
          {plan.bom.length > 0 && (
            <section>
              <h3 className="font-display text-lg text-fg">Buy</h3>
              <p className="mt-1 text-xs text-muted">
                {plan.partsKind === "whole"
                  ? `${plan.totals.pieces} full pieces · glue · do not cut`
                  : `${plan.totals.pieces} pieces`}{" "}
                · {usd(plan.totals.estCostUsd)} estimated · cheapest listing first, same size only
              </p>
              <p className="mt-1 text-[11px] text-faint">{tagNote()} Prices checked 19 Aug 2026.</p>
              <ul className="mt-3 space-y-3">
                {plan.bom.map((b, i) => (
                  <li key={i} className="border-b border-rule/60 pb-3 last:border-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-fg">
                          {b.quantity} {b.unit} · {b.name}
                        </p>
                        {b.notes && <p className="text-xs text-muted">{b.notes}</p>}
                      </div>
                      {b.estimatedCost != null && <p className="font-mono text-xs text-muted">{usd(b.estimatedCost)}</p>}
                    </div>
                    {b.offers && b.offers.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {b.offers.map((o) => (
                          <li key={o.href} className="flex items-baseline justify-between gap-2">
                            <a
                              href={o.href}
                              target="_blank"
                              rel="noreferrer sponsored"
                              className={`text-xs underline-offset-2 hover:underline ${o.best ? "text-fg" : "text-muted hover:text-fg"}`}
                              data-yard-shop={o.retailer}
                              data-yard-affiliate={o.retailer === "amazon" ? "1" : "0"}
                              data-yard-best={o.best ? "1" : "0"}
                            >
                              {o.best ? "Best · " : ""}
                              {o.label} · {o.title}
                            </a>
                            <span className="shrink-0 font-mono text-[11px] text-muted">
                              {o.packsNeeded} × {usd(o.packPrice)} · {usd(o.unitPrice)}/ea
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.cutList.length > 0 && (
            <section>
              <h3 className="font-display text-lg text-fg">{plan.partsKind === "whole" ? "Stick list" : "Cut list"}</h3>
              <p className="mt-1 text-xs text-muted">
                {plan.partsKind === "whole"
                  ? "Full pieces from the pack. Glue them. Do not cut."
                  : "Same size is the same letter. Mark A on the first cut, then batch."}
              </p>
              <table className="mt-3 w-full text-left text-xs">
                <thead className="text-faint">
                  <tr>
                    <th className="py-1 font-medium"> </th>
                    <th className="py-1 font-medium">Qty</th>
                    <th className="py-1 font-medium">Part</th>
                    <th className="py-1 font-medium">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.cutList.map((c) => (
                    <tr key={c.id} className="border-t border-border/70">
                      <td className="py-1.5 font-mono font-semibold text-fg">{c.label ?? ""}</td>
                      <td className="py-1.5 font-mono">{c.quantity}</td>
                      <td className="py-1.5">{c.name}</td>
                      <td className="py-1.5 font-mono text-muted">
                        {c.lengthIn}" × {c.widthIn}" × {c.thicknessIn}"
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section>
            <h3 className="font-display text-lg text-fg">Check</h3>
            <p className={`mt-1 text-xs ${tone}`}>{plan.feasibility.summary}</p>
            {plan.feasibility.issues.length > 0 && (
              <ul className="mt-3 space-y-2">
                {plan.feasibility.issues.slice(0, 4).map((issue, i) => (
                  <li key={i} className="border-b border-border/60 pb-2">
                    <p className="text-fg">{issue.message}</p>
                    {issue.suggestion && <p className="mt-0.5 text-muted">{issue.suggestion}</p>}
                  </li>
                ))}
              </ul>
            )}
            {plan.feasibility.issues.length > 4 && (
              <p className="mt-2 text-xs text-faint">{plan.feasibility.issues.length - 4} more on the printed plan.</p>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-lg text-fg">Build</h3>
              <button
                type="button"
                onClick={() => void grokSteps()}
                disabled={grokBusy}
                className="text-xs text-muted hover:text-fg disabled:opacity-50 print:hidden"
              >
                {grokBusy ? "Adding detail…" : "Add more instructions"}
              </button>
            </div>
            {grokError && <p className="mt-2 text-xs text-danger">{grokError}</p>}
            {plan.grokNotes && <p className="mt-2 text-xs text-muted">{plan.grokNotes}</p>}
            <p className="mt-2 text-[11px] text-faint print:hidden">
              View a step on the bench to capture its photo into the plan and PDF. Auto-capture runs for the first 4 steps after Build plan.
            </p>
            <div className="mt-2 rounded-md border border-border/70 bg-elevated/40 px-3 py-2 text-[11px] leading-relaxed text-muted">
              <p className="font-medium text-fg">Shop words (also printed in the PDF)</p>
              <p className="mt-1">
                <span className="text-fg">Carcase</span> = main box · <span className="text-fg">Toekick</span> = recessed floor strip ·{" "}
                <span className="text-fg">Dry-fit</span> = assemble without glue · <span className="text-fg">Overlay</span> = door sits on the face ·{" "}
                <span className="text-fg">Lag</span> = long screw into a stud · <span className="text-fg">Edge banding</span> = veneer over raw ply edge ·{" "}
                <span className="text-fg">Shim</span> = thin wedge to fill a gap · <span className="text-fg">Scribe</span> = mark/cut to match a wall ·{" "}
                <span className="text-fg">Rack</span> = twist out of square · <span className="text-fg">Plumb</span> = truly vertical ·{" "}
                <span className="text-fg">Predrill</span> = pilot hole before the screw · <span className="text-fg">Kerf</span> = width the saw blade removes
              </p>
            </div>
            <ol className="mt-3 space-y-3">
              {plan.instructions.map((s) => {
                const on = activeStep === s.step;
                const hasPhoto = Boolean(s.imageDataUrl && s.imageDataUrl.startsWith("data:image"));
                return (
                  <li key={s.step}>
                    <button
                      type="button"
                      onClick={() => {
                        if (on) {
                          setActiveStep(null);
                          return;
                        }
                        setActiveStep(s.step);
                        onClose();
                      }}
                      className={`flex w-full flex-col gap-2 rounded-md border p-3 text-left transition ${
                        on ? "border-fg/40 bg-elevated" : "border-transparent hover:border-border"
                      }`}
                    >
                      {hasPhoto ? (
                        <img
                          src={s.imageDataUrl}
                          alt={`Bench view — step ${s.step}`}
                          className="h-40 w-full rounded border border-rule object-cover sm:h-48"
                        />
                      ) : (
                        <div className="flex gap-3">
                          <IsoPlate project={project} step={s} className="h-32 w-32 shrink-0 border border-rule sm:h-36 sm:w-40" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium text-fg">
                              <span className="font-mono text-faint">{String(s.step).padStart(2, "0")}</span> {s.title}
                            </span>
                            <span className="mt-1 block text-muted">{s.description}</span>
                            {s.tips && <span className="mt-1 block text-xs text-faint">{s.tips}</span>}
                            <span className="mt-2 block text-xs text-faint print:hidden">
                              {on ? "On the bench now — click again to leave" : "View this step on the bench (captures photo)"}
                            </span>
                          </span>
                        </div>
                      )}
                      {hasPhoto && (
                        <span className="min-w-0">
                          <span className="block font-medium text-fg">
                            <span className="font-mono text-faint">{String(s.step).padStart(2, "0")}</span> {s.title}
                          </span>
                          <span className="mt-1 block text-muted">{s.description}</span>
                          {s.tips && <span className="mt-1 block text-xs text-faint">{s.tips}</span>}
                          <span className="mt-2 block text-xs text-faint print:hidden">
                            {on ? "On the bench now — click again to leave" : "View this step on the bench"}
                          </span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          <section>
            <h3 className="font-display text-lg text-fg">2D map</h3>
            <p className="mt-1 text-xs text-muted">
              {project.flat && !project.flat.lifted
                ? "Printable gluing diagram — whole sticks on the lines, glue ends, do not cut."
                : "Flat stock layout for print — same pieces as the 3D model, orthographic."}
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
              <div className="mt-2 overflow-hidden rounded-md border border-border bg-bg">
                <p className="border-b border-border px-2 py-1 text-[11px] text-faint">
                  {flatPreview.plane} · {flatPreview.map.pieceCount}{" "}
                  {project.flat && !project.flat.lifted
                    ? "whole sticks · glue ends"
                    : "pieces"}{" "}
                  · {flatPreview.paper.label}
                </p>
                <div
                  className="max-h-72 overflow-auto p-2 [&_svg]:h-auto [&_svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: flatPreview.svg }}
                />
              </div>
            )}
            {showFlatPreview && !flatPreview && (
              <p className="mt-2 text-xs text-danger">Could not draw a 2D preview for this project.</p>
            )}
            {project.flat && !project.flat.lifted && (
              <button
                type="button"
                onClick={() => {
                  const next = liftTo3d();
                  if (next) {
                    setFlatNote(
                      `Lifted to 3D — ${next.instances.length} whole sticks · glue ends · do not cut. Same outline ratios, dual face + cross-ties. Close and reopen Build plan for a fresh plan.`,
                    );
                  }
                }}
                className="mt-2 h-10 w-full rounded-md bg-accent text-sm font-medium text-accent-fg"
              >
                Convert to 3D
              </button>
            )}
            {project.flat?.lifted && (
              <p className="mt-2 text-xs text-muted">Already lifted from 2D paper layout — still whole sticks, no cuts.</p>
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
            <label className="mt-3 block">
              <span className="text-xs text-faint">Scene (optional)</span>
              <input
                value={scene}
                onChange={(e) => setScene(e.target.value)}
                placeholder="white subway-tile bathroom, morning light"
                className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg outline-none ring-fg/15 placeholder:text-faint focus:ring-2"
              />
            </label>
            <button
              type="button"
              onClick={() => void makeRender()}
              disabled={renderBusy}
              className="mt-2 h-10 w-full rounded-md border border-border text-sm text-fg disabled:opacity-50"
            >
              {renderBusy ? "Rendering…" : render?.url ? "Render again" : "Render the finished piece"}
            </button>
            {renderErr && <p className="mt-2 text-xs text-danger">{renderErr}</p>}
          </section>
        </div>

        <div className="flex gap-2 border-t border-border p-4 print:hidden">
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="h-10 flex-1 rounded-md bg-accent text-sm font-medium text-accent-fg"
          >
            Export PDF…
          </button>
        </div>
      </div>
      {exportOpen && <ExportDialog project={project} plan={plan} onClose={() => setExportOpen(false)} />}
    </div>
  );
}
