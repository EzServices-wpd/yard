# Tasks: 002-live-learning

- [x] T1 Learning banner until the lookup ends (e0f223a)
- [x] T2 Learned recipe kept in localStorage and reused (e0f223a)
- [x] T3 Key by typed noun without stock words (4446e8c, e0f223a)
- [x] T4 Saved recipe skips hint/interpret AI calls (185cde1)
- [ ] T5 Run the 18 acceptance prompts on live; fix what still fails

## T5 live run (e0f223a/185cde1 on yard.wiki, 6 fresh sessions at a time)
14/18 learned in the session (cribbage board was already saved by #5). Misses:
- cornhole board, miter saw station, rain barrel stand: both calls timed out (first cut 105s).
- Adirondack footrest: gate fail at 59s, retry timed out.
- wall-mounted mail organizer: built, but the bot commit raced another proposal (409).
- [x] T6 First lookup call gets up to 145s of the 155s bound
- [x] T7 Recipe bot retries its commit on a 409
