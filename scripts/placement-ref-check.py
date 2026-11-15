#!/usr/bin/env python3
"""Independent placement checker.

Reads plan JSONL (prompt, titles, descriptions, buyScrews, cuts, price, pieces, buy, parts).
It does not import the engine. A part is attached at the earliest step that sets or
attaches it, not the first time a sentence mentions it. Reports rests-on, flush-with,
under, through, and back-edge references to a part attached later, and screw sums
that disagree with Buy.
"""
import json
import re
import sys
from collections import Counter

STOP = {
    "side", "edge", "face", "wall", "base", "part", "door", "rail", "post", "leg",
    "box", "step", "end", "top", "back", "bottom", "front", "shelf", "seat",
}

ATTACH = re.compile(
    r"\b(?:attach|set|lay|glue|hang|fasten|pin|fit|mount)\s+(?:the\s+|each\s+|every\s+)?(?:\d+\s+)?(?:both\s+|two\s+)?([A-Za-z][^.,;]{0,48}?)(?=\s+(?:to|onto|into|on|under|with|between|at|from)\b|[.,;]|$)",
    re.I,
)
LETTER = re.compile(r"\b([A-Z]{1,2})\s+([A-Za-z][A-Za-z ]{1,40})")


def singular(word: str) -> str:
    w = word.lower()
    if w.endswith("ves"):
        return w[:-3] + "f"
    if w.endswith("ies"):
        return w[:-3] + "y"
    if w.endswith("s") and len(w) > 3:
        return w[:-1]
    return w


def sentences(text: str):
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text or "") if s.strip()]


def items(text: str):
    t = re.sub(r",\s+and\s+", ", ", text, flags=re.I)
    t = re.sub(r"\s+and\s+", ", ", t, flags=re.I)
    return [x.strip() for x in t.split(",") if x.strip()]


def families(cuts: str, parts: str):
    """letter+family and bare family phrases a step might use."""
    out = []
    for row in (cuts or "").split(";"):
        bits = row.split("|")
        if len(bits) < 3:
            continue
        letter, _qty, name = bits[0], bits[1], bits[2]
        fam = re.sub(r"\s+\d+$", "", name).strip()
        if letter:
            out.append((f"{letter} {fam}".lower(), f"{letter} {fam}"))
            out.append((f"{letter} {singular(fam.split()[-1])}".lower(), f"{letter} {fam}"))
        if fam and singular(fam.split()[-1]) not in STOP:
            out.append((fam.lower(), fam))
    for name in (parts or "").split(";"):
        name = name.strip()
        if name and name.lower() not in STOP:
            out.append((name.lower(), name))
    # longest first so "cubby divider" wins over "divider"
    out.sort(key=lambda x: len(x[0]), reverse=True)
    return out


def attached_at(titles, descriptions, phrases):
    """Earliest step whose verb attaches the phrase. Independent of partsUsed."""
    at = {}
    for i, (title, desc) in enumerate(zip(titles, descriptions)):
        if re.match(r"^(?:confirm|cut|glue up|level|shim|read)\b", title, re.I):
            continue
        blob = f"{title}. {desc}"
        # Join subject only: "attach A Back to", not "edges of A Back".
        for m in re.finditer(r"\battach\s+(?:the\s+)?([A-Z]{1,2})\s+([A-Za-z][A-Za-z ]+?)\s+to\b", blob, re.I):
            key = f"{m.group(1)} {m.group(2)}".lower().rstrip()
            at.setdefault(key, i)
        for m in ATTACH.finditer(blob):
            chunk = m.group(1).strip()
            if re.match(r"^(?:through|the joints|it|them)\b", chunk, re.I):
                continue
            for piece in re.split(r"\s+and\s+", chunk):
                piece = re.sub(r"^(?:the|both|each)\s+", "", piece.strip(), flags=re.I)
                if len(piece) < 3:
                    continue
                words = [singular(w) for w in re.sub(r"[^a-z0-9 ]", " ", piece.lower()).split() if len(singular(w)) > 2]
                if not words:
                    continue
                for key, _shown in phrases:
                    if key in at:
                        continue
                    kwords = [singular(w) for w in key.split() if len(singular(w)) > 2]
                    if kwords and all(w in words for w in kwords):
                        at[key] = i
    return at


