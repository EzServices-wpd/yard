/** Bench photo pass — retired. Plan drawer and print preview use the shared vector step pictures (same as the PDF). */

export type CaptureStep = { step: number; imageDataUrl?: string };

/** No-op: step pictures come from planStepPicture, not canvas JPEGs. */
export async function autoCaptureSteps(
  _steps: CaptureStep[],
  _setActiveStep: (n: number | null) => void,
  _opts?: { max?: number; settleMs?: number },
): Promise<number> {
  return 0;
}

export function needsAutoCapture(_steps: CaptureStep[]): boolean {
  return false;
}
