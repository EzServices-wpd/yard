/**
 * Runs every TypeScript unit test (src/lib/yard/*.test.ts, scripts/*.test.ts) under tsx and fails on
 * any failing test that is not in KNOWN_TEST_FAILURES (scripts/guard-known-failures.ts).
 * GUARD_STRICT=1 ignores the list. The .mjs tests run separately with `node --test`.
 *
 *   npx tsx scripts/run-unit-tests.ts
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { KNOWN_TEST_FAILURES } from "./guard-known-failures";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const files = [
  ...fs.readdirSync(path.join(root, "src/lib/yard")).filter((f) => f.endsWith(".test.ts")).map((f) => `src/lib/yard/${f}`),
  ...fs.readdirSync(path.join(root, "scripts")).filter((f) => f.endsWith(".test.ts")).map((f) => `scripts/${f}`),
].sort();
const strict = process.env.GUARD_STRICT === "1";
const seen = new Set<string>();
let bad = 0;
for (const file of files) {
  const r = spawnSync("npx", ["-y", "tsx", "--test", "--test-reporter=tap", file], { cwd: root, encoding: "utf8", timeout: 600_000 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
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
  const crashed = r.status !== 0 && rows.length === 0;
  if (crashed) unknown.push(`(no TAP output — test file crashed)\n${out.slice(-1500)}`);
  for (const k of known) console.warn(`KNOWN ${file}: ${k}`);
  if (unknown.length) {
    bad += unknown.length;
    for (const u of unknown) console.error(`FAIL ${file}: ${u}`);
  } else {
    console.log(`PASS ${file} (${pass} ok${known.length ? `, ${known.length} known` : ""})`);
  }
}
for (const k of KNOWN_TEST_FAILURES) {
  if (!seen.has(`${k.file}|${k.test}`)) console.warn(`STALE KNOWN test ${k.file}: "${k.test}" did not fail — remove it from scripts/guard-known-failures.ts`);
}
if (bad) {
  console.error(`unit tests: ${bad} unlisted failure(s)`);
  process.exit(1);
}
console.log(`PASS unit tests: ${files.length} files`);
