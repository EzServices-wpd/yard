/**
 * A stepped job (a generator doing one round of work per next()) run under a budget, so no solve can hang or
 * freeze the tab, whatever the device or the build (Critic #98 row 105: the 6-drawer dresser and the jewelry box
 * froze the tab when `while (!j.done) j.it.next()` spun on a generator that had thrown).
 *
 * Class rules, for every job:
 * - Capped: a finite step cap, and an optional wall-clock deadline for the whole job. Past either, the job ends
 *   with its work so far (`partial`), else the fallback. It never runs on.
 * - Yields: one call runs at most one slice (`sliceMs` of wall time or `sliceSteps` steps, at least one step), then
 *   returns null so the caller can give the frame back (runJob schedules the next slice).
 * - Cleans up: whichever way it ends (done, capped, thrown or cancelled) the generator is closed with return(), so
 *   its `finally` (GPU buffers, render targets) always runs. A closed job is never stepped again.
 */
export type StepJob<T> = {
  it: Iterator<unknown, T, void>;
  steps: number;
  done: T | null;
  /** The work so far, used when a cap stops the job early. */
  partial?: () => T | undefined;
  /** Set once the generator is closed (finished, thrown, capped or cancelled). */
  closed?: boolean;
};
export type StepBudget = {
  /** Steps for the whole job (must be finite). */
  maxSteps: number;
  /** Wall-clock deadline for the whole job, on the `now` clock. */
  deadlineAt?: number;
  /** One call stops (and yields) once this much time has passed... */
  sliceMs?: number;
  /** ...or after this many steps. */
  sliceSteps?: number;
};
export type StepOpts = { now?: () => number; onError?: (e: unknown) => void };

const clock = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function stepJob<T>(it: Iterator<unknown, T, void>, partial?: () => T | undefined): StepJob<T> {
  return { it, steps: 0, done: null, partial };
}

/** Close the generator (runs its `finally`); safe to call twice. */
export function closeJob(job: StepJob<unknown>): void {
  if (job.closed) return;
  job.closed = true;
  try { job.it.return?.(undefined as never); } catch { /* a throwing finally must not hang the caller */ }
}

/** Run one slice. Returns the result once the job ends (done, capped or failed), else null: call again later. */
export function runSlice<T>(job: StepJob<T>, fallback: () => T, budget: StepBudget, opts: StepOpts = {}): T | null {
  if (job.done) return job.done;
  if (!Number.isFinite(budget.maxSteps)) throw new Error("step budget: maxSteps must be finite");
  const now = opts.now ?? clock;
  const end = (r: T) => { job.done = r; closeJob(job); return r; };
  // Cancelled before it finished: nothing left to step.
  if (job.closed) return end(fallback());
  const t0 = now();
  for (let k = 0; ; k++) {
    if (job.steps >= budget.maxSteps || (budget.deadlineAt !== undefined && now() > budget.deadlineAt)) {
      opts.onError?.(new Error(job.steps >= budget.maxSteps ? "step budget: step cap" : "step budget: time cap"));
      let part: T | undefined;
      // The work so far is read before the generator is closed (its finally may free what it read from).
      try { part = job.partial?.(); } catch (e) { opts.onError?.(e); }
      return end(part ?? fallback());
    }
    if (k > 0 && ((budget.sliceSteps !== undefined && k >= budget.sliceSteps) || (budget.sliceMs !== undefined && now() - t0 >= budget.sliceMs))) return null;
    let r: IteratorResult<unknown, T>;
    try {
      r = job.it.next();
    } catch (e) {
      opts.onError?.(e);
      job.closed = true; // a generator that threw is finished; its finally has run
      return end(fallback());
    }
    job.steps++;
    if (r.done) { job.closed = true; return end((r.value as T | undefined) ?? fallback()); }
  }
}

/**
 * Run a job to its end one slice per task, giving the frame back between slices. `deadlineMs` counts from now.
 * Returns cancel(): it stops the job and closes the generator; onDone is never called after it.
 */
export function runJob<T>(
  job: StepJob<T>,
  fallback: () => T,
  budget: { maxSteps: number; deadlineMs: number; sliceMs: number },
  onDone: (r: T) => void,
  opts: StepOpts & { schedule?: (f: () => void) => () => void } = {},
): () => void {
  const now = opts.now ?? clock;
  const schedule = opts.schedule ?? ((f: () => void) => { const h = setTimeout(f, 0); return () => clearTimeout(h); });
  const b: StepBudget = { maxSteps: budget.maxSteps, deadlineAt: now() + budget.deadlineMs, sliceMs: budget.sliceMs };
  let stop: (() => void) | null = null;
  let live = true;
  const tick = () => {
    stop = null;
    if (!live) return;
    const r = runSlice(job, fallback, b, opts);
    if (r !== null) { live = false; onDone(r); } else stop = schedule(tick);
  };
  tick();
  return () => {
    if (!live) return;
    live = false;
    stop?.();
    closeJob(job);
  };
}
