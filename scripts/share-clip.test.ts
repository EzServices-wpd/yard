// PR 11 (plan L516–525): the share sheet and the 6 s clip. The clip walks the Watch it build scrub (buildOrder's
// own order) for exactly 6 s and ends on the finished build; nothing shared carries a price, a prompt or a store link.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { buildPlan } from "../src/lib/yard/report";
import { scrubBeat, scrubCounter, scrubShown, scrubTrack } from "../src/components/workspace/build-scrub";
import { BUILD_MS, CLIP_FPS, CLIP_INK, CLIP_MS, cardAlpha, clipK, clipSize, clipTurn, clipType, fileRoute, pickClipType, shareFileName, shareText, shareToken } from "../src/components/workspace/share-clip";
import { permalink } from "../src/lib/yard/shareBuild";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (f: string) => fs.readFileSync(path.join(root, f), "utf8");

test("timeline: the clip is 6 s, one eased full turn that ends on the bench's own angle, the end card late", () => {
  assert.equal(CLIP_MS, 6000);
  assert.equal(Math.round(CLIP_MS / 1000 * CLIP_FPS), 180, "180 frames at 30 fps");
  assert.equal(clipTurn(0), 0);
  assert.ok(Math.abs(clipTurn(CLIP_MS) - 2 * Math.PI) < 1e-9, "a full turn: the last frame is the start angle");
  assert.equal(clipTurn(CLIP_MS + 500), clipTurn(CLIP_MS), "never past the end");
  for (let ms = 0; ms < CLIP_MS; ms += 100) assert.ok(clipTurn(ms + 100) >= clipTurn(ms), "the turn only moves one way");
  assert.ok(clipTurn(1000) < Math.PI / 4, "slow out of the start");
  assert.equal(cardAlpha(BUILD_MS), 0, "no end card while steps play");
  assert.equal(cardAlpha(CLIP_MS), 1, "the end card is fully in at the end");
});

for (const prompt of ["linen closet 31.5 wide 78 tall 16 deep", "pocket vanity", "3 ft popsicle stick eiffel tower"]) {
  test(`${prompt}: every frame maps to a scrub position in plan order, and the clip ends on the finished build`, () => {
    const project = generateFromPrompt(prompt);
    const plan = buildPlan(project);
    const track = scrubTrack(project, plan)!;
    const n = track.positions;
    const ks = Array.from({ length: CLIP_MS / 1000 * CLIP_FPS + 1 }, (_, f) => clipK((f * 1000) / CLIP_FPS, n));
    assert.equal(ks[0], 1, "starts on the first step");
    for (let i = 1; i < ks.length; i++) assert.ok(ks[i] >= ks[i - 1], "never steps back");
    assert.deepEqual([...new Set(ks)], Array.from({ length: n }, (_, i) => i + 1), "every position shows, none skipped, in order");
    const steps = [...new Set(ks)].map((k) => scrubBeat(track, k).step);
    for (let i = 1; i < steps.length; i++) assert.ok(steps[i] > steps[i - 1], `plan step numbers rise: ${steps.join(",")}`);
    assert.equal(ks[ks.length - 1], n);
    assert.equal(scrubShown(track, ks[ks.length - 1]), null, "the last frame is the default finished frame");
    assert.equal(scrubCounter(track, n), `Step ${plan.instructions.length} of ${plan.instructions.length}`);
    const held = ks.filter((k) => k === n).length / CLIP_FPS;
    assert.ok(held >= (CLIP_MS - BUILD_MS) / 1000, `the finished build holds ${held.toFixed(2)} s`);
  });
}

test("frame mapping edge cases: one position, negative and late times", () => {
  assert.equal(clipK(0, 1), 1);
  assert.equal(clipK(-50, 5), 1);
  assert.equal(clipK(BUILD_MS - 1, 5), 5);
  assert.equal(clipK(99_999, 5), 5);
});

test("clip size: the bench's aspect, longest side at most 1080, even sides", () => {
  for (const [w, h] of [[2520, 1260], [585, 1035], [1000, 600], [3, 3]]) {
    const s = clipSize(w, h);
    assert.ok(Math.max(s.w, s.h) <= 1080 && s.w % 2 === 0 && s.h % 2 === 0, `${w}x${h} -> ${s.w}x${s.h}`);
    assert.ok(Math.abs(s.w / s.h - w / h) < 0.02 || w < 10, "aspect kept");
  }
});