def step_of(phrase: str, at: dict, phrases):
    low = re.sub(r"^(?:both|each|all\s+\d+|the)\s+", "", phrase.lower().strip())
    low = re.sub(r"\s+", " ", low)
    headed = re.match(r"^([a-z]{1,2})(?:\s+(.*))?$", low)
    cands = []
    if headed:
        letter, rest = headed.group(1), (headed.group(2) or "").strip()
        words = [singular(w) for w in rest.split() if len(singular(w)) > 2]
        for key, shown in phrases:
            if key != letter and not key.startswith(letter + " "):
                continue
            if words and not all(w in key for w in words):
                continue
            if key in at:
                cands.append((key, at[key], shown))
    else:
        words = [singular(w) for w in re.sub(r"[^a-z0-9 ]", " ", low).split() if len(singular(w)) > 2]
        if not words:
            return None
        for key, shown in phrases:
            if all(w in key for w in words) and key in at:
                cands.append((key, at[key], shown))
    if not cands:
        return None
    cands.sort(key=lambda x: len(x[0]), reverse=True)
    return cands[0]


def screw_sum(descriptions):
    n = 0
    for desc in descriptions:
        if re.search(r"counted in another step's total\.", desc):
            continue
        m = re.search(r"(?:Drive|drives) (\d+) × #8 ", desc)
        if m:
            n += int(m.group(1))
            continue
        for w in re.finditer(r"with (\d+) × #8 ", desc):
            n += int(w.group(1))
    return n


FORMS = [
    ("rests on", re.compile(r"\b(?:rests|set it) on the top of ([^,.;]+)", re.I)),
    ("flush with", re.compile(r"\bflush with the [a-z ]+ of ([^.;]+)", re.I)),
    ("under", re.compile(r"\bunder the front edge of (?:the\s+)?([^,.]{1,48}?)(?=\s+between|[.,]|$)", re.I)),
    ("through", re.compile(r"\b(?:Screw through|Set the joints the stock uses, through|Tape or glue through) ([^.;]+?)(?=\s+into\b|\.|$)", re.I)),
    ("back edges", re.compile(r"\bback edges of ([^.;]+?)\s+with\b", re.I)),
    ("inside face", re.compile(r"\bfrom the inside face of ([^.;]+?)(?=\s+and\s+\d|\.|$)", re.I)),
]


def hits_for(row):
    titles = row.get("titles") or []
    descs = row.get("descriptions") or []
    phrases = families(row.get("cuts") or "", row.get("parts") or "")
    at = attached_at(titles, descs, phrases)
    found = []
    for i, desc in enumerate(descs):
        if re.match(r"^(?:confirm|cut|glue up)\b", titles[i], re.I):
            continue
        for form, cre in FORMS:
            for m in cre.finditer(desc):
                for item in items(m.group(1)):
                    who = step_of(item, at, phrases)
                    if not who:
                        continue
                    if who[1] > i:
                        found.append((form, titles[i], who[2], titles[who[1]]))
    screws = screw_sum(descs)
    buy = int(row.get("buyScrews") or 0)
    text = "\n".join(descs)
    if buy and screws != buy and "#8" in text:
        found.append(("screw sum", "", f"{screws}!={buy}", ""))
    return found


def main():
    path = sys.argv[1]
    counts = Counter()
    plans = 0
    plans_hit = Counter()
    examples = {k: [] for k, _ in FORMS}
    examples["screw sum"] = []
    with open(path) as f:
        for line in f:
            row = json.loads(line)
            if row.get("error"):
                continue
            plans += 1
            seen = set()
            for form, title, part, later in hits_for(row):
                counts[form] += 1
                seen.add(form)
                if len(examples[form]) < 5:
                    examples[form].append(f"{row.get('prompt')} — {title} names {part} before {later}")
            for form in seen:
                plans_hit[form] += 1
    print(f"plans {plans}")
    for form, _ in FORMS + [("screw sum", None)]:
        print(f"{form}\tplans {plans_hit[form]}\thits {counts[form]}")
        for ex in examples[form]:
            print(f"  eg {ex}")


if __name__ == "__main__":
    main()
