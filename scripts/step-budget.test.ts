/**
 * Every stepped job (the See inside solve first) runs under src/components/workspace/step-budget.ts: capped, yields
 * between slices, and always closes its generator. Critic #98 row 105: a thrown generator plus
 * `while (!j.done) j.it.next()` froze the tab on the 6-drawer dresser and the jewelry box; the capped path also
 * never closed the generator, so its finally (ID-pass buffers) never ran.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { closeJob, runJob, runSlice, stepJob, type StepJob } from "../src/components/workspace/step-budget";

/** A generator that records whether its finally ran; each step costs `cost` ms on a fake clock. */
function rig(opts: { steps?: number; cost?: number; throwAt?: number } = {}) {
  const s = { t: 0, freed: 0, stepped: 0, partial: "partial" as string | undefined };
  function* gen(): Generator<number, string, void> {
    try {
      for (let i = 0; opts.steps === undefined || i < opts.steps; i++) {
        s.t += opts.cost ?? 0;
        s.stepped++;
        if (i === opts.throwAt) throw new TypeError("Cannot read properties of undefined (reading 'part')");
        yield i;
      }
      return "solved";
    } finally { s.freed++; }
  }
  const job = stepJob(gen(), () => s.partial);
  return { s, job, now: () => s.t };
}

test("a step cap ends the job with the work so far and closes the generator (its finally runs)", () => {
  const { s, job, now } = rig();
  const errs: unknown[] = [];
  assert.equal(runSlice(job, () => "plain", { maxSteps: 5 }, { now, onError: (e) => errs.push(e) }), "partial");
  assert.equal(s.stepped, 5);
  assert.equal(s.freed, 1, "capped job left its generator suspended (finally never ran: GPU buffers leak)");
  assert.equal(errs.length, 1);
});

test("a deadline ends a slow job the same way; no partial (or a throwing one) means the fallback", () => {
  const a = rig({ cost: 100 });
  assert.equal(runSlice(a.job, () => "plain", { maxSteps: 1000, deadlineAt: 350 }, { now: a.now }), "partial");
  assert.ok(a.s.stepped <= 5 && a.s.freed === 1);
  const b = rig({ cost: 100 }); b.s.partial = undefined;
  assert.equal(runSlice(b.job, () => "plain", { maxSteps: 1000, deadlineAt: 350 }, { now: b.now }), "plain");
  const c = rig(); c.job.partial = () => { throw new Error("cluster failed"); };
  assert.equal(runSlice(c.job, () => "plain", { maxSteps: 3 }, { now: c.now }), "plain");
  assert.equal(c.s.freed, 1);
});

test("a step that throws ends with the fallback, reports it once and is never stepped again", () => {
  const { s, job, now } = rig({ throwAt: 1 });
  const errs: unknown[] = [];
  assert.equal(runSlice(job, () => "plain", { maxSteps: 50 }, { now, onError: (e) => errs.push(e) }), "plain");
  assert.equal(errs.length, 1);
  assert.equal(s.freed, 1);
  const n = s.stepped;
  assert.equal(runSlice(job, () => "again", { maxSteps: 50 }, { now }), "plain");
  assert.equal(s.stepped, n);
});

test("one call runs one slice and yields (null); no call runs past its slice by more than one step", () => {
  const { s, job, now } = rig({ steps: 30, cost: 40 });
  let calls = 0, r: string | null = null, worst = 0;
  while (r === null && calls < 100) {
    const t0 = s.t;
    r = runSlice(job, () => "plain", { maxSteps: 100, sliceMs: 50 }, { now });
    worst = Math.max(worst, s.t - t0);
    calls++;
  }
  assert.equal(r, "solved");
  assert.ok(calls >= 15, `${calls} calls: the job did not yield`);
  assert.ok(worst <= 50 + 40, `a call ran ${worst} ms`);
  assert.equal(s.freed, 1);
  const k = rig({ steps: 10 });
  assert.equal(runSlice(k.job, () => "plain", { maxSteps: 100, sliceSteps: 3 }, { now: k.now }), null);
  assert.equal(k.s.stepped, 3);
});

test("every job is capped: an infinite step cap is refused", () => {
  const { job, now } = rig({ steps: 1000 });
  assert.throws(() => runSlice(job, () => "plain", { maxSteps: Infinity }, { now }), /finite/);
});

test("runJob finishes slice by slice; cancel closes the generator and onDone never fires after it", () => {
  const q: (() => void)[] = [];
  const schedule = (f: () => void) => { q.push(f); return () => { const i = q.indexOf(f); if (i >= 0) q.splice(i, 1); }; };
  const a = rig({ steps: 12, cost: 30 });
  const got: string[] = [];
  runJob(a.job, () => "plain", { maxSteps: 50, deadlineMs: 10_000, sliceMs: 50 }, (r) => got.push(r), { now: a.now, schedule });
  let ticks = 0;
  while (q.length && ticks < 100) { q.shift()!(); ticks++; }
  assert.deepEqual(got, ["solved"]);
  assert.ok(ticks >= 5, "runJob did not give the frame back between slices");
  const b = rig({ cost: 30 });
  const late: string[] = [];
  const cancel = runJob(b.job, () => "plain", { maxSteps: 50, deadlineMs: 10_000, sliceMs: 50 }, (r) => late.push(r), { now: b.now, schedule });
  cancel();
  while (q.length) q.shift()!();
  assert.deepEqual(late, []);
  assert.equal(b.s.freed, 1, "a cancelled job left its generator suspended");
  closeJob(b.job as StepJob<unknown>);
  assert.equal(b.s.freed, 1, "closeJob twice ran finally twice");
});

test("nothing in the app drives a generator by hand: every stepped job goes through step-budget", () => {
  const root = path.join(path.dirname(new URL(import.meta.url).pathname), "../src");
  const bad: string[] = [];
  const walk = (d: string) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(f.name) && !/\.test\.ts$/.test(f.name) && !p.endsWith("step-budget.ts")) {
        const src = fs.readFileSync(p, "utf8");
        if (/while\s*\(\s*!\s*[\w.]+\.done\s*\)/.test(src) || /\.it\.next\(\)/.test(src)) bad.push(path.relative(root, p));
      }
    }
  };
  walk(root);
  assert.deepEqual(bad, []);
});
