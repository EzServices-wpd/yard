// #196 follow-up (Critic 2's advisories): a recorder that can't start says so, every capture track stops, "Copied"
// only after a real copy, focus goes back to Share, and the clip is framed centred (the bench fit is untouched).
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { buildPlan } from "../src/lib/yard/report";
import { scrubState, scrubTrack } from "../src/components/workspace/build-scrub";
import { CLIP_FAILED, COPY_FAILED, ClipFailed, clipCentre, copyText, recordClip, refocusShare, shareState } from "../src/components/workspace/share-clip";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (f: string) => fs.readFileSync(path.join(root, "src/components/workspace", f), "utf8");
const project = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
const track = scrubTrack(project, buildPlan(project))!;

/** A canvas, a 2D context that draws nothing, and a capture stream whose tracks remember being stopped. */
function fakeDom() {
  const tracks = [{ stopped: false, stop() { this.stopped = true; }, requestFrame() {} }, { stopped: false, stop() { this.stopped = true; } }];
  const canvas: Record<string, unknown> = { width: 0, height: 0, captureStream: () => ({ getVideoTracks: () => [tracks[0]], getTracks: () => tracks }) };
  canvas.getContext = () => new Proxy({}, { get: (_, k) => (k === "canvas" ? canvas : k === "measureText" ? () => ({ width: 10 }) : () => {}), set: () => true });
  const g = globalThis as Record<string, unknown>;
  g.document = { createElement: () => canvas, hidden: false };
  g.requestAnimationFrame = (cb: (t: number) => void) => setImmediate(() => cb(0));
  let now = 0;
  mock.method(performance, "now", () => (now += 50));
  return { tracks, gl: { width: 780, height: 1368 } as unknown as HTMLCanvasElement };
}
class OkRecorder {
  ondataavailable?: (e: { data: Blob }) => void; onstop?: () => void;
  start() {}
  stop() { setImmediate(() => { this.ondataavailable?.({ data: new Blob(["x"]) }); this.onstop?.(); }); }
}
const Rec = (c: unknown) => c as typeof MediaRecorder;
const settled = () => { assert.equal(scrubState().open, false, "the scrub is closed"); assert.equal(shareState().turn, null, "the turn is cleared"); };

