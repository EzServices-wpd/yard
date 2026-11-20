import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_CAP_USD, Spend } from "./reader-eval.ts";

const script = new URL("./reader-eval.ts", import.meta.url).pathname;
const size = (quote: string, axis: string, value: number, unit: string, inches: number) => ({ axis, value, unit, inches, of: "overall", quote, confidence: 0.95, assumed: false });

test("the spend budget reserves a worst case first and never passes its cap", () => {
  assert.throws(() => new Spend(0));
  assert.throws(() => new Spend(MAX_CAP_USD + 0.01));
  const s = new Spend(0.01);
  assert.ok(s.reserve(0.004));
  s.settle(0.004, 0.003);
  assert.ok(s.reserve(0.004));
  assert.ok(!s.reserve(0.004), "0.003 billed + 0.004 reserved + 0.004 > 0.01");
  assert.equal(s.calls, 2);
});

test("a dry run replays saved replies, builds both ways, grades both and spends nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "reader-eval-"));
  writeFileSync(join(dir, "prompts.json"), JSON.stringify(["fence panel 6 ft", "porch swing 5 foot", "bookcase 36 wide 12 deep 72 tall"]));
  writeFileSync(join(dir, "replies.json"), JSON.stringify({ "fence panel 6 ft": JSON.stringify({ sizes: [size("6 ft", "H", 6, "ft", 72)], counts: [] }) }));
  execFileSync("npx", ["-y", "tsx", script, "--prompts", join(dir, "prompts.json"), "--out", join(dir, "out"), "--replies", join(dir, "replies.json")], { stdio: "ignore" });
  const builds = readFileSync(join(dir, "out", "builds.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const by = Object.fromEntries(builds.map((b) => [b.prompt, b]));
  assert.equal(by["fence panel 6 ft"].replied, "saved");
  assert.equal(by["fence panel 6 ft"].buildFrom, "fence panel 72 tall", "the saved reply rewrote the build words");
  assert.equal(by["porch swing 5 foot"].replied, "none", "no saved reply: built from the typed words, no call");
  assert.equal(by["porch swing 5 foot"].buildFrom, "porch swing 5 foot");
  assert.equal(by["bookcase 36 wide 12 deep 72 tall"].replied, "skipped", "fully labelled words never go to the reader");
  const sum = JSON.parse(readFileSync(join(dir, "out", "summary.json"), "utf8"));
  assert.equal(sum.mode, "dry run");
  assert.equal(sum.spent, 0);
  assert.ok(sum.projected > 0 && sum.projected < 0.02, `projected $${sum.projected}`);
  const withR = JSON.parse(readFileSync(join(dir, "out", "with.json"), "utf8"));
  const without = JSON.parse(readFileSync(join(dir, "out", "without.json"), "utf8"));
  assert.equal(withR.length, 3);
  assert.equal(withR[0].prompt, without[0].prompt, "both sides are graded against the typed words");
  assert.match(readFileSync(join(dir, "out", "diff.md"), "utf8"), /# Reader eval · dry run/);
});

test("a saved 3x6 ft reply is used when the regex build is 28 by 28, not 3 by 6 ft", () => {
  const dir = mkdtempSync(join(tmpdir(), "reader-eval-"));
  const q = "garden bed 3x6 cedar";
  writeFileSync(join(dir, "prompts.json"), JSON.stringify([q]));
  writeFileSync(join(dir, "replies.json"), JSON.stringify({
    [q]: JSON.stringify({ sizes: [size("3x6", "W", 3, "ft", 36), size("3x6", "D", 6, "ft", 72)], counts: [] }),
  }));
  execFileSync("npx", ["-y", "tsx", script, "--prompts", join(dir, "prompts.json"), "--out", join(dir, "out"), "--replies", join(dir, "replies.json")], { stdio: "ignore" });
  const row = JSON.parse(readFileSync(join(dir, "out", "builds.jsonl"), "utf8"));
  assert.equal(row.replied, "saved");
  assert.equal(row.used, true, row.reason);
  assert.equal(row.buildFrom, "garden bed 36 wide 72 deep cedar");
  const sum = JSON.parse(readFileSync(join(dir, "out", "summary.json"), "utf8"));
  assert.equal(sum.spent, 0);
});

test("a live run needs a cap within the hard ceiling and a key; nothing runs otherwise", () => {
  const dir = mkdtempSync(join(tmpdir(), "reader-eval-"));
  writeFileSync(join(dir, "p.json"), JSON.stringify(["fence panel 6 ft"]));
  const run = (args: string[], env: Record<string, string> = {}) => spawnSync("npx", ["-y", "tsx", script, "--prompts", join(dir, "p.json"), "--out", join(dir, "o"), ...args], { encoding: "utf8", env: { ...process.env, XAI_API_KEY: "", ...env } });
  assert.match(run(["--live"]).stderr, /--live needs --cap-usd/);
  assert.match(run(["--live", "--cap-usd", "1"]).stderr, /needs XAI_API_KEY/);
  assert.match(run(["--live", "--cap-usd", String(MAX_CAP_USD + 1)], { XAI_API_KEY: "x" }).stderr, /at most/);
});
