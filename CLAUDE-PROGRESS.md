LOCK: none

# Claude progress log

Shared log for the Yard bot team. Lives on `release/2026-10-24`. Always pull this branch before reading it.

## Lock

The first line of this file is the push lock. One active pusher at a time.

- Free: `LOCK: none`
- Held: `LOCK: <bot> | item: <short name> | started: <YYYY-MM-DD HH:MM ET> | status: in-progress`

To push: pull `release/2026-10-24` → if the lock is held, wait → otherwise write your lock line, commit and push it → only then start the change. Clear it (back to `LOCK: none`) after the regrade on the new main confirms canaries are still byte-identical.

## Rules

- Only items with an explicit Critic PASS entry below are eligible to push. No entry, no push.
- One at a time: `release/2026-10-24` → squash PR to `main` → merge `main` back. No rebase, no force-push, no direct commits to `main`.
- After each landing, regrade on the new `main` and confirm canaries are byte-identical before the next. On any failure: stop, revert that one, move it to PARKED-IDEAS.
- Anything that raises a price or changes a part size: PR may be opened, never merged until Ezra's explicit yes with the full mover list.
- Hands off Vercel settings and env vars.

## Critic PASS entries

Whoever runs the Critic pastes the short PASS summary here right after the grade.

Format: `- <YYYY-MM-DD> | <item> | PASS | <one-line summary> | moves price/part size: yes/no | verdict: <path or link>`

(none yet)

## Landings

Format: `- <YYYY-MM-DD HH:MM ET> | <item> | PR #<n> | main <sha> | regrade: canaries identical yes/no | by <bot>`

(none yet)
