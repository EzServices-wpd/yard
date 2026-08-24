/** Silent bench photo pass for house plans — stranger path, no tutorial required. */

export type CaptureStep = { step: number; imageDataUrl?: string };

/**
 * Cycle activeStep so StepCapture can grab JPEGs. Caller must keep the plan drawer closed
 * so the canvas is visible. Settles ~1.2s per step (mobile WebGL).
 */
export async function autoCaptureSteps(
  steps: CaptureStep[],
  setActiveStep: (n: number | null) => void,
  opts?: { max?: number; settleMs?: number },
): Promise<number> {
  const max = opts?.max ?? 4;
  const settleMs = opts?.settleMs ?? 1200;
  const targets = steps
    .filter((s) => !s.imageDataUrl || s.imageDataUrl.length < 1200)
    .slice(0, max);
  if (!targets.length) return 0;

  for (const s of targets) {
    setActiveStep(s.step);
    await new Promise((r) => setTimeout(r, settleMs));
  }
  setActiveStep(null);
  // Final settle so last attachStepImage lands before makePlan re-merge.
  await new Promise((r) => setTimeout(r, 400));
  return targets.length;
}

export function needsAutoCapture(steps: CaptureStep[]): boolean {
  if (!steps.length) return false;
  const withPhoto = steps.filter((s) => s.imageDataUrl && s.imageDataUrl.length > 1200).length;
  return withPhoto < Math.min(3, steps.length);
}
