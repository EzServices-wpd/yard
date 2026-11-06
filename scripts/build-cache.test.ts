import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { GRADER_FILES, ROOT_FILES, SCHEMA, entryKey, rowCache, treeKey } from "./build-cache.ts";
import { HEAD_ROOT, gradeOne, loadCorpus, loadEngine } from "./eval-gate-lib.ts";

/** A tiny checkout: src/, the root files and the grader files, each a few bytes. */
function fakeTree(): string {
  const d = mkdtempSync(join(tmpdir(), "yard-cache-"));
  const put = (rel: string, body: string) => { mkdirSync(join(d, rel, ".."), { recursive: true }); writeFileSync(join(d, rel), body); };
  put("src/lib/yard/promptMain.ts", "export const a = 1;\n");
  put("src/lib/yard/data/sizes.json", "{}\n");
  put("src/components/x.tsx", "export {};\n");
  for (const f of [...ROOT_FILES, ...GRADER_FILES]) put(f, `${f}\n`);
  put("docs/ENGINE.md", "notes\n");
  put("scripts/props.test.ts", "// not a grader file\n");
  return d;
}

test("tree key: same tree, same key; a byte changed anywhere the row reads, a new key", () => {
  const t = fakeTree();
  try {
    const k = treeKey(t, t, "v22.0.0");
    assert.match(k, /^[0-9a-f]{64}$/);
    assert.equal(treeKey(t, t, "v22.0.0"), k, "deterministic");
    // A copy at another path is the same tree (paths are relative).
    const c = mkdtempSync(join(tmpdir(), "yard-cache-copy-"));
    cpSync(t, c, { recursive: true });
    assert.equal(treeKey(c, c, "v22.0.0"), k, "a checkout's location is not part of the key");
    rmSync(c, { recursive: true, force: true });

    const misses: [string, () => void][] = [
      ["an engine file", () => writeFileSync(join(t, "src/lib/yard/promptMain.ts"), "export const a = 2;\n")],
      ["engine data", () => writeFileSync(join(t, "src/lib/yard/data/sizes.json"), '{"w":1}\n')],
      ["a new src file", () => writeFileSync(join(t, "src/lib/yard/new.ts"), "export {};\n")],
      ...ROOT_FILES.map((f): [string, () => void] => [f, () => writeFileSync(join(t, f), `${f} changed\n`)]),
      ...GRADER_FILES.map((f): [string, () => void] => [f, () => writeFileSync(join(t, f), `${f} changed\n`)]),
    ];
    let prev = k;
    for (const [what, change] of misses) {
      change();
      const now = treeKey(t, t, "v22.0.0");
      assert.notEqual(now, prev, `changing ${what} must change the key`);
      prev = now;
    }
    assert.notEqual(treeKey(t, t, "v24.0.0"), prev, "another Node version is another key");

    // Files a row never reads leave the key alone.
    writeFileSync(join(t, "docs/ENGINE.md"), "other notes\n");
    writeFileSync(join(t, "scripts/props.test.ts"), "// still not a grader file\n");
    assert.equal(treeKey(t, t, "v22.0.0"), prev, "docs and other scripts are not in the key");
  } finally {
    rmSync(t, { recursive: true, force: true });
  }
});

test("tree key: head grader and base engine are separate inputs", () => {
  const head = fakeTree(), base = fakeTree();
  try {
    const k = treeKey(base, head, "v22.0.0");
    writeFileSync(join(head, "src/lib/yard/promptMain.ts"), "export const a = 9;\n");
    assert.equal(treeKey(base, head, "v22.0.0"), k, "the head's engine does not key the base's rows");
    writeFileSync(join(head, "scripts/eval-gate-lib.ts"), "graded differently\n");
    assert.notEqual(treeKey(base, head, "v22.0.0"), k, "the head's grader does");
  } finally {
    rmSync(head, { recursive: true, force: true });
    rmSync(base, { recursive: true, force: true });
  }
});

test("entry key: every field counts, key order does not", () => {
  const e = { prompt: "bookshelf 36 wide", sources: ["eval46"], ids: ["x"], demands: { size: { width: 36 } }, demandsFrom: "typed-rules" };
  const k = entryKey(e);
  assert.equal(entryKey({ demandsFrom: "typed-rules", demands: { size: { width: 36 } }, ids: ["x"], sources: ["eval46"], prompt: "bookshelf 36 wide" }), k);
  assert.notEqual(entryKey({ ...e, prompt: "bookshelf 38 wide" }), k);
  assert.notEqual(entryKey({ ...e, sources: ["grok100"] }), k);
  assert.notEqual(entryKey({ ...e, ids: [] }), k);
  assert.notEqual(entryKey({ ...e, demands: { size: { width: 38 } } }), k);
  assert.notEqual(entryKey({ ...e, expect: { width: 36 } }), k);
  assert.equal(entryKey({ ...e, expect: undefined }), k, "an undefined field is an absent field (JSON drops it too)");
});

test("row cache: put then get on the same tree; another tree misses; off never hits", () => {
  const t = fakeTree(), dir = mkdtempSync(join(tmpdir(), "yard-cache-rows-"));
  try {
    const e = { prompt: "linen closet 31.5 wide 78 tall 16 deep" };
    const row = { prompt: e.prompt, grade: "pass", schema: SCHEMA };
    const c = rowCache<typeof row>(t, t, dir);
    assert.equal(c.get(e), undefined);
    c.put(e, row);
    assert.deepEqual(rowCache<typeof row>(t, t, dir).get(e), row, "a later run reads the row back");
    writeFileSync(join(t, "src/lib/yard/promptMain.ts"), "export const a = 3;\n");
    assert.equal(rowCache<typeof row>(t, t, dir).get(e), undefined, "an engine change misses");
    const off = rowCache<typeof row>(t, t, null);
    off.put(e, row);
    assert.equal(off.get(e), undefined);
    assert.equal(off.dir, null);
  } finally {
    rmSync(t, { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a cached row is the row a fresh grade writes (this tree, three prompts)", async () => {
  const E = await loadEngine(HEAD_ROOT);
  const want = new Set(["linen closet 31.5 wide 78 tall 16 deep", "shoe rack by the door 36 inches wide", "bookshelf"]);
  const entries = loadCorpus().filter((e) => want.has(e.prompt));
  assert.ok(entries.length >= 2, "corpus still has the sample prompts");
  const dir = mkdtempSync(join(tmpdir(), "yard-cache-real-"));
  try {
    const c = rowCache<ReturnType<typeof gradeOne>>(HEAD_ROOT, HEAD_ROOT, dir);
    for (const e of entries) c.put(e, gradeOne(E, e));
    const again = rowCache<ReturnType<typeof gradeOne>>(HEAD_ROOT, HEAD_ROOT, dir);
    for (const e of entries) assert.deepEqual(again.get(e), JSON.parse(JSON.stringify(gradeOne(E, e))), e.prompt);
    assert.equal(again.hits(), entries.length);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