test("a recorder that can't be made: ClipFailed, every capture track stopped, nothing left open", async () => {
  const { tracks, gl } = fakeDom();
  const Throws = class { constructor() { throw new Error("NotSupportedError"); } };
  await assert.rejects(recordClip(gl, track, "Linen", "video/webm", { Recorder: Rec(Throws) }), ClipFailed);
  assert.ok(tracks.every((t) => t.stopped), "tracks stopped");
  settled();
});
test("a recorder that won't start: ClipFailed, every capture track stopped, nothing left open", async () => {
  const { tracks, gl } = fakeDom();
  const NoStart = class extends OkRecorder { start() { throw new Error("InvalidStateError"); } };
  await assert.rejects(recordClip(gl, track, "Linen", "video/webm", { Recorder: Rec(NoStart) }), ClipFailed);
  assert.ok(tracks.every((t) => t.stopped));
  settled();
});
test("a finished clip and a cancelled one both stop every capture track", async () => {
  let { tracks, gl } = fakeDom();
  const blob = await recordClip(gl, track, "Linen", "video/webm;codecs=vp9", { Recorder: Rec(OkRecorder) });
  assert.equal(blob?.type, "video/webm");
  assert.ok(tracks.every((t) => t.stopped), "success: tracks stopped");
  settled();
  ({ tracks, gl } = fakeDom());
  assert.equal(await recordClip(gl, track, "Linen", "video/webm", { Recorder: Rec(OkRecorder), cancelled: () => true }), null);
  assert.ok(tracks.every((t) => t.stopped), "cancelled: tracks stopped");
  settled();
});
test("the sheet drops the clip button and says why when recording fails, with no console error", () => {
  const btn = read("share-button.tsx");
  assert.match(btn, /catch \{[^}]*setFailed\(true\);/, "the failure is caught (no unhandled rejection)");
  assert.match(btn, /clip=\{type && track \? \(failed \? null : /);
  assert.match(btn, /clipNote=\{failed \? CLIP_FAILED : null\}/);
  assert.equal(CLIP_FAILED, "Couldn't record a clip on this device. Share the image instead.");
});

test("Copied only once the clipboard has the link; a refusal shows the link to copy by hand", async () => {
  const got: string[] = [];
  assert.equal(await copyText({ writeText: async (t) => void got.push(t) }, "https://yard.wiki/workspace?y=a"), true);
  assert.deepEqual(got, ["https://yard.wiki/workspace?y=a"]);
  assert.equal(await copyText({ writeText: () => Promise.reject(new Error("NotAllowedError")) }, "u"), false);
  assert.equal(await copyText({ writeText: () => { throw new Error("sync"); } }, "u"), false);
  assert.equal(await copyText(undefined, "u"), false, "no clipboard (http, old browser)");
  assert.equal(await copyText({}, "u"), false);
  const sheet = read("share-sheet.tsx");
  assert.match(sheet, /const ok = await p\.onCopy\(\); setCopy\(ok \? "copied" : "failed"\)/);
  assert.doesNotMatch(sheet, /setCopy\("copied"\)|setCopied\(true\)|navigator\.clipboard/, "never Copied without the result");
  assert.match(sheet, /copy === "failed" && p\.url[\s\S]*select-all[^>]*>\{p\.url\}/, "the link is shown to select");
  assert.equal(COPY_FAILED, "Couldn't copy. Select the link below to copy it.");
});

test("closing the sheet puts focus back on Share, unless focus has moved elsewhere", () => {
  const body = {};
  const inSheet = { closest: (s: string) => (s === "[data-yard-share=open]" ? {} : null) };
  assert.equal(refocusShare(null, body), true);
  assert.equal(refocusShare(body as never, body), true, "focus fell to the page");
  assert.equal(refocusShare(inSheet, body), true, "Escape or a tap inside the sheet");
  assert.equal(refocusShare({ closest: () => null }, body), false, "a field the person tapped keeps focus");
  assert.match(read("share-sheet.tsx"), /onCloseAutoFocus=\{\(e\) => \{ e\.preventDefault\(\); p\.onClosed\(\); \}\}/);
  assert.match(read("share-button.tsx"), /onClosed=\{\(\) => \{ if \(refocusShare\(document\.activeElement, document\.body\)\) button\.current\?\.focus\(/);
  assert.match(read("share-button.tsx"), /ref=\{button\}\s+data-yard-share="closed"/);
});

test("the clip is framed centred: the card shift is set aside while the turn runs and put back after", () => {
  const cam = new THREE.PerspectiveCamera(40, 390 / 684, 0.1, 1000);
  const target = new THREE.Vector3(0, 6, 0);
  cam.position.set(30, 20, 40); cam.lookAt(target);
  cam.setViewOffset(390, 684, 0, 140, 390, 684); // the bench's shift: the model sits high, clear of the cards
  const ndc = () => { cam.updateMatrixWorld(true); return target.clone().project(cam); };
  assert.ok(ndc().y > 0.3, `the live bench frame is off-centre (${ndc().y.toFixed(2)})`);
  let saved = clipCentre(cam, true, null);
  assert.ok(Math.abs(ndc().x) < 1e-6 && Math.abs(ndc().y) < 1e-6, "while recording, the model is centred");
  saved = clipCentre(cam, true, saved);
  assert.equal(saved?.offsetY, 140, "later frames keep the bench's own shift");
  saved = clipCentre(cam, false, saved);
  assert.equal(saved, null);
  assert.ok(cam.view?.enabled && cam.view.offsetY === 140 && ndc().y > 0.3, "after: the bench's exact shift again");
  assert.equal(clipCentre(cam, false, null), null, "idle: nothing changes");
  assert.equal(cam.view?.offsetY, 140);
  const s2 = clipCentre(cam, true, null);
  cam.setViewOffset(390, 684, 0, 90, 390, 684); // a refit during the turn sets its own shift
  clipCentre(cam, false, s2);
  assert.equal(cam.view?.offsetY, 90, "a refit's shift is kept, never overwritten");
  assert.match(fs.readFileSync(path.join(root, "src/components/workspace/canvas.tsx"), "utf8"), /function ClipTurn\(\)[\s\S]*?clipCentre\(camera as THREE\.PerspectiveCamera, turn != null, shift\.current\)/, "ClipTurn (the clip only) centres");
});
