/**
 * Buy titles read as plain product names (Critic release-1022 row 166, as a class): no listing or checked-stock title
 * stutters, i.e. repeats a word or puts a word next to its own stem ("Sande sanded plywood"). Every title on the
 * Buy list comes from LISTINGS or CHECKED_STOCK, so this covers every build's Buy rows.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { LISTINGS } from "../src/lib/yard/listings";
import * as checked from "../src/lib/yard/checkedStock";

const stem = (w: string) => w.toLowerCase().replace(/[^a-z]/g, "").replace(/(ed|ing|er|es|e|s)$/, "");
export function stutter(title: string): string | null {
  const words = title.split(/\s+/).filter((w) => /[a-z]{3,}/i.test(w));
  for (let i = 1; i < words.length; i++) {
    const a = stem(words[i - 1]), b = stem(words[i]);
    if (a.length >= 3 && a === b) return `${words[i - 1]} ${words[i]}`;
  }
  return null;
}

test("stutter: catches a repeated word or a word beside its own stem, passes plain titles", () => {
  assert.equal(stutter('3/4" x 4x8 Sande sanded plywood'), "Sande sanded");
  assert.equal(stutter("Wood glue glue"), "glue glue");
  assert.equal(stutter('3/4" x 4x8 Sande plywood'), null);
  assert.equal(stutter("Plytanium 23/32 in. x 4 ft. x 8 ft. BC Sanded Pine Plywood"), null);
});

test("no Buy title stutters (LISTINGS + CHECKED_STOCK)", () => {
  const titles = [
    ...LISTINGS.map((l) => l.title),
    ...Object.values(checked).flatMap((v) => (v && typeof v === "object" ? Object.values(v as Record<string, unknown>) : []))
      .flatMap((o) => (o && typeof o === "object" && typeof (o as { title?: unknown }).title === "string" ? [(o as { title: string }).title] : [])),
  ];
  assert.ok(titles.length > 50, `only ${titles.length} titles found`);
  const bad = titles.flatMap((t) => (stutter(t) ? [`${t}  (${stutter(t)})`] : []));
  assert.deepEqual(bad, []);
});
