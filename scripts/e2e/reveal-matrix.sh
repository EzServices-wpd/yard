for cpu in $CPUS; do while IFS= read -r q; do for w in 390 1440; do for r in 1 2; do
o=$(CPU=$cpu timeout 200 python3 scripts/e2e/reveal-events.py "$q" $w url 2>&1 | tail -1)
python3 - "$cpu" "$q" "$w" "$o" <<'P'
import sys,ast,re
cpu,q,w,o=sys.argv[1:]
try:
  ev=ast.literal_eval(o[o.index('['):o.index('] ..')+1]); ms=re.search(r"ms '?(\w+)",o).group(1)
  wire=next(t for s,t in ev if s.startswith('wire')); done=next((t for s,t in ev if s.startswith(('done','skip'))),None)
  fin=[s for s,t in ev if s.startswith(('done','skip'))][0].split('|')[0]
  steps=[int(s.split('/')[0]) for s,t in ev if re.match(r'^\d+/',s)]
  mono=all(a<=b for a,b in zip(steps,steps[1:]))
  print(f"cpu{cpu} {q[:14]:14} {w:>4} wire->done {done-wire:5}ms ms={ms} steps={len(steps)} mono={mono} end={fin}")
except Exception as e: print("ERR",cpu,q,w,o[-200:])
P
done; done; done <<<"$QS"; done
