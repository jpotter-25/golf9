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

### Release evidence

- Runtime change: `970cb8293ffaf5c81e2e7d450b39ee437f149f4b`.
  Follow-up `5b21fa528d56238da7a03a7c3b1d1ae4299248be` explicitly stages the
  three new client test/fixture files excluded by the workspace's sparse-checkout
  rules; it does not change runtime code. Both mobile build archives included
  those tests, confirmed by the public-card regression in their post-install logs.
- Railway deployment `a54ac741-03d6-486e-862f-92770c0867eb` is Active on
  `5b21fa52`; `/health` and `/health/ready` both returned HTTP 200, ready `true`.
- iOS EAS build 6: `2fcd011e-05a5-403c-a213-24ee5167ab30` finished.
  Submission `a055ab66-ff2b-4471-bd63-8550fa285959` finished; Apple build
  `d9533093-c4dd-4ac9-9b51-a526801db8fd` is `VALID`, beta review `APPROVED`,
  and external state `IN_BETA_TESTING`. App Store Connect also visibly shows
  build 6 as Testing in the existing Private Playtesters group. Its public link,
  tester accounts, review contact, and older builds were preserved.
  IPA SHA-256: `d17a527003f7f20519bc6fc44b24f82b2c1caf544604ee4b493cecebe8af911e`.
  Package checks verified ZIP integrity, app/team/version, unchanged sign-in URL
  schemes, native component markers, and the new public-card JavaScript. These
  checks do not constitute physical-device launch or full signature verification.
- Android EAS version code 62: `182634bb-457c-45b1-87e0-0af0c4525a47` finished.
  [Download the AAB](https://expo.dev/artifacts/eas/sfL7G5wxyXLz5TvYNSNsw7ATrnnMshc7cPrOjB9L4mA.aab).
  Downloaded successfully and checked ZIP integrity, bundle structure, package ID,
  the same embedded upload certificate as version 61, and the new public-card
  JavaScript. SHA-256:
  `3cd57bf93d2e3c88a8edd1c33f9637c1f32e3e6001a09bc8cf53aca3397ffaba`.
  Ready for the existing Google Play closed-testing track; not uploaded or
  published to Google Play by this task. Both mobile builds use runtime commit
  `970cb829`; later commits contain test fixtures and release documentation only.

For the physical-device check, reconnect both apps and start a fresh online
round. Flip one opening card and verify it appears on the other device before
the opening timer finishes. Repeat from the other player, then verify a
drawn deck card is immediately visible on both devices. Reveal a hidden grid card
and pause before choosing: both players should see its face and the updated visible
score. Test both Keep Revealed and Keep Drawn, switch discard to deck, and reconnect
the observing player during a pending decision. Unflipped cards must remain hidden.
