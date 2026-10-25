/**
 * Runs every TypeScript unit test (src/lib/yard/*.test.ts, scripts/*.test.ts) under tsx and fails on
 * any failing test that is not in KNOWN_TEST_FAILURES (scripts/guard-known-failures.ts).
 * GUARD_STRICT=1 ignores the list. The .mjs tests run separately with `node --test`.
 * Files run UNIT_JOBS at a time (default: one per CPU); each file is still its own tsx process.
 *
 *   npx tsx scripts/run-unit-tests.ts                        every file
 *   npx tsx scripts/run-unit-tests.ts --shard 2/4            the 2nd of 4 shards (CI matrix); the shards cover every file exactly once
 *   npx tsx scripts/run-unit-tests.ts --shard 2/4 --list     print that shard's files and exit
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { KNOWN_TEST_FAILURES } from "./guard-known-failures";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const allFiles = [
  ...fs.readdirSync(path.join(root, "src/lib/yard")).filter((f) => f.endsWith(".test.ts")).map((f) => `src/lib/yard/${f}`),
  ...fs.readdirSync(path.join(root, "scripts")).filter((f) => f.endsWith(".test.ts")).map((f) => `scripts/${f}`),
].sort();

/** Longest-first greedy split by the measured seconds in unit-test-timings.json: every file lands in exactly one shard. */
function shardOf(all: string[], index: number, count: number, secs: Record<string, number>): string[] {
  const load = Array.from({ length: count }, () => 0);
  const mine: string[] = [];
  const weight = (f: string) => (typeof secs[f] === "number" ? secs[f] : 2);
  for (const f of [...all].sort((a, b) => weight(b) - weight(a) || a.localeCompare(b))) {
    const k = load.indexOf(Math.min(...load));
    load[k] += weight(f);
    if (k === index - 1) mine.push(f);
  }
  return mine.sort();
}

const argAt = process.argv.indexOf("--shard");
const shard = argAt < 0 ? null : process.argv[argAt + 1]?.match(/^(\d+)\/(\d+)$/);
if (argAt >= 0 && (!shard || +shard[1] < 1 || +shard[1] > +shard[2])) throw new Error(`--shard wants i/N with 1 <= i <= N`);
const secs = JSON.parse(fs.readFileSync(path.join(root, "scripts/unit-test-timings.json"), "utf8"));
const files = shard ? shardOf(allFiles, +shard[1], +shard[2], secs) : allFiles;
if (process.argv.includes("--list")) {
  console.log(files.join("\n"));
  process.exit(0);
}
const strict = process.env.GUARD_STRICT === "1";
const jobs = Math.max(1, Number(process.env.UNIT_JOBS) || os.availableParallelism());
const seen = new Set<string>();
let bad = 0;

type Run = { status: number | null; signal: NodeJS.Signals | null; error?: Error; out: string; secs: number };
function runFile(file: string): Promise<Run> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const child = spawn("npx", ["-y", "tsx", "--test", "--test-reporter=tap", file], { cwd: root });
    let out = "";
    let error: Error | undefined;
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const timer = setTimeout(() => child.kill("SIGTERM"), 600_000);
    child.on("error", (e) => (error = e));
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      resolve({ status, signal, error, out, secs: (Date.now() - t0) / 1000 });
    });
  });
}

function report(file: string, r: Run) {
  const out = r.out;
  const rows = out
    .split("\n")
    .map((line) => line.match(/^(\s*)(not ok|ok) \d+ - (.*?)(?:\s+#.*)?$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ indent: m[1].length, ok: m[2] === "ok", name: m[3].trim() }));
  const isKnown = (name: string) => !strict && KNOWN_TEST_FAILURES.some((k) => k.file === file && k.test === name);
  const unknown: string[] = [];
  const known: string[] = [];
  rows.forEach((row, i) => {
    if (row.ok) return;
    // TAP prints children before their parent: the failing rows just above with a deeper indent.
    const kids: typeof rows = [];
    for (let j = i - 1; j >= 0 && rows[j].indent > row.indent; j--) if (!rows[j].ok && rows[j].indent === row.indent + 4) kids.push(rows[j]);
    if (isKnown(row.name)) {
      known.push(row.name);
      seen.add(`${file}|${row.name}`);
    } else if (!(kids.length && kids.every((k) => isKnown(k.name)))) {
      // A parent whose failing children are all listed is tolerated; anything else is a real failure.
      unknown.push(row.name);
    }
  });
  const pass = rows.filter((x) => x.ok).length;
  // A file that timed out or exited non-zero mid-run (a slow box) only printed some rows: that is a failure, never a pass.
  const crashed = (r.status !== 0 || !!r.signal || !!r.error) && !rows.some((x) => !x.ok);
  if (crashed) unknown.push(`(no TAP output — test file crashed)\n${out.slice(-1500)}`);
  for (const k of known) console.warn(`KNOWN ${file}: ${k}`);
  if (unknown.length) {
    bad += unknown.length;
    for (const u of unknown) console.error(`FAIL ${file}: ${u}`);
  } else {
    console.log(`PASS ${file} (${pass} ok${known.length ? `, ${known.length} known` : ""}) ${r.secs.toFixed(1)}s`);
  }
}

const queue = [...files];
await Promise.all(
  Array.from({ length: Math.min(jobs, files.length) }, async () => {
    for (let f = queue.shift(); f; f = queue.shift()) report(f, await runFile(f));
  }),
);
// A shard answers only for the known entries of its own files.
for (const k of KNOWN_TEST_FAILURES.filter((x) => files.includes(x.file))) {
  if (!seen.has(`${k.file}|${k.test}`)) console.warn(`STALE KNOWN test ${k.file}: "${k.test}" did not fail — remove it from scripts/guard-known-failures.ts`);
}
if (bad) {
  console.error(`unit tests: ${bad} unlisted failure(s)`);
  process.exit(1);
}
console.log(`PASS unit tests: ${files.length} files${shard ? ` (shard ${shard[1]}/${shard[2]} of ${allFiles.length})` : ""}, ${jobs} at a time`);
