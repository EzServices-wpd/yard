import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  acceptIdeaCard,
  ideaSearchScore,
  ideaStem,
  localLibraryDecision,
  stemsTooClose,
  type IdeaCandidate,
} from "./ideaLibrary.ts";

const known = [
  { label: "Desk", prompt: "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space" },
  { label: "Popsicle Eiffel", prompt: "3 foot Eiffel Tower from popsicle sticks" },
];

function candidate(over: Partial<IdeaCandidate> = {}): IdeaCandidate {
  return {
    prompt: "murphy bed 60 wide that folds into a cabinet",
    name: "Murphy bed",
    size: '60" × 80" × 16"',
    kind: "furniture",
    stock: '3/4" plywood',
    pieces: 24,
    feasibility: "ok",
    summary: "Cuts fit the sheet.",
    honestyOk: true,
    wire: false,
    parts: "2 sides, 1 top, 4 legs",
    warnings: "",
    place: "freestanding",
    steps: 6,
    ...over,
  };
}

describe("idea library gate", () => {
  it("treats a resized desk as the desk already on the list", () => {
    const a = ideaStem(known[0].prompt);
    const b = ideaStem("desk 48 inches wide by 24 deep by 29 high with drawers and 24 inch knee space");
    assert.equal(a, b);
    const d = localLibraryDecision(
      candidate({ prompt: "desk 48 inches wide by 24 deep by 29 high with drawers and 24 inch knee space", name: "Writing table" }),
      known,
    );
    assert.equal(d.call, false);
    assert.equal(d.reason, "already built");
  });

  it("does not file a critical, dishonest, empty, or wire plan", () => {
    assert.equal(localLibraryDecision(candidate({ feasibility: "critical" }), known).reason, "not good");
    assert.equal(localLibraryDecision(candidate({ honestyOk: false }), known).reason, "not what was asked");
    assert.equal(localLibraryDecision(candidate({ pieces: 0 }), known).reason, "empty");
    assert.equal(localLibraryDecision(candidate({ wire: true }), known).reason, "no real stock");
    assert.equal(localLibraryDecision(candidate({ prompt: "stool" }), known).reason, "too short");
  });

  it("sends a new sound plan to the librarian", () => {
    const d = localLibraryDecision(candidate(), known);
    assert.equal(d.call, true);
  });

  it("refuses a card that renames an idea already on the list", () => {
    const card = acceptIdeaCard(
      {
        label: "Desk",
        size: "48 × 29",
        blurb: "A shorter desk with drawers.",
        section: "Sit and work",
        group: "house",
        stock: null,
      },
      candidate({ prompt: "writing desk for a small room", name: "Writing desk" }),
      known,
    );
    assert.equal(card, null);
  });

  it("keeps a genuinely new house idea", () => {
    const card = acceptIdeaCard(
      {
        label: "Murphy bed",
        size: "60 × 80 × 16",
        blurb: "A fold-down bed that stores as a cabinet.",
        section: "Store",
        group: "house",
        stock: null,
      },
      candidate(),
      known,
    );
    assert.ok(card);
    assert.equal(card?.section, "Store");
    assert.equal(card?.group, "house");
    assert.equal(card?.prompt.includes("murphy bed"), true);
    assert.equal(card?.stock, undefined);
  });

  it("treats the same idea in another word order as already built", () => {
    assert.equal(
      stemsTooClose(
        "desk with drawers and knee space",
        "drawers and a knee space desk",
      ),
      true,
    );
    const d = localLibraryDecision(
      candidate({
        prompt: "drawers and a knee space desk",
        name: "Desk",
      }),
      known,
    );
    assert.equal(d.call, false);
    assert.equal(d.reason, "already built");
    assert.equal(d.match, "Desk");
  });

  it("keeps a coat rack with a bench apart from a coat rack", () => {
    const d = localLibraryDecision(
      candidate({
        prompt: "coat rack with bench 48 wide and a hat shelf",
        name: "Coat rack with bench",
      }),
      [{ label: "Coat rack", prompt: "coat rack 36 wide 12 high 4 deep" }],
    );
    assert.equal(d.call, true);
  });

  it("ranks a label hit above a passing mention, and folds plurals", () => {
    const desk = ideaSearchScore(
      { label: "Desk", size: "60", blurb: "Drawers and a place to sit.", section: "Sit and work", prompt: "desk 60 wide" },
      "desk",
    );
    const mention = ideaSearchScore(
      { label: "Mudroom bench", size: "48", blurb: "Not a desk.", section: "Sit and work", prompt: "mudroom bench" },
      "desk",
    );
    assert.ok(desk > mention);
    const shelves = ideaSearchScore(
      { label: "Floating shelves", size: "36", blurb: "Boards on cleats.", section: "Hang on the wall", prompt: "floating shelves 36 wide" },
      "shelf",
    );
    assert.ok(shelves > 0);
    const buried = ideaSearchScore(
      { label: "Too small for books", size: "6", blurb: "Phones and plants.", section: "Fitted to a hole", prompt: "corner bookshelf, 6 inches along each wall" },
      "shelf",
    );
    assert.equal(buried, -1);
    const stray = ideaSearchScore(
      { label: "Kitchen base", size: "24 deep", blurb: "Floor carcase, door(s), toekick.", section: "Store", prompt: "kitchen base cabinet 24 wide" },
      "shelf",
    );
    assert.equal(stray, -1);
    const both = ideaSearchScore(
      { label: "Coat rack with bench", size: "48", blurb: "Seat and hooks.", section: "Sit and work", prompt: "coat rack with bench" },
      "coat bench",
    );
    const onlyCoat = ideaSearchScore(
      { label: "Coat rack", size: "36", blurb: "Peg rail.", section: "Hang on the wall", prompt: "coat rack 36 wide" },
      "coat bench",
    );
    assert.ok(both > 0);
    assert.equal(onlyCoat, -1);
  });
});
