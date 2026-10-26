import { describe, it } from "node:test";
import assert from "node:assert/strict";

// The share card prints the bench's own numbers: the same token through the real bench path (run-prompt, AI stubbed
// and never called) gives the Buy list total and piece count the card shows.
(globalThis as { window?: unknown }).window = { setTimeout, clearTimeout, atob, btoa, location: { search: "" } };
const { runYardPrompt } = await import("../src/components/workspace/run-prompt");
const { useYard } = await import("../src/lib/yard/store");
const { encodeShare } = await import("../src/lib/yard/shareBuild");
const { POCKET_DREAM } = await import("../src/lib/yard/pocket");
const { usd } = await import("../src/lib/utils");
const { cardFacts, cardPayload, cardSvg, CARD_W, CARD_H, MAX_TOKEN } = await import("../src/lib/og/card");
const { cardFactsWithin } = await import("../src/lib/og/budget.server");
const await_ShareBuild = await import("../src/lib/yard/shareBuild");
const await_Pdf = await import("../src/lib/yard/pdf");

const calls: string[] = [];
const stub = (name: string) => (async () => { calls.push(name); return { ok: false }; }) as never;
const ai = { lookupRecipe: stub("lookup"), hintSubject: stub("hint"), interpretPrompt: stub("interp"), briefHousePrompt: stub("house"), proposeRecipeFn: stub("propose") };
const token = (prompt: string) => encodeShare({ prompt, measure: {} });

describe("og card price and parts are the Buy list's", () => {
  const canaries = [
    { id: "linen", prompt: "linen closet 31.5 wide 78 tall 16 deep", parts: 11, price: "~$193.68 estimated", size: '31 1/2" W × 16" D × 78" H' },
    { id: "pocket vanity", prompt: POCKET_DREAM, parts: 50, price: "~$636.23 estimated" },
    { id: "eiffel (sticks)", prompt: "3 foot Eiffel Tower from popsicle sticks", parts: 784, price: "~$19.96 estimated" },
    { id: "cat tree", prompt: "cat tree", parts: 20, price: "~$128.08 estimated" },
  ];
  for (const c of canaries) {
    it(c.id, async () => {
      const f = cardFacts(token(c.prompt));
      assert.ok(f, "a built card");
      calls.length = 0;
      await runYardPrompt(c.prompt, { fresh: true, ai });
      const plan = useYard.getState().plan ?? useYard.getState().makePlan();
      assert.deepEqual(calls, [], "the bench built it without the AI");
      assert.equal(f.price, `${usd(plan.totals.estCostUsd)} estimated`, "card price = Buy list total");
      assert.equal(f.parts, plan.totals.pieces, "card parts = Buy list pieces");
      assert.equal(f.price, c.price);
      assert.equal(f.parts, c.parts);
      if (c.size) assert.equal(f.size, c.size);
      assert.match(cardSvg(f), new RegExp(`width="${CARD_W}" height="${CARD_H}"`));
    });
  }
});

