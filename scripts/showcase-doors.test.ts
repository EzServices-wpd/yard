// Home cards: the doors (pocket vanity) swing shut and stop at shut. The shared close curve bumps 1.5% past shut;
// on a door that swung the leaf ~1° into the case. Clamped at 0 (swingAt), like c0d5ffb's drawer slide (slideAt).
import { test } from "node:test";
import assert from "node:assert/strict";
import { closeCurve, keyframes, openCurve, swingAt, type Leaf } from "../src/components/home/showcase-doors";

/** A leaf that writes its angle as the transform, so keyframes can be read back as angles. */
const leaf = (max: number): Leaf => ({ els: [], at: (deg) => `deg(${deg})`, max });
const deg = (k: { transform: string }) => Number(k.transform.slice(4, -1));
/** Float noise (1e-16°) is not a swing past shut; a billionth of a degree is the line. */
const EPS = 1e-9;

test("the raw close curve does dip past shut (what the clamp is for), the clamped one never does", () => {
  const N = 2000;
  const raw = Array.from({ length: N + 1 }, (_, i) => closeCurve(i / N));
  assert.ok(Math.min(...raw) < -0.01, "close curve bumps past shut");
  for (let i = 0; i <= N; i++) assert.ok(swingAt(closeCurve, i / N) >= 0, `t ${i / N}`);
  assert.ok(Math.abs(swingAt(closeCurve, 1)) < EPS);
  assert.equal(swingAt(closeCurve, 0), 1);
});

test("door and lid: the angle never passes shut anywhere in the close, sampled across the whole tween", () => {
  for (const max of [68, 58]) {
    for (const kind of ["close", "once"] as const) {
      const kf = keyframes(leaf(max), kind);
      // The close part of the tween ("once" closes over its last 40%).
      const close = kind === "close" ? kf : kf.filter((k) => k.offset >= 0.6);
      assert.ok(close.length >= 21);
      for (const k of close) assert.ok(deg(k) >= -EPS, `${kind} ${max}°: keyframe at ${k.offset} is ${deg(k)}°`);
      // Between keyframes the tween runs linear: sample 50 points inside every gap.
      for (let i = 1; i < close.length; i++) {
        const a = deg(close[i - 1]), b = deg(close[i]);
        for (let s = 0; s <= 50; s++) assert.ok(a * (1 - s / 50) + b * (s / 50) >= -EPS, `${kind} ${max}°: between ${close[i - 1].offset} and ${close[i].offset}`);
      }
      assert.ok(Math.abs(deg(close[close.length - 1])) < EPS, `${kind}: ends shut`);
      // Before the clamp the same sampling put a keyframe past shut.
      assert.ok(close.some((_, i) => max * closeCurve(i / 20) < 0), "the unclamped curve would pass shut at a keyframe");
    }
  }
});

test("the open swing is unchanged (its overshoot is away from the case)", () => {
  const kf = keyframes(leaf(68), "open");
  kf.forEach((k, i) => assert.equal(deg(k), 68 * openCurve(i / 20)));
  assert.ok(Math.max(...kf.map(deg)) > 68, "open still overshoots and settles");
});
