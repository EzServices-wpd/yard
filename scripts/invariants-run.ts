/** Print every invariant violation over the corpus as JSON (to refresh evals/invariants-baseline.json by hand). */
import { violations } from "./eval-lib.ts";
import { corpus } from "./invariants-corpus.ts";
console.log(JSON.stringify(Object.fromEntries(violations(corpus())), null, 1));