test("fallback detection: no recorder, no canvas capture, no supported type or reduced motion hides the clip", () => {
  const all = { isTypeSupported: () => true };
  assert.equal(clipType({ recorder: undefined, capture: true, reduced: false }), null);
  assert.equal(clipType({ recorder: all, capture: false, reduced: false }), null);
  assert.equal(clipType({ recorder: all, capture: true, reduced: true }), null, "reduced motion: the still and the link only");
  assert.equal(clipType({ recorder: { isTypeSupported: () => false }, capture: true, reduced: false }), null);
  assert.equal(clipType({ recorder: {}, capture: true, reduced: false }), null);
  assert.equal(pickClipType(() => { throw new Error("no"); }), null, "a throwing probe never errors");
  assert.equal(clipType({ recorder: all, capture: true, reduced: false }), "video/mp4;codecs=avc1", "mp4 first (Safari, phones)");
  assert.equal(pickClipType((t) => t.startsWith("video/webm")), "video/webm;codecs=vp9");
  const f = { name: "x.webm" } as File;
  assert.equal(fileRoute(undefined, f), "download");
  assert.equal(fileRoute({}, f), "download", "no canShare: download");
  assert.equal(fileRoute({ canShare: () => false }, f), "download");
  assert.equal(fileRoute({ canShare: () => { throw new Error("x"); } }, f), "download");
  assert.equal(fileRoute({ canShare: () => true }, f), "share");
});

test("share text and link: the build's name, its permalink, no prompt, price or store link", () => {
  const project = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
  const url = permalink(project)!;
  const t = shareText("Linen", url);
  assert.deepEqual(t, { title: "Linen", text: "Linen: a real model with every part, cut and step. Made on yard.wiki", url });
  assert.ok(url.startsWith("https://yard.wiki/workspace?y="), url);
  assert.equal(shareToken(url), new URL(url).searchParams.get("y"));
  assert.equal(shareToken(null), null);
  assert.deepEqual(shareText("  ", null), { title: "Yard plan", text: "Yard plan: a real model with every part, cut and step. Made on yard.wiki" }, "no url key without a link");
  const all = JSON.stringify(t);
  assert.doesNotMatch(all, /\$|amazon|homedepot|lowes|tag=|linen closet 31\.5/i);
  assert.equal(shareFileName("Linen · 31 1/2\" W", "webm"), "linen-31-1-2-w-yard.webm");
  assert.equal(shareFileName("", "png"), "yard-plan-yard.png");
});

test("guardrails in the sheet and clip source: no price, no store links, no audio, palette B, props and figure off", () => {
  const sheet = read("src/components/workspace/share-sheet.tsx"), clip = read("src/components/workspace/share-clip.ts"), btn = read("src/components/workspace/share-button.tsx");
  for (const src of [sheet, clip, btn]) {
    assert.doesNotMatch(src, /outbound|affiliate|amazonCart|usd\(|buyList|totalCost/, "no price or store links");
    assert.doesNotMatch(src, /project\.prompt/, "never the typed prompt");
  }
  assert.doesNotMatch(clip, /getUserMedia|AudioContext|audio:/, "no audio track");
  assert.deepEqual(CLIP_INK, { bg: "#131518", surface: "#1c1f23", border: "#2c3136", fg: "#eceae6", mark: "#7cb2ff" });
  const css = read("src/styles.css");
  for (const v of Object.values(CLIP_INK)) assert.ok(css.includes(v), `${v} is a palette B token`);
  assert.doesNotMatch(clip, /shadowBlur|shadowColor/, "chalk blue never glows");
  assert.match(clip, /setScrub\(\{ open: true, rec: true, k: 1 \}\)/, "the clip runs through the scrub, so ScaleLayer (figure, props) is hidden");
  assert.match(read("src/components/workspace/canvas.tsx"), /hidden=\{[^}]*scrubbing\}/, "ScaleLayer hides while scrubbing");
  assert.doesNotMatch(btn, /data-bench-overlay/, "the closed button is not a bench card: closed framing is release's");
  assert.match(btn, /lazy\(\(\) => import\("\.\/share-sheet"\)\)/, "the sheet loads on the first tap");
  assert.match(sheet, /data-bench-overlay=\{p\.card \? "share" : undefined\}/);
  assert.match(btn, /card=\{framed && ms == null\}/, "the sheet is a card only once slid in and never while recording");
  assert.match(btn, /clip=\{type && track \?/, "no clip button when the device can't record (clipType null)");
  assert.doesNotMatch(sheet, /from "@\/|from "\.\//, "the lazy sheet imports only react and vaul");
  assert.match(read("src/components/workspace/build-scrubber.tsx"), /if \(!usable \|\| rec\) return null;/, "the bar is hidden while the clip drives the scrub");
});