describe("og card input", () => {
  it("bad, oversized, measured or malformed tokens get the default card", () => {
    for (const t of [undefined, "", "!!!", "a".repeat(MAX_TOKEN + 1), "e30", token("   "), encodeShare({ prompt: "cat tree", measure: { width: "30" } }), encodeShare({ prompt: "cat tree", measure: {}, shelves: -1 }), encodeShare({ prompt: "cat tree", measure: {}, shelves: 1.5 })]) {
      assert.equal(cardPayload(t), null, String(t).slice(0, 40));
      assert.equal(cardFacts(t), null);
    }
    assert.match(cardSvg(null), /Think it up\. Yard works it out\./);
  });
  it("text is escaped and the card has no links", () => {
    const svg = cardSvg({ name: `<b>"&"</b>`, size: "1 W", parts: 1, price: "", drawing: "<svg></svg>" });
    assert.ok(!svg.includes("<b>") && svg.includes("&lt;b&gt;&quot;&amp;&quot;&lt;/b&gt;"));
    assert.ok(!/href|https?:\/\/(?!www\.w3\.org\/2000\/svg")/i.test(cardSvg(cardFacts(token("cat tree")))));
  });
});

describe("og card is the link's build, within a time budget", () => {
  it("a permalink naming the build's own stock prices like the bench; a switched stock gets the default card", async () => {
    // build-info's permalink always carries the stock: the card must not take the stock-switch path for it.
    calls.length = 0;
    await runYardPrompt("cat tree", { fresh: true, ai });
    const plan = useYard.getState().plan ?? useYard.getState().makePlan();
    const own = cardFacts(encodeShare({ prompt: "cat tree", measure: {}, stockId: useYard.getState().project.primaryMaterialId }));
    assert.equal(own?.price, `${usd(plan.totals.estCostUsd)} estimated`);
    assert.equal(own?.parts, plan.totals.pieces);
    const other = useYard.getState().project.primaryMaterialId === "plywood-1-2-4x8" ? "plywood-3-4-4x8" : "plywood-1-2-4x8";
    assert.equal(cardFacts(encodeShare({ prompt: "cat tree", measure: {}, stockId: other })), null);
  });
  it("a build past the budget is the default card, never a held request; one card at a time", async () => {
    const slow = await cardFactsWithin(token("deck 100 x 100 feet"), 300);
    assert.deepEqual([slow.why, slow.facts], ["slow", null]);
    const a = cardFactsWithin(token("cat tree")), b = cardFactsWithin(token("bookcase"));
    assert.equal((await b).why, "busy");
    const done = await a;
    assert.equal(done.why, "ok");
    assert.equal(done.facts?.price, "~$128.08 estimated");
  });
});

describe("og card = the build its permalink opens (Critic rows 561/562: the 13 shares that priced wrong)", () => {
  const { permalink, decodeShare } = await_ShareBuild;
  const { headerAxes, headerName } = await_Pdf;
  const shares = ["cat tree", "coffee table 48 wide", "adirondack chair", "murphy bed", "chicken coop", "rolling cart for bar 24 wide", "hanging bird feeder",
    "rustic x coffee table 52 long 27 wide 18 tall", "sewing table 48 long", "workbench 6 foot with a vise", "console table 48 long 11 deep 29 tall", "wall mounted desk 36 wide", "cribbage board"];
  const bench = async (prompt: string) => {
    await runYardPrompt(prompt, { fresh: true, ai });
    const project = useYard.getState().project, plan = useYard.getState().plan ?? useYard.getState().makePlan();
    return { name: headerName(project), size: headerAxes(project), parts: plan.totals.pieces, price: `${usd(plan.totals.estCostUsd)} estimated`, project };
  };
  for (const q of shares) {
    it(q, async () => {
      calls.length = 0;
      const sharer = await bench(q);
      const link = permalink(sharer.project);
      assert.ok(link, "the bench offers a permalink");
      const token = new URL(link).searchParams.get("y")!;
      const card = cardFacts(token);
      // The recipient's bench: a link with no edits opens as the fresh build of its words (shell.tsx).
      calls.length = 0;
      const opened = await bench(decodeShare(token)!.prompt);
      // Words the bench sends to the AI (hint, interpret) may be reshaped live: those get the default card, never a guess.
      if (calls.length) return assert.equal(card, null, `AI called (${calls.join()}): default card`);
      assert.ok(card, "a built card");
      const { name, size, parts, price } = card;
      assert.deepEqual({ name, size, parts, price }, { name: opened.name, size: opened.size, parts: opened.parts, price: opened.price });
      // Same words as the sharer typed: the card is also the sharer's own numbers.
      if (decodeShare(token)!.prompt === q) assert.deepEqual({ parts, price }, { parts: sharer.parts, price: sharer.price });
    });
  }
});
