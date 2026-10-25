"""
One canonical per page, in the server HTML: exactly one <link rel="canonical">, an absolute https URL that equals
og:url, and for the workbench its own URL (the ?q= build, or the ?y= share link exactly), never "/".
The first page is the two-canonical /ideas the Growth review found.

  python3 scripts/e2e/canonical.py http://127.0.0.1:8091 [https://yard.wiki]
Exit 1 on any failure. The second argument is the site the canonicals name (default https://yard.wiki).
"""
import re, sys, urllib.request, html as H

U = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://127.0.0.1:8091"
SITE = sys.argv[2].rstrip("/") if len(sys.argv) > 2 else "https://yard.wiki"
# A share token (base64url JSON {"prompt": "bookcase 36 wide 72 tall 12 deep"}), as shareBuild.shareUrl writes it.
Y = "eyJwcm9tcHQiOiJib29rY2FzZSAzNiB3aWRlIDcyIHRhbGwgMTIgZGVlcCJ9"
PAGES = [("/ideas", "/ideas"), ("/", "/"), ("/plans/bookcase", "/plans/bookcase"), ("/about", "/about"), ("/terms", "/terms"),
         ("/privacy", "/privacy"), ("/workspace?q=bookcase+36+wide&test=1", "/workspace?q=bookcase+36+wide"), (f"/workspace?y={Y}", f"/workspace?y={Y}"),
         ("/workspace", "/workspace")]
fails = []
for path, own in PAGES:
    req = urllib.request.Request(U + path, headers={"x-yard-test": "1", "user-agent": "yard-e2e"})
    doc = urllib.request.urlopen(req, timeout=60).read().decode("utf8", "replace")
    head = doc.split("</head>")[0]
    canon = [H.unescape(m) for m in re.findall(r'<link[^>]*rel="canonical"[^>]*href="([^"]*)"', head)]
    og = [H.unescape(m) for m in re.findall(r'<meta[^>]*property="og:url"[^>]*content="([^"]*)"', head)]
    ok = len(canon) == 1 and canon == og and canon[0] == SITE + own
    print(f"{'ok  ' if ok else 'FAIL'} {path}: canonical={canon} og:url={og}")
    if not ok: fails.append(path)
print(f"{len(PAGES) - len(fails)}/{len(PAGES)} pages with one canonical")
sys.exit(1 if fails else 0)
