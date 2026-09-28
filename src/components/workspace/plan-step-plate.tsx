"use client";

import { useMemo } from "react";
import { planOverviewSvg, planStepSvg } from "@/lib/yard/planStepPicture";
import type { AssemblyStep, BuildPlan, YardProject } from "@/lib/yard/types";

/** Vector step / overview picture — same drawing path as the printed plan PDF. */
export function PlanStepPlate({
  project,
  plan,
  step,
  overview,
  className,
}: {
  project: YardProject;
  plan: BuildPlan;
  step?: AssemblyStep;
  overview?: boolean;
  className?: string;
}) {
  const svg = useMemo(() => {
    if (overview || !step) return planOverviewSvg(project).svg;
    const idx = plan.instructions.findIndex((s) => s.step === step.step);
    if (idx < 0) return planOverviewSvg(project).svg;
    return planStepSvg(project, plan, idx).svg;
  }, [project, plan, step?.step, overview]);

  return (
    <span
      className={`block overflow-hidden rounded border border-rule bg-paper [&>svg]:h-full [&>svg]:w-full ${className ?? ""}`}
      data-yard-plan-pic={overview ? "overview" : `step-${step?.step ?? "?"}`}
      // SVG is built from our own geometry — never from user HTML.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
