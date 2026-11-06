"""NR-1 mover generator, part 3: diff two observe.mts outputs into the mover list (markdown).
python3 movers.py release.jsonl head.jsonl > movers.md"""
import json, sys
from collections import defaultdict

def load(p):
    d = {}
    for l in open(p):
        try:
            o = json.loads(l)
        except Exception:
            continue
        d[o["prompt"]] = o
    return d

base, head = load(sys.argv[1]), load(sys.argv[2])
common = sorted(set(base) & set(head))
key = lambda o: (o["W"], o["D"], o["H"], o["usd"], o["pieces"], o["refused"], o["cut"])
moved = [p for p in common if key(base[p]) != key(head[p])]
box = lambda o: "refused" if o["refused"] else f'{o["W"]:g}×{o["D"]:g}×{o["H"]:g}'
money = lambda o: "—" if o["refused"] else f'${o["usd"]:.2f}'

groups = defaultdict(list)
for p in moved:
    b, h = base[p], head[p]
    groups[(box(b), money(b), b["pieces"], box(h), money(h), h["pieces"])].append(p)

up = [g for g in groups if g[4] != "—" and (g[1] == "—" or float(g[4][1:]) > float(g[1][1:]))]
down = [g for g in groups if g[1] != "—" and g[4] != "—" and float(g[4][1:]) < float(g[1][1:])]
other = [g for g in groups if g not in up and g not in down]

def rows(gs):
    out = ["| before (W×D×H, price, pieces) | after | prompts |", "|---|---|---|"]
    for g in sorted(gs, key=lambda g: (-len(groups[g]), g)):
        out.append(f"| {g[0]} {g[1]} {g[2]}p | {g[3]} {g[4]} {g[5]}p | {'; '.join(groups[g])} |")
    return out

n = lambda gs: sum(len(groups[g]) for g in gs)
print(f"Measured on {len(common)} prompts: {len(moved)} move ({n(up)} price-ups in {len(up)} builds, "
      f"{n(down)} price-downs in {len(down)} builds, {n(other)} same price / refusal changes in {len(other)} builds).\n")
print(f"### Price-ups, every one ({n(up)} prompts)\n")
print("\n".join(rows(up)))
big = [g for g in groups if g[5] - g[2] >= 8]
print(f"\n### Builds gaining 8+ pieces ({n(big)} prompts)\n")
print("\n".join(rows(big)))
print(f"\n### Price-downs ({n(down)} prompts)\n")
print("\n".join(rows(down)))
print(f"\n### Same price, size or refusal change ({n(other)} prompts)\n")
print("\n".join(rows(other)))
