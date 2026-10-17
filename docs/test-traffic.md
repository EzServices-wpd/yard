# Test traffic and the Ideas log

`/api/ideas-log` feeds the real-user query log the nightly sweep reads. Test traffic must never write to it.
The endpoint always answers 204; marked requests are silently dropped (`src/lib/yard/ideaLogGate.ts`).

| Marker | Where | Effect |
|---|---|---|
| `offline=1` or `local=1` in the page URL | client | `logIdea` never sends |
| header `x-yard-test: <anything>` | server | write dropped |
| `?test=1` / `?offline=1` / `?local=1` on the log request URL | server | write dropped |
| Referer query with `offline=1` / `local=1` | server | write dropped |
| `VERCEL_ENV=preview` or `development` | server | every write dropped on preview deploys |

Harnesses (Critic, walks): keep `offline=1` in page URLs and also set
`extra_http_headers={"x-yard-test": "1"}` on the Playwright context; that header rides on sendBeacon/fetch too.
Test: `src/lib/yard/ideaLogGate.test.ts`.
