# Autoplay recovery repair — October 31, 2026

## Report and scope

Flo returned from inactivity without seeing any reclaim-control popup, while Nemo could reclaim normally. Flo's board still advertised manual actions despite showing AUTOPLAY. The old screen had ten independent native modals and placed its only explicit reclaim action inside one of them. The exact native presentation failure on Flo's device has not been reproduced; a modal collision is a plausible explanation, not a proven device trace.

This repair removes the dependency on that popup. It does not change AFK thresholds, penalties, matchmaking, or intentional-forfeit rules.

## Behavior

- An ordinary **Take Back Control** panel stays in the board footer whenever the local player is under recoverable autoplay. It is available during either player's turn, initial peek, and round summaries.
- Open game dialogs also display that recovery panel. All game dialogs share one native modal host with an explicit priority order; the screen no longer presents competing native modals. Background/unfocused screens do not present dialogs, and turn announcements are suppressed during autoplay.
- Manual card actions and instructions no longer pretend the player has control during autoplay. The server acknowledgement restores controls, clears obsolete AI cues, and remains authoritative over separately delivered room summaries.
- Reclaim requests have a ten-second acknowledgement timeout, a duplicate-tap guard, and an inline retry error. Losing connectivity cannot leave the button permanently stuck on “Restoring Control”.
- Intentional forfeits remain permanent. Completed matches and spectators do not offer reclaim.

## Verification

- Full verification: **274 server tests**, **40 client tests**, client lint, client typecheck, and Expo web export passed.
- Client regression tests cover recovery state, stale room summaries, dialog priority, foreground visibility, the non-modal recovery component, disabled/busy and retry states, acknowledgement success/failure/timeout, and screen wiring.
- A real local two-player Socket.IO integration test expires the initial peek for both seats, reconnects the guest, reclaims the waiting seat, and cancels an already queued AI move for the active seat. It verifies a fresh turn deadline, idempotency, both players' manual moves, no overwritten held card, and rejection of a non-seated requester. Starting-player randomization is respected.
- The existing intentional-forfeit test continues to reject reclaim.
- Visual fixture uses the actual recovery component at 320, 375, and 414 pixel widths. This is a browser layout check, not physical iOS/Android validation.

## Mobile rollout and acceptance

This is a bundled client change. A Railway deployment alone cannot repair existing phone installs. New Android and iOS builds must be uploaded to the existing closed-test/TestFlight tracks; this change does not expand the tester audience or enable Facebook on iOS.

After installing the new build on two devices:

1. Join a casual match and leave both players inactive until autoplay starts.
2. Return with one device still connected and the other fully reconnecting. Both must show the footer panel without needing a popup.
3. Reclaim while the other player has the turn, then reclaim the active seat during an AI source/target animation. Verify subsequent manual moves reach both devices and the cancelled AI does not move afterward.
4. Repeat with game chat/settings open and across a round boundary. The recovery panel must remain reachable inside the displayed sheet.
5. Interrupt connectivity during reclaim. Confirm an inline error allows retry, and reconnecting reflects any reclaim the server already accepted.
6. Repeat on iOS/iOS, Android/Android, and iOS/Android. Verify normal turn alerts, offline pass-and-play handoffs, round summaries, and explicit forfeits still behave correctly.

No new mobile build was created or distributed as part of this source-code repair. The phone acceptance checks above remain release checks.
