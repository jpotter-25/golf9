# Public card visibility correction

## Cause and behavior

Opening flips were marked `visibleToUserId`, which made the server's public
snapshot hide them from every other player. The marker survived the transition
into normal turns. Socket updates were arriving, but opponents received card
backs and a lower visible score instead of the two revealed opening cards.

Opening flips, including timer-selected flips, now become public immediately.
The snapshot serializer also ignores stale opening privacy markers in existing
room snapshots. It does not mutate the authoritative room state.

The initial fix covered opening cards only and retained an incorrect private
keep/replace rule. The owner's subsequent screenshots and clarification establish
that a drawn card and a revealed grid card are public immediately, not just when
the turn ends. That mid-turn masking is now removed, including obsolete markers
in an already-running room. Untouched face-down cards and the remaining draw pile
still receive synthetic IDs and masked values.

The server publishes the active player's already-drawn card as `tableHeld`,
including its source (deck/discard). It is display-only and cleared when the card
is committed or the turn/round ends. The existing `viewerHeld*` fields remain
specific to the owner, and server turn/ownership checks are unchanged. The client
uses `tableHeld` only for pile presentation, never to enable the viewer's actions.

## Verification

The new regressions failed against the previous implementation and passed after
the correction. Tests cover sequential and simultaneous opening phases, timer
completion, legacy room snapshots, public mid-turn reveals, and hidden-card boundaries.

Real local Socket.IO connections exercise iOS/Android, Android/Android, and
iOS/iOS metadata pairings, plus three- and four-player mixed-platform tables.
Listeners installed before each action verify unsolicited revision updates,
opening flips, public draws and grid reveals before turn completion, both decision
outcomes, discard replacement/source switching, and mid-decision reconnects.
Opponents still cannot act using the visible held card. These are protocol tests,
not a substitute for physical-device testing.

Verification completed on 2026-10-30:

- Full server suite: 261 passed, zero failures.
- Client tests: 31 passed, zero failures, including real card/grid/pile rendering
  for active and observing players across draw, reveal and completed-turn stages.
- Client lint and typecheck: passed.
- Production web export and `git diff --check`: passed.

## Rollout and device check

The public grid-reveal fix works with existing installed clients after the server
deploys. Showing another player's drawn card in the deck/discard area also needs
the new client: iOS build 6 / Android version code 62. Do not treat the earlier
build 5 / 61 as containing that new presentation code. Deployment and store
availability must be verified separately from successful tests/builds.

For the physical-device check, reconnect both apps and start a fresh online
round. Flip one opening card and verify it appears on the other device before
the opening timer finishes. Repeat from the other player, then verify a
drawn deck card is immediately visible on both devices. Reveal a hidden grid card
and pause before choosing: both players should see its face and the updated visible
score. Test both Keep Revealed and Keep Drawn, switch discard to deck, and reconnect
the observing player during a pending decision. Unflipped cards must remain hidden.
