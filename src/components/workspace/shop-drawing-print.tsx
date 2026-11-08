"use client";

import { useMemo } from "react";
import { headerTitle } from "@/lib/yard/pdf";
import { planOverviewSvg } from "@/lib/yard/planStepPicture";
import { shopDrawable } from "./shop-drawing";
import type { YardProject } from "@/lib/yard/types";

/** Mounted only while the mode is on and the bench holds a sheet build; otherwise nothing at all. */
export function ShopDrawingSheet({ on, project }: { on: boolean; project: YardProject }) {
  return on && shopDrawable(project) ? <ShopDrawingPrint project={project} /> : null;
}

/**
 * The Shop drawing's print sheet: hidden on screen, the only thing the browser prints while the mode is on. The
 * plan's vector overview (the PDF hero path: model parts only, so no prop or scale figure; dims on sheet builds),
 * re-inked black on white: every part face fills white and strokes black, so hidden lines stay hidden.
 * Always the 3/4 view, like the PDF, not the orbited stage angle.
 */
export function ShopDrawingPrint({ project }: { project: YardProject }) {
  const svg = useMemo(() => planOverviewSvg(project, 960, 640).svg, [project]);
  return (
    <div
      data-yard-shop-print
      aria-hidden="true"
      className="hidden bg-white p-6 text-black print:block [&_line]:stroke-black [&_path]:fill-white [&_path]:stroke-black [&_path]:[stroke-width:1] [&_rect]:fill-white [&_svg]:h-auto [&_svg]:w-full [&_text]:fill-black"
    >
      <p className="mb-4 font-display text-xl">{headerTitle(project)}</p>
      {/* SVG is built from our own geometry, never from user HTML. */}
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
