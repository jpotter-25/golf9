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
Android version code 61, both built from `1db524c98f755ecea62d5a995e2622e1c470ea2c`.
A successful build is not itself confirmation of TestFlight/Google Play availability.

### Verified rollout status

- Railway deployment `bf3f1f55-b339-4e89-a025-2e3c1fe922c7` is Active on the
  source above. Both `/health` and `/health/ready` returned HTTP 200, with
  readiness `true` after activation.
- iOS EAS build `6a99ac65-6314-41c2-acf0-5bc855037d88` finished successfully.
  The downloaded IPA identifies the existing bundle/team, version 0.1.0 (5),
  unchanged minimum iOS and sign-in URL schemes, and Apple sign-in entitlement.
  ZIP integrity, new Ranked copy, and existing native component markers passed
  inspection. These checks do not substitute for cold launch on a physical device.
- iOS submission `e69c95aa-7a46-4d67-9ff7-48370b5e807c` finished successfully.
  Apple build `978fcdaf-4850-4ffe-a44e-666176220c4f` is `VALID`, beta review
  `APPROVED`, and external state `IN_BETA_TESTING`. Build 5 is attached to the
  existing Private Playtesters group with updated testing notes and automatic
  notification enabled. Existing testers, older builds, public link, and reviewer
  contact/credentials were preserved. iPhone users can update in TestFlight.
  The IPA SHA-256 is
  `4008b6200492af1d7520ddb23b61bb411930910fbdd9fec6aeee31449bb3f491`.
- Android EAS build `aa787722-838e-48bb-91f0-99387178183d` finished successfully
  as version 0.1.0, version code 61. The downloaded AAB passed ZIP integrity,
  package identity/new Ranked bundle checks, and its embedded upload certificate
  matches version code 60. It is ready for upload to the Google Play closed-testing
  track; no Play release was created or published by this task.
  The AAB SHA-256 is
  `f77961589519719cc863f2587a76975474861766099cd87229b7bf1838cd3dc5`.

Local artifacts (ignored by Git):

- `artifacts/nine-below-0.1.0-ios-build-5.ipa`
- `artifacts/Nine-Below-Android-0.1.0-version-code-61.aab`

The Android AAB, not an APK, is the file for Play Console. Players install the
approved update through Google Play, while iPhone players update through
TestFlight. Neither app needs to be uninstalled and existing accounts stay intact.

On the updated devices, check season badge containment, enlarged text, ranked
matching with clubmates, automatic room entry, and a complete match/result.
