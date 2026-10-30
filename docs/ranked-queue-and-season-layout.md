# Ranked queue and season layout — October 30, 2026

## Root causes and approved behavior

The matcher deliberately excluded a second member of an already represented
club. Nemo and Flo both belonged to OWNR, so each remained at 1/2 eligible even
though both were queued. Waiting only expanded the rating range; it never
relaxed that club rule. This was not platform-specific transport failure.

The owner explicitly approved allowing clubmates in Ranked with normal ranked
results. Matching now ignores club membership, while preserving distinct users,
queue order, rating compatibility/expansion, separate table-size queues, human-only
tables, and existing result/forfeit rules. Club membership snapshots and ordinary
ranked/club result credit remain unchanged. No account or rating reset is needed.

Queue responses retain `clubSeparated: false` for installed clients, so the old
club restriction warning disappears without a mobile update. `queuedPlayers`
now reports the queue population rather than duplicating `eligiblePlayers`.
The new client distinguishes these counts and explains rating-range waits.
Diagnostics expose aggregate counts/reasons, not other players' identities or MMR.

The season subtitle and readiness badge previously shared a non-wrapping row
whose text container could not shrink. The subtitle now has a full-width line;
the heading/badge row can wrap and the badge does not shrink. The related Ranked
menu section and queue metric rows also wrap safely. The season name comes from
the server instead of a hard-coded Season 1 label.

## Verification

- All 258 server tests and 28 client tests passed.
- Client lint, typecheck, Expo dependency compatibility, production web export,
  and diff whitespace checks passed.
- Matcher regressions cover same-club 2/3/4-player tables, duplicate prevention,
  queue ordering, unchanged rating expansion and normal result credit.
- HTTP integration verifies real clubmate accounts receive the same normal
  ranked room; iOS/iOS, Android/Android, and mixed platform metadata all match.
- The local-only `node test/previewRanked.cjs` fixture renders real screen/styles
  with synthetic data. Browser bounds checks confirm the complete readiness badge
  stays within its panel at 320/375/414px and simulated 200% text at 320px.
  The Ranked menu's rounds badge is also contained. This is not device testing.
- Dependency installation printed existing npm advisory warnings. Dependencies
  and lockfiles were not upgraded in this gameplay/layout change; this work is
  not a dependency security assessment.

## Distribution and device check

The server rule works with installed mobile builds once the Railway deployment
is active. Cancel any old search, reopen the apps, and have both players enter
the same table-size queue. Similar-rated clubmates can now match normally.

The layout and detailed queue copy require a new native binary: iOS build 5 and
Android version code 61 are reserved in this source change. A successful build
is not itself confirmation of TestFlight/Google Play availability. Record actual
artifact and distribution status after those services verify the release.

On the updated devices, check season badge containment, enlarged text, ranked
matching with clubmates, automatic room entry, and a complete match/result.
