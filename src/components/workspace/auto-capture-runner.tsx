"use client";

import { useEffect, useRef } from "react";
import { useYard } from "@/lib/yard/store";
import { autoCaptureSteps, needsAutoCapture } from "@/lib/yard/autoCapture";

/**
 * After a house plan is built, silently walks the first few steps so StepCapture
 * can grab bench photos. No drawer open required — stranger path.
 */
export function AutoCaptureRunner() {
  const projectId = useYard((s) => s.project.id);
  const plan = useYard((s) => s.plan);
  const panels = useYard((s) => s.project.panels.length);
  const setActiveStep = useYard((s) => s.setActiveStep);
  const makePlan = useYard((s) => s.makePlan);
  const busy = useYard((s) => s.building || s.grokBusy);
  const ranFor = useRef<string | null>(null);
  const running = useRef(false);

  useEffect(() => {
    if (busy || !plan || panels === 0) return;
    if (ranFor.current === projectId) return;
    if (running.current) return;
    if (!needsAutoCapture(plan.instructions)) {
      ranFor.current = projectId;
      return;
    }

    running.current = true;
    void (async () => {
      try {
        const n = await autoCaptureSteps(plan.instructions, setActiveStep, {
          max: 4,
          settleMs: 1200,
        });
        if (n > 0) makePlan(); // re-merge photos into fresh plan object
        ranFor.current = projectId;
      } finally {
        running.current = false;
        setActiveStep(null);
      }
    })();
  }, [busy, plan, panels, projectId, setActiveStep, makePlan]);

  return null;
}
