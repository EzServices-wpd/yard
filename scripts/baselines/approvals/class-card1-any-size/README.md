# DRAFT — NOT APPROVED. Class F card 1 at every size spelling (branch class-card1-any-size, f1e7472)

Built on NR-1 (#225). Graded only after #225 has its Critic PASS and Ezra's answer; never stacked on an ungraded card.

## The rule
A card 1 host (media console, sideboard, credenza, buffet, vanity, desk, nightstand) typed with its size in any spelling
the one reader reads and "with 1 shelf" / "with one shelf" / "with an open shelf" builds the host with its own shelf,
as the digit size already does. It never becomes a second "Shelf" product beside the host (I41: a feature never picks
the build). Other hosts keep release's reading ("coffee table with an open shelf" stays two products, row 570).

## Measured effect (vs NR-1 r5 fc7de9e; the 1,724 prompts with "shelf" in scripts/baselines/approvals/pr-225/prompts.json)
213 prompts move, 37 distinct builds, all price-downs, 0 price-ups, 0 refusal changes. Every mover was a
"<host> with Shelf" combined build and is now the host's own build at its typed size. Prompts without "shelf" cannot
move (the rule only reads text CARD1 matches). Critic NR-1 probe: A, B, C, D, E all pass (712 prompts; 74 move, all
price-downs). Full unit suite: same results as r5.

Rerun: `npx tsx scripts/baselines/approvals/pr-225/observe.mts <this folder>/prompts.json out.jsonl` on r5 and on this
branch, then `python3 scripts/baselines/approvals/pr-225/movers.py r5.jsonl this.jsonl`.
