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
  const render = plan.render ?? project.render;
  const md = planToMarkdown(project, plan);

  useEffect(() => {
    let url: string | null = null;
    try {
      const blob = buildPlanPdf(project, plan).output("blob");
      url = URL.createObjectURL(blob);
      setPdfUrl(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugPlan(project.name)}-plan.pdf`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setDlNote("PDF ready. If no download started, it is on the page below.");
    } catch (err) {
      setDlNote(err instanceof Error ? err.message : "Could not build the PDF.");
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [project, plan]);

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

  function exportPdf() {
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
      setDlNote("PDF is open below. If no download started, use the viewer or right-click → save.");
    } catch (err) {
      setDlNote(err instanceof Error ? err.message : "Could not build the PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] flex flex-col bg-paper text-ink">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-rule px-4 py-3 print:hidden">
        <div className="min-w-0">
          <p className="truncate font-display text-lg text-ink">{project.name}</p>
          <p className="text-xs text-ink-muted">Plan on paper. PDF is the shop copy.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => void copyMd()} className="h-10 rounded-md border border-rule px-3 text-sm text-ink">
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" onClick={downloadMd} className="h-10 rounded-md border border-rule px-3 text-sm text-ink">
            .md
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={pdfBusy}
            className="h-10 rounded-md bg-ink px-3.5 text-sm font-medium text-paper disabled:opacity-50"
          >
            {pdfBusy ? "Building…" : "PDF"}
          </button>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center text-ink-muted hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <article className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
          <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">Yard plan</p>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-ink">{project.name}</h1>
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
            <ol className="mt-4 space-y-6">
              {plan.instructions.map((s) => (
                <li key={s.step} className="flex gap-4 border-t border-rule pt-4">
                  <IsoPlate project={project} step={s} className="hidden h-24 w-28 shrink-0 sm:block" />
                  <div>
                    <p className="font-medium">
                      <span className="font-mono text-ink-muted">{String(s.step).padStart(2, "0")}</span> {s.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-muted">{s.description}</p>
                    {s.tips && <p className="mt-1 text-xs text-ink-muted">{s.tips}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <p className="mt-12 text-xs text-ink-muted">Yard — guidance only. Not stamped engineering.</p>
        </article>
      </div>
    </div>
  );
}
