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
  const sticks = useYard((s) => s.project.instances.length);
  const setActiveStep = useYard((s) => s.setActiveStep);
  const busy = useYard((s) => s.building || s.grokBusy);
  const ranFor = useRef<string | null>(null);
  const running = useRef(false);

  useEffect(() => {
    if (busy || !plan || (panels === 0 && sticks === 0)) return;
    if (ranFor.current === projectId) return;
    if (running.current) return;
    if (!needsAutoCapture(plan.instructions)) {
      ranFor.current = projectId;
      return;
    }

    running.current = true;
    void (async () => {
      try {
        await autoCaptureSteps(plan.instructions, setActiveStep, {
          max: 6,
          settleMs: 1600,
        });
        ranFor.current = projectId;
      } finally {
        running.current = false;
        setActiveStep(null);
      }
    })();
  }, [busy, plan, panels, sticks, projectId, setActiveStep]);

  return null;
}
