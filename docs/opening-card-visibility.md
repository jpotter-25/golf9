# Opening-card visibility correction

## Cause and behavior

Opening flips were marked `visibleToUserId`, which made the server's public
snapshot hide them from every other player. The marker survived the transition
into normal turns. Socket updates were arriving, but opponents received card
backs and a lower visible score instead of the two revealed opening cards.

Opening flips, including timer-selected flips, now become public immediately.
The snapshot serializer also ignores stale opening privacy markers in existing
room snapshots. It does not mutate the authoritative room state.

Temporary turn decisions remain private: only the deciding player sees the
hidden grid card being examined before a keep/replace decision. Once committed,
that face-up card is shared. Face-down cards, the draw pile, and another player's
held draw remain masked. This correction does not disable anti-cheating masks.

## Verification

The new regressions failed against the previous implementation and passed after
the correction. Tests cover sequential and simultaneous opening phases, timer
completion, legacy room snapshots, and private decision boundaries.

Real local Socket.IO connections exercise iOS/Android, Android/Android, and
iOS/iOS metadata pairings. Listeners installed before each action verify
unsolicited revision updates, opening flips, draws, private examination, committed
reveals, discard replacement, and reconnect snapshots. These are protocol tests,
not a substitute for physical-device testing.

Verification completed on 2026-10-30:

- Full server suite: 252 passed, zero failures.
- Client tests: 25 passed, zero failures.
- Client lint and typecheck: passed.
- Production web export and `git diff --check`: passed.

## Rollout and device check

This is a server-side correction for online matches. Existing mobile builds
render the corrected server snapshots; no new TestFlight or Google Play package
is required. Verify the pushed commit is active in Railway and both `/health`
and `/health/ready` succeed before reporting the deployment complete.

For the physical-device check, reconnect both apps and start a fresh online
round. Flip one opening card and verify it appears on the other device before
the opening timer finishes. Repeat from the other player, then verify a
committed turn updates both grids. A newly drawn card and an unfinished private
keep/replace preview should still be visible only to the deciding player.
