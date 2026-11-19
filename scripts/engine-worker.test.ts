import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { answer } from "../src/lib/yard/engine.worker";
import { callKey, dropHeld, holdAnswer, takeBuild, takeIgnored, takePlan } from "../src/lib/yard/engineCache";
import { generateFromPrompt, ignoredTypedWords } from "../src/lib/yard/promptMain";
import { buildPlan } from "../src/lib/yard/report";
import { useYard } from "../src/lib/yard/store";
import { emptyProject } from "../src/lib/yard/prompt";

const CANARIES = (JSON.parse(readFileSync("evals/corpus/canaries.json", "utf8")).canaries as { prompt: string; dream?: string }[]).filter((c) => !c.dream).map((c) => c.prompt);
const SAMPLE = [...CANARIES, "bookcase 36 wide", "outdoor deck storage box 6 foot", "queen platform bed 60 by 80", "kids play kitchen", "spice rack wall mounted", "wine rack holds 12 bottles", "pergola 12x16", "closet system 80x120"];
const withoutId = (p: any) => ({ ...p, id: "" });
const plain = (plan: any) => ({ ...plan, generatedAt: "" }); // the plan's timestamp is the only part that differs call to call

test("the worker's answer, after structured clone, is the engine's own build, plan and ignored words", () => {
  for (const q of SAMPLE) {
    const args = [q, undefined, undefined, { fresh: true, scale: "full" }] as unknown as Parameters<typeof generateFromPrompt>;
    const a = structuredClone(answer({ id: 1, key: callKey(args), args, ignoredFor: q }));
    assert.equal(a.error, undefined, q);
    const p = generateFromPrompt(...args);
    assert.ok(isDeepStrictEqual(withoutId(a.project), withoutId(p)), `${q}: build`);
    assert.ok(isDeepStrictEqual(plain(a.plan), plain(buildPlan(a.project!))), `${q}: plan`);
    assert.deepEqual(a.ignored, ignoredTypedWords(a.project!, q), `${q}: ignored words`);
  }
});

test("the store takes a held answer only for the exact call and the exact project; anything else builds here", () => {
  const args = ["bookcase 36 wide", undefined, undefined, { fresh: true, scale: "full" }] as unknown as Parameters<typeof generateFromPrompt>;
  const a = structuredClone(answer({ id: 2, key: callKey(args), args, ignoredFor: "bookcase 36 wide" }));
  holdAnswer(a, "bookcase 36 wide");
  assert.equal(takeBuild(args), a.project);
  assert.equal(takeBuild(["bookcase 30 wide", undefined, undefined, { fresh: true, scale: "full" }] as unknown as typeof args), null);
  assert.equal(takeBuild([args[0], undefined, undefined, { fresh: true, scale: "half" }] as unknown as typeof args), null);
  assert.equal(takePlan(a.project!), a.plan);
  assert.equal(takePlan(structuredClone(a.project!)), a.plan, "an equal copy of the project is the same build");
  assert.equal(takePlan({ ...a.project!, typedPrompt: "bookshelf 36 wide" }), null, "a changed project builds its own plan");
  assert.deepEqual(takeIgnored(a.project!, "bookcase 36 wide"), a.ignored);
  assert.equal(takeIgnored(a.project!, "other words"), null);
  dropHeld();
  assert.equal(takeBuild(args), null);
});

test("the bench is the same build whether the worker answered or not", () => {
  const clearBench = () => useYard.setState({ project: emptyProject(), plan: null } as never);
  for (const q of SAMPLE) {
    dropHeld();
    clearBench();
    const here = withoutId(useYard.getState().generate(q, undefined, undefined, { fresh: true }));
    const herePlan = useYard.getState().makePlan();
    clearBench();
    const args = useYard.getState().engineCallFor(q, undefined, undefined, { fresh: true });
    holdAnswer(structuredClone(answer({ id: 3, key: callKey(args), args, ignoredFor: q })), q);
    const viaWorker = withoutId(useYard.getState().generate(q, undefined, undefined, { fresh: true }));
    const workerPlan = useYard.getState().makePlan();
    assert.ok(isDeepStrictEqual(viaWorker, here), `${q}: bench build`);
    assert.ok(isDeepStrictEqual(workerPlan.bom, herePlan.bom) && isDeepStrictEqual(workerPlan.instructions, herePlan.instructions) && isDeepStrictEqual(workerPlan.totals, herePlan.totals), `${q}: bench plan`);
  }
  dropHeld();
});

test("run-prompt builds through the worker and never waits on the reader before the first model; the 3D view loads lazily", () => {
  const run = readFileSync("src/components/workspace/run-prompt.ts", "utf8");
  const once = run.slice(run.indexOf("async function runOnce"));
  assert.ok(once.indexOf("await prebuilt(typed)") < once.indexOf("prompt = await reading"), "the typed words build before the reader's answer is awaited");
  assert.ok(once.indexOf("const reading = readerPrompt(") < once.indexOf("await prebuilt(typed)"), "the reader starts at once, in parallel");
  assert.doesNotMatch(once, /prompt = await readerPrompt\(/, "no build waits on the reader");
  const shell = readFileSync("src/components/workspace/shell.tsx", "utf8");
  assert.doesNotMatch(shell, /^import \{[^}]*WorkspaceCanvas[^}]*\} from "@\/components\/workspace\/canvas";/m, "no static import of the 3D view");
  assert.match(shell, /lazy\(\(\) => import\("@\/components\/workspace\/canvas"\)/);
  const canvas = readFileSync("src/components/workspace/canvas.tsx", "utf8");
  assert.match(canvas, /BENCH_HDRI = "\/hdri\/empty_warehouse_01_256\.hdr"/);
  const hdr = readFileSync("public/hdri/empty_warehouse_01_256.hdr");
  assert.equal(hdr.subarray(0, 10).toString(), "#?RADIANCE");
  assert.ok(hdr.length < 200_000, `${hdr.length} bytes`);
});
