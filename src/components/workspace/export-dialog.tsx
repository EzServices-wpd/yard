"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { planToMarkdown } from "@/lib/yard/report";
import { buildPlanPdf, slugPlan } from "@/lib/yard/pdf";
import { IsoPlate } from "@/components/workspace/iso-plate";
import { usd } from "@/lib/utils";
import type { BuildPlan, YardProject } from "@/lib/yard/types";

export function ExportDialog({
  project,
  plan,
  onClose,
}: {
  project: YardProject;
  plan: BuildPlan;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [dlNote, setDlNote] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const render = plan.render ?? project.render;
  const md = planToMarkdown(project, plan);
  const photoCount = plan.instructions.filter(
    (s) => s.imageDataUrl && s.imageDataUrl.startsWith("data:image") && s.imageDataUrl.length > 800,
  ).length;

  // Build a preview blob only — never auto-download.
  useEffect(() => {
    let url: string | null = null;
    try {
      const blob = buildPlanPdf(project, plan).output("blob");
      url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setDlNote(
        photoCount
          ? `Ready · ${photoCount} bench photo${photoCount === 1 ? "" : "s"}. Tap Save PDF when you want the file.`
          : "Ready. Save PDF for the shop copy. Open a step on the bench first if you want photos in the plan.",
      );
    } catch (err) {
      setDlNote(err instanceof Error ? err.message : "Could not build the PDF.");
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [project, plan, photoCount]);

  async function copyMd() {
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setDlNote("Clipboard blocked — select the plan below and copy.");
    }
  }

  function downloadMd() {
    try {
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugPlan(project.name)}-plan.md`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setDlNote("If no file appeared, this preview blocks downloads — use Copy instead.");
    } catch {
      setDlNote("Download blocked here. Use Copy.");
    }
  }

  function savePdf() {
    setPdfBusy(true);
    setDlNote(null);
    try {
      const doc = buildPlanPdf(project, plan);
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugPlan(project.name)}-plan.pdf`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setDlNote(
        photoCount
          ? `Saved · ${photoCount} bench photo${photoCount === 1 ? "" : "s"} in the file.`
          : "Saved. View steps on the bench first next time to capture photos into the plan.",
      );
    } catch (err) {
      setDlNote(err instanceof Error ? err.message : "Could not build the PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  const unit =
    project.fitted?.unit ??
    project.pocket?.unit ??
    project.overall;

  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] flex flex-col bg-paper text-ink">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-rule px-4 py-3 print:hidden">
        <div className="min-w-0">
          <p className="truncate font-display text-lg text-ink">{project.name}</p>
          <p className="text-xs text-ink-muted">
            {unit.width}" × {unit.height}" × {unit.depth}" · the plan on paper
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={savePdf}
            disabled={pdfBusy}
            className="h-10 rounded-md bg-ink px-4 text-sm font-medium text-paper disabled:opacity-50"
          >
            {pdfBusy ? "Building…" : "Save PDF"}
          </button>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="h-10 rounded-md border border-rule px-3 text-sm text-ink-muted hover:text-ink"
          >
            More
          </button>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center text-ink-muted hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
      </header>

      {moreOpen && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-rule bg-paper px-4 py-2 print:hidden">
          <button type="button" onClick={() => void copyMd()} className="h-9 rounded-md border border-rule px-3 text-xs text-ink">
            {copied ? "Copied" : "Copy markdown"}
          </button>
          <button type="button" onClick={downloadMd} className="h-9 rounded-md border border-rule px-3 text-xs text-ink">
            Download .md
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <article className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">Yard plan</p>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-ink">{project.name}</h1>
          <p className="mt-2 font-mono text-sm tracking-tight text-ink">
            {unit.width}" × {unit.height}" × {unit.depth}"
          </p>
          {project.prompt && <p className="mt-3 text-sm leading-relaxed text-ink-muted">{project.prompt}</p>}
          {dlNote && <p className="mt-3 text-xs text-ink-muted">{dlNote}</p>}

          {pdfUrl && (
            <object data={pdfUrl} type="application/pdf" className="mt-6 h-[70vh] w-full border border-rule" title="Plan PDF">
              <p className="p-4 text-sm text-ink-muted">
                PDF built.{" "}
                <a href={pdfUrl} download={`${slugPlan(project.name)}-plan.pdf`} className="underline">
                  Save the file
                </a>
              </p>
            </object>
          )}

          {render?.url && (
            <figure className="mt-6">
              <img src={render.url} alt={`Finished render of ${project.name}`} className="w-full border border-rule" />
              {render.scene && <figcaption className="mt-2 text-xs text-ink-muted">{render.scene}</figcaption>}
            </figure>
          )}

          <section className="mt-8">
            <h2 className="font-display text-xl text-ink">Check</h2>
            <p className="mt-2 text-sm text-ink-muted">{plan.feasibility.summary}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {plan.feasibility.issues.map((issue, i) => (
                <li key={i} className="border-b border-rule/80 pb-2">
                  <p>{issue.message}</p>
                  {issue.suggestion && <p className="mt-0.5 text-ink-muted">{issue.suggestion}</p>}
                </li>
              ))}
            </ul>
          </section>

          {plan.cutList.length > 0 && (
            <section className="mt-8">
              <h2 className="font-display text-xl text-ink">{plan.partsKind === "whole" ? "Stick list" : "Cut list"}</h2>
              <p className="mt-1 text-xs text-ink-muted">
                {plan.partsKind === "whole"
                  ? "Full pieces from the pack. Glue them. Do not cut."
                  : "Same size is the same letter. Mark A on the first cut, then batch."}
              </p>
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="py-1 font-medium"> </th>
                    <th className="py-1 font-medium">Qty</th>
                    <th className="py-1 font-medium">Part</th>
                    <th className="py-1 font-medium">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.cutList.map((c) => (
                    <tr key={c.id} className="border-t border-rule">
                      <td className="py-1.5 font-mono font-semibold">{c.label ?? ""}</td>
                      <td className="py-1.5 font-mono">{c.quantity}</td>
                      <td className="py-1.5">{c.name}</td>
                      <td className="py-1.5 font-mono text-ink-muted">
                        {c.lengthIn}" × {c.widthIn}" × {c.thicknessIn}"
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {plan.bom.length > 0 && (
            <section className="mt-8">
              <h2 className="font-display text-xl text-ink">Buy</h2>
              <p className="mt-1 text-xs text-ink-muted">
                {plan.partsKind === "whole"
                  ? `${plan.totals.pieces} full pieces · glue · do not cut`
                  : `${plan.totals.pieces} pieces`}{" "}
                · {usd(plan.totals.estCostUsd)} estimated
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {plan.bom.map((b, i) => (
                  <li key={i}>
                    {b.quantity} {b.unit} · {b.name}
                    {b.estimatedCost != null ? ` · ${usd(b.estimatedCost)}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-8">
            <h2 className="font-display text-xl text-ink">Build</h2>
            {!photoCount && (
              <p className="mt-2 text-xs text-ink-muted">
                No bench photos yet. In the plan drawer, click a step to view it on the bench — that captures the photo into the plan and PDF.
              </p>
            )}
            <ol className="mt-4 space-y-6">
              {plan.instructions.map((s) => {
                const hasPhoto = Boolean(
                  s.imageDataUrl && s.imageDataUrl.startsWith("data:image") && s.imageDataUrl.length > 800,
                );
                return (
                  <li key={s.step} className="border-t border-rule pt-4">
                    {hasPhoto && s.imageDataUrl ? (
                      <img
                        src={s.imageDataUrl}
                        alt={`Bench view — step ${s.step}`}
                        className="mb-3 w-full border border-rule object-cover"
                      />
                    ) : (
                      <div className="mb-3 flex gap-4">
                        <IsoPlate project={project} step={s} className="hidden h-24 w-28 shrink-0 sm:block" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">
                        <span className="font-mono text-ink-muted">{String(s.step).padStart(2, "0")}</span> {s.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-muted">{s.description}</p>
                      {s.tips && <p className="mt-1 text-xs text-ink-muted">{s.tips}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <p className="mt-12 text-xs text-ink-muted">Yard — guidance only. Not stamped engineering.</p>
        </article>
      </div>
    </div>
  );
}
