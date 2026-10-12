import assert from "node:assert/strict";
import { it } from "node:test";
import { parseRecipe } from "./recipes.ts";
import { lookupAndBuild } from "./recipeBuild.ts";

const reply = {
  key: "Lap Desk", title: "Lap desk", size: { width: "24", height: 4, depth: "16" }, defining: ["tray", "cushion"],
  parts: [
    { role: "Trays", name: "lap-tray", box: [0, "0.6", 0, 1, 0.1, 1.2], kind: "board", on: ["Base", "missing part"] },
    { role: "base", name: "Base", box: [0, 0, 0, 1, 0.6, 1], kind: "panel" },
  ],
};

it("a lookup reply is repaired, not refused, when only optional or loose fields are off", () => {
  const r = parseRecipe("```json\n" + JSON.stringify(reply) + "\n```")!;
  assert.ok(r);
  assert.equal(r.key, "lap-desk");
  assert.deepEqual(r.size, { width: 24, height: 4, depth: 16 });
  assert.deepEqual(r.defining, ["tray"]);
  const tray = r.parts.find((p) => p.name === "Lap tray")!;
  assert.equal(tray.kind, "member");
  assert.deepEqual(tray.on, ["Base"]);
  assert.ok(tray.box[5] <= 1 && tray.box[1] === 0.6);
  assert.equal(r.notes.length, 0);
});

it("a reply with no size or parts is refused with a reason the one retry can fix", async () => {
  const calls: (string[] | undefined)[] = [];
  const out = await lookupAndBuild("chicken tractor", async (_p, fb) => { calls.push(fb); return { title: "Chicken tractor", parts: [] }; }, () => ({ name: "x", notes: [] }) as never);
  assert.equal(out.calls, 2);
  assert.equal(calls.length, 2);
  assert.match(calls[1]![0], /missing size .*parts/);
});
