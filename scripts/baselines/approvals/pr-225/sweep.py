"""NR-1 mover generator, part 1: the prompt set (deterministic). python3 sweep.py corpus.json probe.jsonl > prompts.json
Every eval-corpus prompt, every Critic NR-1 probe prompt, and a sweep of hosts x sizes x spellings x axes x features."""
import json, sys
HOSTS = ["bookcase", "nightstand", "desk", "dresser", "media console", "wardrobe", "closet", "bench", "coffee table",
         "side table", "table", "cabinet", "base cabinet", "kitchen base cabinet", "bathroom vanity", "sideboard",
         "tv stand", "shoe rack", "shelf", "wall shelf", "toy box", "hope chest", "workbench", "stool", "step stool",
         "linen cabinet", "pantry cabinet", "kitchen island", "dog house", "planter box"]
ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()
def words(n):
    if n < 20: return ONES[n]
    t, o = divmod(n, 10)
    return TENS[t] + ("-" + ONES[o] if o else "")
def spellings(n):
    s = [f"{n}", f'{n}"', f"{n} inches", f"{n} in", f"{words(n)} inches", f"{round(n*25.4)} mm", f"{round(n*2.54,1):g} cm"]
    ft, inch = divmod(n, 12)
    if ft:
        s += [f"{ft} ft {inch} in" if inch else f"{ft} ft", f"{ft}'{inch}\"" if inch else f"{ft}'"]
        if inch == 0: s += [f"{words(ft)} feet", f"{ft} feet"]
        if inch == 6: s += [f"{ft} 1/2 ft", f"{ft}.5 ft", f"{words(ft)} and a half feet"]
    return s
FEATS = ["", " with two drawers", " with three shelves", " with 1 shelf", " with two doors"]
out = set(json.load(open(sys.argv[1])))
for l in open(sys.argv[2]):
    try: out.add(json.loads(l)["prompt"])
    except Exception: pass
for host in HOSTS:
    for n, axes in [(18, ["deep", "tall"]), (24, ["wide", "tall"]), (30, ["wide", "tall"]), (36, ["wide", "tall"]), (48, ["wide"]), (72, ["tall"])]:
        for ax in axes:
            for sp in spellings(n):
                for f in FEATS:
                    out.add(f"{host} {sp} {ax}{f}")
json.dump(sorted(out), sys.stdout)
